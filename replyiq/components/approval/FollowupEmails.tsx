"use client";
import { m } from "motion/react";
import { BadgeCheck, Ban, Bot, FileText, Mail, ShieldAlert, XCircle } from "lucide-react";
import { useState } from "react";
import type { GroupView } from "@/lib/api-types";
import type { EmailCheck, SequenceDraft } from "@/lib/types";
import { Chip } from "../ui/primitives";
import { UNVERIFIED_NOTE } from "../run/AnswerCardView";

function Check({ check }: { check: EmailCheck }) {
  return check.ok ? (
    <Chip color="#4fe3d1">
      <BadgeCheck className="size-3" /> passed the fact-check{check.audited ? "" : " (rules only)"}
    </Chip>
  ) : (
    <Chip color="#ff5d7a">
      <XCircle className="size-3" /> {check.issues.length} issue{check.issues.length === 1 ? "" : "s"}
    </Chip>
  );
}

function EmailCard({ label, subject, body, check, delay }: { label: string; subject: string; body: string; check?: EmailCheck; delay: number }) {
  return (
    <m.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay }} className="rounded-2xl border border-line bg-white/[0.025] p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 font-mono text-[11px] text-dim">
          <Mail className="size-3" /> {label}
        </span>
        {check && <Check check={check} />}
      </div>
      <p className="mt-2 font-medium text-text">{subject}</p>
      <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-muted">{body}</p>
      {check && !check.ok && (
        <ul className="mt-3 flex flex-col gap-1">
          {check.issues.map((i) => (
            <li key={i} className="text-xs text-rose/90">
              • {i}
            </li>
          ))}
        </ul>
      )}
    </m.div>
  );
}

/** What the follow-up sequence says, and what it is allowed to claim. Before drafting: the plan. */
export default function FollowupEmails({ group, sequence }: { group: GroupView; sequence?: SequenceDraft }) {
  const [showInstructions, setShowInstructions] = useState(false);
  if (!sequence) {
    return (
      <div className="flex flex-col gap-5 text-sm leading-relaxed text-muted">
        <p>
          When you draft, ReplyIQ builds a two-step follow-up sequence in graph8&apos;s Sequencer. It is created as a draft with no sender attached, so nothing can send until a person launches it.
          {group.returnWaves && group.returnWaves.length > 1 ? " Out of office: one draft per return date, each with the same two steps and step 1 waiting until those people are back." : ""}
        </p>
        <ol className="flex flex-col gap-3">
          <li className="rounded-2xl border border-line bg-white/[0.02] p-4">
            <p className="flex items-center gap-2 font-medium text-text">
              <Bot className="size-4 text-iris" /> Step 1 · written per person by graph8&apos;s AI when it sends
            </p>
            <p className="mt-1">From ReplyIQ&apos;s instructions: what this group said word for word, the goal{group.card ? ` (“${group.card.emailAngle}”)` : ""}, verified facts only, and a never-claim list.</p>
          </li>
          <li className="rounded-2xl border border-line bg-white/[0.02] p-4">
            <p className="flex items-center gap-2 font-medium text-text">
              <FileText className="size-4 text-lime" /> Step 2 · ReplyIQ&apos;s own short follow-up, four days later
            </p>
            <p className="mt-1">Written only from verified facts, then fact-checked: every number must come from a fact, the original campaign&apos;s rules are enforced, and a second model audits every claim.</p>
          </li>
        </ol>
        {group.card?.proofGap && (
          <p className="flex items-start gap-2 rounded-xl border border-amber/25 bg-amber/[0.05] p-3 text-amber">
            <Ban className="mt-0.5 size-4 shrink-0" /> Never claimed: {group.card.proofGap.replace(UNVERIFIED_NOTE, "")}
          </p>
        )}
      </div>
    );
  }

  if (sequence.status === "failed") {
    return (
      <p className="flex items-start gap-2 rounded-xl border border-rose/25 bg-rose/[0.05] p-4 text-sm text-rose">
        <XCircle className="mt-0.5 size-4 shrink-0" /> The follow-up sequence wasn&apos;t created: {sequence.error}
      </p>
    );
  }

  const step2 = sequence.steps.find((s) => s.inputType === "MANUAL_TEMPLATE");
  const drafts = sequence.waves?.filter((w) => w.status !== "retired").length ?? 0;
  return (
    <div className="flex flex-col gap-7">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-medium text-text">{drafts > 1 ? `The same emails in ${drafts} Sequencer drafts, one per return date` : sequence.sequenceName}</span>
        <Chip color={sequence.verified ? "#4fe3d1" : "#ffb547"}>{sequence.verified ? "read back from graph8" : "not verified"}</Chip>
        <Chip>
          <ShieldAlert className="size-3" /> no sender attached
        </Chip>
      </div>

      <section className="flex flex-col gap-3">
        <h4 className="flex items-center gap-2 font-mono text-[10.5px] uppercase tracking-[0.2em] text-iris">
          <Bot className="size-3.5" /> Step 1 · {sequence.waves?.length ? "when they're back (see Return dates)" : "day 0"} · graph8&apos;s AI writes each email at send time
        </h4>
        <div className="rounded-2xl border border-line bg-white/[0.02] p-4 text-sm">
          <p className="text-muted">It can only state these {sequence.facts.length} facts, each found word for word in a company document:</p>
          <ul className="mt-3 flex flex-col gap-2">
            {sequence.facts.map((f) => (
              <li key={f.excerpt} className="rounded-lg border border-aqua/15 bg-aqua/[0.04] px-3 py-2">
                <p className="text-text">{f.claim}</p>
                <p className="mt-0.5 font-mono text-[10px] text-dim">{f.source}</p>
              </li>
            ))}
          </ul>
          {sequence.doNotClaim.length > 0 && (
            <div className="mt-4">
              <p className="text-muted">Never claims (the card said it, no document backs it):</p>
              <ul className="mt-1.5 flex flex-col gap-1">
                {sequence.doNotClaim.map((d) => (
                  <li key={d} className="text-xs text-amber/90">
                    • {d}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {sequence.proofGap && (
            <div className="mt-4">
              <p className="text-muted">Proof we don&apos;t have (never papered over with a guess):</p>
              <p className="mt-1.5 text-xs text-amber/90">⚠ {sequence.proofGap}</p>
            </div>
          )}
          {sequence.originalRules.length > 0 && <p className="mt-4 text-xs text-dim">Plus {sequence.originalRules.length} rules carried over from the original campaign.</p>}
          <button onClick={() => setShowInstructions((v) => !v)} className="mt-4 text-xs text-iris hover:underline">
            {showInstructions ? "Hide" : "Show"} the full instructions graph8 gets
          </button>
          {showInstructions && <pre className="thin-scroll mt-2 max-h-72 overflow-auto whitespace-pre-wrap rounded-lg bg-ink-2 p-3 font-mono text-[11px] leading-relaxed text-muted">{sequence.instructions}</pre>}
        </div>
        {sequence.previews?.map((p, i) => (
          <EmailCard key={p.contactId} label={`preview for ${p.email} · not sent`} subject={p.subject} body={p.body} check={p.check} delay={i * 0.08} />
        ))}
        {sequence.previews && <p className="text-xs text-dim">graph8&apos;s estimate for these previews: about {sequence.previewCredits ?? "?"} credits.</p>}
      </section>

      <section className="flex flex-col gap-3">
        <h4 className="flex items-center gap-2 font-mono text-[10.5px] uppercase tracking-[0.2em] text-lime">
          <FileText className="size-3.5" /> Step 2 · {step2?.delayDays ?? 4} days after step 1 · ReplyIQ&apos;s text
        </h4>
        {sequence.manualEmail ? (
          <EmailCard
            label={`fact-checked in ${sequence.manualEmail.attempts} attempt${sequence.manualEmail.attempts === 1 ? "" : "s"}`}
            subject={sequence.manualEmail.subject}
            body={sequence.manualEmail.body}
            check={sequence.manualEmail.check}
            delay={0.1}
          />
        ) : (
          <p className="text-sm text-muted">Step 2 was left out: it didn&apos;t pass the fact-check twice, and ReplyIQ never saves unchecked text.</p>
        )}
      </section>

      {sequence.warnings.length > 0 && (
        <ul className="flex flex-col gap-1">
          {sequence.warnings.map((w) => (
            <li key={w} className="text-xs text-amber/90">
              ⚠ {w}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
