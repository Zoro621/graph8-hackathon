import { describe, expect, it } from "vitest";
import { resolveContacts } from "../lib/pipeline/resolveContacts";
import type { Category, Classified, Group } from "../lib/types";
import { reply } from "./helpers";

const cl = (id: string, category: Category, contactId: number | undefined, email = `${id}@example.com`): Classified => ({
  ...reply(id, `reply ${id}`, { contactId, contactEmail: email }),
  category,
  confidence: 0.9,
  quote: `reply ${id}`,
  needsReview: false,
});
const grp = (key: Category, replies: Classified[]): Group => ({ key, label: key, replies, eligible: [], excluded: [] });

function fakeClient(opts: { suppressed?: number[]; channelOnly?: number[]; failSuppression?: number[]; lookup?: Record<string, number>; failLookup?: boolean } = {}) {
  const calls = { suppression: [] as number[], lookup: [] as string[] };
  return {
    calls,
    client: {
      findContactByEmail: async (email: string) => {
        calls.lookup.push(email);
        if (opts.failLookup) throw new Error("search down");
        const id = opts.lookup?.[email];
        return id ? { id, first_name: null, last_name: null, work_email: email, job_title: null, company_id: null } : null;
      },
      getSuppression: async (id: number) => {
        calls.suppression.push(id);
        if (opts.failSuppression?.includes(id)) throw new Error("ledger down");
        return {
          contact_id: id,
          is_suppressed: opts.suppressed?.includes(id) ?? false,
          active_channels: opts.channelOnly?.includes(id) ? ["sms"] : [],
          suppressions: [],
        };
      },
    },
  };
}

const reasons = (g: Group) => Object.fromEntries(g.excluded.map((e) => [e.threadId, e.reason]));

describe("resolveContacts", () => {
  it("applies every rule in order", async () => {
    const { client } = fakeClient({ suppressed: [5] });
    const res = await resolveContacts(client, [
      grp("hard_no", [cl("no", "hard_no", 1)]),
      grp("unsubscribe", [cl("unsub", "unsubscribe", 2)]),
      grp("pricing_request", [cl("ok", "pricing_request", 3), cl("missing", "pricing_request", undefined), cl("supp", "pricing_request", 5)]),
      grp("meeting_booked", [cl("mtg", "meeting_booked", 6)]),
      grp("other", [cl("review", "other", 7)]),
    ]);
    const [no, unsub, price, mtg, other] = res.groups;
    expect(reasons(no)).toEqual({ no: "hard_no" });
    expect(reasons(unsub)).toEqual({ unsub: "unsubscribe" });
    expect(price.eligible).toEqual([{ contactId: 3, email: "ok@example.com", threadId: "ok" }]);
    expect(reasons(price)).toEqual({ missing: "not_found", supp: "suppressed" });
    expect(reasons(mtg)).toEqual({ mtg: "no_followup_category" });
    expect(reasons(other)).toEqual({ review: "no_followup_category" });
    expect(res.eligible).toBe(1);
    expect(res.excluded).toEqual({ hard_no: 1, unsubscribe: 1, not_found: 1, suppressed: 1, no_followup_category: 2 });
  });

  it("a hard stop in one thread excludes the same contact everywhere (by id or email)", async () => {
    const { client } = fakeClient();
    const res = await resolveContacts(client, [
      grp("unsubscribe", [cl("u", "unsubscribe", 9, "dana@example.com")]),
      grp("pricing_request", [cl("p", "pricing_request", 9, "dana@example.com")]),
      grp("out_of_office", [cl("o", "out_of_office", 10, "DANA@example.com")]), // different id, same email
    ]);
    expect(res.groups[1].eligible).toEqual([]);
    expect(reasons(res.groups[1])).toEqual({ p: "hard_stop_elsewhere" });
    expect(reasons(res.groups[2])).toEqual({ o: "hard_stop_elsewhere" });
  });

  it("fails closed when the suppression check errors", async () => {
    const { client } = fakeClient({ failSuppression: [3] });
    const res = await resolveContacts(client, [grp("pricing_request", [cl("p", "pricing_request", 3)])]);
    expect(res.groups[0].eligible).toEqual([]);
    expect(reasons(res.groups[0])).toEqual({ p: "suppression_unknown" });
    expect(res.warnings.join()).toMatch(/suppression check failed/);
  });

  it("treats suppression on any channel as suppressed (conservative)", async () => {
    const { client } = fakeClient({ channelOnly: [3] });
    const res = await resolveContacts(client, [grp("pricing_request", [cl("p", "pricing_request", 3)])]);
    expect(reasons(res.groups[0])).toEqual({ p: "suppressed" });
  });

  it("looks up contacts by email only when the inbox gave no id, once per email", async () => {
    const { client, calls } = fakeClient({ lookup: { "x@example.com": 42 } });
    const res = await resolveContacts(client, [
      grp("pricing_request", [cl("a", "pricing_request", undefined, "x@example.com"), cl("b", "pricing_request", 7)]),
      grp("no_need", [cl("c", "no_need", undefined, "X@example.com")]),
    ]);
    expect(calls.lookup).toEqual(["x@example.com"]);
    expect(res.groups[0].eligible.map((e) => e.contactId).sort()).toEqual([42, 7]);
    expect(res.groups[1].eligible[0].contactId).toBe(42);
  });

  it("a failed lookup means not_found (never guessed)", async () => {
    const { client } = fakeClient({ failLookup: true });
    const res = await resolveContacts(client, [grp("pricing_request", [cl("a", "pricing_request", undefined)])]);
    expect(reasons(res.groups[0])).toEqual({ a: "not_found" });
    expect(res.warnings.join()).toMatch(/lookup failed/);
  });

  it("checks suppression once per contact and dedupes a contact within a group", async () => {
    const { client, calls } = fakeClient();
    const res = await resolveContacts(client, [grp("out_of_office", [cl("a", "out_of_office", 5), cl("b", "out_of_office", 5)])]);
    expect(calls.suppression).toEqual([5]);
    expect(res.groups[0].eligible).toHaveLength(1);
  });

  it("every reply is accounted for: eligible or excluded (except in-group duplicates)", async () => {
    const { client } = fakeClient({ suppressed: [2] });
    const groups = [grp("referral_wrong_person", [cl("a", "referral_wrong_person", 1), cl("b", "referral_wrong_person", 2), cl("c", "referral_wrong_person", undefined)])];
    const res = await resolveContacts(client, groups);
    const g = res.groups[0];
    expect(g.eligible.length + g.excluded.length).toBe(3);
  });
});
