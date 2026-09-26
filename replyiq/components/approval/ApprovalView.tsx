"use client";
import { AnimatePresence, m } from "motion/react";
import { ArrowLeft, CalendarClock, CheckCircle2, Coins, ExternalLink, Rocket, Sparkles, Users } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import AnswerCardView from "../run/AnswerCardView";
import V1V2Diff from "./V1V2Diff";
import AudienceTable from "./AudienceTable";
import DraftProgress from "./DraftProgress";
import LaunchModal from "./LaunchModal";
import { Button, Chip, Counter, Eyebrow, SpotCard } from "../ui/primitives";
import { useDraft, useLaunched, useRun } from "@/lib/client/hooks";
import { recordLaunch, startDraft } from "@/lib/client/store";
import { creditEstimate, sequenceOf } from "@/lib/demo/engine";
import { V1_STEPS, V2_STEPS, contactOf } from "@/lib/demo/fixtures";
import { TAXONOMY, canDraft } from "@/lib/taxonomy";
import { CATEGORY_COLOR } from "@/lib/ui/theme";
import type { Category } from "@/lib/types";

type Tab = "card" | "diff" | "audience";

export default function ApprovalView({ runId, groupKey, launchEnabled }: { runId: string; groupKey: Category; launchEnabled: boolean }) {
  const state = useRun(runId);
  const draft = useDraft(runId, groupKey);
  const launched = useLaunched(runId, groupKey);
  const rule = TAXONOMY[groupKey];
  const color = CATEGORY_COLOR[groupKey];
  const [tab, setTab] = useState<Tab>(rule.answerCard ? "card" : "diff");
  const [modal, setModal] = useState(false);

  if (!state) return <div className="mx-auto h-96 w-full max-w-[1400px] animate-pulse px-6 pt-10" />;
  const { snap, final } = state;
  const group = snap.run.groups.find((g) => g.key === groupKey);
  const seq = sequenceOf(snap.run.source.sequenceId);

  if (!group || !snap.done) {
    const exists = final.run.groups.some((g) => g.key === groupKey);
    return (
      <div className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center gap-4 px-6 py-24 text-center">
        <span className="size-3 animate-pulse rounded-full" style={{ background: color }} />
        <h1 className="text-2xl font-semibold tracking-tight">{exists ? "The agents are still working on this run" : `No “${rule.short}” replies in this run`}</h1>
        <p className="text-sm text-muted">{exists ? "Come back once the Answer Cards are written." : "Pick another group from the run."}</p>
        <Link href={`/runs/${runId}`}>
          <Button variant="ghost">
            <ArrowLeft className="size-4" /> Back to the run
          </Button>
        </Link>
      </div>
    );
  }

  const v1 = V1_STEPS[seq.id] ?? [];
  const v2 = V2_STEPS[groupKey] ?? v1;
  const eligible = group.eligible;
  const credits = creditEstimate(v2.length, eligible.length);
  const draftable = canDraft(groupKey, eligible.length);
  const runExcluded = snap.run.groups.flatMap((g) => g.excluded);
  const timing = group.replies.find((r) => r.revisitHint)?.revisitHint;
  const audience = eligible.map((e) => {
    const n = Number(e.email.match(/(\d+)@/)?.[1]);
    const c = contactOf(n);
    return { email: e.email, name: c.name, company: c.company };
  });

  const changes = [
    { what: `Hook: “${v1[0]?.subject}” → “${v2[0]?.subject}”`, why: `${group.replies.length} replies asked for this directly: “${group.replies[0].quote}”.` },
    { what: `Angle: ${rule.angle}`, why: group.card?.emailAngle ?? "Follows the taxonomy rule for this reason." },
    { what: `${v1.length} → ${v2.length} steps`, why: "Shorter gaps: these people already replied once." },
    {
      what: group.card?.proofWeHave.length ? `${group.card.proofWeHave.length} grounded proof points` : "No proof claims",
      why: group.card?.proofGap ? "Anything not in Studio is kept out of the copy and flagged as a gap." : "Nothing to ground for this group.",
    },
  ];

  const tabs: { k: Tab; label: string; show: boolean }[] = [
    { k: "card", label: "Answer Card", show: !!group.card },
    { k: "diff", label: "V1 → V2", show: true },
    { k: "audience", label: `Audience · ${eligible.length}`, show: true },
  ];

  const flow = [
    { l: "Evidence", done: true },
    { l: "Draft", done: draft.status === "ready" },
    { l: "Approve", done: launched },
  ];

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 pb-24 pt-8 sm:px-6">
      <Link href={`/runs/${runId}`} className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-text">
        <ArrowLeft className="size-4" /> {seq.label}
      </Link>

      <div className="mt-5 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Eyebrow>Approval · {rule.label}</Eyebrow>
          <h1 className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-4xl font-semibold tracking-[-0.035em] sm:text-5xl">
            <m.span
              className="size-4 rounded-full"
              style={{ background: color }}
              animate={{ boxShadow: [`0 0 0px ${color}`, `0 0 28px ${color}`, `0 0 0px ${color}`] }}
              transition={{ repeat: Infinity, duration: 2.4 }}
            />
            {rule.short}
            <span className="font-serif text-3xl font-normal italic text-muted sm:text-4xl">follow-up</span>
          </h1>
        </div>
        <ol className="flex items-center gap-2">
          {flow.map((f, i) => (
            <li key={f.l} className="flex items-center gap-2">
              <span
                className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-colors duration-500 ${
                  f.done ? "border-aqua/40 bg-aqua/10 text-aqua" : "border-line text-dim"
                }`}
              >
                {f.done ? <CheckCircle2 className="size-3.5" /> : <span className="font-mono">{i + 1}</span>}
                {f.l}
              </span>
              {i < flow.length - 1 && <span className={`h-px w-5 ${flow[i + 1].done || f.done ? "bg-aqua/40" : "bg-line"}`} />}
            </li>
          ))}
        </ol>
      </div>

      <div className="mt-10 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        {/* ---------------------------- evidence tabs ---------------------------- */}
        <div className="min-w-0">
          <div role="tablist" className="surface mb-6 inline-flex rounded-full p-1">
            {tabs
              .filter((t) => t.show)
              .map((t) => (
                <button
                  key={t.k}
                  role="tab"
                  aria-selected={tab === t.k}
                  onClick={() => setTab(t.k)}
                  className={`relative rounded-full px-4 py-2 text-sm transition-colors ${tab === t.k ? "text-ink" : "text-muted hover:text-text"}`}
                >
                  {tab === t.k && (
                    <m.span layoutId="approval-tab" className="absolute inset-0 rounded-full" style={{ background: color }} transition={{ type: "spring", stiffness: 400, damping: 32 }} />
                  )}
                  <span className="relative font-medium">{t.label}</span>
                </button>
              ))}
          </div>
          <m.div
            key={tab}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="surface rounded-3xl p-5 sm:p-8"
          >
            {tab === "card" && group.card && <AnswerCardView card={group.card} color={color} />}
            {tab === "diff" && <V1V2Diff v1={v1} v2={v2} color={color} changes={changes} />}
            {tab === "audience" && <AudienceTable group={group} runExcluded={runExcluded} />}
          </m.div>
        </div>

        {/* ------------------------------ mission panel ------------------------------ */}
        <aside className="flex flex-col gap-4 lg:sticky lg:top-20">
          <SpotCard className="p-5" color="79,227,209">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="flex items-center gap-1.5 text-xs text-muted">
                  <Users className="size-3.5" /> Audience
                </p>
                <p className="mt-1 text-3xl font-semibold tabular-nums">
                  <Counter value={eligible.length} />
                </p>
                <button onClick={() => setTab("audience")} className="text-[11px] text-rose/90 hover:underline">
                  {runExcluded.length} excluded in run →
                </button>
              </div>
              <div>
                <p className="flex items-center gap-1.5 text-xs text-muted">
                  <Coins className="size-3.5" /> Est. credits
                </p>
                <p className="mt-1 text-3xl font-semibold tabular-nums">
                  ~<Counter value={credits.total} />
                </p>
                <p className="text-[11px] text-dim">
                  {credits.sends} sends + ~{credits.generation} generation
                </p>
              </div>
            </div>
            {(timing || rule.note) && (
              <p className="mt-4 flex items-start gap-2 rounded-xl border border-line bg-white/[0.02] p-3 text-xs leading-relaxed text-muted">
                <CalendarClock className="mt-0.5 size-3.5 shrink-0 text-iris" />
                <span>
                  {timing ? <>Prospects said “{timing}”. Timing is advice only: graph8 has no delayed-start field.</> : rule.note}
                </span>
              </p>
            )}
          </SpotCard>

          <SpotCard className="p-5" color="155,140,255">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-medium">Follow-up campaign</h3>
              {draft.status === "ready" ? <Chip color="#4fe3d1">draft ready</Chip> : draft.status === "drafting" ? <Chip color="#9b8cff">drafting</Chip> : <Chip>not drafted</Chip>}
            </div>
            <AnimatePresence mode="wait" initial={false}>
              {draft.status === "idle" ? (
                <m.div key="idle" exit={{ opacity: 0, height: 0 }} className="flex flex-col gap-3">
                  <p className="text-sm leading-relaxed text-muted">
                    Creates a graph8 list of {eligible.length} contacts and a Studio campaign whose brief embeds this Answer Card. Doc generation
                    spends AI credits, so it only runs when you click.
                  </p>
                  <Button
                    variant="iris"
                    magnetic
                    disabled={!draftable}
                    onClick={() => startDraft(runId, groupKey)}
                    className="w-full"
                  >
                    <Sparkles className="size-4" /> Draft follow-up campaign
                  </Button>
                  {!draftable && <p className="text-xs text-amber">Needs at least 2 eligible contacts in a follow-up category.</p>}
                </m.div>
              ) : (
                <m.div key="progress" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                  <DraftProgress draft={draft} color={color} />
                  {draft.status === "ready" && (
                    <m.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-4 grid grid-cols-2 gap-2 text-xs">
                      <span className="flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-2 text-muted">
                        <Users className="size-3.5 text-aqua" /> Audience list created
                      </span>
                      <span className="flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-2 text-muted">
                        <ExternalLink className="size-3.5 text-iris" /> Draft in Studio
                      </span>
                    </m.div>
                  )}
                </m.div>
              )}
            </AnimatePresence>
          </SpotCard>

          <m.div animate={{ opacity: draft.status === "ready" ? 1 : 0.45 }}>
            <Button
              variant="primary"
              magnetic
              disabled={draft.status !== "ready"}
              onClick={() => setModal(true)}
              className="w-full !py-3.5 text-[15px]"
            >
              <Rocket className="size-4" /> {launched ? "Approved · view outbox" : "Approve & launch"}
            </Button>
            <p className="mt-2 text-center text-[11px] text-dim">
              {draft.status === "ready" ? "Nothing launches without your hold-to-confirm." : "Draft the campaign first."}
            </p>
          </m.div>
        </aside>
      </div>

      <LaunchModal
        open={modal}
        onClose={() => setModal(false)}
        color={color}
        launchEnabled={launchEnabled}
        launched={launched}
        onLaunch={() => recordLaunch(runId, groupKey)}
        summary={{ steps: v2.length, audience, credits: credits.total, firstStep: v2[0] }}
      />
    </div>
  );
}
