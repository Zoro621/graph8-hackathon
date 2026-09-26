"use client";
import { m } from "motion/react";
import { AlertTriangle, BadgeCheck, FileText, MessageSquareQuote, Target, XCircle } from "lucide-react";
import type { AnswerCard } from "@/lib/types";

const item = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.16, 1, 0.3, 1] as const } },
};

function Section({ icon: Icon, title, children, tone = "text-muted" }: { icon: typeof FileText; title: string; children: React.ReactNode; tone?: string }) {
  return (
    <m.section variants={item} className="flex flex-col gap-2.5">
      <h4 className={`flex items-center gap-2 font-mono text-[10.5px] uppercase tracking-[0.2em] ${tone}`}>
        <Icon className="size-3.5" /> {title}
      </h4>
      {children}
    </m.section>
  );
}

/** The Answer Card, with the grounding check made visible: verified proofs tick in, rejected claims strike out. */
export default function AnswerCardView({ card, color }: { card: AnswerCard; color: string }) {
  const gapLines = (card.proofGap ?? "").split("\n").filter(Boolean);
  const rejected = gapLines.filter((l) => l.startsWith("Unverified: "));
  const gaps = gapLines.filter((l) => !l.startsWith("Unverified: "));
  return (
    <m.div
      className="flex flex-col gap-7"
      initial="hidden"
      animate="show"
      variants={{ show: { transition: { staggerChildren: 0.09 } } }}
    >
      <m.p variants={item} className="text-xl leading-snug tracking-tight text-text sm:text-2xl">
        <span className="font-serif italic" style={{ color }}>
          “
        </span>
        {card.summary}
      </m.p>

      <Section icon={MessageSquareQuote} title="What they said">
        <div className="flex flex-wrap gap-2">
          {[...new Set(card.quotes)].map((q) => (
            <span key={q} className="rounded-lg border border-line bg-white/[0.03] px-3 py-1.5 text-sm text-text">
              “{q}” {card.quotes.filter((x) => x === q).length > 1 && <span className="font-mono text-xs text-dim">×{card.quotes.filter((x) => x === q).length}</span>}
            </span>
          ))}
        </div>
      </Section>

      <Section icon={BadgeCheck} title={`Proof we have · ${card.proofWeHave.length} grounded`} tone="text-aqua">
        <ul className="flex flex-col gap-2.5">
          {card.proofWeHave.map((p, i) => (
            <m.li
              key={p.excerpt}
              variants={item}
              className="group relative overflow-hidden rounded-xl border border-aqua/15 bg-aqua/[0.04] p-3.5"
            >
              <m.span
                className="absolute inset-y-0 left-0 w-0.5 bg-aqua"
                initial={{ scaleY: 0 }}
                animate={{ scaleY: 1 }}
                transition={{ delay: 0.4 + i * 0.15, duration: 0.5 }}
              />
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-medium text-text">{p.claim}</p>
                <span className="flex shrink-0 items-center gap-1 rounded-md border border-aqua/25 px-1.5 py-0.5 font-mono text-[10px] text-aqua">
                  <FileText className="size-3" /> {p.sourceDocName}
                </span>
              </div>
              <p className="mt-2 border-l border-line-2 pl-3 text-[13px] italic leading-relaxed text-muted">
                …<mark className="rounded bg-aqua/15 px-0.5 not-italic text-aqua">{p.excerpt}</mark>…
              </p>
              <p className="mt-2 flex items-center gap-1.5 font-mono text-[10px] text-dim">
                <BadgeCheck className="size-3 text-aqua" /> excerpt found word for word in {p.sourceDocName}
              </p>
            </m.li>
          ))}
          {card.proofWeHave.length === 0 && <li className="text-sm text-dim">No grounded proof in Studio for this objection.</li>}
        </ul>
      </Section>

      {(gaps.length > 0 || rejected.length > 0) && (
        <Section icon={AlertTriangle} title="Proof gap" tone="text-amber">
          <div className="rounded-xl border border-amber/25 bg-amber/[0.05] p-3.5">
            {gaps.map((g) => (
              <p key={g} className="text-sm leading-relaxed text-amber">
                ⚠ {g}
              </p>
            ))}
            {rejected.map((r, i) => (
              <m.div
                key={r}
                className="mt-3 flex items-start gap-2 rounded-lg border border-rose/20 bg-rose/[0.05] p-2.5"
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.9 + i * 0.15 }}
              >
                <XCircle className="mt-0.5 size-3.5 shrink-0 text-rose" />
                <div>
                  <p className="relative inline text-[13px] text-muted">
                    {r.replace("Unverified: ", "")}
                    <m.span
                      className="absolute left-0 top-1/2 h-px w-full origin-left bg-rose"
                      initial={{ scaleX: 0 }}
                      animate={{ scaleX: 1 }}
                      transition={{ delay: 1.2 + i * 0.15, duration: 0.5 }}
                    />
                  </p>
                  <p className="mt-1 font-mono text-[10px] text-rose/80">rejected by grounding check · excerpt not found in the cited doc</p>
                </div>
              </m.div>
            ))}
          </div>
        </Section>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Section icon={Target} title="How to answer" tone="text-iris">
          <p className="text-sm leading-relaxed text-text/90">{card.howToAnswer}</p>
        </Section>
        <Section icon={FileText} title="Email angle" tone="text-lime">
          <p className="rounded-xl border border-lime/20 bg-lime/[0.04] p-3 text-sm leading-relaxed text-text/90">{card.emailAngle}</p>
        </Section>
      </div>
    </m.div>
  );
}
