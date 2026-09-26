"use client";
import { m } from "motion/react";
import { Check, FilePen, Loader2 } from "lucide-react";
import { CAMPAIGN_DOCS } from "@/lib/demo/fixtures";
import { DRAFT_PHASES, type DraftSnapshot } from "@/lib/demo/engine";

/** Draft pipeline: phases on the left, the 17 Studio campaign docs lighting up on the right. */
export default function DraftProgress({ draft, color }: { draft: DraftSnapshot; color: string }) {
  return (
    <div className="flex flex-col gap-5">
      <ol className="flex flex-col gap-2">
        {DRAFT_PHASES.map((p, i) => {
          const done = draft.phaseIndex > i;
          const active = draft.phaseIndex === i;
          return (
            <li key={p.key} className="flex items-center gap-3 text-sm">
              <span
                className={`grid size-6 place-items-center rounded-full border transition-colors duration-300 ${
                  done ? "border-aqua/50 bg-aqua/10" : active ? "border-iris/60 bg-iris/10" : "border-line"
                }`}
              >
                {done ? (
                  <Check className="size-3 text-aqua" strokeWidth={3} />
                ) : active ? (
                  <Loader2 className="size-3 animate-spin text-iris" />
                ) : (
                  <span className="size-1 rounded-full bg-dim" />
                )}
              </span>
              <span className={done ? "text-text" : active ? "text-iris" : "text-dim"}>
                {p.label}
                {p.key === "docs" && (active || done) && (
                  <span className="ml-2 font-mono text-xs text-muted">
                    {draft.docsDone}/{draft.docsTotal}
                  </span>
                )}
              </span>
            </li>
          );
        })}
      </ol>
      <div className="grid grid-cols-2 gap-1.5">
        {CAMPAIGN_DOCS.map((d, i) => {
          const done = i < draft.docsDone;
          const patched = draft.docsPatched.includes(d);
          return (
            <m.div
              key={d}
              animate={{
                opacity: done ? 1 : 0.35,
                borderColor: patched ? color : done ? "rgba(79,227,209,0.35)" : "rgba(255,255,255,0.07)",
                scale: patched ? [1, 1.06, 1] : 1,
              }}
              transition={{ duration: 0.4 }}
              className="relative flex items-center gap-1.5 overflow-hidden rounded-lg border bg-white/[0.02] px-2 py-1.5 text-[11px]"
            >
              {done && (
                <m.span
                  className="absolute inset-0"
                  initial={{ x: "-100%" }}
                  animate={{ x: "100%" }}
                  transition={{ duration: 0.7 }}
                  style={{ background: "linear-gradient(90deg, transparent, rgba(79,227,209,0.18), transparent)" }}
                />
              )}
              {patched ? <FilePen className="size-3 shrink-0" style={{ color }} /> : <span className={`size-1.5 shrink-0 rounded-full ${done ? "bg-aqua" : "bg-dim"}`} />}
              <span className={`truncate ${patched ? "text-text" : done ? "text-muted" : "text-dim"}`}>{d}</span>
            </m.div>
          );
        })}
      </div>
      {draft.docsPatched.length > 0 && (
        <m.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-xs leading-relaxed text-muted">
          Answer Card appended to <span style={{ color }}>{draft.docsPatched.join(" and ")}</span>, so the next generation uses it.
        </m.p>
      )}
    </div>
  );
}
