"use client";
import { m } from "motion/react";
import { Ban, Check, UserRoundSearch } from "lucide-react";
import type { GroupView } from "@/lib/api-types";
import type { ExclusionReason } from "@/lib/types";
import { Chip } from "../ui/primitives";

export const REASON: Record<ExclusionReason, { label: string; color: string }> = {
  hard_no: { label: "said no", color: "#ff5d7a" },
  unsubscribe: { label: "unsubscribed", color: "#ff3d6e" },
  hard_stop_elsewhere: { label: "said no in another thread", color: "#ff5d7a" },
  suppressed: { label: "suppressed", color: "#ff5d7a" },
  suppression_unknown: { label: "suppression check failed", color: "#ffb547" },
  not_found: { label: "not in the CRM", color: "#ffb547" },
  no_followup_category: { label: "no follow-up for this reason", color: "#8d93ab" },
};

export default function AudienceTable({ group, runExcluded }: { group: GroupView; runExcluded: number }) {
  const byThread = new Map(group.replies.map((r) => [r.threadId, r]));
  const referral = group.key === "referral_wrong_person";
  const draftAudience = group.draft?.audience ?? [];
  return (
    <div className="flex flex-col gap-8">
      {draftAudience.length > 0 && (
        <div>
          <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.2em] text-lime">On the graph8 list · {draftAudience.length}</p>
          <ul className="surface divide-y divide-line overflow-hidden rounded-2xl">
            {draftAudience.map((c) => (
              <li key={c.contactId} className="flex items-center gap-3 px-4 py-3 text-sm">
                <span className="grid size-7 place-items-center rounded-full bg-lime/10 text-lime">
                  <Check className="size-3.5" />
                </span>
                <span className="flex-1 truncate text-text">{c.email}</span>
                {c.referredBy && <span className="truncate text-xs text-dim">referred by {c.referredBy}</span>}
              </li>
            ))}
          </ul>
          {group.draft?.audienceNotes.map((n) => (
            <p key={n} className="mt-2 text-xs text-muted">
              {n}
            </p>
          ))}
        </div>
      )}

      {referral && !draftAudience.length && (
        <div>
          <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.2em] text-aqua">People they pointed to</p>
          <ul className="surface divide-y divide-line overflow-hidden rounded-2xl">
            {group.replies.map((r) => (
              <li key={r.threadId} className="flex items-center gap-3 px-4 py-3 text-sm">
                <span className="grid size-7 place-items-center rounded-full bg-aqua/10 text-aqua">
                  <UserRoundSearch className="size-3.5" />
                </span>
                <span className="flex-1 truncate text-text">{r.referredName ?? "no one named"}</span>
                <span className="truncate text-xs text-dim">from {r.contactName ?? r.contactEmail}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-dim">The follow-up goes to the named people, looked up in the CRM when you draft. The person who left is never contacted.</p>
        </div>
      )}

      {!referral && !draftAudience.length && (
        <div>
          <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.2em] text-aqua">Eligible for the follow-up · {group.eligible.length}</p>
          <ul className="surface divide-y divide-line overflow-hidden rounded-2xl">
            {group.eligible.map((c, i) => {
              const r = byThread.get(c.threadId);
              return (
                <m.li key={`${c.contactId}-${c.threadId}`} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }} className="flex items-center gap-3 px-4 py-3 text-sm">
                  <span className="grid size-7 place-items-center rounded-full bg-aqua/10 text-aqua">
                    <Check className="size-3.5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-text">{r?.contactName ?? c.email}</span>
                    <span className="block truncate text-xs text-dim">{r?.company ? `${r.company} · ` : ""}{c.email}</span>
                  </span>
                  {r?.revisitHint && <span className="hidden text-xs text-dim sm:inline">back {r.revisitHint}</span>}
                </m.li>
              );
            })}
            {group.eligible.length === 0 && <li className="px-4 py-6 text-center text-sm text-dim">Nobody in this group can be contacted.</li>}
          </ul>
        </div>
      )}

      <div>
        <p className="mb-1 font-mono text-[11px] uppercase tracking-[0.2em] text-rose">Excluded from this group · {group.excluded.length}</p>
        <p className="mb-3 text-xs text-dim">
          Checked against graph8&apos;s suppression list and every thread in the run. Across the whole run, {runExcluded} contacts are excluded.
        </p>
        <ul className="surface divide-y divide-line overflow-hidden rounded-2xl">
          {group.excluded.map((x) => (
            <li key={`${x.email}-${x.threadId}`} className="flex items-center gap-3 px-4 py-3 text-sm">
              <span className="grid size-7 place-items-center rounded-full bg-rose/10 text-rose">
                <Ban className="size-3.5" />
              </span>
              <span className="flex-1 truncate text-muted line-through decoration-rose/40">{x.email}</span>
              <Chip color={REASON[x.reason].color}>{REASON[x.reason].label}</Chip>
            </li>
          ))}
          {group.excluded.length === 0 && <li className="px-4 py-6 text-center text-sm text-dim">Nobody excluded in this group.</li>}
        </ul>
      </div>
    </div>
  );
}
