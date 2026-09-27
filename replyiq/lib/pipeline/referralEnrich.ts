// Referral follow-ups go to the people the replies name ("reach out to Kurt Huegin"). The run already searches
// graph8's CRM for them (free). This step handles the ones who are not there yet, after a person approved it:
//   company name -> POST /enrichment/lookup/company (domain) -> POST /enrichment/lookup/person (work email)
//   -> POST /contacts. Each lookup costs about 1-2 credits; nothing is added to a list here (the draft does that,
// after its own hard-stop and suppression checks). The person who left is never contacted.
import type { G8Client } from "../g8";
import { describeError } from "../g8";
import type { Group } from "../types";
import { nameKey, parsePersonNames, referralTargets, sameName } from "./draftCampaign";

export type EnrichClient = Pick<G8Client, "searchContacts" | "lookupCompany" | "lookupPerson" | "createContact">;

export interface EnrichOutcome {
  created: { name: string; email: string; company: string }[];
  notes: string[];
  lookups: number; // paid calls made
}

const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined);
const emailOf = (d: Record<string, unknown> | null | undefined) => str(d?.work_email) ?? str(d?.email) ?? str(d?.business_email);
const domainOf = (d: Record<string, unknown> | null | undefined) =>
  (str(d?.domain) ?? str(d?.website) ?? str(d?.company_domain))?.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0].toLowerCase();
const isPlaceholderDomain = (domain: string) => /(^|\.)example\.(com|org|net)$|\s/.test(domain);

/** The replier's own email domain, when it is a real one: colleagues share it. */
function domainFromReply(email: string | undefined): string | undefined {
  const d = email?.split("@")[1]?.toLowerCase();
  return d && !isPlaceholderDomain(d) ? d : undefined;
}

/**
 * Looks up and adds to the CRM every named person the free search could not find. Returns what it created and a
 * note per name. Never throws for one name: a failed lookup is a note, the next name is still tried.
 */
export async function enrichReferrals(g8: EnrichClient, group: Group, log: (m: string) => void = () => {}): Promise<EnrichOutcome> {
  const out: EnrichOutcome = { created: [], notes: [], lookups: 0 };
  const domains = new Map<string, string | null>(); // company name -> domain (null = not found)
  const done = new Set<string>();

  for (const r of group.replies) {
    const names = parsePersonNames(r.referredName);
    const company = r.company?.trim();
    if (names.length === 0) continue;
    if (!company) {
      out.notes.push(`${names.join(" and ")}: no company on the reply, so no domain to look them up with`);
      continue;
    }
    for (const name of names) {
      const key = `${nameKey(name)}|${nameKey(company)}`;
      if (done.has(key)) continue;
      done.add(key);
      const parts = name.split(/\s+/);
      if (parts.length < 2) {
        out.notes.push(`${name} (${company}): first and last name needed for a lookup`);
        continue;
      }
      const first_name = parts[0];
      const last_name = parts.slice(1).join(" ");

      // Already in the CRM? Then nothing to pay for.
      try {
        const hits = (await g8.searchContacts({ name: last_name, company_name: company })).filter((c) => c.id && sameName(`${c.first_name ?? ""} ${c.last_name ?? ""}`, name));
        if (hits.length === 1 && hits[0].work_email) {
          out.notes.push(`${name} (${company}): already in the CRM`);
          continue;
        }
      } catch {
        // fall through to the lookup
      }

      // Domain: the replier's real email domain, else a paid company lookup by name (cached per company).
      let domain = domainFromReply(r.contactEmail);
      if (!domain) {
        if (!domains.has(nameKey(company))) {
          try {
            out.lookups++;
            const res = await g8.lookupCompany(company);
            domains.set(nameKey(company), (res?.found && domainOf(res.data)) || null);
          } catch (err) {
            domains.set(nameKey(company), null);
            out.notes.push(`${company}: company lookup failed (${describeError(err)})`);
          }
        }
        domain = domains.get(nameKey(company)) ?? undefined;
      }
      if (!domain) {
        out.notes.push(`${name} (${company}): graph8 has no domain for this company, so the person can't be looked up`);
        continue;
      }

      try {
        out.lookups++;
        const res = await g8.lookupPerson({ first_name, last_name, company_domain: domain });
        const email = res?.found ? emailOf(res.data) : undefined;
        if (!email) {
          out.notes.push(`${name} (${company}): not found by graph8's lookup at ${domain}`);
          continue;
        }
        await g8.createContact({ first_name, last_name, work_email: email, company_domain: domain, ...(str(res.data?.job_title) ? { job_title: str(res.data?.job_title) } : {}), ...(str(res.data?.linkedin_url) ? { linkedin_url: str(res.data?.linkedin_url) } : {}) });
        out.created.push({ name, email, company });
        out.notes.push(`${name} (${company}): found and added to the CRM`);
        log(`  referral: ${name} found at ${domain}, contact created`);
      } catch (err) {
        out.notes.push(`${name} (${company}): lookup failed (${describeError(err)})`);
      }
    }
  }
  return out;
}

/** Runs the enrichment, then re-counts who the draft can reach, and stores both on the group. */
export async function enrichAndRecount(g8: EnrichClient, group: Group, log?: (m: string) => void): Promise<EnrichOutcome> {
  const result = await enrichReferrals(g8, group, log);
  const named = group.referralLookup?.named ?? new Set(group.replies.flatMap((r) => parsePersonNames(r.referredName).map((n) => `${nameKey(n)}|${nameKey(r.company ?? "")}`))).size;
  const { found } = await referralTargets(g8, group);
  group.referralLookup = { found: found.length, named, notes: result.notes, enrichedAt: new Date().toISOString(), created: result.created.length };
  return result;
}
