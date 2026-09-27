"use client";
import { AnimatePresence, LayoutGroup, m } from "motion/react";
import { AlertTriangle, ArrowRight, CheckCircle2, Loader2, RotateCcw, ShieldAlert, XCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import ReplyCore, { type ClusterMark, type Orb } from "../three/ReplyCore";
import PipelineRail from "./PipelineRail";
import AgentLog from "./AgentLog";
import GroupCard from "./GroupCard";
import Sheet from "./Sheet";
import AnswerCardView from "./AnswerCardView";
import LearningsPanel from "./LearningsPanel";
import StateNotice from "../shell/StateNotice";
import { Button, Chip, Counter, Eyebrow } from "../ui/primitives";
import { api, isWorking, useRunView } from "@/lib/client/api";
import { useNow } from "@/lib/client/hooks";
import { meta } from "@/lib/ui/categories";
import { clockTime, splitName } from "@/lib/ui/format";
import { runLog } from "@/lib/ui/runLog";
import { STEP_ORDER } from "@/lib/ui/theme";
import { OTHER_ORG_REASON, type ReplyView, type RunView as Run } from "@/lib/api-types";
import type { Category } from "@/lib/types";

const PENDING_ORB = "#c9c2ff";

function useOrbs(run: Run | undefined) {
  return useMemo(() => {
    if (!run) return { orbs: [] as Orb[], marks: [] as ClusterMark[], clusterOf: new Map<Category, number>(), replies: [] as ReplyView[] };
    const groups = run.groups;
    const clusterOf = new Map<Category, number>(groups.map((g, i) => [g.key, i]));
    const replies = groups.flatMap((g) => g.replies);
    let orbs: Orb[];
    if (replies.length) {
      orbs = groups.flatMap((g, gi) =>
        g.replies.map((r, i) => ({ id: r.threadId, color: meta(g.key).color, state: "cluster" as const, cluster: gi, clusters: groups.length, slot: i, slots: g.replies.length })),
      );
    } else {
      // Replies fetched but not classified yet: they circle the core (the Analyst is reading them).
      const n = run.steps.fetch === "done" ? Math.min(run.counts.prospectReplies, 60) : 0;
      const classifying = run.steps.classify === "running";
      orbs = Array.from({ length: n }, (_, i) => ({ id: `pending-${i}`, color: PENDING_ORB, state: classifying && i % 3 === 0 ? "core" : "orbit", cluster: 0, clusters: 1, slot: 0, slots: 1 }));
    }
    const marks = groups.map((g, i) => ({ color: meta(g.key).color, index: i, count: groups.length }));
    return { orbs, marks, clusterOf, replies };
  }, [run]);
}

export default function RunView({ runId }: { runId: string }) {
  const router = useRouter();
  const { data: run, error, loading } = useRunView(runId);
  const [hl, setHl] = useState<Category | null>(null);
  const [openCard, setOpenCard] = useState<Category | null>(null);
  const [tip, setTip] = useState<{ id: string; x: number; y: number } | null>(null);
  const [rerunning, setRerunning] = useState(false);
  const [rerunError, setRerunError] = useState<string | null>(null);
  const working = isWorking(run);
  const now = useNow(working);
  const { orbs, marks, clusterOf, replies } = useOrbs(run);

  if (!run) {
    if (error?.code === "not_configured") return <StateNotice kind="setup" />;
    if (error?.status === 404) return <StateNotice kind="not-found" title="This run doesn't exist" detail="It may have been created on another machine: runs are stored by the server that ran them." />;
    if (error && !loading) return <StateNotice kind="error" title="Couldn't load this run" detail={error.message} />;
    return <RunSkeleton />;
  }

  const finished = STEP_ORDER.filter((s) => ["done", "skipped", "failed"].includes(run.steps[s])).length;
  const progress = run.status === "running" ? finished / STEP_ORDER.length : 1;
  const started = Date.parse(run.createdAt);
  const sourceName = splitName(run.source.name || "Loading source…");
  // The pipeline's own duration. Drafts and learnings move updatedAt later, so a run saved before finishedAt
  // existed only shows a duration when nothing else has touched it since.
  const endedAt = run.finishedAt ?? (run.groups.some((g) => g.draft) || run.learnings ? undefined : run.updatedAt);
  const elapsed = ((run.status === "running" && now ? now : Date.parse(endedAt ?? run.updatedAt)) - started) / 1000;
  const classified = replies.length;
  const total = run.counts.prospectReplies;
  const guarded = run.steps.resolve === "done";
  const cardsPending = run.steps.cards === "running" || run.steps.cards === "pending";
  const excludedTotal = run.groups.reduce((a, g) => a + g.excluded.length, 0);
  const draftable = run.groups.filter((g) => g.draftable.ok).sort((a, b) => (b.card?.proofWeHave.length ?? -1) - (a.card?.proofWeHave.length ?? -1));
  const tipReply = tip ? replies.find((r) => r.threadId === tip.id) : null;
  const openGroup = openCard ? run.groups.find((g) => g.key === openCard) : null;

  const rerun = async () => {
    setRerunning(true);
    setRerunError(null);
    try {
      const { runId: next } = await api.startRun(run.source.selector);
      router.push(`/runs/${next}`);
    } catch (e) {
      setRerunError((e as Error).message);
      setRerunning(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 pb-24 pt-8 sm:px-6">
      {/* header */}
      <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div>
          <Eyebrow>Run · started {clockTime(started)}</Eyebrow>
          <h1 className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">
            {sourceName.title}
            {sourceName.tags.map((t) => (
              <Chip key={t} color="#9b8cff">
                {t}
              </Chip>
            ))}
          </h1>
          <p className="mt-1.5 text-sm text-muted">
            {run.steps.fetch === "done" ? `${run.counts.prospectReplies} replies · ${run.counts.threads} threads` : "Fetching replies…"}
            {run.source.sequences.length > 1 && ` · ${run.source.sequences.length} sequences`}
            {run.usage.llmCalls > 0 && ` · ${run.usage.llmCalls} AI calls`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <AnimatePresence mode="wait" initial={false}>
            {run.status === "done" ? (
              <m.span key="done" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}>
                <Chip color="#4fe3d1">
                  <CheckCircle2 className="size-3.5" /> {endedAt ? `Complete in ${Math.max(1, Math.round(elapsed))}s` : "Complete"}
                </Chip>
              </m.span>
            ) : run.status === "failed" ? (
              <m.span key="failed" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <Chip color="#ff5d7a">
                  <XCircle className="size-3.5" /> Run failed
                </Chip>
              </m.span>
            ) : run.interrupted ? (
              <m.span key="int" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <Chip color="#ffb547">
                  <AlertTriangle className="size-3.5" /> Interrupted
                </Chip>
              </m.span>
            ) : (
              <m.span key="run" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <Chip color="#9b8cff">
                  <span className="size-1.5 animate-pulse rounded-full bg-iris" /> Agents working · {Math.max(0, Math.round(elapsed))}s
                </Chip>
              </m.span>
            )}
          </AnimatePresence>
          <Button variant="ghost" onClick={rerun} disabled={rerunning || run.otherOrg || (run.status === "running" && !run.interrupted)} className="!px-3.5" aria-label="Run this analysis again">
            {rerunning ? <Loader2 className="size-4 animate-spin" /> : <RotateCcw className="size-4" />} Run again
          </Button>
        </div>
      </div>
      {rerunError && <p className="mt-3 text-sm text-rose">{rerunError}</p>}
      {run.otherOrg && (
        <p className="mt-4 flex items-start gap-2 rounded-xl border border-amber/30 bg-amber/[0.06] px-4 py-3 text-sm leading-relaxed text-amber">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          {OTHER_ORG_REASON}. You can read it, but drafting and Studio changes are off. To work with this org&apos;s replies, pick a sequence on the home page.
        </p>
      )}

      {/* progress line */}
      <div className="relative mt-6 h-px w-full bg-line">
        <m.div className="absolute inset-y-0 left-0 bg-gradient-to-r from-iris via-aqua to-lime" animate={{ width: `${progress * 100}%` }} transition={{ duration: 0.6 }} />
        <m.div
          className="absolute -top-[3px] size-[7px] rounded-full bg-lime shadow-[0_0_14px_#d4ff4f]"
          animate={{ left: `calc(${progress * 100}% - 3px)` }}
          transition={{ duration: 0.6 }}
        />
      </div>

      {run.status === "failed" && (
        <div className="mt-6 flex items-start gap-3 rounded-2xl border border-rose/30 bg-rose/[0.06] p-4 text-sm">
          <XCircle className="mt-0.5 size-4 shrink-0 text-rose" />
          <div>
            <p className="font-medium text-text">The run stopped at a step it can&apos;t skip.</p>
            <p className="mt-1 text-muted">{run.errors.filter((e) => !e.includes("warning")).slice(-2).join(" · ") || "See the agent log."}</p>
          </div>
        </div>
      )}

      {/* mission control */}
      <div className="mt-6 grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)] xl:grid-cols-[280px_minmax(0,1fr)_320px]">
        <div className="surface rounded-2xl p-3">
          <PipelineRail run={run} />
        </div>

        <div className="surface relative h-[400px] overflow-hidden rounded-2xl lg:h-[540px]">
          <ReplyCore
            className="absolute inset-0"
            label="Replies flowing from the agent core into category clusters"
            layout="wide"
            orbs={orbs}
            clusterMarks={marks}
            highlight={hl != null ? (clusterOf.get(hl) ?? null) : null}
            pulseKey={classified}
            energy={working ? 0.45 : 0.05}
            onHover={(id, x, y) => setTip(id && !id.startsWith("pending-") ? { id, x, y } : null)}
            onSelect={(id) => {
              const r = replies.find((x) => x.threadId === id);
              if (!r) return;
              const g = run.groups.find((x) => x.key === r.category);
              if (g?.card) setOpenCard(r.category);
              else document.getElementById(`g-${r.category}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
            }}
          />
          <div className="pointer-events-none absolute left-4 top-4 flex items-baseline gap-2">
            <span className="text-4xl font-semibold tabular-nums tracking-tight">
              <Counter value={classified} />
            </span>
            <span className="text-sm text-muted">{total ? `/ ${total} classified` : run.steps.fetch === "done" ? "replies" : "fetching…"}</span>
          </div>
          {run.status === "done" && total === 0 && (
            <p className="absolute inset-x-0 top-1/2 -translate-y-1/2 text-center text-sm text-muted">This source has no prospect replies yet.</p>
          )}
          <div className="absolute inset-x-0 bottom-0 flex flex-wrap justify-center gap-1.5 p-3">
            <AnimatePresence>
              {run.groups.map((g) => (
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
                  style={{ borderColor: hl === g.key ? meta(g.key).color : "var(--line-2)", color: meta(g.key).color }}
                >
                  <span className="size-1.5 rounded-full" style={{ background: meta(g.key).color }} />
                  {g.label}
                  <span className="font-mono text-text/80">{g.replies.length}</span>
                </m.button>
              ))}
            </AnimatePresence>
          </div>
        </div>

        <div className="surface h-[300px] overflow-hidden rounded-2xl lg:col-span-2 xl:col-span-1 xl:h-[540px]">
          <AgentLog lines={runLog(run)} done={!working} />
        </div>
      </div>

      {/* groups */}
      <section className="mt-14">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Eyebrow>Step 2</Eyebrow>
            <h2 className="mt-3 text-2xl font-semibold tracking-[-0.03em] sm:text-3xl">
              {run.groups.length ? (
                <>
                  {run.groups.length} {run.groups.length === 1 ? "reason" : "reasons"},{" "}
                  <span className="font-serif font-normal italic text-iris">{guarded ? `${draftable.length} ready to draft` : "guarding contacts…"}</span>
                </>
              ) : run.status === "running" ? (
                "Waiting for the Analyst…"
              ) : (
                "No replies to group"
              )}
            </h2>
          </div>
          {guarded && excludedTotal > 0 && (
            <m.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2 text-sm text-rose/90">
              <ShieldAlert className="size-4" /> The Warden excluded {excludedTotal} contact{excludedTotal > 1 ? "s" : ""}. They never enter a follow-up list.
            </m.p>
          )}
        </div>

        <LayoutGroup>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <AnimatePresence>
              {run.groups.map((g) => (
                <div key={g.key} id={`g-${g.key}`} className="scroll-mt-24">
                  <GroupCard
                    group={g}
                    runId={run.id}
                    guarded={guarded}
                    cardsPending={cardsPending}
                    draftable={g.draftable.ok}
                    highlighted={hl === g.key}
                    onHover={(on) => setHl(on ? g.key : null)}
                    onOpenCard={() => setOpenCard(g.key)}
                  />
                </div>
              ))}
            </AnimatePresence>
            {!run.groups.length && run.status === "running" && Array.from({ length: 3 }, (_, i) => <div key={i} className="surface h-56 animate-pulse rounded-2xl opacity-40" />)}
          </div>
        </LayoutGroup>

        {run.status === "done" && draftable[0] && (
          <m.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="mt-10 flex flex-col items-center gap-3 text-center">
            <p className="text-sm text-muted">Next: review the strongest group and draft its follow-up in graph8.</p>
            <Link href={`/runs/${run.id}/groups/${draftable[0].key}`}>
              <Button variant="primary" magnetic>
                Review {draftable[0].label} <ArrowRight className="size-4" />
              </Button>
            </Link>
          </m.div>
        )}
      </section>

      {run.status === "done" && !run.otherOrg && run.groups.some((g) => g.card) && <LearningsPanel run={run} />}

      {/* orb tooltip */}
      <AnimatePresence>
        {tip && tipReply && (
          <m.div
            className="pointer-events-none fixed z-[70] max-w-72 rounded-xl border border-line-2 bg-ink-2/95 p-3 text-xs backdrop-blur-md"
            style={{ left: tip.x + 14, top: tip.y + 14 }}
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
          >
            <p className="font-medium text-text">
              {tipReply.contactName ?? tipReply.contactEmail} {tipReply.company && <span className="text-dim">· {tipReply.company}</span>}
            </p>
            <p className="mt-1 line-clamp-4 text-muted">“{tipReply.quote}”</p>
            {(tipReply.referredName || tipReply.revisitHint) && (
              <p className="mt-1.5 text-dim">{tipReply.referredName ? `→ ${tipReply.referredName}` : `back ${tipReply.revisitHint}`}</p>
            )}
            <p className="mt-2 flex items-center justify-between gap-2" style={{ color: meta(tipReply.category).color }}>
              {meta(tipReply.category).label}
              <span className="font-mono text-dim">{Math.round(tipReply.confidence * 100)}%</span>
            </p>
          </m.div>
        )}
      </AnimatePresence>

      <Sheet open={!!openGroup?.card} onClose={() => setOpenCard(null)} accent={openGroup ? meta(openGroup.key).color : "#9b8cff"} title="Answer Card">
        {openGroup?.card && (
          <div className="flex flex-col gap-8">
            <div>
              <Eyebrow>Answer Card</Eyebrow>
              <h2 className="mt-3 flex items-center gap-3 text-2xl font-semibold tracking-tight">
                <span className="size-3 rounded-full" style={{ background: meta(openGroup.key).color, boxShadow: `0 0 16px ${meta(openGroup.key).color}` }} />
                {openGroup.label}
                <span className="font-mono text-sm font-normal text-dim">{openGroup.replies.length} replies</span>
              </h2>
            </div>
            <AnswerCardView card={openGroup.card} color={meta(openGroup.key).color} themes={openGroup.themes} />
            {openGroup.draftable.ok && (
              <Link href={`/runs/${run.id}/groups/${openGroup.key}`} className="self-start">
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
