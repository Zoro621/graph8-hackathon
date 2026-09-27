"use client";
import { ArrowRight, Bot, FileText, Loader2, Mail, Phone } from "lucide-react";
import type { StepView } from "@/lib/api-types";
import type { CampaignDraft, ChannelEvidence } from "@/lib/types";
import { useOriginal } from "@/lib/client/api";
import { splitName } from "@/lib/ui/format";

function StepCard({ step, accent }: { step: StepView & { channel?: "email" | "call" }; accent: string }) {
  const call = step.channel === "call";
  return (
    <div className="rounded-2xl border border-line bg-white/[0.02] p-4">
      <p className="mb-2 flex items-center gap-2 text-xs text-dim">
        <span className="rounded-md border border-line px-1.5 py-0.5 font-mono" style={{ color: accent }}>
          Day {step.day}
        </span>
        {call ? <Phone className="size-3.5" /> : step.kind === "ai" ? <Bot className="size-3.5" /> : <Mail className="size-3.5" />}
        {call ? "call (the rep, with the call script)" : step.kind === "ai" ? "written per contact by graph8's AI" : "fixed email"}
      </p>
      {step.subject && <p className="mb-1 text-sm font-medium text-text">{step.subject}</p>}
      <p className="line-clamp-[8] whitespace-pre-wrap text-[13px] leading-relaxed text-muted">{step.text || "(empty)"}</p>
    </div>
  );
}

/**
 * V1 (the original sequence, read live from graph8) next to V2 (this follow-up draft), with what changed.
 * Days are counted from the start of each sequence.
 */
export default function V1V2Diff({ runId, draft, channels, color }: { runId: string; draft: CampaignDraft; channels?: ChannelEvidence; color: string }) {
  const { data, error, loading } = useOriginal(runId);
  const seq = draft.sequence;
  const s = draft.strategy;

  // V1 steps with cumulative days.
  const v1 = (data?.sequences ?? []).map((q) => {
    let day = 0;
    return { ...q, steps: q.steps.map((st, i) => ({ ...st, day: (day += i === 0 ? 0 : st.day) })) };
  });
  const v2: (StepView & { channel?: "email" | "call" })[] = [];
  if (seq?.status === "ready") {
    for (const st of seq.steps) {
      const day = st.order === 1 ? 0 : st.delayDays;
      if (st.inputType === "ON_DEMAND") v2.push({ order: st.order, day, kind: "ai", text: seq.instructions });
      else v2.push({ order: st.order, day, kind: "template", ...(seq.manualEmail ? { subject: seq.manualEmail.subject, text: seq.manualEmail.body } : { text: "" }) });
    }
  }
  for (const p of s?.plan.filter((x) => x.channel === "call") ?? []) v2.push({ order: 0, day: p.day, kind: "template", channel: "call", text: p.goal });
  v2.sort((a, b) => a.day - b.day);

  const v1Contacts = channels?.sequencer.reduce((n, x) => n + x.contacts, 0) ?? 0;
  const changes = [
    v1Contacts ? `Audience: ${v1Contacts.toLocaleString()} cold contacts → the ${draft.audience.length} who replied for this reason, re-checked for hard stops, calls and suppression.` : `Audience: the ${draft.audience.length} who replied for this reason, re-checked for hard stops, calls and suppression.`,
    seq?.status === "ready" ? `Claims: graph8's AI may only state ${seq.facts.length} fact${seq.facts.length === 1 ? "" : "s"} found word for word in company documents, and never ${seq.doNotClaim.length} unproven claim${seq.doNotClaim.length === 1 ? "" : "s"}.` : null,
    s?.angle ? `Angle: ${s.angle}` : null,
    s?.plan.some((p) => p.channel === "call") ? `Channels: email only → email plus ${s.plan.filter((p) => p.channel === "call").length} call step(s) with a fact-checked script.` : null,
  ].filter((x): x is string => Boolean(x));

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-2xl border border-line bg-white/[0.02] p-4">
        <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.2em] text-dim">What changed</p>
        <ul className="flex flex-col gap-1.5 text-sm leading-relaxed text-text">
          {changes.map((c) => (
            <li key={c} className="flex gap-2">
              <ArrowRight className="mt-1 size-3.5 shrink-0" style={{ color }} />
              {c}
            </li>
          ))}
        </ul>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="min-w-0">
          <p className="mb-3 flex items-center gap-2 text-sm font-medium text-muted">
            <FileText className="size-4" /> V1 · the original{v1[0] ? `: ${splitName(v1[0].name).title}` : ""}
          </p>
          {loading && !data ? (
            <p className="flex items-center gap-2 text-sm text-dim">
              <Loader2 className="size-4 animate-spin" /> Reading the original sequence from graph8…
            </p>
          ) : error ? (
            <p className="text-sm text-rose">Couldn&apos;t read the original sequence: {error.message}</p>
          ) : v1.every((q) => q.steps.length === 0) ? (
            <p className="text-sm text-dim">The original sequence has no readable steps.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {v1.flatMap((q) => q.steps.map((st) => <StepCard key={`${q.id}-${st.order}`} step={st} accent="#8d93ab" />))}
            </div>
          )}
          {data?.errors.map((e) => (
            <p key={e} className="mt-2 text-xs text-amber">
              ⚠ {e}
            </p>
          ))}
        </div>
        <div className="min-w-0">
          <p className="mb-3 flex items-center gap-2 text-sm font-medium" style={{ color }}>
            <Mail className="size-4" /> V2 · this follow-up
          </p>
          {v2.length ? (
            <div className="flex flex-col gap-3">
              {v2.map((st, i) => (
                <StepCard key={`${st.channel ?? "email"}-${st.order}-${i}`} step={st} accent={color} />
              ))}
            </div>
          ) : (
            <p className="text-sm text-dim">The follow-up emails appear here once the draft is written.</p>
          )}
        </div>
      </div>
    </div>
  );
}
