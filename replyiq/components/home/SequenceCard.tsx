"use client";
import { ArrowRight, Loader2, Mail, MessageSquareText, Users, Workflow } from "lucide-react";
import type { RunMeta } from "@/lib/demo/engine";
import { THREADS } from "@/lib/demo/fixtures";
import type { SequenceSummary } from "@/lib/types";
import { displayName, timeAgo } from "@/lib/ui/format";
import { Button, Chip, Counter, SpotCard } from "../ui/primitives";

const ease = [0.16, 1, 0.3, 1] as const;

export default function SequenceCard({
  seq,
  i,
  primary,
  busy,
  disabled,
  lastRun,
  now,
  onLaunch,
}: {
  seq: SequenceSummary;
  i: number;
  primary: boolean;
  busy: boolean;
  disabled: boolean;
  lastRun?: RunMeta;
  now: number;
  onLaunch: () => void;
}) {
  const snippets = [...new Set((THREADS[seq.id] ?? []).map((t) => t.replyText))].slice(0, 3);
  return (
    <SpotCard
      tilt
      className="group flex flex-col gap-6 p-6 sm:p-7"
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ delay: i * 0.1, duration: 0.8, ease }}
    >
      <div className="flex items-start justify-between gap-4">
        <span className="grid size-11 place-items-center rounded-xl border border-line-2 bg-gradient-to-br from-iris/20 to-aqua/10">
          <Workflow className="size-5 text-iris" strokeWidth={1.6} />
        </span>
        <Chip color="#4fe3d1">{seq.status}</Chip>
      </div>

      <div>
        <h3 className="text-2xl font-semibold tracking-tight">{displayName(seq.name)}</h3>
        <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
          <span className="flex items-center gap-1.5">
            <Users className="size-3.5" /> {seq.contactCount} contacts
          </span>
          <span className="flex items-center gap-1.5">
            <Mail className="size-3.5" /> {seq.stepCount}-step email sequence
          </span>
        </p>
      </div>

      <div className="rounded-2xl border border-line bg-white/[0.02] p-4">
        <div className="mb-3 flex items-baseline justify-between">
          <span className="flex items-center gap-2 text-sm text-text">
            <MessageSquareText className="size-4 text-aqua" />
            <span className="text-2xl font-semibold tabular-nums">
              <Counter value={seq.threads} />
            </span>
            replies waiting
          </span>
        </div>
        <ul className="flex flex-col gap-1.5">
          {snippets.map((s, k) => (
            <li
              key={s}
              className="w-fit max-w-full truncate rounded-xl rounded-bl-sm border border-line bg-ink-3/80 px-3 py-1.5 text-[13px] text-muted transition-transform duration-500 group-hover:translate-x-1"
              style={{ transitionDelay: `${k * 60}ms` }}
            >
              {s}
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-auto flex items-center justify-between gap-3">
        <span className="text-xs text-dim">{lastRun ? `Last analysed ${timeAgo(lastRun.createdAt, now)}` : "Not analysed yet"}</span>
        <Button variant={primary ? "primary" : "ghost"} magnetic disabled={disabled} onClick={onLaunch}>
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
