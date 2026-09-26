"use client";
import { m } from "motion/react";
import { Ban, Check } from "lucide-react";
import type { ExclusionReason, Group } from "@/lib/types";
import { Chip } from "../ui/primitives";

const REASON: Record<ExclusionReason, { label: string; color: string }> = {
  hard_no: { label: "hard no", color: "#ff5d7a" },
  unsubscribe: { label: "unsubscribe", color: "#ff3d6e" },
  suppressed: { label: "suppressed", color: "#ff5d7a" },
  not_found: { label: "not in CRM", color: "#ffb547" },
  no_followup_category: { label: "no follow-up category", color: "#8d93ab" },
};

export default function AudienceTable({ group, runExcluded }: { group: Group; runExcluded: Group["excluded"] }) {
  return (
    <div className="flex flex-col gap-8">
      <div>
        <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.2em] text-aqua">In the follow-up list · {group.eligible.length}</p>
        <ul className="surface divide-y divide-line overflow-hidden rounded-2xl">
          {group.eligible.map((c, i) => (
            <m.li
              key={c.email}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.06 }}
              className="flex items-center gap-3 px-4 py-3 text-sm"
            >
              <span className="grid size-7 place-items-center rounded-full bg-aqua/10 text-aqua">
                <Check className="size-3.5" />
              </span>
              <span className="flex-1 truncate text-text">{c.email}</span>
              <span className="hidden text-xs text-dim sm:inline">in follow-up list</span>
            </m.li>
          ))}
        </ul>
      </div>
      <div>
        <p className="mb-1 font-mono text-[11px] uppercase tracking-[0.2em] text-rose">Excluded across this run · {runExcluded.length}</p>
        <p className="mb-3 text-xs text-dim">Hard-no, unsubscribe and suppressed contacts never enter any list. Checked against graph8&apos;s suppression ledger.</p>
        <ul className="surface divide-y divide-line overflow-hidden rounded-2xl">
          {runExcluded.map((x, i) => (
            <m.li
              key={x.email}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 + i * 0.06 }}
              className="flex items-center gap-3 px-4 py-3 text-sm"
            >
              <span className="grid size-7 place-items-center rounded-full bg-rose/10 text-rose">
                <Ban className="size-3.5" />
              </span>
              <span className="flex-1 truncate text-muted line-through decoration-rose/40">{x.email}</span>
              <Chip color={REASON[x.reason].color}>{REASON[x.reason].label}</Chip>
            </m.li>
          ))}
          {runExcluded.length === 0 && <li className="px-4 py-6 text-center text-sm text-dim">Nobody excluded.</li>}
        </ul>
      </div>
    </div>
  );
}
