// M3b: decide who may get a follow-up campaign. Fails closed at every step.
// Excluded, in this order of precedence:
//   hard_no / unsubscribe      - said so in this thread
//   hard_stop_elsewhere        - the same contact said no / unsubscribe in ANY other thread of the run
//   not_found                  - no graph8 contact (by id from the inbox, else by email lookup)
//   suppression_unknown        - the suppression check failed: never assume "not suppressed"
//   suppressed                 - on graph8's suppression ledger (any channel)
//   no_followup_category       - meeting booked, meeting request (goes to a rep), needs review
// Everyone else in a follow-up category is eligible (deduped per group by contact).
import type { G8Client } from "../g8";
import { allowsFollowUpCampaign, isHardStop } from "../taxonomy";
import type { Classified, ExclusionReason, Group } from "../types";

const CONCURRENCY = 4;

type ResolveClient = Pick<G8Client, "findContactByEmail" | "getSuppression">;

export interface ResolveOutcome {
  groups: Group[];
  eligible: number;
  excluded: Partial<Record<ExclusionReason, number>>;
  warnings: string[];
}

async function mapLimit<T>(items: T[], limit: number, fn: (x: T) => Promise<void>) {
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) await fn(items[next++]);
  }));
}

export async function resolveContacts(client: ResolveClient, groups: Group[], opts: { concurrency?: number } = {}): Promise<ResolveOutcome> {
  const warnings: string[] = [];
  const replies = groups.flatMap((g) => g.replies);
  const limit = opts.concurrency ?? CONCURRENCY;

  // 1) Contact id per reply: from the inbox, else one lookup per email.
  const byEmail = new Map<string, number | null>();
  const needLookup = [...new Set(replies.filter((r) => !r.contactId && r.contactEmail).map((r) => r.contactEmail.toLowerCase()))];
  await mapLimit(needLookup, limit, async (email) => {
    try {
      byEmail.set(email, (await client.findContactByEmail(email))?.id ?? null);
    } catch (err) {
      byEmail.set(email, null);
      warnings.push(`contact lookup failed for ${email}: ${err instanceof Error ? err.message : String(err)}`);
    }
  });
  const contactOf = (r: Classified) => r.contactId ?? (r.contactEmail ? byEmail.get(r.contactEmail.toLowerCase()) ?? null : null);

  // 2) Suppression per contact (once each). undefined = check failed.
  const suppression = new Map<number, boolean | undefined>();
  const ids = [...new Set(replies.map(contactOf).filter((x): x is number => typeof x === "number"))];
  await mapLimit(ids, limit, async (id) => {
    try {
      const s = await client.getSuppression(id);
      suppression.set(id, s.is_suppressed === true || (s.active_channels ?? []).length > 0);
    } catch (err) {
      suppression.set(id, undefined);
      warnings.push(`suppression check failed for contact ${id}: ${err instanceof Error ? err.message : String(err)}`);
    }
  });

  // 3) Hard stops win everywhere: collect contacts / emails that said no in any thread.
  const stoppedIds = new Set<number>();
  const stoppedEmails = new Set<string>();
  for (const r of replies) {
    if (!isHardStop(r.category)) continue;
    const id = contactOf(r);
    if (id) stoppedIds.add(id);
    if (r.contactEmail) stoppedEmails.add(r.contactEmail.toLowerCase());
  }

  const excludedCount: Partial<Record<ExclusionReason, number>> = {};
  let eligibleCount = 0;
  const out = groups.map((g) => {
    const eligible: Group["eligible"] = [];
    const excluded: Group["excluded"] = [];
    const seen = new Set<number>();
    for (const r of g.replies) {
      const contactId = contactOf(r) ?? undefined;
      const email = r.contactEmail;
      let reason: ExclusionReason | null = null;
      if (isHardStop(r.category)) reason = r.category as ExclusionReason;
      else if ((contactId && stoppedIds.has(contactId)) || (email && stoppedEmails.has(email.toLowerCase()))) reason = "hard_stop_elsewhere";
      else if (!contactId) reason = "not_found";
      else if (suppression.get(contactId) === undefined) reason = "suppression_unknown";
      else if (suppression.get(contactId)) reason = "suppressed";
      else if (!allowsFollowUpCampaign(r.category)) reason = "no_followup_category";

      if (reason) {
        excluded.push({ email, reason, threadId: r.threadId, ...(contactId ? { contactId } : {}) });
        excludedCount[reason] = (excludedCount[reason] ?? 0) + 1;
      } else if (!seen.has(contactId!)) {
        seen.add(contactId!);
        eligible.push({ contactId: contactId!, email, threadId: r.threadId });
        eligibleCount++;
      }
    }
    return { ...g, eligible, excluded };
  });

  return { groups: out, eligible: eligibleCount, excluded: excludedCount, warnings };
}
