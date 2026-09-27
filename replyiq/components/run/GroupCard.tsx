"use client";
import { m } from "motion/react";
import { ArrowRight, Ban, BookOpenCheck, CheckCircle2, Clock, Loader2, UserCheck, UserRoundSearch, UserX } from "lucide-react";
import Link from "next/link";
import type { GroupView } from "@/lib/api-types";
import { hexToRgb, meta } from "@/lib/ui/categories";
import { Chip, SpotCard } from "../ui/primitives";

export default function GroupCard({
  group,
  runId,
  guarded,
  cardsPending,
  draftable,
  onOpenCard,
  onHover,
  highlighted,
}: {
  group: GroupView;
  runId: string;
  guarded: boolean;
  cardsPending: boolean;
  draftable: boolean;
  onOpenCard: () => void;
  onHover: (on: boolean) => void;
  highlighted: boolean;
}) {
  const info = meta(group.key);
  const color = info.color;
  const needsReview = group.replies.filter((r) => r.needsReview).length;
  const avgConf = group.replies.reduce((a, r) => a + r.confidence, 0) / Math.max(group.replies.length, 1);
  const lead = group.themes?.[0]?.quote ?? group.replies[0]?.quote ?? "";
  const referred = [...new Set(group.replies.map((r) => r.referredName).filter(Boolean))] as string[];
  const revisit = [...new Set(group.replies.map((r) => r.revisitHint).filter(Boolean))] as string[];
  const draft = group.draft;

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
      className={`flex h-full flex-col gap-4 p-5 transition-[border-color] duration-300 ${highlighted ? "!border-white/20" : ""}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="size-2.5 rounded-full" style={{ background: color, boxShadow: `0 0 14px ${color}` }} />
            <h3 className="truncate font-medium text-text">{group.label}</h3>
          </div>
          <p className="mt-1 text-[11px] text-dim">{info.note}</p>
        </div>
        <m.span key={group.replies.length} initial={{ scale: 1.6, color: "#ffffff" }} animate={{ scale: 1, color }} className="text-4xl font-semibold leading-none tabular-nums tracking-tight">
          {group.replies.length}
        </m.span>
      </div>

      <p className="line-clamp-2 min-h-10 text-sm leading-relaxed text-muted">“{lead}”</p>

      {group.themes && group.themes.length > 1 && (
        <ul className="flex flex-col gap-1">
          {group.themes.slice(0, 3).map((t) => (
            <li key={t.id} className="flex items-center justify-between gap-2 text-xs">
              <span className="truncate text-text/85">{t.label}</span>
              <span className="font-mono text-dim">{t.threadIds.length}</span>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap gap-1.5">
        {info.hardStop && (
          <Chip color="#ff5d7a">
            <Ban className="size-3" /> never re-contacted
          </Chip>
        )}
        {!info.hardStop && info.angle && info.followUp && <Chip color={color}>{info.angle}</Chip>}
        {referred.length > 0 && (
          <Chip>
            <UserRoundSearch className="size-3" /> {referred.slice(0, 2).join(", ")}
            {referred.length > 2 && ` +${referred.length - 2}`}
          </Chip>
        )}
        {revisit.length > 0 && (
          <Chip>
            <Clock className="size-3" /> {revisit[0]}
            {revisit.length > 1 && ` +${revisit.length - 1}`}
          </Chip>
        )}
        {needsReview > 0 && <Chip color="#ffb547">{needsReview} need review</Chip>}
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
        {info.answerCard && (group.card || cardsPending) && (
          <button
            onClick={onOpenCard}
            disabled={!group.card}
            className="flex items-center gap-1.5 rounded-full border border-line px-2.5 py-1 text-text transition-colors hover:border-line-2 hover:bg-white/5 disabled:opacity-50"
          >
            {group.card ? <BookOpenCheck className="size-3.5" style={{ color }} /> : <Loader2 className="size-3.5 animate-spin" />}
            {group.card ? "Answer Card" : "writing…"}
          </button>
        )}
        {draftable && (
          <Link
            href={`/runs/${runId}/groups/${group.key}`}
            className={`group/l flex items-center gap-1 rounded-full px-3 py-1 font-medium transition-shadow ${
              draft?.status === "ready" ? "border border-aqua/40 text-aqua" : "bg-lime text-ink hover:shadow-[0_0_24px_-4px_rgba(212,255,79,0.8)]"
            }`}
          >
            {draft?.status === "ready" ? (
              <>
                <CheckCircle2 className="size-3.5" /> Drafted
              </>
            ) : draft?.status === "drafting" ? (
              <>
                <Loader2 className="size-3.5 animate-spin" /> Drafting
              </>
            ) : (
              <>
                Draft <ArrowRight className="size-3.5 transition-transform group-hover/l:translate-x-0.5" />
              </>
            )}
          </Link>
        )}
      </div>
    </SpotCard>
  );
}
