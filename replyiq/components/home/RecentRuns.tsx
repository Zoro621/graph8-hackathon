"use client";
import { m } from "motion/react";
import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { snapshot, sequenceOf, type RunMeta } from "@/lib/demo/engine";
import { TAXONOMY, canDraft } from "@/lib/taxonomy";
import { CATEGORY_COLOR } from "@/lib/ui/theme";
import { displayName, timeAgo } from "@/lib/ui/format";
import { useSpotlight } from "../ui/primitives";

function RunCard({ meta, now, i }: { meta: RunMeta; now: number; i: number }) {
  const snap = snapshot(meta, now);
  const onMove = useSpotlight<HTMLAnchorElement>();
  const groups = snap.run.groups;
  const total = groups.reduce((a, g) => a + g.replies.length, 0) || 1;
  const ready = groups.filter((g) => canDraft(g.key, g.eligible.length)).length;
  const top = [...groups].sort((a, b) => b.replies.length - a.replies.length).slice(0, 3);
  return (
    <m.li initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}>
      <Link
        href={`/runs/${meta.id}`}
        onPointerMove={onMove}
        className="spotlight surface group flex h-full flex-col gap-4 rounded-2xl p-5 transition-transform duration-300 hover:-translate-y-0.5"
      >
        <div className="flex items-center justify-between text-xs">
          <span className={`flex items-center gap-1.5 ${snap.done ? "text-aqua" : "text-iris"}`}>
            <span className={`size-1.5 rounded-full ${snap.done ? "bg-aqua" : "animate-pulse bg-iris"}`} />
            {snap.done ? "Complete" : "Analysing"}
          </span>
          <span className="text-dim">{timeAgo(meta.createdAt, now)}</span>
        </div>
        <h4 className="text-[15px] font-medium leading-snug text-text">{displayName(sequenceOf(meta.sequenceId).name)}</h4>
        <div className="flex h-1.5 w-full gap-0.5 overflow-hidden rounded-full bg-white/5">
          {groups.map((g) => (
            <span
              key={g.key}
              className="h-full rounded-full"
              style={{ width: `${(g.replies.length / total) * 100}%`, background: CATEGORY_COLOR[g.key] }}
              title={`${TAXONOMY[g.key].short}: ${g.replies.length}`}
            />
          ))}
        </div>
        <ul className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted">
          {top.map((g) => (
            <li key={g.key} className="flex items-center gap-1.5">
              <span className="size-1.5 rounded-full" style={{ background: CATEGORY_COLOR[g.key] }} />
              {TAXONOMY[g.key].short} <span className="text-dim">{g.replies.length}</span>
            </li>
          ))}
        </ul>
        <div className="mt-auto flex items-center justify-between border-t border-line pt-3 text-xs text-muted">
          <span>
            {groups.length} reasons · <span className="text-lime">{ready} ready to draft</span>
          </span>
          <ArrowUpRight className="size-4 text-dim transition-all group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-iris" />
        </div>
      </Link>
    </m.li>
  );
}

export default function RecentRuns({ runs }: { runs: RunMeta[] }) {
  const [now] = useState(() => Date.now());
  if (!runs.length) return null;
  return (
    <div className="mt-14">
      <h3 className="mb-4 font-mono text-[11px] uppercase tracking-[0.2em] text-dim">Recent runs</h3>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {runs.slice(0, 6).map((r, i) => (
          <RunCard key={r.id} meta={r} now={now} i={i} />
        ))}
      </ul>
    </div>
  );
}
