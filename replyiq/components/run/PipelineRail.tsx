"use client";
import { m } from "motion/react";
import { Check, Minus, X } from "lucide-react";
import type { RunView } from "@/lib/api-types";
import type { StepName } from "@/lib/types";
import { STEP_META, STEP_ORDER } from "@/lib/ui/theme";
import { AgentGlyph } from "./AgentGlyph";

/** A short real counter for each finished step. */
function stepCounter(k: StepName, run: RunView): string {
  const state = run.steps[k];
  if (state !== "done") return state === "skipped" ? "skipped" : state === "failed" ? "failed" : "";
  switch (k) {
    case "load":
      return `${run.source.sequences.length} seq`;
    case "fetch":
      return `${run.counts.prospectReplies} replies`;
    case "classify":
      return `${run.groups.length} groups`;
    case "themes":
      return `${run.groups.reduce((n, g) => n + (g.themes?.length ?? 0), 0)} themes`;
    case "tag":
      return run.tagging ? `${run.tagging.tagged + run.tagging.already} tagged` : "done";
    case "resolve":
      return run.audience ? `${run.audience.eligible} eligible` : "done";
    case "cards":
      return run.cards ? `${run.cards.generated} cards` : "done";
  }
}

export default function PipelineRail({ run }: { run: RunView }) {
  const finished = STEP_ORDER.filter((s) => run.steps[s] !== "pending" && run.steps[s] !== "running").length;
  return (
    <ol className="relative flex flex-col gap-0.5">
      <span className="absolute bottom-6 left-[27px] top-6 w-px bg-line" aria-hidden />
      <m.span
        className="absolute left-[27px] top-6 w-px origin-top bg-gradient-to-b from-iris via-aqua to-lime"
        style={{ height: "calc(100% - 3rem)" }}
        initial={{ scaleY: 0 }}
        animate={{ scaleY: finished / STEP_ORDER.length }}
        transition={{ duration: 0.6 }}
        aria-hidden
      />
      {STEP_ORDER.map((k) => {
        const st = run.steps[k];
        const meta = STEP_META[k];
        const running = st === "running" && !run.interrupted;
        const done = st === "done";
        return (
          <li key={k} className="relative flex items-center gap-3 rounded-xl p-2">
            {running && (
              <m.span layoutId="rail-active" className="absolute inset-0 rounded-xl border border-iris/25 bg-iris/[0.07]" transition={{ type: "spring", stiffness: 300, damping: 30 }} />
            )}
            <span
              className={`relative grid size-10 shrink-0 place-items-center rounded-xl border bg-ink-2 transition-all duration-500 ${
                running ? "border-iris/70 shadow-[0_0_24px_-4px_rgba(155,140,255,0.8)]" : done ? "border-aqua/40" : st === "failed" ? "border-rose/50" : "border-line"
              }`}
            >
              {done ? (
                <m.span key="d" initial={{ scale: 0, rotate: -90 }} animate={{ scale: 1, rotate: 0 }}>
                  <Check className="size-4 text-aqua" strokeWidth={2.5} />
                </m.span>
              ) : st === "failed" ? (
                <X className="size-4 text-rose" />
              ) : st === "skipped" ? (
                <Minus className="size-4 text-dim" />
              ) : (
                <span className={running ? "animate-pulse" : ""}>
                  <AgentGlyph step={k} active={running} className="size-4" />
                </span>
              )}
            </span>
            <span className="relative min-w-0 flex-1">
              <span className="flex items-center justify-between gap-2">
                <span className={`truncate text-sm font-medium ${st === "pending" ? "text-dim" : "text-text"}`}>{meta.title}</span>
                <span className={`font-mono text-[11px] tabular-nums ${st === "failed" ? "text-rose" : "text-muted"}`}>{stepCounter(k, run)}</span>
              </span>
              <span className="block truncate text-[11px] text-dim">
                {meta.agent} · {running ? <span className="text-iris">working…</span> : meta.detail}
              </span>
              {running && (
                <span className="mt-1.5 block h-0.5 overflow-hidden rounded-full bg-white/5">
                  <span className="scan block h-full w-full" />
                </span>
              )}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
