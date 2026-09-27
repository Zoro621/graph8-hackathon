"use client";
import { m } from "motion/react";
import { AlertTriangle, CheckCircle2, Mail, Phone, Target, Voicemail } from "lucide-react";
import type { CampaignStrategy } from "@/lib/types";
import { Chip } from "../ui/primitives";

const ease = [0.16, 1, 0.3, 1] as const;

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2.5 font-mono text-[11px] uppercase tracking-[0.2em] text-dim">{title}</p>
      {children}
    </div>
  );
}

/** The follow-up's revised plan across channels: why V1 didn't convert this group, the angle, who, when, and what to say on a call. */
export default function ChannelPlan({ strategy, color }: { strategy: CampaignStrategy; color: string }) {
  const s = strategy;
  const script = s.callScript;
  return (
    <div className="flex flex-col gap-8">
      {s.diagnosis.length > 0 && (
        <Section title="Why the original didn't convert this group">
          <ul className="flex flex-col gap-2">
            {s.diagnosis.map((d) => (
              <li key={d} className="flex gap-2.5 text-sm leading-relaxed text-text">
                <span className="mt-2 size-1.5 shrink-0 rounded-full" style={{ background: color }} />
                {d}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {s.angle && (
        <Section title="New angle">
          <p className="text-lg leading-snug text-text">{s.angle}</p>
        </Section>
      )}

      {(s.targeting.focus || s.targeting.avoid) && (
        <div className="grid gap-3 sm:grid-cols-2">
          {s.targeting.focus && (
            <div className="rounded-2xl border border-aqua/25 bg-aqua/[0.04] p-4">
              <p className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-aqua">
                <Target className="size-3.5" /> Focus on
              </p>
              <p className="text-sm leading-relaxed text-muted">{s.targeting.focus}</p>
            </div>
          )}
          {s.targeting.avoid && (
            <div className="rounded-2xl border border-rose/25 bg-rose/[0.04] p-4">
              <p className="mb-1.5 text-xs font-medium text-rose">Leave out</p>
              <p className="text-sm leading-relaxed text-muted">{s.targeting.avoid}</p>
            </div>
          )}
        </div>
      )}

      <Section title="Plan by day">
        <ol className="relative flex flex-col gap-3 border-l border-line pl-5">
          {s.plan.map((p, i) => (
            <m.li key={`${p.day}-${p.channel}-${i}`} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.06, ease }} className="relative">
              <span className="absolute -left-[27px] top-0.5 grid size-3.5 place-items-center rounded-full border border-line bg-ink">
                <span className="size-1.5 rounded-full" style={{ background: p.channel === "call" ? "#ffb547" : color }} />
              </span>
              <p className="flex items-center gap-2 text-sm font-medium text-text">
                Day {p.day}
                <Chip color={p.channel === "call" ? "#ffb547" : "#9b8cff"}>
                  {p.channel === "call" ? <Phone className="size-3" /> : <Mail className="size-3" />} {p.channel}
                </Chip>
              </p>
              <p className="mt-0.5 text-sm text-muted">{p.goal}</p>
            </m.li>
          ))}
        </ol>
        <p className="mt-3 text-xs text-dim">The email steps are the follow-up sequence in graph8. Call steps are guidance for the rep and are never dialled by ReplyIQ.</p>
      </Section>

      {script && (
        <Section title="Call script">
          <div className="flex flex-col gap-4 rounded-2xl border border-line bg-white/[0.02] p-5">
            <p className="flex items-center gap-2 text-xs">
              {s.check.ok ? (
                <span className="flex items-center gap-1.5 text-aqua">
                  <CheckCircle2 className="size-3.5" /> passed the fact-check · written into the Studio campaign
                </span>
              ) : (
                <span className="flex items-center gap-1.5 text-amber">
                  <AlertTriangle className="size-3.5" /> {s.check.issues.length} issue{s.check.issues.length === 1 ? "" : "s"} · kept out of Studio until it passes
                </span>
              )}
            </p>
            <div>
              <p className="text-xs text-dim">Opener</p>
              <p className="mt-1 text-sm leading-relaxed text-text">{script.opener}</p>
            </div>
            {script.questions.length > 0 && (
              <div>
                <p className="text-xs text-dim">Ask</p>
                <ul className="mt-1 flex flex-col gap-1 text-sm text-text">
                  {script.questions.map((q) => (
                    <li key={q}>· {q}</li>
                  ))}
                </ul>
              </div>
            )}
            {script.objections.length > 0 && (
              <div className="flex flex-col gap-2">
                <p className="text-xs text-dim">If they say…</p>
                {script.objections.map((o) => (
                  <div key={o.objection} className="rounded-xl border border-line p-3 text-sm">
                    <p className="font-medium text-text">“{o.objection}”</p>
                    <p className="mt-1 leading-relaxed text-muted">{o.answer}</p>
                  </div>
                ))}
              </div>
            )}
            <div>
              <p className="text-xs text-dim">Close</p>
              <p className="mt-1 text-sm leading-relaxed text-text">{script.close}</p>
            </div>
            <div className="rounded-xl border border-line bg-white/[0.02] p-3">
              <p className="flex items-center gap-1.5 text-xs text-dim">
                <Voicemail className="size-3.5" /> Voicemail
              </p>
              <p className="mt-1 text-sm leading-relaxed text-text">{script.voicemail}</p>
            </div>
            {!s.check.ok && s.check.issues.length > 0 && (
              <ul className="flex flex-col gap-1 text-xs text-amber/90">
                {s.check.issues.map((i) => (
                  <li key={i}>⚠ {i}</li>
                ))}
              </ul>
            )}
          </div>
        </Section>
      )}

      <details className="text-xs text-dim">
        <summary className="cursor-pointer">The evidence this plan was built from ({s.evidence.length})</summary>
        <ul className="mt-2 flex flex-col gap-1.5 leading-relaxed">
          {s.evidence.map((e) => (
            <li key={e}>· {e}</li>
          ))}
        </ul>
        <p className="mt-2">Every number in the plan appears in these lines; any line with a number that didn&apos;t was dropped.</p>
      </details>
    </div>
  );
}
