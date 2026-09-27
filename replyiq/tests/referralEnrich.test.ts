import { describe, expect, it } from "vitest";
import { enrichAndRecount, enrichReferrals, type EnrichClient } from "../lib/pipeline/referralEnrich";
import type { Classified, Group } from "../lib/types";

const reply = (id: string, contactEmail: string, company: string, referredName: string): Classified =>
  ({ threadId: id, contactEmail, company, referredName, category: "referral_wrong_person", replyText: "", quote: "", confidence: 1, needsReview: false, conversation: [] }) as unknown as Classified;

const group = (): Group => ({
  key: "referral_wrong_person",
  label: "Referral",
  replies: [
    reply("t1", "john@anm.com", "ANM", "Kurt Huegin"), // real replier domain: no company lookup needed
    reply("t2", "prospect-756@example.com", "PartsSource", "Jeff Evans"), // anonymised replier: company lookup for the domain
    reply("t3", "prospect-1@example.com", "Project44", "Rob Moore"), // already in the CRM: free
    reply("t4", "prospect-2@example.com", "USCellular", "their team leaders"), // not a person
    reply("t5", "prospect-3@example.com", "Nowhere Inc", "Ann Lee"), // company has no domain
  ],
  eligible: [],
  excluded: [],
  referralLookup: { found: 1, named: 4, notes: [] },
});

function fakeClient() {
  const calls: { company: string[]; person: { first_name: string; last_name: string; company_domain: string }[]; created: Record<string, unknown>[] } = { company: [], person: [], created: [] };
  const crm = new Map<string, { id: number; first_name: string; last_name: string; work_email: string }>([["moore|project44", { id: 7, first_name: "Rob", last_name: "Moore", work_email: "rob@project44.com" }]]);
  const client: EnrichClient = {
    searchContacts: async (q) => {
      const hit = crm.get(`${(q.name ?? "").toLowerCase()}|${(q.company_name ?? "").toLowerCase()}`);
      return hit ? [{ ...hit, job_title: null, company_id: null }] : [];
    },
    lookupCompany: async (name) => {
      calls.company.push(name);
      return name === "PartsSource" ? { found: true, data: { domain: "https://www.partssource.com/" } } : { found: false, data: null };
    },
    lookupPerson: async (q) => {
      calls.person.push(q);
      if (q.company_domain === "anm.com") return { found: true, confidence: 0.9, data: { email: "kurt.huegin@anm.com", job_title: "VP Sales" } };
      if (q.company_domain === "partssource.com") return { found: false, data: null };
      return { found: false, data: null };
    },
    createContact: async (body) => {
      calls.created.push(body);
      crm.set(`${body.last_name.toLowerCase()}|anm`, { id: 99, first_name: body.first_name, last_name: body.last_name, work_email: body.work_email });
      return { id: 99, first_name: body.first_name, last_name: body.last_name, work_email: body.work_email, job_title: null, company_id: null };
    },
  };
  return { client, calls };
}

describe("enrichReferrals", () => {
  it("looks up only the named people the CRM lacks, gets the domain from the replier's real email or a company lookup, and adds who it finds", async () => {
    const { client, calls } = fakeClient();
    const out = await enrichReferrals(client, group());
    // Kurt: domain from john@anm.com (no company lookup), found, contact created with the title.
    expect(calls.person).toContainEqual({ first_name: "Kurt", last_name: "Huegin", company_domain: "anm.com" });
    expect(calls.created).toEqual([{ first_name: "Kurt", last_name: "Huegin", work_email: "kurt.huegin@anm.com", company_domain: "anm.com", job_title: "VP Sales" }]);
    // Jeff: anonymised replier -> company lookup -> domain normalised -> person not found.
    expect(calls.company).toEqual(["PartsSource", "Nowhere Inc"]);
    expect(calls.person).toContainEqual({ first_name: "Jeff", last_name: "Evans", company_domain: "partssource.com" });
    // Rob is in the CRM already: no paid call for him. "their team leaders" is not a person.
    expect(calls.person.some((p) => p.last_name === "Moore")).toBe(false);
    expect(out.created).toEqual([{ name: "Kurt Huegin", email: "kurt.huegin@anm.com", company: "ANM" }]);
    expect(out.lookups).toBe(4); // Kurt person, PartsSource company, Jeff person, Nowhere company
    expect(out.notes).toEqual([
      "Kurt Huegin (ANM): found and added to the CRM",
      "Jeff Evans (PartsSource): not found by graph8's lookup at partssource.com",
      "Rob Moore (Project44): already in the CRM",
      "Ann Lee (Nowhere Inc): graph8 has no domain for this company, so the person can't be looked up",
    ]);
  });

  it("a failing lookup is a note, not a crash, and the next name is still tried", async () => {
    const { client, calls } = fakeClient();
    client.lookupPerson = async (q) => {
      calls.person.push(q);
      if (q.last_name === "Huegin") throw new Error("provider down");
      return { found: false, data: null };
    };
    const out = await enrichReferrals(client, group());
    expect(out.created).toEqual([]);
    expect(out.notes[0]).toMatch(/Kurt Huegin \(ANM\): lookup failed \(provider down\)/);
    expect(calls.person.length).toBeGreaterThan(1);
  });

  it("enrichAndRecount stores the new CRM count on the group, so the draft can proceed", async () => {
    const { client } = fakeClient();
    const g = group();
    await enrichAndRecount(client, g);
    expect(g.referralLookup?.found).toBe(2); // Rob (already there) + Kurt (added)
    expect(g.referralLookup?.named).toBe(4);
    expect(g.referralLookup?.created).toBe(1);
    expect(g.referralLookup?.enrichedAt).toBeTruthy();
  });
});
