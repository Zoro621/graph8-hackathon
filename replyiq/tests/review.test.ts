import { describe, expect, it } from "vitest";
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
