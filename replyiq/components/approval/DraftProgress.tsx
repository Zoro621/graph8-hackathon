"use client";
import { m } from "motion/react";
import { Check, Loader2, X } from "lucide-react";
import { docList } from "@/lib/docLabels";
import type { CampaignDraft } from "@/lib/types";

interface Stage {
  label: string;
  done: boolean;
  detail?: string;
}

/** The draft's real stages, read from what graph8 has returned so far (lib/pipeline/draftCampaign.ts). */
export function draftStages(d: CampaignDraft | undefined, timed = false): Stage[] {
  const seq = d?.sequence;
  const waves = seq?.waves?.filter((w) => w.status !== "retired") ?? [];
  const stages: Stage[] = [
    { label: "Re-check hard stops and suppression", done: Boolean(d?.audience.length), detail: d?.audience.length ? `${d.audience.length} contacts cleared` : undefined },
    { label: "Create the audience list", done: Boolean(d?.listId), detail: d?.listTitle },
    { label: "Create the Studio campaign", done: Boolean(d?.campaignId), detail: d?.campaignName },
    {
      label: "Studio writes the campaign docs",
      done: d?.generation === "complete" || Boolean(d?.docsPatched.length),
      detail:
        d?.generation === "in_progress"
          ? `still writing${d.docsPending.length ? ` ${docList(d.docsPending)}` : ""}`
          : d?.docsFailed.length
            ? `Studio left ${d.docsFailed.length} empty (a known graph8 issue); ReplyIQ filled the ones it owns`
            : undefined,
    },
    { label: "Add the Answer Card to the docs", done: Boolean(d?.docsPatched.length), detail: d?.docsPatched.length ? docList(d.docsPatched) : undefined },
    { label: "Write and fact-check the follow-up emails", done: Boolean(seq), detail: seq ? (seq.status === "ready" ? (waves.length > 1 ? "the same emails in every return-date draft" : seq.sequenceName) : seq.error) : undefined },
  ];
  // Out of office: each return date gets its own Sequencer draft, step 1 waiting until they are back.
  if (timed)
    stages.push({
      label: "Time the first email to each return date",
      done: waves.length > 0,
      detail: waves.length ? `${waves.length} return date${waves.length === 1 ? "" : "s"}, ${waves.length} Sequencer draft${waves.length === 1 ? "" : "s"}` : undefined,
    });
  return stages;
}

export default function DraftProgress({ draft, working, timed = false }: { draft: CampaignDraft | undefined; working: boolean; timed?: boolean }) {
  const stages = draftStages(draft, timed);
  const active = working ? stages.findIndex((s) => !s.done) : -1;
  const failed = draft?.status === "failed";
  return (
    <ol className="flex flex-col gap-2.5">
      {stages.map((s, i) => {
        const isActive = i === active;
        const isFailed = failed && i === stages.findIndex((x) => !x.done);
        return (
          <m.li key={s.label} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }} className="flex items-start gap-3 text-sm">
            <span
              className={`mt-0.5 grid size-6 shrink-0 place-items-center rounded-full border transition-colors duration-300 ${
                s.done ? "border-aqua/50 bg-aqua/10" : isFailed ? "border-rose/50 bg-rose/10" : isActive ? "border-iris/60 bg-iris/10" : "border-line"
              }`}
            >
              {s.done ? (
                <Check className="size-3 text-aqua" strokeWidth={3} />
              ) : isFailed ? (
                <X className="size-3 text-rose" />
              ) : isActive ? (
                <Loader2 className="size-3 animate-spin text-iris" />
              ) : (
                <span className="size-1 rounded-full bg-dim" />
              )}
            </span>
            <span className="min-w-0">
              <span className={s.done ? "text-text" : isActive ? "text-iris" : isFailed ? "text-rose" : "text-dim"}>{s.label}</span>
              {s.detail && <span className="line-clamp-2 block text-xs text-dim">{s.detail}</span>}
            </span>
          </m.li>
        );
      })}
    </ol>
  );
}
