"use client";
import { m } from "motion/react";
import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import type { RunSummary } from "@/lib/api-types";
import { meta } from "@/lib/ui/categories";
import { displayName, timeAgo } from "@/lib/ui/format";
import { useSpotlight } from "../ui/primitives";

function RunCard({ run, now, i }: { run: RunSummary; now: number; i: number }) {
  const onMove = useSpotlight<HTMLAnchorElement>();
  const total = run.groups.reduce((a, g) => a + g.count, 0) || 1;
  const top = [...run.groups].sort((a, b) => b.count - a.count).slice(0, 3);
  const working = run.status === "running" && run.job;
  const statusLabel = run.status === "done" ? "Complete" : run.status === "failed" ? "Failed" : working ? "Analysing" : "Interrupted";
  const statusTone = run.status === "done" ? "text-aqua" : run.status === "failed" ? "text-rose" : working ? "text-iris" : "text-amber";
  return (
    <m.li initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}>
      <Link href={`/runs/${run.id}`} onPointerMove={onMove} className="spotlight surface group flex h-full flex-col gap-4 rounded-2xl p-5 transition-transform duration-300 hover:-translate-y-0.5">
        <div className="flex items-center justify-between text-xs">
          <span className={`flex items-center gap-1.5 ${statusTone}`}>
            <span className={`size-1.5 rounded-full bg-current ${working ? "animate-pulse" : ""}`} />
            {statusLabel}
          </span>
          <span className="text-dim">{timeAgo(Date.parse(run.createdAt), now)}</span>
        </div>
        <h4 className="text-[15px] font-medium leading-snug text-text">{displayName(run.name || "Loading source…")}</h4>
        <div className="flex h-1.5 w-full gap-0.5 overflow-hidden rounded-full bg-white/5">
          {run.groups.map((g) => (
            <span key={g.key} className="h-full rounded-full" style={{ width: `${(g.count / total) * 100}%`, background: meta(g.key).color }} title={`${meta(g.key).label}: ${g.count}`} />
          ))}
        </div>
        <ul className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted">
          {top.map((g) => (
            <li key={g.key} className="flex items-center gap-1.5">
              <span className="size-1.5 rounded-full" style={{ background: meta(g.key).color }} />
              {meta(g.key).label} <span className="text-dim">{g.count}</span>
            </li>
          ))}
          {!top.length && <li className="text-dim">{run.status === "running" ? "Classifying…" : "No replies"}</li>}
        </ul>
        <div className="mt-auto flex items-center justify-between border-t border-line pt-3 text-xs text-muted">
          <span>
            {run.replies} replies · {run.drafts ? <span className="text-aqua">{run.drafts} drafted</span> : <span className="text-lime">{run.draftable} ready to draft</span>}
          </span>
          <ArrowUpRight className="size-4 text-dim transition-all group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-iris" />
        </div>
      </Link>
    </m.li>
  );
}

export default function RecentRuns({ runs, now }: { runs: RunSummary[]; now: number }) {
  if (!runs.length) return null;
  return (
    <div className="mt-14">
      <h3 className="mb-4 font-mono text-[11px] uppercase tracking-[0.2em] text-dim">Recent runs</h3>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {runs.slice(0, 6).map((r, i) => (
          <RunCard key={r.id} run={r} now={now} i={i} />
        ))}
      </ul>
    </div>
  );
}
