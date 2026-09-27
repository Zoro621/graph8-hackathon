// What happened on graph8's other Engage channels, for a run's source and the contacts who replied. Read-only.
//   sequencer  -> how far each source sequence got: reached, replied, bounced, meetings (sequence report)
//   dialer     -> each replying contact's latest call outcome; "not interested" / "do not call" are hard stops
//                 across channels, "booked" means no follow-up is needed
//   meetings   -> objections raised in recorded meetings (graph8's meeting analysis)
//   bookings   -> appointments that came from the source sequence, and no-shows
//   newsletter, nurture -> counted only: they reach opted-in audiences, not a cold sequence's prospects
// Never throws: a channel graph8 can't read is marked "unavailable" with the reason, the rest still load.
import type { CallResult, G8Client } from "../g8";
import { describeError } from "../g8";
import type { ChannelEvidence, ChannelStatus, Run } from "../types";

export type ChannelsClient = Pick<
  G8Client,
  "getSequenceReport" | "searchCallResults" | "listMeetings" | "listBookings" | "countNurtures" | "countNewsletters"
>;

/** Call outcomes that mean "never contact again" on any channel. */
export const CALL_HARD_STOPS = ["not_interested", "dnc"];
/** A meeting was booked on the call: the follow-up campaign isn't needed. */
export const CALL_BOOKED = ["booked"];
const MAX_CALL_PAGES = 10; // newest 1,000 calls

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
const idOf = (c: CallResult) => (c.contact_id == null ? null : Number(c.contact_id));
const timeOf = (c: CallResult) => Date.parse(c.call_start_date ?? c.created_at ?? "") || 0;
const statusOf = (n: number): ChannelStatus => (n > 0 ? "ok" : "none");
/** Seeded practice calls say so; they carry no conversation worth learning from. */
const informative = (summary: string | null | undefined) => Boolean(summary?.trim()) && !/^\[(synthetic|demo)\]|no call was placed/i.test(summary!.trim());

/** Contact ids of everyone who replied in the run (from the inbox thread). */
export const runContacts = (run: Pick<Run, "groups">) => new Set(run.groups.flatMap((g) => g.replies.map((r) => r.contactId).filter((x): x is number => typeof x === "number")));

/** Every call, newest first, across pages (optionally only some dispositions). */
async function allCalls(g8: ChannelsClient, dispositions?: string[]): Promise<CallResult[]> {
  const out: CallResult[] = [];
  for (let page = 1; page <= MAX_CALL_PAGES; page++) {
    const rows = await g8.searchCallResults({ dispositions, page, pageSize: 100 });
    out.push(...rows);
    if (rows.length < 100) break;
  }
  return out.sort((a, b) => timeOf(b) - timeOf(a));
}

/** Contacts (of those given) whose calls say "never again" or "already booked". Re-read live before a draft adds anyone. */
export async function callStops(g8: Pick<G8Client, "searchCallResults">, contactIds: Iterable<number>): Promise<{ saidNo: Set<number>; booked: Set<number> }> {
  const wanted = new Set(contactIds);
  const calls = await allCalls(g8 as ChannelsClient, [...CALL_HARD_STOPS, ...CALL_BOOKED]);
  const saidNo = new Set<number>();
  const booked = new Set<number>();
  for (const c of calls) {
    const id = idOf(c);
    if (id === null || !wanted.has(id)) continue;
    if (CALL_HARD_STOPS.includes(c.disposition ?? "")) saidNo.add(id);
    else if (CALL_BOOKED.includes(c.disposition ?? "")) booked.add(id);
  }
  return { saidNo, booked };
}

export async function loadChannels(g8: ChannelsClient, run: Pick<Run, "groups" | "source">, now = new Date()): Promise<ChannelEvidence> {
  const errors: string[] = [];
  const unavailable = (channel: string, err: unknown) => errors.push(`${channel}: ${describeError(err)}`);
  const ev: ChannelEvidence = {
    loadedAt: now.toISOString(),
    sequencer: [],
    calls: { status: "none", contacts: [], outcomes: {}, saidNo: [], booked: [] },
    meetings: { status: "none", total: 0, objections: [] },
    bookings: { status: "none", total: 0, fromSource: 0, noShows: 0 },
    newsletters: { status: "none", count: 0 },
    nurtures: { status: "none", count: 0 },
    errors,
  };
  const contacts = runContacts(run);
  const sequenceIds = new Set(run.source.sequences.map((s) => s.id));

  await Promise.all([
    // Sequencer: the source sequences' own funnel.
    (async () => {
      for (const s of run.source.sequences) {
        try {
          const r = await g8.getSequenceReport(s.id);
          const steps = r.step_breakdown ?? [];
          const sum = (k: string) => steps.reduce((n, x) => n + num(x.status_counts?.[k]), 0);
          const first = steps.find((x) => x.step_order === 1) ?? steps[0];
          ev.sequencer.push({
            sequenceId: s.id,
            name: s.name,
            contacts: num(r.overview?.total_contacts),
            reached: num(first?.status_counts?.completed) + num(first?.status_counts?.replied),
            replied: sum("replied"),
            bounced: sum("bounced"),
            unsubscribed: sum("unsubscribed"),
            meetingsBooked: num(r.overview?.meetings_booked),
            replyRate: typeof r.overview?.reply_rate === "number" ? r.overview.reply_rate : null,
          });
        } catch (err) {
          unavailable(`sequence report for "${s.name}"`, err);
        }
      }
    })(),
    // Dialer: the latest outcome per replying contact.
    (async () => {
      try {
        const latest = new Map<number, CallResult>();
        for (const c of await allCalls(g8)) {
          const id = idOf(c);
          if (id !== null && contacts.has(id) && !latest.has(id)) latest.set(id, c);
        }
        ev.calls.contacts = [...latest.entries()].map(([contactId, c]) => ({
          contactId,
          disposition: c.disposition ?? "unknown",
          ...(informative(c.summary) ? { summary: c.summary!.trim().slice(0, 400) } : {}),
          ...(c.call_start_date || c.created_at ? { at: (c.call_start_date ?? c.created_at)! } : {}),
        }));
        for (const c of ev.calls.contacts) ev.calls.outcomes[c.disposition] = (ev.calls.outcomes[c.disposition] ?? 0) + 1;
        // Any "no" wins, even if a later call ended differently.
        const stops = await callStops(g8, contacts);
        ev.calls.saidNo = [...stops.saidNo];
        ev.calls.booked = [...stops.booked].filter((id) => !stops.saidNo.has(id));
        ev.calls.status = statusOf(ev.calls.contacts.length);
      } catch (err) {
        ev.calls.status = "unavailable";
        unavailable("dialer", err);
      }
    })(),
    // Meetings: objections graph8's meeting analysis found.
    (async () => {
      try {
        const meetings = await g8.listMeetings();
        ev.meetings = {
          status: statusOf(meetings.length),
          total: meetings.length,
          objections: [...new Set(meetings.flatMap((m) => m.analysis?.objections ?? []).map((o) => o.trim()).filter(Boolean))].slice(0, 12),
        };
      } catch (err) {
        ev.meetings.status = "unavailable";
        unavailable("meetings", err);
      }
    })(),
    // Appointments booked from the source sequence.
    (async () => {
      try {
        const bookings = await g8.listBookings();
        const mine = bookings.filter((b) => b.sequence_id && sequenceIds.has(b.sequence_id));
        ev.bookings = { status: statusOf(bookings.length), total: bookings.length, fromSource: mine.length, noShows: mine.filter((b) => b.attendees?.some((a) => a.no_show)).length };
      } catch (err) {
        ev.bookings.status = "unavailable";
        unavailable("appointments", err);
      }
    })(),
    (async () => {
      try {
        const count = await g8.countNewsletters();
        ev.newsletters = { status: statusOf(count), count };
      } catch (err) {
        ev.newsletters.status = "unavailable";
        unavailable("newsletters", err);
      }
    })(),
    (async () => {
      try {
        const count = await g8.countNurtures();
        ev.nurtures = { status: statusOf(count), count };
      } catch (err) {
        ev.nurtures.status = "unavailable";
        unavailable("nurtures", err);
      }
    })(),
  ]);
  return ev;
}

const pct = (n: number, d: number) => (d > 0 ? `${Math.round((n / d) * 1000) / 10}%` : "n/a");

/** The evidence as short lines a strategist can cite. Every number in a strategy must come from these lines. */
export function evidenceLines(run: Pick<Run, "counts" | "groups">, ev: ChannelEvidence | undefined, groupKey?: string): string[] {
  const lines: string[] = [];
  for (const s of ev?.sequencer ?? []) {
    lines.push(`Sequencer "${s.name}": ${s.contacts} contacts, ${s.reached} reached by step 1, ${s.replied} replied (${pct(s.replied, s.reached)} of those reached), ${s.bounced} bounced, ${s.unsubscribed} unsubscribed, ${s.meetingsBooked} meetings booked.`);
  }
  lines.push(`AI Inbox: ${run.counts.prospectReplies} prospect replies, grouped as ${run.groups.map((g) => `${g.label} ${g.replies.length}`).join(", ")}.`);
  const reported = (ev?.sequencer ?? []).reduce((n, s) => n + s.replied, 0);
  if (ev?.sequencer.length && reported < run.counts.prospectReplies)
    lines.push(`The sequence report counts ${reported} replies but the AI Inbox holds ${run.counts.prospectReplies}; the inbox is the record of who replied.`);
  const group = groupKey ? run.groups.find((g) => g.key === groupKey) : undefined;
  if (ev?.calls.status === "ok") {
    const outcomes = Object.entries(ev.calls.outcomes).map(([d, n]) => `${d.replace(/_/g, " ")} ${n}`).join(", ");
    lines.push(`Dialer: ${ev.calls.contacts.length} of the contacts who replied were also called; latest outcomes: ${outcomes}.`);
    if (group) {
      const ids = new Set(group.replies.map((r) => r.contactId));
      const mine = ev.calls.contacts.filter((c) => ids.has(c.contactId));
      if (mine.length) lines.push(`Dialer, this group: ${mine.length} of ${group.replies.length} were called; outcomes: ${mine.map((c) => c.disposition.replace(/_/g, " ")).join(", ")}.`);
      for (const c of mine.filter((x) => x.summary)) lines.push(`Call summary (${c.disposition.replace(/_/g, " ")}): "${c.summary}"`);
    }
  } else if (ev?.calls.status === "none") lines.push("Dialer: none of the contacts who replied has been called.");
  if (ev?.meetings.objections.length) lines.push(`Recorded meetings raised these objections: ${ev.meetings.objections.join("; ")}.`);
  if (ev && ev.bookings.status === "ok") lines.push(`Appointments: ${ev.bookings.fromSource} booked from this sequence (${ev.bookings.noShows} no-shows).`);
  return lines;
}
