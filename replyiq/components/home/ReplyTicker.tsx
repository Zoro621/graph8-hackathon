"use client";
import { m } from "motion/react";
import { MousePointer2 } from "lucide-react";
import { TAXONOMY } from "@/lib/taxonomy";
import type { Category } from "@/lib/types";
import { CATEGORY_COLOR } from "@/lib/ui/theme";
import { Chip, Decode, Dot } from "../ui/primitives";

export interface ReplySample {
  text: string;
  who: string;
  category: Category;
  confidence: number;
}

/** The replies orbiting the hero core. One orb per sample. */
export const REPLY_SAMPLES: ReplySample[] = [
  { text: "Send pricing details.", who: "Head of RevOps · SaaS", category: "pricing_request", confidence: 0.95 },
  { text: "We're locked into Apollo until Q1.", who: "VP Sales · Fintech", category: "competitor_locked_in", confidence: 0.91 },
  { text: "Interested in a demo, share the agenda.", who: "Founder · Logistics", category: "interested_no_meeting", confidence: 0.93 },
  { text: "Not the right person, talk to Sarah in RevOps.", who: "SDR Manager · HR tech", category: "referral_wrong_person", confidence: 0.89 },
  { text: "Please remove this contact.", who: "Office Manager · Retail", category: "unsubscribe", confidence: 0.98 },
  { text: "Budget is frozen, circle back after the new year.", who: "CFO · Manufacturing", category: "timing_not_now", confidence: 0.87 },
  { text: "Can we schedule a follow-up next week?", who: "Director of Growth · Health", category: "meeting_request", confidence: 0.88 },
  { text: "Too expensive for a team our size.", who: "COO · Agency", category: "price_objection", confidence: 0.9 },
  { text: "We built this in-house last year, no need.", who: "CTO · Marketplace", category: "no_need", confidence: 0.86 },
  { text: "Out of office until Monday, back on the 6th.", who: "AE · Cybersecurity", category: "out_of_office", confidence: 0.97 },
  { text: "Not interested at this time.", who: "VP Marketing · EdTech", category: "hard_no", confidence: 0.84 },
  { text: "What does it cost for 10 seats?", who: "Sales Lead · PropTech", category: "pricing_request", confidence: 0.94 },
  { text: "Happy to look, can you send a one-pager first?", who: "Head of Sales · Insurance", category: "interested_no_meeting", confidence: 0.9 },
  { text: "Using Outreach and it works fine for us.", who: "RevOps Lead · Media", category: "competitor_locked_in", confidence: 0.88 },
];

export type TickerPhase = "reading" | "labelled" | "inspecting";

/** One reply being read by the Analyst: text decodes, then the label lands. Hovering an orb pins it instantly. */
export default function ReplyTicker({ index, phase }: { index: number; phase: TickerPhase }) {
  const item = REPLY_SAMPLES[index % REPLY_SAMPLES.length];
  const color = CATEGORY_COLOR[item.category];
  const rule = TAXONOMY[item.category];
  const showLabel = phase !== "reading";
  return (
    <div
      className="surface relative w-full overflow-hidden rounded-2xl bg-ink-2/70 p-4 backdrop-blur-xl sm:p-5"
      style={{ boxShadow: showLabel ? `0 20px 60px -30px ${color}, inset 0 1px 0 rgba(255,255,255,0.05)` : undefined }}
    >
      <m.span
        className="absolute inset-x-0 top-0 h-px"
        animate={{ background: `linear-gradient(90deg, transparent, ${showLabel ? color : "#9b8cff"}, transparent)` }}
      />
      <div className="mb-3 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.2em] text-dim">
        <span className="flex items-center gap-2">
          {phase === "inspecting" ? <MousePointer2 className="size-3 text-lime" /> : <Dot color={showLabel ? color : "#9b8cff"} pulse={!showLabel} />}
          {phase === "reading" ? "Analyst · reading" : phase === "inspecting" ? "Inspecting reply" : "Analyst · labelled"}
        </span>
        <span className="truncate pl-3 normal-case tracking-normal text-muted">{item.who}</span>
      </div>
      <m.p
        key={`${index}-${phase === "reading"}`}
        initial={{ opacity: 0.2, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.18 }}
        className="text-[17px] leading-snug text-text"
      >
        “{phase === "reading" ? <Decode text={item.text} speed={16} /> : item.text}”
      </m.p>
      <div className="mt-4 flex h-7 items-center gap-3">
        {showLabel ? (
          <m.div key={`l${index}`} className="flex min-w-0 flex-1 items-center gap-2" initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.2 }}>
            <Chip color={color}>{rule.short}</Chip>
            <span className="truncate text-xs text-muted">{rule.angle ?? rule.note ?? "No follow-up"}</span>
          </m.div>
        ) : (
          <div className="h-1 w-32 overflow-hidden rounded-full bg-white/5">
            <div className="scan h-full w-full" />
          </div>
        )}
        {showLabel && (
          <span className="ml-auto flex shrink-0 items-center gap-2 font-mono text-[11px] text-muted">
            <span className="h-1 w-12 overflow-hidden rounded-full bg-white/10">
              <m.span
                className="block h-full rounded-full"
                style={{ background: color }}
                initial={{ width: 0 }}
                animate={{ width: `${item.confidence * 100}%` }}
                transition={{ duration: 0.4 }}
              />
            </span>
            {Math.round(item.confidence * 100)}%
          </span>
        )}
      </div>
    </div>
  );
}
