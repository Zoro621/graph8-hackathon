// Out-of-office follow-ups timed to each person's return date.
//
// graph8 has no "start on date X" setting, but step 1 of a sequence can wait N days after launch
// (`time_interval`). So ReplyIQ splits the group by return date: people already back share one Sequencer
// draft that sends on launch; people still away get one draft per date, whose first email waits until the
// first working day after they are back.
//
// Dates come from the classifier's revisit hint ("until June 9", "6/8/26", "Monday July 6, 2026",
// "Monday"), read against the date of the reply. Without a year: the nearest sensible one (up to 120 days
// ahead, else the latest date before the reply: an auto-reply left on after the person came back). No date
// at all: assumed back two weeks after the reply. Pure functions: the server and the UI share them.
import type { Category, Classified, ReturnWave, WaveContact } from "../types";

export const DAY_MS = 86_400_000;
/** No return date in the reply: assumed back this many days after they replied. */
export const ASSUMED_AWAY_DAYS = 14;
/** A date without a year counts as upcoming only this far ahead of the reply; further out, it is last year's. */
const AHEAD_DAYS = 120;

export type IsoDay = string; // YYYY-MM-DD, UTC

/** Only out-of-office replies carry return dates the follow-up is timed to. */
export const timedByReturnDate = (key: Category) => key === "out_of_office";

export const isoDay = (d: Date): IsoDay => d.toISOString().slice(0, 10);
const parseDay = (s: IsoDay) => new Date(`${s}T00:00:00Z`);
export const addDays = (s: IsoDay, n: number): IsoDay => isoDay(new Date(parseDay(s).getTime() + n * DAY_MS));
export const daysBetween = (from: IsoDay, to: IsoDay) => Math.round((parseDay(to).getTime() - parseDay(from).getTime()) / DAY_MS);

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** "Mon 5 Oct" */
export const dayLabel = (d: IsoDay) => {
  const x = parseDay(d);
  return `${DOW[x.getUTCDay()]} ${x.getUTCDate()} ${MON[x.getUTCMonth()]}`;
};

// ---------- reading a return date ----------

const MONTH = "(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)";
const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const COUNT: Record<string, number> = { a: 1, one: 1, two: 2, three: 3, four: 4 };
const monthIndex = (name: string) => MON.findIndex((m) => m.toLowerCase() === name.slice(0, 3));

/** A real calendar date (31 June is not). */
function valid(y: number, m: number, d: number): Date | null {
  if (m < 0 || m > 11 || d < 1) return null;
  const x = new Date(Date.UTC(y, m, d));
  return x.getUTCMonth() === m && x.getUTCDate() === d ? x : null;
}

/** A month and day without a year, placed near the reply: up to 120 days ahead, else the latest one before it. */
function placeYear(m: number, d: number, anchor: Date): Date | null {
  const y = anchor.getUTCFullYear();
  const dates = [y - 1, y, y + 1].map((yy) => valid(yy, m, d)).filter((x): x is Date => x !== null);
  const next = dates.find((x) => x.getTime() >= anchor.getTime());
  if (next && next.getTime() - anchor.getTime() <= AHEAD_DAYS * DAY_MS) return next;
  return [...dates].reverse().find((x) => x.getTime() < anchor.getTime()) ?? next ?? null;
}

const fullYear = (y: string) => (y.length === 2 ? 2000 + Number(y) : Number(y));
const dayOf = (s: string | undefined) => (s && !Number.isNaN(Date.parse(s)) ? isoDay(new Date(s)) : null);

/**
 * The day someone is back, from what they wrote ("until June 9", "5/26 - 6/5", "Monday"), read against the
 * day they replied (`repliedAt`, else `today`). A range gives its last day. Null when no date can be read
 * ("next quarter", "limited access").
 */
export function resolveReturnDate(hint: string | undefined, repliedAt: string | undefined, today: IsoDay): IsoDay | null {
  if (!hint?.trim()) return null;
  const anchor = parseDay(dayOf(repliedAt) ?? today);
  const t = ` ${hint.toLowerCase().replace(/(\d)(st|nd|rd|th)\b/g, "$1").replace(/,/g, " ").replace(/\s+/g, " ")} `;
  const found: Date[] = [];
  const add = (x: Date | null) => {
    if (x) found.push(x);
  };
  for (const m of t.matchAll(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/g)) add(valid(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  for (const m of t.matchAll(/(?<![\d-])(\d{1,2})\/(\d{1,2})(?:\/(\d{4}|\d{2}))?\b/g)) {
    let [mo, d] = [Number(m[1]), Number(m[2])];
    if (mo > 12 && d <= 12) [mo, d] = [d, mo]; // 26/5: day first
    add(m[3] ? valid(fullYear(m[3]), mo - 1, d) : placeYear(mo - 1, d, anchor));
  }
  for (const m of t.matchAll(new RegExp(`\\b${MONTH}\\.?\\s+(\\d{1,2})\\b(?:\\s+(\\d{4})\\b)?`, "g"))) {
    add(m[3] ? valid(Number(m[3]), monthIndex(m[1]), Number(m[2])) : placeYear(monthIndex(m[1]), Number(m[2]), anchor));
  }
  for (const m of t.matchAll(new RegExp(`\\b(\\d{1,2})\\s+(?:of\\s+)?${MONTH}\\b\\.?(?:\\s+(\\d{4})\\b)?`, "g"))) {
    add(m[3] ? valid(Number(m[3]), monthIndex(m[2]), Number(m[1])) : placeYear(monthIndex(m[2]), Number(m[1]), anchor));
  }
  if (!found.length) {
    // Relative to the reply: a weekday ("back Monday"), next week, "in two weeks", tomorrow.
    const after = (n: number) => add(new Date(anchor.getTime() + n * DAY_MS));
    const weekday = t.match(/\b(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/);
    const span = t.match(/\b(\d{1,2}|a|one|two|three|four)\s+(day|week)s?\b/);
    if (weekday) after((WEEKDAYS.indexOf(weekday[1]) - anchor.getUTCDay() + 7) % 7 || 7);
    else if (/\bnext week\b/.test(t)) after((1 - anchor.getUTCDay() + 7) % 7 || 7);
    else if (span) after((COUNT[span[1]] ?? Number(span[1])) * (span[2] === "week" ? 7 : 1));
    else if (/\btomorrow\b/.test(t)) after(1);
  }
  if (!found.length) return null;
  return isoDay(new Date(Math.max(...found.map((x) => x.getTime()))));
}

// ---------- splitting a group by return date ----------

/** The first working day after they are back (a Friday return gets a Monday email). */
export function firstWorkingDayAfter(day: IsoDay): IsoDay {
  const next = addDays(day, 1);
  const wd = parseDay(next).getUTCDay();
  return wd === 6 ? addDays(next, 2) : wd === 0 ? addDays(next, 1) : next;
}

/**
 * The group's audience split by when the first email should go: "now" (already back, sent on launch), then
 * one wave per later date, earliest first. `delayDays` is how long step 1 waits after a launch on `today`.
 */
export function planReturnWaves(group: { replies: Pick<Classified, "threadId" | "contactEmail" | "revisitHint" | "repliedAt">[] }, audience: { contactId: number; email: string; threadId: string }[], today: IsoDay): ReturnWave[] {
  const waves = new Map<string, ReturnWave>();
  for (const a of audience) {
    const r = group.replies.find((x) => x.threadId === a.threadId) ?? group.replies.find((x) => x.contactEmail.toLowerCase() === a.email.toLowerCase());
    const stated = resolveReturnDate(r?.revisitHint, r?.repliedAt, today);
    const replied = dayOf(r?.repliedAt);
    const returnOn = stated ?? (replied ? addDays(replied, ASSUMED_AWAY_DAYS) : null);
    const first = returnOn ? firstWorkingDayAfter(returnOn) : today;
    const later = first > today;
    const key = later ? first : "now";
    const wave = waves.get(key) ?? { key, returnOn: null, firstEmailOn: later ? first : today, delayDays: later ? daysBetween(today, first) : 0, contacts: [] };
    const contact: WaveContact = { contactId: a.contactId, email: a.email, threadId: a.threadId, returnOn, ...(r?.revisitHint ? { said: r.revisitHint } : {}), ...(!stated && returnOn ? { assumed: true } : {}) };
    wave.contacts.push(contact);
    if (later && returnOn && (!wave.returnOn || returnOn > wave.returnOn)) wave.returnOn = returnOn;
    waves.set(key, wave);
  }
  return [...waves.values()].sort((a, b) => (a.key === "now" ? -1 : b.key === "now" ? 1 : a.key.localeCompare(b.key)));
}

const people = (n: number) => `${n} ${n === 1 ? "person" : "people"}`;

/** "back already" / "back by Fri 2 Oct": names a wave by when its people are back, which stays true whenever it launches. */
export const waveTag = (w: Pick<ReturnWave, "key" | "returnOn">) => (w.key === "now" || !w.returnOn ? "back already" : `back by ${dayLabel(w.returnOn)}`);

/** One paragraph for the brief, the Studio documents and the approval page. */
export function wavesSummary(waves: ReturnWave[], countedOn: IsoDay): string {
  const parts = waves.map((w) =>
    w.key === "now"
      ? `${people(w.contacts.length)} back already: first email when the draft is launched`
      : `${people(w.contacts.length)} ${waveTag(w)}: first email ${dayLabel(w.firstEmailOn)} (step 1 waits ${w.delayDays} day${w.delayDays === 1 ? "" : "s"} after launch)`,
  );
  const assumed = waves.reduce((n, w) => n + w.contacts.filter((c) => c.assumed).length, 0);
  const lines = [`Timed to their return dates, one Sequencer draft per date: ${parts.join("; ")}.`];
  if (assumed) lines.push(`${people(assumed)} gave no return date: assumed back ${ASSUMED_AWAY_DAYS} days after replying.`);
  if (waves.some((w) => w.delayDays > 0))
    lines.push(`The waits count from launch and were set on ${dayLabel(countedOn)}. Launching later? Recount them in ReplyIQ first, so each first email still lands the working day after people are back.`);
  return lines.join(" ");
}
