"use client";
import { m } from "motion/react";
import { MousePointer2 } from "lucide-react";
import type { Category } from "@/lib/types";
import { meta } from "@/lib/ui/categories";
import { Chip, Decode, Dot } from "../ui/primitives";

/** One item orbiting the hero core: a real reply from the latest run, or one of the reasons ReplyIQ listens for. */
export interface TickerItem {
  id: string;
  text: string;
  who: string;
  category: Category;
  confidence?: number;
}

export type TickerPhase = "reading" | "labelled" | "inspecting";

/** The Analyst reads one item: text decodes, then the label lands. Hovering an orb pins it instantly. */
export default function ReplyTicker({ item, phase, source }: { item: TickerItem; phase: TickerPhase; source: "run" | "taxonomy" }) {
  const info = meta(item.category);
  const showLabel = phase !== "reading";
  return (
    <div
      className="surface relative w-full overflow-hidden rounded-2xl bg-ink-2/70 p-4 backdrop-blur-xl sm:p-5"
      style={{ boxShadow: showLabel ? `0 20px 60px -30px ${info.color}, inset 0 1px 0 rgba(255,255,255,0.05)` : undefined }}
    >
      <m.span className="absolute inset-x-0 top-0 h-px" animate={{ background: `linear-gradient(90deg, transparent, ${showLabel ? info.color : "#9b8cff"}, transparent)` }} />
      <div className="mb-3 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.2em] text-dim">
        <span className="flex items-center gap-2">
          {phase === "inspecting" ? <MousePointer2 className="size-3 text-lime" /> : <Dot color={showLabel ? info.color : "#9b8cff"} pulse={!showLabel} />}
          {phase === "reading" ? "Analyst · reading" : phase === "inspecting" ? "Inspecting" : "Analyst · labelled"}
        </span>
        <span className="truncate pl-3 normal-case tracking-normal text-muted">{item.who}</span>
      </div>
      <m.p
        key={`${item.id}-${phase === "reading"}`}
        initial={{ opacity: 0.2, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.18 }}
        className={`leading-snug text-text ${source === "run" ? "text-[17px]" : "text-[15px]"}`}
      >
        {source === "run" ? "“" : ""}
        {phase === "reading" ? <Decode text={item.text} speed={16} /> : item.text}
        {source === "run" ? "”" : ""}
      </m.p>
      <div className="mt-4 flex h-7 items-center gap-3">
        {showLabel ? (
          <m.div key={`l${item.id}`} className="flex min-w-0 flex-1 items-center gap-2" initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.2 }}>
            <Chip color={info.color}>{info.label}</Chip>
            <span className="truncate text-xs text-muted">{info.followUp && info.angle ? info.angle : info.note}</span>
          </m.div>
        ) : (
          <div className="h-1 w-32 overflow-hidden rounded-full bg-white/5">
            <div className="scan h-full w-full" />
          </div>
        )}
        {showLabel && item.confidence != null && (
          <span className="ml-auto flex shrink-0 items-center gap-2 font-mono text-[11px] text-muted">
            <span className="h-1 w-12 overflow-hidden rounded-full bg-white/10">
              <m.span className="block h-full rounded-full" style={{ background: info.color }} initial={{ width: 0 }} animate={{ width: `${item.confidence * 100}%` }} transition={{ duration: 0.4 }} />
            </span>
            {Math.round(item.confidence * 100)}%
          </span>
        )}
      </div>
    </div>
  );
}
