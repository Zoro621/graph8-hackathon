import { G8Error } from "@graph8/sdk";
import { describe, expect, it, vi } from "vitest";
import { createG8Client, describeError, fromSearchItem, normaliseTagList, toStudioDoc, WriteNotAllowedError } from "../lib/g8";

type Route = (url: URL, init: RequestInit) => Response | Promise<Response>;

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });

/** A fake fetch: first matching "METHOD /path" wins; records every call. */
function fakeFetch(routes: Record<string, Route>) {
  const calls: { method: string; path: string; url: URL; body?: unknown }[] = [];
  const impl = vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = new URL(String(input));
    const method = (init.method ?? "GET").toUpperCase();
    const path = url.pathname.replace(/^\/api\/v1/, "");
    calls.push({ method, path, url, body: init.body ? JSON.parse(String(init.body)) : undefined });
    const route = routes[`${method} ${path}`];
    if (!route) return json({ detail: `no route for ${method} ${path}` }, 404);
    return route(url, init);
  });
  return { impl: impl as unknown as typeof fetch, calls };
}

const client = (routes: Record<string, Route>, extra: Partial<Parameters<typeof createG8Client>[0]> = {}) => {
  const f = fakeFetch(routes);
  const sleeps: number[] = [];
  const c = createG8Client({
    base: "https://be.graph8.test/api/v1",
    apiKey: "test-key",
    fetchImpl: f.impl,
    sleepImpl: async (ms) => void sleeps.push(ms),
    ...extra,
  });
  return { c, calls: f.calls, sleeps };
};

describe("HTTP core", () => {
  it("unwraps {data} and sends the bearer key", async () => {
    let auth = "";
    const { c } = client({
      "GET /sequences/s1": (_u, init) => {
        auth = new Headers(init.headers).get("authorization") ?? "";
        return json({ data: { id: "s1", name: "Seq" } });
      },
    });
    expect((await c.getSequence("s1")).name).toBe("Seq");
    expect(auth).toBe("Bearer test-key");
  });

  it("retries a 429 honouring Retry-After, then succeeds", async () => {
    let n = 0;
    const { c, sleeps } = client({
      "GET /sequences/s1": () => (++n === 1 ? json({ detail: "slow down" }, 429, { "retry-after": "2" }) : json({ data: { id: "s1" } })),
    });
    await c.getSequence("s1");
    expect(n).toBe(2);
    expect(sleeps).toEqual([2000]);
  });

  it("does not retry a 4xx and surfaces a readable error", async () => {
    let n = 0;
    const { c } = client({
      "GET /sequences/bad": () => {
        n++;
        return json({ detail: "Sequence not found" }, 404, { "x-request-id": "req_1" });
      },
    });
    const err = await c.getSequence("bad").catch((e) => e);
    expect(n).toBe(1);
    expect(err).toBeInstanceOf(G8Error);
    expect(describeError(err)).toMatch(/404.*Sequence not found.*req_1/);
  });

  it("gives up after 2 retries on repeated 5xx", async () => {
    let n = 0;
    const { c } = client({ "GET /sequences/s1": () => (n++, json({ detail: "boom" }, 503)) });
    await expect(c.getSequence("s1")).rejects.toBeInstanceOf(G8Error);
    expect(n).toBe(3);
  });

  it("follows pagination on list endpoints", async () => {
    const { c, calls } = client({
      "GET /sequences": (u) =>
        u.searchParams.get("page") === "1"
          ? json({ data: [{ id: "a" }], pagination: { has_next: true } })
          : json({ data: [{ id: "b" }], pagination: { has_next: false } }),
    });
    expect((await c.listSequences()).map((s) => s.id)).toEqual(["a", "b"]);
    expect(calls.filter((x) => x.path === "/sequences")).toHaveLength(2);
  });
});

describe("write policy (fails closed)", () => {
  const notSandbox = () => json({ detail: "This endpoint is available only in the graph8 developer sandbox environment." }, 404);
  const me = (org = "org_live") => () => json({ data: { org_id: org, role: "admin" } });

  it("allows writes when /sandbox/status says sandbox", async () => {
    const { c } = client({ "GET /sandbox/status": () => json({ data: { sandbox: true, environment: "sandbox", org_id: "org_sb" } }) });
    await expect(c.assertWriteAllowed()).resolves.toMatchObject({ allowed: true, via: "sandbox", orgId: "org_sb" });
  });

  it("refuses writes off-sandbox when the allowlist is empty", async () => {
    const { c } = client({ "GET /sandbox/status": notSandbox, "GET /roles/me/permissions": me() });
    await expect(c.assertWriteAllowed()).rejects.toBeInstanceOf(WriteNotAllowedError);
  });

  it("refuses writes when the key's org is not in the allowlist", async () => {
    const { c } = client({ "GET /sandbox/status": notSandbox, "GET /roles/me/permissions": me("org_other") }, { writeOrgIds: ["org_live"] });
    await expect(c.assertWriteAllowed()).rejects.toThrow(/not in the write allowlist/);
  });

  it("allows writes only when the key's org is allowlisted", async () => {
    const { c } = client({ "GET /sandbox/status": notSandbox, "GET /roles/me/permissions": me("org_live") }, { writeOrgIds: ["org_live"] });
    await expect(c.assertWriteAllowed()).resolves.toMatchObject({ allowed: true, via: "org_allowlist" });
  });

  it("the shipped allowlist is exactly the confirmed hackathon sandbox org", async () => {
    const { SANDBOX_ORG_IDS } = await import("../lib/config");
    expect(SANDBOX_ORG_IDS).toEqual(["org_87325c23062e"]);
  });

  it("an allowed write is sent with an idempotency key", async () => {
    let idem = "";
    const { c } = client(
      {
        "GET /sandbox/status": notSandbox,
        "GET /roles/me/permissions": me("org_live"),
        "POST /inbox/tags": (_u, init) => {
          idem = new Headers(init.headers).get("idempotency-key") ?? "";
          return json({ data: {} }, 201);
        },
      },
      { writeOrgIds: ["org_live"] },
    );
    await c.write("POST", "/inbox/tags", { name: "x" }, "run1:tag:x");
    expect(idem).toBe("run1:tag:x");
  });

  it("a refused write never reaches the network", async () => {
    const { c, calls } = client({ "GET /sandbox/status": notSandbox, "GET /roles/me/permissions": me() });
    await expect(c.write("POST", "/inbox/tags", { name: "x" })).rejects.toBeInstanceOf(WriteNotAllowedError);
    expect(calls.some((x) => x.method === "POST")).toBe(false);
  });

  it("does not treat other sandbox errors as 'not sandbox'", async () => {
    const { c } = client({ "GET /sandbox/status": () => json({ detail: "forbidden" }, 403) });
    await expect(c.writePolicy()).rejects.toBeInstanceOf(G8Error);
  });
});

describe("listThreads", () => {
  const searchItem = (id: string, mailbox: string, seq: string) => ({
    id,
    mailbox,
    subject: `Re: ${id}`,
    campaign_id: seq,
    campaign_name: "Seq",
    contact: { id: 42, email: "P@Example.com", first_name: "Pat", last_name: "Lee", company_name: "Acme" },
    messages: { messages: [{ responder: "OTHER", content: "hi", from_email: ["p@example.com"], to: [], date: "2026-09-24T10:00:00Z", draft: false }] },
    tags: [{ id: "t1", name: "Interested" }],
  });

  it("searches one mailbox per call and merges with GET /inbox, deduped", async () => {
    const { c, calls } = client({
      "GET /inbox/mailboxes/all": () => json({ data: { items: [{ email: "a@example.com" }, { email: "b@example.com" }] } }),
      "POST /inbox/emails/search": (_u, init) => {
        const body = JSON.parse(String(init.body));
        const mb = body.mailboxes[0];
        const items = mb === "a@example.com" ? [searchItem("t-1", mb, "seq1"), searchItem("t-2", mb, "seq1")] : [];
        return json({ data: { items, total: items.length } });
      },
      "GET /inbox": () => json({ data: [{ id: "t-2", messages: [] }, { id: "t-3", messages: [] }], pagination: { has_next: false } }),
    });
    const threads = await c.listThreads("seq1");
    expect(threads.map((t) => t.id).sort()).toEqual(["t-1", "t-2", "t-3"]);
    const searches = calls.filter((x) => x.path === "/inbox/emails/search");
    expect(searches.map((x) => (x.body as { mailboxes: string[] }).mailboxes)).toEqual([["a@example.com"], ["b@example.com"]]);
    expect(threads.find((t) => t.id === "t-2")?.source).toBe("emails.search"); // search result wins
  });

  it("drops threads that belong to a different sequence", async () => {
    const { c } = client({
      "GET /inbox/mailboxes/all": () => json({ data: { items: [{ email: "a@example.com" }] } }),
      "POST /inbox/emails/search": () => json({ data: { items: [searchItem("t-9", "a@example.com", "other")], total: 1 } }),
      "GET /inbox": () => json({ data: [], pagination: { has_next: false } }),
    });
    expect(await c.listThreads("seq1")).toEqual([]);
  });
});

describe("M5 writes", () => {
  const allowed = { "GET /sandbox/status": () => json({ data: { sandbox: true, environment: "sandbox", org_id: "o" } }) };

  it("adding contacts retries a 409 conflict with skip_all (never add_all)", async () => {
    const bodies: unknown[] = [];
    const { c } = client({
      ...allowed,
      "POST /lists/7/contacts": (_u, init) => {
        const body = JSON.parse(String(init.body));
        bodies.push(body);
        return body.conflict_resolution ? json({ data: { added: 1 } }) : json({ detail: { code: "CONFLICT_REVIEW_REQUIRED" } }, 409);
      },
    });
    const res = await c.addContactsToList(7, [1, 2]);
    expect(res.conflictSkipped).toBe(true);
    expect(bodies).toEqual([{ contact_ids: [1, 2] }, { contact_ids: [1, 2], conflict_resolution: "skip_all" }]);
  });

  it("other list errors are not swallowed", async () => {
    const { c } = client({ ...allowed, "POST /lists/7/contacts": () => json({ detail: "bad" }, 400) });
    await expect(c.addContactsToList(7, [1])).rejects.toBeInstanceOf(G8Error);
  });

  it("creates lists and campaigns with the idempotency key, only when writes are allowed", async () => {
    const keys: string[] = [];
    const { c } = client({
      ...allowed,
      "POST /lists": (_u, init) => (keys.push(new Headers(init.headers).get("idempotency-key") ?? ""), json({ data: { id: 5, title: "t" } }, 201)),
      "POST /campaigns": (_u, init) => (keys.push(new Headers(init.headers).get("idempotency-key") ?? ""), json({ data: { id: "camp", status: "copy_in_progress" } })),
    });
    expect((await c.createList("t", "d", "k-list"))?.id).toBe(5);
    expect((await c.createCampaign({ name: "n" }, "k-camp"))?.id).toBe("camp");
    expect(keys).toEqual(["k-list", "k-camp"]);
  });
});

describe("Studio campaign readers", () => {
  it("reads the full campaign and metrics with the requested window", async () => {
    let days = "";
    const { c } = client({
      "GET /campaigns/c1/full": () =>
        json({ data: { id: "c1", name: "Ref", status: "paused", linked_sequences: [{ sequence_id: "s1" }], documents: [{ id: "d1", file_type: "messaging_objections", meta_data: { content: "angles" } }] } }),
      "GET /campaigns/c1/metrics": (u) => {
        days = u.searchParams.get("days") ?? "";
        return json({ data: { campaign_id: "c1", metric_status: "unknown", email_metrics: null, send_receipts: { succeeded: 2212 } } });
      },
    });
    const full = await c.getCampaignFull("c1");
    expect(full.linked_sequences?.[0].sequence_id).toBe("s1");
    const { docText } = await import("../lib/g8");
    expect(docText(full.documents?.[0])).toBe("angles");
    const m = await c.getCampaignMetrics("c1", 365);
    expect(days).toBe("365");
    expect(m.metric_status).toBe("unknown");
  });
});

describe("normalisers", () => {
  it("maps an emails/search item", () => {
    const t = fromSearchItem({
      id: "x",
      campaign_id: "s",
      contact: { id: "7", email: "A@Example.com", first_name: "A", last_name: "B", company_name: "Co" },
      messages: { messages: [{ responder: "USER", content: "", html_content: "<p>hi</p>", from_email: ["me@example.com"], draft: false }] },
      tags: [{ id: 1, name: "T" }, { name: "no id" }],
    });
    expect(t.contact).toEqual({ id: 7, email: "a@example.com", name: "A B", company: "Co" });
    expect(t.messages[0]).toMatchObject({ content: "<p>hi</p>", from: "me@example.com", responder: "USER" });
    expect(t.tags).toEqual([{ id: "1", name: "T" }]);
  });

  it("accepts the tag list as array or wrapped", () => {
    expect(normaliseTagList([{ id: "1", name: "A" }])).toHaveLength(1);
    expect(normaliseTagList({ tags: [{ tag_id: "2", tag_name: "B" }] })[0]).toMatchObject({ id: "2", name: "B" });
    expect(normaliseTagList({ nothing: true })).toEqual([]);
  });

  it("reads Studio doc content from meta_data when top-level content is missing", () => {
    expect(toStudioDoc({ id: 1, display_name: "Proof Catalog", meta_data: { content: "proof" } })).toMatchObject({
      id: "1",
      displayName: "Proof Catalog",
      content: "proof",
    });
  });
});
