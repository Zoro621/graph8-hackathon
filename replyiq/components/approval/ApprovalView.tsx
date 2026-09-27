"use client";
import { AnimatePresence, m } from "motion/react";
import { AlertTriangle, ArrowLeft, ArrowRight, CalendarClock, CheckCircle2, Coins, ExternalLink, History, Loader2, PenLine, RefreshCcw, Rocket, Sparkles, Users, Wand2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import AnswerCardView from "../run/AnswerCardView";
import FollowupEmails from "./FollowupEmails";
import AudienceTable from "./AudienceTable";
import ChannelPlan from "./ChannelPlan";
import V1V2Diff from "./V1V2Diff";
import DraftProgress from "./DraftProgress";
import ConfirmDraftModal, { DRAFT_CREDITS } from "./ConfirmDraftModal";
import StateNotice from "../shell/StateNotice";
import { Button, Chip, Counter, Eyebrow, HoldButton, SpotCard } from "../ui/primitives";
import { api, keys, revalidate, useRunView, useStatus } from "@/lib/client/api";
import { meta } from "@/lib/ui/categories";
import { displayName, timeAgo } from "@/lib/ui/format";
import { useNow } from "@/lib/client/hooks";
import type { Category } from "@/lib/types";

type Tab = "card" | "emails" | "plan" | "v1v2" | "audience";

const studioUrl = (campaignId: string) => `https://app.graph8.com/studio?campaignId=${encodeURIComponent(campaignId)}`;

export default function ApprovalView({ runId, groupKey }: { runId: string; groupKey: Category }) {
  const { data: run, error } = useRunView(runId);
  const { data: status } = useStatus();
  const info = meta(groupKey);
  const color = info.color;
  const [tab, setTab] = useState<Tab | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const now = useNow(true, 60_000);

  if (!run) {
    if (error?.code === "not_configured") return <StateNotice kind="setup" />;
    if (error?.status === 404) return <StateNotice kind="not-found" title="This run doesn't exist" />;
    if (error) return <StateNotice kind="error" title="Couldn't load this run" detail={error.message} />;
    return <div className="mx-auto h-96 w-full max-w-[1400px] animate-pulse px-6 pt-10" />;
  }

  const group = run.groups.find((g) => g.key === groupKey);
  if (!group || run.status === "running") {
    return (
      <StateNotice
        kind="not-found"
        title={run.status === "running" ? "The agents are still working on this run" : `No “${info.label}” replies in this run`}
        detail={run.status === "running" ? "Come back once the Answer Cards are written." : "Pick another group from the run."}
      />
    );
  }

  const draft = group.draft;
  const drafting = draft?.status === "drafting" && !run.interrupted;
  const jobHere = run.job?.kind === "draft" && run.job.group === groupKey;
  const busyElsewhere = Boolean(run.job) && !jobHere;
  const draftable = group.draftable.ok;
  const referral = groupKey === "referral_wrong_person";
  // The number and its label switch together: the draft's list once it has one; otherwise (no draft yet, or one that
  // stopped short of a list) the server's preflight count, labelled as what it is.
  const onList = draft?.audience.length ?? 0;
  const [audienceLabel, audienceSize] = onList > 0 ? ["On the list", onList] : [referral ? "Named people" : "Eligible", group.draftable.targets];
  const runExcluded = run.groups.reduce((n, g) => n + g.excluded.length, 0);
  const revisit = [...new Set(group.replies.map((r) => r.revisitHint).filter(Boolean))] as string[];
  const current: Tab = tab ?? (draft?.sequence ? "emails" : group.card ? "card" : "audience");
  const writeBlocked = status?.write && !status.write.allowed ? status.write.reason : null;

  // A newer run took this draft over: read-only here. An earlier run's draft of this group can be taken over instead of a new one.
  const takenOver = draft?.supersededBy;
  const previous = draft?.campaignId ? undefined : group.previousDraft;

  const act = async (action: "create" | "patch" | "previews" | "rewrite" | "adopt", label: string) => {
    setPending(label);
    setActionError(null);
    try {
      await api.draft(run.id, groupKey, { action, ...(action === "previews" ? { previews: 2 } : {}), ...(action === "adopt" && previous ? { fromRunId: previous.runId } : {}) });
      await revalidate(keys.run(run.id));
    } catch (e) {
      setActionError((e as Error).message);
    } finally {
      setPending(null);
    }
  };

  const tabs: { k: Tab; label: string; show: boolean }[] = [
    { k: "card", label: "Answer Card", show: Boolean(group.card) },
    { k: "emails", label: "Follow-up emails", show: true },
    { k: "plan", label: "Channel plan", show: Boolean(draft?.strategy) },
    { k: "v1v2", label: "V1 → V2", show: Boolean(draft?.sequence) },
    { k: "audience", label: `Audience · ${audienceSize}`, show: true },
  ];

  const flow = [
    { l: "Evidence", done: true },
    { l: "Draft in graph8", done: draft?.status === "ready" },
    { l: "Launch (you, in graph8)", done: false },
  ];

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 pb-24 pt-8 sm:px-6">
      <Link href={`/runs/${runId}`} className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-text">
        <ArrowLeft className="size-4" /> {displayName(run.source.name)}
      </Link>

      <div className="mt-5 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Eyebrow>Follow-up · {info.tag}</Eyebrow>
          <h1 className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-4xl font-semibold tracking-[-0.035em] sm:text-5xl">
            <m.span
              className="size-4 rounded-full"
              style={{ background: color }}
              animate={{ boxShadow: [`0 0 0px ${color}`, `0 0 28px ${color}`, `0 0 0px ${color}`] }}
              transition={{ repeat: Infinity, duration: 2.4 }}
            />
            {info.label}
            <span className="font-serif text-3xl font-normal italic text-muted sm:text-4xl">follow-up</span>
          </h1>
        </div>
        <ol className="flex flex-wrap items-center gap-2">
          {flow.map((f, i) => (
            <li key={f.l} className="flex items-center gap-2">
              <span className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-colors duration-500 ${f.done ? "border-aqua/40 bg-aqua/10 text-aqua" : "border-line text-dim"}`}>
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
          <div role="tablist" className="surface mb-6 inline-flex max-w-full overflow-x-auto rounded-full p-1">
            {tabs
              .filter((t) => t.show)
              .map((t) => (
                <button
                  key={t.k}
                  role="tab"
                  aria-selected={current === t.k}
                  onClick={() => setTab(t.k)}
                  className={`relative shrink-0 rounded-full px-4 py-2 text-sm transition-colors ${current === t.k ? "text-ink" : "text-muted hover:text-text"}`}
                >
                  {current === t.k && <m.span layoutId="approval-tab" className="absolute inset-0 rounded-full" style={{ background: color }} transition={{ type: "spring", stiffness: 400, damping: 32 }} />}
                  <span className="relative font-medium">{t.label}</span>
                </button>
              ))}
          </div>
          <m.div key={current} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }} className="surface rounded-3xl p-5 sm:p-8">
            {current === "card" && group.card && <AnswerCardView card={group.card} color={color} themes={group.themes} />}
            {current === "emails" && <FollowupEmails group={group} sequence={draft?.sequence} />}
            {current === "plan" && draft?.strategy && <ChannelPlan strategy={draft.strategy} color={color} />}
            {current === "v1v2" && draft && <V1V2Diff runId={run.id} draft={draft} channels={run.channels} color={color} />}
            {current === "audience" && <AudienceTable group={group} runExcluded={runExcluded} />}
          </m.div>
        </div>

        {/* ------------------------------ side panel ------------------------------ */}
        <aside className="flex flex-col gap-4 lg:sticky lg:top-20">
          <SpotCard className="p-5" color="79,227,209">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="flex items-center gap-1.5 text-xs text-muted">
                  <Users className="size-3.5" /> {audienceLabel}
                </p>
                <p className="mt-1 text-3xl font-semibold tabular-nums">
                  <Counter value={audienceSize} />
                </p>
                <button onClick={() => setTab("audience")} className="text-[11px] text-rose/90 hover:underline">
                  {group.excluded.length} excluded here →
                </button>
              </div>
              <div>
                <p className="flex items-center gap-1.5 text-xs text-muted">
                  <Coins className="size-3.5" /> Draft cost
                </p>
                <p className="mt-1 text-3xl font-semibold tabular-nums">~{DRAFT_CREDITS}</p>
                <p className="text-[11px] text-dim">{status?.credits != null ? `${Math.round(status.credits).toLocaleString()} credits left` : "credits, Studio docs"}</p>
              </div>
            </div>
            {(revisit.length > 0 || draft?.timingNote) && (
              <p className="mt-4 flex items-start gap-2 rounded-xl border border-line bg-white/[0.02] p-3 text-xs leading-relaxed text-muted">
                <CalendarClock className="mt-0.5 size-3.5 shrink-0 text-iris" />
                <span>{draft?.timingNote ?? `They said: ${revisit.slice(0, 3).join(", ")}. Timing is advice only: graph8 has no delayed start.`}</span>
              </p>
            )}
          </SpotCard>

          <SpotCard className="p-5" color="155,140,255">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-medium">Draft in graph8</h3>
              {draft?.status === "ready" ? (
                <Chip color="#4fe3d1">ready</Chip>
              ) : drafting ? (
                <Chip color="#9b8cff">drafting</Chip>
              ) : draft?.status === "failed" ? (
                <Chip color="#ff5d7a">failed</Chip>
              ) : run.interrupted && draft?.status === "drafting" ? (
                <Chip color="#ffb547">interrupted</Chip>
              ) : (
                <Chip>not drafted</Chip>
              )}
            </div>

            <AnimatePresence mode="wait" initial={false}>
              {!draft ? (
                <m.div key="idle" exit={{ opacity: 0, height: 0 }} className="flex flex-col gap-3">
                  {previous && (
                    <div className="flex flex-col gap-3 rounded-xl border border-iris/30 bg-iris/[0.05] p-3.5">
                      <p className="flex items-start gap-2 text-xs leading-relaxed text-muted">
                        <History className="mt-0.5 size-3.5 shrink-0 text-iris" />
                        <span>
                          An <Link href={`/runs/${previous.runId}/groups/${groupKey}`} className="text-iris hover:underline">earlier run</Link> already drafted this follow-up
                          {previous.campaignName ? ` (“${previous.campaignName}”)` : ""}, {timeAgo(Date.parse(previous.updatedAt), now)}. Update it with this run&apos;s evidence: the same list, campaign and
                          sequence, with the Answer Card and emails replaced. No new Studio documents, so no ~{DRAFT_CREDITS} credits.
                        </span>
                      </p>
                      {pending === "adopt" ? (
                        <span className="flex items-center gap-2 text-sm text-lime">
                          <Loader2 className="size-4 animate-spin" /> Taking it over…
                        </span>
                      ) : (
                        <HoldButton onConfirm={() => void act("adopt", "adopt")} disabled={!draftable || busyElsewhere || Boolean(writeBlocked) || Boolean(pending)} className="w-full">
                          Hold to update the existing draft
                        </HoldButton>
                      )}
                    </div>
                  )}
                  <p className="text-sm leading-relaxed text-muted">
                    {previous ? "Or create a separate new draft: " : ""}Creates the audience list, a Studio campaign carrying this Answer Card, and fact-checked follow-up emails. You approve before anything is created.
                  </p>
                  <Button variant={previous ? "ghost" : "iris"} magnetic disabled={!draftable || busyElsewhere || Boolean(writeBlocked) || Boolean(pending)} onClick={() => setConfirm(true)} className="w-full">
                    {pending === "create" ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />} {previous ? "Create a new draft instead" : "Draft follow-up in graph8"}
                  </Button>
                  {!draftable && group.draftable.reason && <p className="text-xs text-amber">{group.draftable.reason}.</p>}
                  {writeBlocked && <p className="text-xs text-amber">{writeBlocked}</p>}
                  {busyElsewhere && <p className="text-xs text-amber">Another job is running on this run. Try again when it finishes.</p>}
                </m.div>
              ) : (
                <m.div key="progress" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-4">
                  {takenOver && (
                    <Link
                      href={`/runs/${takenOver}/groups/${groupKey}`}
                      className="flex items-center justify-between gap-3 rounded-xl border border-amber/30 bg-amber/[0.06] p-3 text-xs leading-relaxed text-amber transition-colors hover:bg-amber/10"
                    >
                      A newer run took this draft over: the campaign now carries its evidence. This copy is read-only. <span className="flex shrink-0 items-center gap-1 font-medium">Continue there <ArrowRight className="size-3.5" /></span>
                    </Link>
                  )}
                  {draft.adoptedFrom && !takenOver && (
                    <p className="flex items-start gap-2 text-xs leading-relaxed text-dim">
                      <History className="mt-0.5 size-3.5 shrink-0" />
                      <span>
                        Took over the draft of an <Link href={`/runs/${draft.adoptedFrom}/groups/${groupKey}`} className="text-iris hover:underline">earlier run</Link>: same list, campaign and sequence, updated with this run&apos;s evidence.
                      </span>
                    </p>
                  )}
                  <DraftProgress draft={draft} working={drafting || jobHere} />
                  {draft.status === "failed" && draft.error && <p className="rounded-xl border border-rose/25 bg-rose/[0.05] p-3 text-xs leading-relaxed text-rose">{draft.error}</p>}
                  {draft.warnings.length > 0 && draft.status !== "drafting" && (
                    <details className="text-xs text-amber/90">
                      <summary className="cursor-pointer">{draft.warnings.length} note{draft.warnings.length === 1 ? "" : "s"} on this draft</summary>
                      <ul className="mt-2 flex flex-col gap-1">
                        {draft.warnings.map((w) => (
                          <li key={w}>⚠ {w}</li>
                        ))}
                      </ul>
                    </details>
                  )}
                  {draft.campaignId && (
                    <a href={studioUrl(draft.campaignId)} target="_blank" rel="noreferrer" className="flex items-center justify-between rounded-xl border border-line px-3 py-2.5 text-sm text-text transition-colors hover:border-line-2 hover:bg-white/5">
                      Open the campaign in Studio <ExternalLink className="size-4 text-iris" />
                    </a>
                  )}
                  {!drafting && !jobHere && !takenOver && (
                    <div className="flex flex-wrap gap-2">
                      {(draft.status === "failed" || (run.interrupted && draft.status === "drafting")) && (
                        <Button variant="ghost" onClick={() => setConfirm(true)} disabled={busyElsewhere || Boolean(pending)} className="!px-3.5 !py-2 text-xs">
                          <RefreshCcw className="size-3.5" /> {draft.campaignId ? "Resume" : "Try again"}
                        </Button>
                      )}
                      {draft.status === "ready" && draft.docsPending.length > 0 && (
                        <Button variant="ghost" onClick={() => act("patch", "patch")} disabled={busyElsewhere || Boolean(pending)} className="!px-3.5 !py-2 text-xs">
                          {pending === "patch" ? <Loader2 className="size-3.5 animate-spin" /> : <Wand2 className="size-3.5" />} Add the card to {draft.docsPending.length} late doc{draft.docsPending.length === 1 ? "" : "s"}
                        </Button>
                      )}
                      {draft.status === "ready" && draft.sequence?.status === "ready" && (
                        <Button
                          variant="ghost"
                          onClick={() => act("rewrite", "rewrite")}
                          disabled={busyElsewhere || Boolean(pending)}
                          className="!px-3.5 !py-2 text-xs"
                          title="Writes the follow-up emails and the channel plan again, fact-checked, in the same Sequencer draft. No new sequence; nothing is sent."
                        >
                          {pending === "rewrite" ? <Loader2 className="size-3.5 animate-spin" /> : <PenLine className="size-3.5" />} Rewrite the follow-up emails
                        </Button>
                      )}
                      {draft.status === "ready" && draft.sequence?.status === "ready" && !referral && (
                        <Button variant="ghost" onClick={() => act("previews", "previews")} disabled={busyElsewhere || Boolean(pending)} className="!px-3.5 !py-2 text-xs" title="graph8's AI drafts step 1 for 2 contacts now (about 9 credits each). Nothing is sent.">
                          {pending === "previews" ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />} Preview step 1 (~18 credits)
                        </Button>
                      )}
                    </div>
                  )}
                </m.div>
              )}
            </AnimatePresence>
            {actionError && <p className="mt-3 text-xs text-rose">{actionError}</p>}
          </SpotCard>

          <div className="rounded-2xl border border-line bg-white/[0.02] p-4 text-xs leading-relaxed text-muted">
            <p className="flex items-center gap-2 font-medium text-text">
              <Rocket className="size-3.5 text-lime" /> Launching stays with you
            </p>
            <p className="mt-1.5">ReplyIQ never attaches a sender. In graph8, connect a mailbox to the follow-up sequence and launch it yourself.</p>
            {run.interrupted && draft?.status === "drafting" && (
              <p className="mt-2 flex items-start gap-1.5 text-amber">
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0" /> The server stopped while drafting. Resume reuses the list and campaign already created.
              </p>
            )}
          </div>
        </aside>
      </div>

      <ConfirmDraftModal
        open={confirm}
        onClose={() => setConfirm(false)}
        color={color}
        groupLabel={info.label}
        referral={referral}
        hasCard={Boolean(group.card)}
        audience={group.eligible.length}
        balance={status?.credits}
        onConfirm={() => {
          setConfirm(false);
          void act("create", "create");
        }}
      />
    </div>
  );
}
