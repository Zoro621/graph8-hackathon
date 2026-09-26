"use client";
import { m } from "motion/react";
import { useState } from "react";
import { STEP_META, STEP_ORDER } from "@/lib/ui/theme";
import { AgentGlyph } from "../run/AgentGlyph";

/** The six agents as a connected chain. Hover (or focus) one to light the beam up to it. */
export default function AgentStrip() {
  const [active, setActive] = useState<number | null>(null);
  return (
    <div className="relative">
      <div className="absolute left-[8%] right-[8%] top-7 hidden h-px bg-line md:block" aria-hidden />
      <m.div
        className="absolute left-[8%] top-7 hidden h-px bg-gradient-to-r from-iris via-aqua to-lime md:block"
        animate={{ width: active == null ? "0%" : `${(active / (STEP_ORDER.length - 1)) * 84}%` }}
        transition={{ type: "spring", stiffness: 120, damping: 20 }}
        aria-hidden
      />
      <ol className="relative grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-6">
        {STEP_ORDER.map((k, i) => {
          const meta = STEP_META[k];
          const on = active != null && i <= active;
          return (
            <li key={k}>
              <button
                onMouseEnter={() => setActive(i)}
                onMouseLeave={() => setActive(null)}
                onFocus={() => setActive(i)}
                onBlur={() => setActive(null)}
                className="group flex w-full flex-col items-center gap-3 rounded-2xl p-2 text-center outline-none"
              >
                <m.span
                  animate={{ scale: active === i ? 1.12 : 1, rotate: active === i ? 8 : 0 }}
                  className={`grid size-14 place-items-center rounded-2xl border bg-ink-2 transition-colors duration-300 ${
                    on ? "border-iris/60 shadow-[0_0_30px_-6px_rgba(155,140,255,0.7)]" : "border-line"
                  }`}
                >
                  <AgentGlyph step={k} active={on} />
                </m.span>
                <span>
                  <span className="block text-sm font-medium text-text">{meta.agent}</span>
                  <span className="block text-xs text-muted">{meta.title}</span>
                  <m.span
                    initial={false}
                    animate={{ opacity: active === i ? 1 : 0, height: active === i ? "auto" : 0 }}
                    className="block overflow-hidden text-[11px] leading-snug text-dim"
                  >
                    {meta.detail}
                  </m.span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
