import { describe, expect, it, vi } from "vitest";
import { assertSameOrigin } from "../lib/server/origin";
import { draftability } from "../lib/server/service";
import { splitName } from "../lib/ui/format";
import type { Group } from "../lib/types";

const req = (headers: Record<string, string>) => new Request("http://localhost:3000/api/runs", { method: "POST", headers });

describe("assertSameOrigin", () => {
  it("accepts JSON from the app's own origin (or with no Origin header)", () => {
    expect(() => assertSameOrigin(req({ "content-type": "application/json", origin: "http://localhost:3000", host: "localhost:3000" }))).not.toThrow();
    expect(() => assertSameOrigin(req({ "content-type": "application/json; charset=utf-8", host: "localhost:3000" }))).not.toThrow();
  });
  it("refuses other sites and non-JSON bodies (cross-site forms)", () => {
    expect(() => assertSameOrigin(req({ "content-type": "application/json", origin: "https://evil.example", host: "localhost:3000" }))).toThrow(/only accepted/);
    expect(() => assertSameOrigin(req({ "content-type": "application/json", origin: "null", host: "localhost:3000" }))).toThrow(/only accepted/);
    expect(() => assertSameOrigin(req({ "content-type": "text/plain", host: "localhost:3000" }))).toThrow(/application\/json/);
  });
});

describe("draftability (same rules as the draft)", () => {
  const reply = (referredName?: string) => ({ referredName }) as Group["replies"][number];
  const group = (key: Group["key"], replies: Group["replies"], eligible = 0): Group =>
    ({ key, label: key, replies, eligible: Array.from({ length: eligible }, (_, i) => ({ contactId: i, email: `${i}@x.com`, threadId: `t${i}` })), excluded: [] }) as Group;
  const done = { steps: { resolve: "done" } } as never;

  it("referrals need enough distinct named people, not just any referral", () => {
    expect(draftability(done, group("referral_wrong_person", [reply("Kurt Huegin")]), 2)).toMatchObject({ ok: false, targets: 1 });
    expect(draftability(done, group("referral_wrong_person", [reply("Kurt Huegin"), reply("kurt huegin")]), 2).ok).toBe(false);
    expect(draftability(done, group("referral_wrong_person", [reply("Kurt Huegin"), reply("Rob Moore")]), 2)).toMatchObject({ ok: true, targets: 2 });
  });
  it("other groups need enough eligible contacts, a follow-up category and a resolved audience", () => {
    expect(draftability(done, group("pricing_request", [], 2), 2).ok).toBe(true);
    expect(draftability(done, group("pricing_request", [], 1), 2).ok).toBe(false);
    expect(draftability(done, group("hard_no", [], 5), 2).ok).toBe(false);
    expect(draftability({ steps: { resolve: "running" } } as never, group("pricing_request", [], 5), 2).ok).toBe(false);
  });
});

describe("splitName", () => {
  it("drops [DEMO]/[SYNTHETIC] but keeps the prefixes that tell look-alike sources apart", () => {
    expect(splitName("[DEMO] Product introduction history")).toEqual({ title: "Product introduction history", tags: [] });
    expect(splitName("[Full copy] Kill Your Tool Stack — Tech SMB Sales v2 - Sequence")).toEqual({ title: "Kill Your Tool Stack — Tech SMB Sales v2", tags: ["Full copy"] });
    expect(splitName("[Hackathon copy] Kill Your Tool Stack — Tech SMB Sales v2 - Sequence").tags).toEqual(["Hackathon copy"]);
  });
});

describe("PR #2 review fixes", () => {
  it("one-line labels keep the tags that tell look-alike sources apart", async () => {
    const { displayName } = await import("../lib/ui/format");
    expect(displayName("[Full copy] Kill Your Tool Stack v2 - Sequence")).toBe("Kill Your Tool Stack v2 · Full copy");
    expect(displayName("[Hackathon copy] Kill Your Tool Stack v2 - Sequence")).toBe("Kill Your Tool Stack v2 · Hackathon copy");
    expect(displayName("[DEMO] Product introduction history")).toBe("Product introduction history");
  });

  it("referral names that differ only in spacing or case are one target, like in the draft", () => {
    const g = {
      key: "referral_wrong_person",
      label: "Referral",
      replies: [{ referredName: "Kurt Huegin" }, { referredName: "Kurt  Huegin" }, { referredName: "kurt huegin" }],
      eligible: [],
      excluded: [],
    } as unknown as Group;
    expect(draftability({ steps: { resolve: "done" } } as never, g, 2)).toMatchObject({ ok: false, targets: 1 });
  });

  it("the same name at two companies is two referral targets (the draft looks names up per company)", () => {
    const g = {
      key: "referral_wrong_person",
      label: "Referral",
      replies: [
        { referredName: "John Smith", company: "Acme" },
        { referredName: "John Smith", company: "Globex" },
        { referredName: "john  smith", company: "acme" },
      ],
      eligible: [],
      excluded: [],
    } as unknown as Group;
    expect(draftability({ steps: { resolve: "done" } } as never, g, 2)).toMatchObject({ ok: true, targets: 2 });
  });

  it("x-forwarded-host is only trusted on Vercel, which overwrites it", () => {
    const forged = { "content-type": "application/json", origin: "https://evil.example", "x-forwarded-host": "evil.example", host: "localhost:3000" };
    expect(() => assertSameOrigin(req(forged))).toThrow(/only accepted/);
    const proxied = { "content-type": "application/json", origin: "https://replyiq.vercel.app", "x-forwarded-host": "replyiq.vercel.app", host: "internal:3000" };
    expect(() => assertSameOrigin(req(proxied))).toThrow(/only accepted/);
    vi.stubEnv("VERCEL", "1");
    try {
      expect(() => assertSameOrigin(req(proxied))).not.toThrow();
      expect(() => assertSameOrigin(req({ ...proxied, origin: "https://evil.example" }))).toThrow(/only accepted/);
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("a configured server that can't reach graph8 is an error, not healthy", async () => {
    const { connectionState } = await import("../lib/ui/connection");
    const base = { configured: true, missing: [], launchEnabled: false, minGroupSize: 2 };
    expect(connectionState(undefined).state).toBe("loading");
    expect(connectionState(undefined, { message: "Can't reach the ReplyIQ server" }).state).toBe("error");
    expect(connectionState({ ...base, configured: false, missing: ["G8_API_KEY"] }).state).toBe("setup");
    expect(connectionState({ ...base, error: "graph8 401 unauthorized" })).toEqual({ state: "error", message: "graph8 401 unauthorized" });
    expect(connectionState({ ...base, write: { allowed: false, reason: "not allowlisted" } })).toEqual({ state: "readonly", message: "not allowlisted" });
    expect(connectionState({ ...base, write: { allowed: true, via: "sandbox", orgId: "o" } }).state).toBe("live");
  });
});

describe("PR #2 re-review fixes", () => {
  it("a failed refetch wins over the last good status the cache keeps", async () => {
    const { connectionState } = await import("../lib/ui/connection");
    const stale = { configured: true, missing: [], launchEnabled: false, minGroupSize: 2, write: { allowed: true as const, via: "sandbox" as const, orgId: "o" } };
    expect(connectionState(stale, { message: "Can't reach the ReplyIQ server" })).toEqual({ state: "error", message: "Can't reach the ReplyIQ server" });
  });
});

describe("E2E review fixes", () => {
  it("Studio documents read as names, not file types", async () => {
    const { docLabel, docList } = await import("../lib/docLabels");
    expect(docList(["messaging_objections", "campaign_brief", "reply_templates"])).toBe("Messaging & Objections, Campaign Brief, Reply Templates");
    expect(docLabel("brand_new_doc")).toBe("brand new doc");
  });
});

describe("ReplyIQ never cites its own text", () => {
  it("withoutOwnSections drops learnings blocks and campaign-doc sections, keeping the company's text", async () => {
    const { withoutOwnSections } = await import("../lib/text");
    const doc = [
      "Company text before.",
      "<!-- replyiq:learnings:camp-1 -->",
      "## Heard in the field",
      "ReplyIQ's words.",
      "<!-- /replyiq:learnings:camp-1 -->",
      "Company text after.",
    ].join("\n");
    expect(withoutOwnSections(doc)).toBe("Company text before.\n\nCompany text after.");
    // Campaign-doc sections run from their marker to the next ReplyIQ marker or the end, as draftCampaign writes them.
    const campaign = "Studio's objections.\n\n<!-- replyiq:run1:pricing_request -->\n## ReplyIQ Answer Card\nour card\n\n<!-- replyiq:run2:hard_no -->\nanother";
    expect(withoutOwnSections(campaign)).toBe("Studio's objections.");
    expect(withoutOwnSections("<!-- replyiq:run1:k -->\nonly ours")).toBe("");
    expect(withoutOwnSections("No markers at all.")).toBe("No markers at all.");
  });
});
