"use client";
import { m } from "motion/react";
import { CalendarCheck2, CalendarClock, ListChecks, Send, XCircle } from "lucide-react";
import type { GroupView } from "@/lib/api-types";
import type { ReturnWave, SequenceDraft, SequenceWave } from "@/lib/types";
import { ASSUMED_AWAY_DAYS, dayLabel } from "@/lib/pipeline/returnDates";
import { Chip } from "../ui/primitives";

type Wave = ReturnWave & Partial<Pick<SequenceWave, "slot" | "listTitle" | "sequenceName" | "verified" | "status" | "error">>;

/** The group's return-date waves: as drafted in graph8 once there is a draft, else as they would split today. */
export function returnWaves(group: GroupView, sequence?: SequenceDraft): { waves: Wave[]; spare: number; drafted: boolean; countedOn?: string } {
  if (sequence?.waves?.length) {
    return { waves: sequence.waves.filter((w) => w.status !== "retired"), spare: sequence.waves.filter((w) => w.status === "retired").length, drafted: true, countedOn: sequence.wavesCountedOn };
  }
  return { waves: group.returnWaves ?? [], spare: 0, drafted: false };
}

const people = (n: number) => `${n} ${n === 1 ? "person" : "people"}`;
const title = (w: Wave) => (w.key === "now" ? "Back already" : `Back by ${dayLabel(w.returnOn ?? w.firstEmailOn)}`);
const when = (w: Wave) => (w.key === "now" ? "first email when the draft is launched" : `first email ${dayLabel(w.firstEmailOn)} · step 1 waits ${w.delayDays} day${w.delayDays === 1 ? "" : "s"} after launch`);

/** Side panel: one line per wave. */
export function ReturnDatesSummary({ group, sequence }: { group: GroupView; sequence?: SequenceDraft }) {
  const { waves, drafted } = returnWaves(group, sequence);
  if (!waves.length) return null;
  return (
    <div className="mt-4 rounded-xl border border-line bg-white/[0.02] p-3 text-xs leading-relaxed text-muted">
      <p className="flex items-center gap-2 font-medium text-text">
        <CalendarClock className="size-3.5 text-iris" /> {drafted ? "Timed to their return dates" : sequence?.status === "ready" ? "Not split by return date yet" : "Will be timed to their return dates"}
      </p>
      <ul className="mt-2 flex flex-col gap-1.5">
        {waves.map((w) => (
          <li key={w.key} className="flex items-baseline justify-between gap-3">
            <span className="text-text">
              {title(w)} <span className="text-dim">· {w.contacts.length}</span>
            </span>
            <span className="shrink-0 text-right">{w.key === "now" ? "on launch" : `${dayLabel(w.firstEmailOn)} (waits ${w.delayDays}d)`}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** The Return dates tab: who is back when, and the Sequencer draft each date gets. */
export default function ReturnDates({ group, sequence, color }: { group: GroupView; sequence?: SequenceDraft; color: string }) {
  const { waves, spare, drafted, countedOn } = returnWaves(group, sequence);
  const byThread = new Map(group.replies.map((r) => [r.threadId, r]));
  const waits = waves.some((w) => w.delayDays > 0);
  if (!waves.length) return <p className="text-sm text-muted">No one in this group can be followed up yet, so there are no return dates to time.</p>;
  const unsplit = sequence?.status === "ready" && !drafted; // drafted before the return-date split existed
  return (
    <div className="flex flex-col gap-6">
      <p className="max-w-[68ch] text-sm leading-relaxed text-muted">
        graph8 has no &ldquo;start on a date&rdquo; setting, but step 1 of a sequence can wait a number of days after launch. So each return date gets its own Sequencer draft: people already back
        get their first email when it&apos;s launched, and everyone else on the first working day after they&apos;re back.
      </p>
      {unsplit && (
        <p className="rounded-xl border border-amber/25 bg-amber/[0.05] p-3 text-xs leading-relaxed text-amber">
          This draft was made before ReplyIQ split drafts by return date, so its one sequence would email everyone on launch. Press &ldquo;Recount the waiting days&rdquo; to split it as shown below.
          Same emails; no credits.
        </p>
      )}

      <ol className="flex flex-col gap-4">
        {waves.map((w, i) => (
          <m.li key={w.key} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }} className="rounded-2xl border border-line bg-white/[0.02] p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="flex items-center gap-2 font-medium text-text">
                  {w.key === "now" ? <CalendarCheck2 className="size-4 text-aqua" /> : <CalendarClock className="size-4" style={{ color }} />}
                  {title(w)} <span className="font-normal text-dim">· {people(w.contacts.length)}</span>
                </p>
                <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted">
                  <Send className="size-3" /> {when(w)}
                </p>
              </div>
              {drafted &&
                (w.status === "ready" ? (
                  <Chip color={w.verified ? "#4fe3d1" : "#ffb547"}>{w.verified ? "read back from graph8" : "not verified"}</Chip>
                ) : (
                  <Chip color="#ff5d7a">
                    <XCircle className="size-3" /> not created
                  </Chip>
                ))}
            </div>

            <ul className="mt-3 divide-y divide-line overflow-hidden rounded-xl border border-line">
              {w.contacts.map((c) => {
                const r = byThread.get(c.threadId);
                return (
                  <li key={c.contactId} className="flex flex-col gap-0.5 px-3 py-2 text-sm sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
                    <span className="min-w-0 truncate text-text">
                      {r?.contactName ?? c.email}
                      {r?.company && <span className="text-dim"> · {r.company}</span>}
                    </span>
                    <span className="shrink-0 text-xs text-muted">
                      {c.assumed
                        ? `no date given · assumed back ${dayLabel(c.returnOn!)}`
                        : c.returnOn
                          ? `said “${c.said ?? "?"}” · back ${dayLabel(c.returnOn)}`
                          : c.said
                            ? `said “${c.said}” · no date to read`
                            : "no date given"}
                    </span>
                  </li>
                );
              })}
            </ul>

            {drafted && (
              <div className="mt-3 flex flex-col gap-1 text-xs text-dim">
                {w.sequenceName && (
                  <p className="flex items-center gap-1.5">
                    <ListChecks className="size-3.5 shrink-0" /> Sequencer draft “{w.sequenceName}”{w.listTitle ? ` on the list “${w.listTitle}”` : ""}
                  </p>
                )}
                {w.error && <p className="text-rose">{w.error}</p>}
              </div>
            )}
          </m.li>
        ))}
      </ol>

      <div className="flex flex-col gap-1.5 text-xs leading-relaxed text-dim">
        {waves.some((w) => w.contacts.some((c) => c.assumed)) && <p>No return date given: assumed back {ASSUMED_AWAY_DAYS} days after they replied.</p>}
        {waits && (
          <p>
            {drafted && countedOn ? `The waits were counted on ${dayLabel(countedOn)} and run from launch.` : "The waits are counted from today and run from launch."} Launch later and every first email moves later by
            the same days, so {drafted ? "press “Recount the waiting days” just before launching." : "recount them after drafting, just before launching."}
          </p>
        )}
        {spare > 0 && <p>{spare} earlier return-date draft{spare === 1 ? " is" : "s are"} no longer needed: {spare === 1 ? "its list was" : "their lists were"} emptied, so launching {spare === 1 ? "it" : "them"} reaches no one.</p>}
      </div>
    </div>
  );
}
