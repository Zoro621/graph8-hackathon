"use client";
import { m } from "motion/react";
import { ArrowRight, Mail } from "lucide-react";
import type { SequenceStep } from "@/lib/types";

function StepCard({ s, i, tone, color }: { s: SequenceStep; i: number; tone: "old" | "new"; color: string }) {
  const isNew = tone === "new";
  return (
    <m.li
      initial={{ opacity: 0, x: isNew ? 20 : -20 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true }}
      transition={{ delay: i * 0.12 + (isNew ? 0.25 : 0), duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      whileHover={{ y: -3 }}
      className={`relative rounded-xl border p-4 ${isNew ? "bg-white/[0.035]" : "border-line bg-white/[0.015]"}`}
      style={isNew ? { borderColor: `${color}40`, boxShadow: `0 12px 40px -24px ${color}` } : undefined}
    >
      <div className="flex items-center justify-between font-mono text-[10.5px] text-dim">
        <span className="flex items-center gap-1.5">
          <Mail className="size-3" /> Step {i + 1} · email
        </span>
        <span>day {s.day}</span>
      </div>
      <p className={`mt-2 text-sm font-medium ${isNew ? "text-text" : "text-muted"}`}>{s.subject}</p>
      <p className={`mt-1 text-[13px] leading-relaxed ${isNew ? "text-text/80" : "text-dim"}`}>{s.body}</p>
    </m.li>
  );
}

export default function V1V2Diff({ v1, v2, color, changes }: { v1: SequenceStep[]; v2: SequenceStep[]; color: string; changes: { what: string; why: string }[] }) {
  return (
    <div className="flex flex-col gap-8">
      <div className="grid items-start gap-4 md:grid-cols-[1fr_auto_1fr]">
        <div>
          <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.2em] text-dim">V1 · what they got</p>
          <ol className="flex flex-col gap-3">
            {v1.map((s, i) => (
              <StepCard key={i} s={s} i={i} tone="old" color={color} />
            ))}
          </ol>
        </div>
        <div className="hidden h-full items-center md:flex">
          <m.div
            animate={{ x: [0, 5, 0] }}
            transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
            className="grid size-10 place-items-center rounded-full border"
            style={{ borderColor: `${color}55`, color }}
          >
            <ArrowRight className="size-4" />
          </m.div>
        </div>
        <div>
          <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.2em]" style={{ color }}>
            V2 · what they get next
          </p>
          <ol className="flex flex-col gap-3">
            {v2.map((s, i) => (
              <StepCard key={i} s={s} i={i} tone="new" color={color} />
            ))}
          </ol>
        </div>
      </div>

      <div>
        <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.2em] text-dim">What changed and why</p>
        <ul className="grid gap-3 sm:grid-cols-2">
          {changes.map((c, i) => (
            <m.li
              key={c.what}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
              className="rounded-xl border border-line bg-white/[0.02] p-3.5"
            >
              <p className="text-sm font-medium text-text">{c.what}</p>
              <p className="mt-1 text-xs leading-relaxed text-muted">{c.why}</p>
            </m.li>
          ))}
        </ul>
      </div>
    </div>
  );
}
