"use client";
import { ArrowRight, Inbox, Layers, Loader2, MessageSquareText, Users, Workflow } from "lucide-react";
import type { RunSummary, SourceSummary } from "@/lib/api-types";
import { displayName, timeAgo } from "@/lib/ui/format";
import { Button, Chip, Counter, SpotCard } from "../ui/primitives";

const ease = [0.16, 1, 0.3, 1] as const;

export default function SequenceCard({
  source,
  i,
  primary,
  busy,
  disabled,
  lastRun,
  now,
  onLaunch,
}: {
  source: SourceSummary;
  i: number;
  primary: boolean;
  busy: boolean;
  disabled: boolean;
  lastRun?: RunSummary;
  now: number;
  onLaunch: () => void;
}) {
  const hasReplies = source.replyThreads > 0;
  return (
    <SpotCard
      tilt
      className={`group flex flex-col gap-6 p-6 sm:p-7 ${hasReplies ? "" : "opacity-60"}`}
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: hasReplies ? 1 : 0.6, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ delay: Math.min(i, 4) * 0.08, duration: 0.8, ease }}
    >
      <div className="flex items-start justify-between gap-4">
        <span className="grid size-11 place-items-center rounded-xl border border-line-2 bg-gradient-to-br from-iris/20 to-aqua/10">
          <Workflow className="size-5 text-iris" strokeWidth={1.6} />
        </span>
        {source.sequenceStatus && <Chip color={/active|running/i.test(source.sequenceStatus) ? "#d4ff4f" : "#4fe3d1"}>{source.sequenceStatus.toLowerCase()}</Chip>}
      </div>

      <div>
        <h3 className="text-2xl font-semibold tracking-tight">{displayName(source.sequenceName)}</h3>
        {source.campaignName && (
          <p className="mt-1.5 flex items-center gap-1.5 text-sm text-muted">
            <Layers className="size-3.5 shrink-0" /> <span className="truncate">{displayName(source.campaignName)}</span>
          </p>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2">
        {[
          { icon: MessageSquareText, v: source.replyThreads, l: "replies", tone: "text-aqua" },
          { icon: Users, v: source.contactCount ?? 0, l: "contacts", tone: "text-iris" },
          { icon: Inbox, v: source.mailboxes.length, l: source.mailboxes.length === 1 ? "inbox" : "inboxes", tone: "text-muted" },
        ].map((x) => (
          <div key={x.l} className="rounded-xl border border-line bg-white/[0.02] p-3">
            <x.icon className={`size-3.5 ${x.tone}`} />
            <div className="mt-2 text-2xl font-semibold tabular-nums">
              <Counter value={x.v} />
            </div>
            <div className="text-[11px] text-dim">{x.l}</div>
          </div>
        ))}
      </div>

      <div className="mt-auto flex items-center justify-between gap-3">
        <span className="text-xs text-dim">
          {!hasReplies ? "No replies yet" : lastRun ? `Last analysed ${timeAgo(Date.parse(lastRun.createdAt), now)}` : "Not analysed yet"}
        </span>
        <Button variant={primary ? "primary" : "ghost"} magnetic disabled={disabled || !hasReplies} onClick={onLaunch}>
          {busy ? (
            <>
              <Loader2 className="size-4 animate-spin" /> Spinning up agents
            </>
          ) : (
            <>
              Analyse replies <ArrowRight className="size-4" />
            </>
          )}
        </Button>
      </div>
    </SpotCard>
  );
}
