"use client";
import { m } from "motion/react";
import { ArrowRight, Ban, BookOpenCheck, Clock, Loader2, UserCheck, UserX } from "lucide-react";
import Link from "next/link";
import type { Group } from "@/lib/types";
import { TAXONOMY, canDraft, isHardStop } from "@/lib/taxonomy";
import { CATEGORY_COLOR } from "@/lib/ui/theme";
import { Chip, SpotCard } from "../ui/primitives";

const hexToRgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)).join(",");

export default function GroupCard({
  group,
  runId,
  guarded,
  cardsPending,
  onOpenCard,
  onHover,
  highlighted,
}: {
  group: Group;
  runId: string;
  guarded: boolean;
  cardsPending: boolean;
  onOpenCard: () => void;
  onHover: (on: boolean) => void;
  highlighted: boolean;
}) {
  const rule = TAXONOMY[group.key];
  const color = CATEGORY_COLOR[group.key];
  const stop = isHardStop(group.key);
  const draftable = guarded && canDraft(group.key, group.eligible.length);
  const needsReview = group.replies.some((r) => r.needsReview);
  const avgConf = group.replies.reduce((a, r) => a + r.confidence, 0) / group.replies.length;

  return (
    <SpotCard
      layout
      color={hexToRgb(color)}
      tilt
      initial={{ opacity: 0, scale: 0.92, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 240, damping: 24 }}
      onHoverStart={() => onHover(true)}
      onHoverEnd={() => onHover(false)}
      className={`flex flex-col gap-4 p-5 transition-[border-color] duration-300 ${highlighted ? "!border-white/20" : ""}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="size-2.5 rounded-full" style={{ background: color, boxShadow: `0 0 14px ${color}` }} />
            <h3 className="truncate font-medium text-text">{rule.short}</h3>
          </div>
        </div>
        <m.span
          key={group.replies.length}
          initial={{ scale: 1.6, color: "#ffffff" }}
          animate={{ scale: 1, color }}
          className="text-4xl font-semibold leading-none tabular-nums tracking-tight"
        >
          {group.replies.length}
        </m.span>
      </div>

      <p className="line-clamp-2 min-h-10 text-sm leading-relaxed text-muted">“{group.replies[0]?.quote}”</p>

      <div className="flex flex-wrap gap-1.5">
        {stop && (
          <Chip color="#ff5d7a">
            <Ban className="size-3" /> never re-contacted
          </Chip>
        )}
        {!stop && rule.angle && <Chip color={color}>{rule.angle}</Chip>}
        {!rule.followUp && !stop && <Chip>{rule.note ?? "No follow-up"}</Chip>}
        {group.replies[0]?.revisitHint && (
          <Chip>
            <Clock className="size-3" /> {group.replies[0].revisitHint}
          </Chip>
        )}
        {needsReview && <Chip color="#ffb547">needs review</Chip>}
        <Chip>{Math.round(avgConf * 100)}% avg conf.</Chip>
      </div>

      <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-2 whitespace-nowrap border-t border-line pt-4 text-xs">
        {guarded ? (
          <>
            <span className="flex items-center gap-1.5 text-aqua">
              <UserCheck className="size-3.5" /> {group.eligible.length} eligible
            </span>
            <span className={`flex items-center gap-1.5 ${group.excluded.length ? "text-rose" : "text-dim"}`}>
              <UserX className="size-3.5" /> {group.excluded.length} excluded
            </span>
          </>
        ) : (
          <span className="flex items-center gap-1.5 text-dim">
            <Loader2 className="size-3.5 animate-spin" /> guarding contacts…
          </span>
        )}
        <span className="flex-1" />
        {rule.answerCard && (
          <button
            onClick={onOpenCard}
            disabled={!group.card}
            className="flex items-center gap-1.5 rounded-full border border-line px-2.5 py-1 text-text transition-colors hover:border-line-2 hover:bg-white/5 disabled:opacity-50"
          >
            {group.card ? <BookOpenCheck className="size-3.5" style={{ color }} /> : <Loader2 className="size-3.5 animate-spin" />}
            {group.card ? "Answer Card" : cardsPending ? "writing…" : "card"}
          </button>
        )}
        {draftable && (
          <Link
            href={`/runs/${runId}/groups/${group.key}`}
            className="group/l flex items-center gap-1 rounded-full bg-lime px-3 py-1 font-medium text-ink transition-shadow hover:shadow-[0_0_24px_-4px_rgba(212,255,79,0.8)]"
          >
            Draft <ArrowRight className="size-3.5 transition-transform group-hover/l:translate-x-0.5" />
          </Link>
        )}
      </div>
    </SpotCard>
  );
}
