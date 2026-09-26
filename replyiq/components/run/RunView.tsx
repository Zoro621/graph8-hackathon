"use client";
import { AnimatePresence, LayoutGroup, m } from "motion/react";
import { ArrowRight, CheckCircle2, RotateCcw, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import ReplyCore, { type ClusterMark, type Orb } from "../three/ReplyCore";
import PipelineRail from "./PipelineRail";
import AgentLog from "./AgentLog";
import GroupCard from "./GroupCard";
import Sheet from "./Sheet";
import AnswerCardView from "./AnswerCardView";
import { Button, Chip, Counter, Eyebrow } from "../ui/primitives";
import { useRun } from "@/lib/client/hooks";
import { RUN_DURATION, classifiedReplies, sequenceOf } from "@/lib/demo/engine";
import { CATEGORY_COLOR } from "@/lib/ui/theme";
import { clockTime, displayName } from "@/lib/ui/format";
import { TAXONOMY, canDraft } from "@/lib/taxonomy";
import type { Category } from "@/lib/types";

export default function RunView({ runId }: { runId: string }) {
  const state = useRun(runId);
  const [hl, setHl] = useState<Category | null>(null);
  const [openCard, setOpenCard] = useState<Category | null>(null);
  const [tip, setTip] = useState<{ id: string; x: number; y: number } | null>(null);

  const sequenceId = state?.final.run.source.sequenceId;
  // Stable 3D layout: cluster per final group, slot per reply inside its cluster.
  const layout = useMemo(() => {
    if (!state || !sequenceId) return null;
    const groups = state.final.run.groups;
    const clusterOf = new Map<Category, number>(groups.map((g, i) => [g.key, i]));
    const slotOf = new Map<string, { slot: number; slots: number }>();
    groups.forEach((g) => g.replies.forEach((r, i) => slotOf.set(r.threadId, { slot: i, slots: g.replies.length })));
    return { clusterOf, slotOf, replies: classifiedReplies(sequenceId) };
  }, [sequenceId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!state || !layout) return <RunSkeleton />;
  const { snap, replay } = state;
  const seq = sequenceOf(snap.run.source.sequenceId);
  const clusters = state.final.run.groups.length;
  const total = seq.threads;
  const liveIds = new Set(snap.run.groups.flatMap((g) => g.replies.map((r) => r.threadId)));

  const orbs: Orb[] = layout.replies.map((r, i) => {
    const classified = liveIds.has(r.threadId);
    const state: Orb["state"] =
      i >= snap.fetched ? "hidden" : classified ? "cluster" : i === snap.classified && snap.activeStep === "classify" ? "core" : "orbit";
    return {
      id: r.threadId,
      color: classified ? CATEGORY_COLOR[r.category] : "#c9c2ff",
      state,
      cluster: layout.clusterOf.get(r.category) ?? 0,
      clusters,
      ...(layout.slotOf.get(r.threadId) ?? { slot: 0, slots: 1 }),
    };
  });

  const marks: ClusterMark[] = snap.run.groups.map((g) => ({
    color: CATEGORY_COLOR[g.key],
    index: layout.clusterOf.get(g.key) ?? 0,
    count: clusters,
  }));

  const guarded = snap.run.steps.resolve === "done";
  const cardsPending = snap.run.steps.cards === "running" || snap.run.steps.cards === "pending";
  const excludedTotal = snap.run.groups.reduce((a, g) => a + g.excluded.length, 0);
  const draftable = snap.run.groups
    .filter((g) => canDraft(g.key, g.eligible.length))
    .sort((a, b) => (b.card?.proofWeHave.length ?? -1) - (a.card?.proofWeHave.length ?? -1));
  const tipReply = tip ? layout.replies.find((r) => r.threadId === tip.id) : null;
  const tipClassified = tip ? liveIds.has(tip.id) : false;
  const openGroup = openCard ? snap.run.groups.find((g) => g.key === openCard) : null;

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 pb-24 pt-8 sm:px-6">
      {/* header */}
      <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div>
          <Eyebrow>
            Run · started {clockTime(Date.parse(snap.run.createdAt))}
          </Eyebrow>
          <h1 className="mt-3 text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">{displayName(seq.name)}</h1>
          <p className="mt-1.5 text-sm text-muted">
            {seq.threads} reply threads · {seq.stepCount}-step sequence · {seq.contactCount} contacts
          </p>
        </div>
        <div className="flex items-center gap-3">
          <AnimatePresence mode="wait">
            {snap.done ? (
              <m.span key="done" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}>
                <Chip color="#4fe3d1">
                  <CheckCircle2 className="size-3.5" /> Complete in {(Math.min(snap.elapsed, RUN_DURATION) / 1000).toFixed(1)}s
                </Chip>
              </m.span>
            ) : (
              <m.span key="run" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <Chip color="#9b8cff">
                  <span className="size-1.5 animate-pulse rounded-full bg-iris" /> Agents working · {(snap.elapsed / 1000).toFixed(1)}s
                </Chip>
              </m.span>
            )}
          </AnimatePresence>
          <Button variant="ghost" onClick={replay} className="!px-3.5" aria-label="Replay run">
            <RotateCcw className="size-4" /> Replay
          </Button>
        </div>
      </div>

      {/* progress line */}
      <div className="relative mt-6 h-px w-full bg-line">
        <m.div
          className="absolute inset-y-0 left-0 bg-gradient-to-r from-iris via-aqua to-lime"
          animate={{ width: `${snap.progress * 100}%` }}
          transition={{ ease: "linear", duration: 0.12 }}
        />
        <m.div
          className="absolute -top-[3px] size-[7px] rounded-full bg-lime shadow-[0_0_14px_#d4ff4f]"
          animate={{ left: `calc(${snap.progress * 100}% - 3px)` }}
          transition={{ ease: "linear", duration: 0.12 }}
        />
      </div>

      {/* mission control */}
      <div className="mt-6 grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)] xl:grid-cols-[280px_minmax(0,1fr)_320px]">
        <div className="surface rounded-2xl p-3">
          <PipelineRail snap={snap} total={total} />
        </div>

        <div className="surface relative h-[400px] overflow-hidden rounded-2xl lg:h-[540px]">
          <ReplyCore
            className="absolute inset-0"
            label="Replies flowing from the agent core into category clusters"
            layout="wide"
            orbs={orbs}
            clusterMarks={marks}
            highlight={hl != null ? (layout.clusterOf.get(hl) ?? null) : null}
            pulseKey={snap.classified}
            energy={snap.done ? 0.05 : 0.45}
            onHover={(id, x, y) => setTip(id ? { id, x, y } : null)}
            onSelect={(id) => {
              const r = layout.replies.find((x) => x.threadId === id);
              if (r && liveIds.has(id) && TAXONOMY[r.category].answerCard) setOpenCard(r.category);
              else if (r) document.getElementById(`g-${r.category}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
            }}
          />
          <div className="pointer-events-none absolute left-4 top-4 flex items-baseline gap-2">
            <span className="text-4xl font-semibold tabular-nums tracking-tight">
              <Counter value={snap.classified} />
            </span>
            <span className="text-sm text-muted">/ {total} classified</span>
          </div>
          <div className="absolute inset-x-0 bottom-0 flex flex-wrap justify-center gap-1.5 p-3">
            <AnimatePresence>
              {snap.run.groups.map((g) => (
                <m.button
                  key={g.key}
                  layout
                  initial={{ opacity: 0, y: 10, scale: 0.8 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  onMouseEnter={() => setHl(g.key)}
                  onMouseLeave={() => setHl(null)}
                  onFocus={() => setHl(g.key)}
                  onBlur={() => setHl(null)}
                  onClick={() => document.getElementById(`g-${g.key}`)?.scrollIntoView({ behavior: "smooth", block: "center" })}
                  className="flex items-center gap-1.5 rounded-full border bg-ink/70 px-2.5 py-1 text-[11px] backdrop-blur-md transition-colors"
                  style={{ borderColor: hl === g.key ? CATEGORY_COLOR[g.key] : "var(--line-2)", color: CATEGORY_COLOR[g.key] }}
                >
                  <span className="size-1.5 rounded-full" style={{ background: CATEGORY_COLOR[g.key] }} />
                  {TAXONOMY[g.key].short}
                  <span className="font-mono text-text/80">{g.replies.length}</span>
                </m.button>
              ))}
            </AnimatePresence>
          </div>
        </div>

        <div className="surface h-[300px] overflow-hidden rounded-2xl lg:col-span-2 xl:col-span-1 xl:h-[540px]">
          <AgentLog lines={snap.log} done={snap.done} />
        </div>
      </div>

      {/* groups */}
      <section className="mt-14">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Eyebrow>Step 2</Eyebrow>
            <h2 className="mt-3 text-2xl font-semibold tracking-[-0.03em] sm:text-3xl">
              {snap.run.groups.length ? (
                <>
                  {snap.run.groups.length} reasons,{" "}
                  <span className="font-serif font-normal italic text-iris">{guarded ? `${draftable.length} ready to draft` : "guarding contacts…"}</span>
                </>
              ) : (
                "Waiting for the Analyst…"
              )}
            </h2>
          </div>
          {guarded && excludedTotal > 0 && (
            <m.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2 text-sm text-rose/90">
              <ShieldAlert className="size-4" /> Warden excluded {excludedTotal} contact{excludedTotal > 1 ? "s" : ""}. They never enter a follow-up list.
            </m.p>
          )}
        </div>

        <LayoutGroup>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <AnimatePresence>
              {snap.run.groups.map((g) => (
                <div key={g.key} id={`g-${g.key}`} className="scroll-mt-24">
                  <GroupCard
                    group={g}
                    runId={snap.run.id}
                    guarded={guarded}
                    cardsPending={cardsPending}
                    highlighted={hl === g.key}
                    onHover={(on) => setHl(on ? g.key : null)}
                    onOpenCard={() => setOpenCard(g.key)}
                  />
                </div>
              ))}
            </AnimatePresence>
            {!snap.run.groups.length &&
              Array.from({ length: 3 }, (_, i) => <div key={i} className="surface h-56 animate-pulse rounded-2xl opacity-40" />)}
          </div>
        </LayoutGroup>

        {snap.done && draftable[0] && (
          <m.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mt-10 flex flex-col items-center gap-3 text-center"
          >
            <p className="text-sm text-muted">Next: review the strongest group and draft its follow-up campaign.</p>
            <Link href={`/runs/${snap.run.id}/groups/${draftable[0].key}`}>
              <Button variant="primary" magnetic>
                Review {TAXONOMY[draftable[0].key].short} <ArrowRight className="size-4" />
              </Button>
            </Link>
          </m.div>
        )}
      </section>

      {/* orb tooltip */}
      <AnimatePresence>
        {tip && tipReply && (
          <m.div
            className="pointer-events-none fixed z-[70] max-w-64 rounded-xl border border-line-2 bg-ink-2/95 p-3 text-xs backdrop-blur-md"
            style={{ left: tip.x + 14, top: tip.y + 14 }}
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
          >
            <p className="font-medium text-text">
              {tipReply.contactName} <span className="text-dim">· {tipReply.company}</span>
            </p>
            <p className="mt-1 text-muted">“{tipReply.replyText}”</p>
            {tipClassified ? (
              <p className="mt-2 flex items-center justify-between gap-2" style={{ color: CATEGORY_COLOR[tipReply.category] }}>
                {TAXONOMY[tipReply.category].short}
                <span className="font-mono text-dim">{Math.round(tipReply.confidence * 100)}%</span>
              </p>
            ) : (
              <p className="mt-2 font-mono text-iris">awaiting Analyst…</p>
            )}
          </m.div>
        )}
      </AnimatePresence>

      <Sheet
        open={!!openGroup?.card}
        onClose={() => setOpenCard(null)}
        accent={openGroup ? CATEGORY_COLOR[openGroup.key] : "#9b8cff"}
        title="Answer Card"
      >
        {openGroup?.card && (
          <div className="flex flex-col gap-8">
            <div>
              <Eyebrow>Answer Card</Eyebrow>
              <h2 className="mt-3 flex items-center gap-3 text-2xl font-semibold tracking-tight">
                <span className="size-3 rounded-full" style={{ background: CATEGORY_COLOR[openGroup.key], boxShadow: `0 0 16px ${CATEGORY_COLOR[openGroup.key]}` }} />
                {TAXONOMY[openGroup.key].short}
                <span className="font-mono text-sm font-normal text-dim">{openGroup.replies.length} replies</span>
              </h2>
            </div>
            <AnswerCardView card={openGroup.card} color={CATEGORY_COLOR[openGroup.key]} />
            {canDraft(openGroup.key, openGroup.eligible.length) && (
              <Link href={`/runs/${snap.run.id}/groups/${openGroup.key}`} className="self-start">
                <Button variant="primary" magnetic>
                  Review & draft follow-up <ArrowRight className="size-4" />
                </Button>
              </Link>
            )}
          </div>
        )}
      </Sheet>
    </div>
  );
}

function RunSkeleton() {
  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 pt-8 sm:px-6">
      <div className="h-4 w-40 animate-pulse rounded bg-white/5" />
      <div className="mt-4 h-9 w-96 max-w-full animate-pulse rounded bg-white/5" />
      <div className="mt-8 grid gap-4 lg:grid-cols-[280px_1fr_320px]">
        {[0, 1, 2].map((i) => (
          <div key={i} className="surface h-[420px] animate-pulse rounded-2xl opacity-50" />
        ))}
      </div>
    </div>
  );
}
