"use client";
import { m } from "motion/react";
import { Check, Minus } from "lucide-react";
import type { RunSnapshot } from "@/lib/demo/engine";
import { cardCategories } from "@/lib/demo/engine";
import { STEP_META, STEP_ORDER } from "@/lib/ui/theme";
import type { StepKey } from "@/lib/types";
import { AgentGlyph } from "./AgentGlyph";

function stepCounter(k: StepKey, s: RunSnapshot, total: number) {
  const cards = cardCategories(s.run.source.sequenceId).length;
  switch (k) {
    case "fetch":
      return `${s.fetched}/${total}`;
    case "classify":
      return `${s.classified}/${total}`;
    case "tag":
      return s.run.steps.tag === "done" ? `${total} tagged` : "";
    case "resolve": {
      if (s.run.steps.resolve !== "done") return "";
      const ex = s.run.groups.reduce((a, g) => a + g.excluded.length, 0);
      return `${ex} excluded`;
    }
    case "cards":
      return cards ? `${s.cardsReady}/${cards}` : "none";
    default:
      return s.run.steps.load === "done" ? "ok" : "";
  }
}

export default function PipelineRail({ snap, total }: { snap: RunSnapshot; total: number }) {
  return (
    <ol className="relative flex flex-col gap-1">
      <span className="absolute bottom-6 left-[27px] top-6 w-px bg-line" aria-hidden />
      <m.span
        className="absolute left-[27px] top-6 w-px origin-top bg-gradient-to-b from-iris via-aqua to-lime"
        style={{ height: "calc(100% - 3rem)" }}
        initial={{ scaleY: 0 }}
        animate={{ scaleY: snap.progress }}
        transition={{ ease: "linear", duration: 0.12 }}
        aria-hidden
      />
      {STEP_ORDER.map((k) => {
        const st = snap.run.steps[k];
        const meta = STEP_META[k];
        const running = st === "running";
        const done = st === "done";
        return (
          <li key={k} className="relative flex items-center gap-3 rounded-xl p-2">
            {running && (
              <m.span
                layoutId="rail-active"
                className="absolute inset-0 rounded-xl border border-iris/25 bg-iris/[0.07]"
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
              />
            )}
            <span
              className={`relative grid size-10 shrink-0 place-items-center rounded-xl border bg-ink-2 transition-all duration-500 ${
                running
                  ? "border-iris/70 shadow-[0_0_24px_-4px_rgba(155,140,255,0.8)]"
                  : done
                    ? "border-aqua/40"
                    : "border-line"
              }`}
            >
              {done ? (
                <m.span key="d" initial={{ scale: 0, rotate: -90 }} animate={{ scale: 1, rotate: 0 }}>
                  <Check className="size-4 text-aqua" strokeWidth={2.5} />
                </m.span>
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
                <span className="font-mono text-[11px] tabular-nums text-muted">{stepCounter(k, snap, total)}</span>
              </span>
              <span className="block truncate text-[11px] text-dim">
                {meta.agent} · {running ? <span className="text-iris">working…</span> : st === "skipped" ? "skipped" : meta.detail}
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
