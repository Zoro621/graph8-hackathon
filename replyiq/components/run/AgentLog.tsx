"use client";
import { m } from "motion/react";
import { useEffect, useRef } from "react";
import type { LogLine, Tone } from "@/lib/demo/engine";

const TONE: Record<Tone, string> = {
  info: "text-muted",
  ok: "text-aqua",
  warn: "text-amber",
  stop: "text-rose",
  agent: "text-text",
};
const AGENT_COLOR: Record<string, string> = {
  Scout: "#9b8cff",
  Collector: "#6fb6ff",
  Analyst: "#c78bff",
  Scribe: "#4fe3d1",
  Warden: "#ff5d7a",
  Strategist: "#d4ff4f",
};

export default function AgentLog({ lines, done }: { lines: LogLine[]; done: boolean }) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = box.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [lines.length]);
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-dim">Agent log</span>
        <span className="flex gap-1.5" aria-hidden>
          <span className="size-2 rounded-full bg-rose/60" />
          <span className="size-2 rounded-full bg-amber/60" />
          <span className="size-2 rounded-full bg-aqua/60" />
        </span>
      </div>
      <div ref={box} className="thin-scroll min-h-0 flex-1 overflow-y-auto p-3 font-mono text-[11.5px] leading-relaxed" aria-live="polite">
        {lines.map((l, i) => (
          <m.div
            key={`${l.at}-${i}`}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.25 }}
            className="flex gap-2 py-0.5"
          >
            <span className="shrink-0 tabular-nums text-dim">{(l.at / 1000).toFixed(1).padStart(4, "0")}s</span>
            <span className="w-[74px] shrink-0 truncate" style={{ color: AGENT_COLOR[l.agent] }}>
              {l.agent}
            </span>
            <span className={`${TONE[l.tone]} break-words`}>{l.text}</span>
          </m.div>
        ))}
        {!done && (
          <div className="flex gap-2 py-0.5 text-dim">
            <span className="animate-pulse">▍</span>
          </div>
        )}
      </div>
    </div>
  );
}
