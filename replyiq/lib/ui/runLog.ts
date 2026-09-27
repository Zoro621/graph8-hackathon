// The agent log, derived from the run's real state (steps, counts, summaries, warnings). Nothing invented.
import type { RunView } from "../api-types";
import type { StepName } from "../types";
import { meta } from "./categories";
import { displayName } from "./format";
import { STEP_META, STEP_ORDER } from "./theme";

export type Tone = "info" | "ok" | "warn" | "stop" | "agent";
export interface LogLine {
  step: StepName;
  agent: string;
  text: string;
  tone: Tone;
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

const EXCLUSION_LABEL: Record<string, string> = {
  hard_no: "hard no",
  unsubscribe: "unsubscribe",
  hard_stop_elsewhere: "said no elsewhere",
  suppressed: "suppressed",
  suppression_unknown: "suppression unknown",
  not_found: "not in CRM",
  no_followup_category: "no follow-up",
  said_no_on_call: "said no on a call",
  booked_on_call: "booked on a call",
};

function stepLines(run: RunView, step: StepName): Omit<LogLine, "step" | "agent">[] {
  const state = run.steps[step];
  if (state === "pending") return [];
  if (state === "running") return [{ text: "working…", tone: "agent" }];
  const out: Omit<LogLine, "step" | "agent">[] = [];
  const add = (text: string, tone: Tone = "info") => out.push({ text, tone });
  switch (step) {
    case "load":
      if (state === "done") {
        add(`Loaded “${displayName(run.source.name)}” · ${plural(run.source.sequences.length, "sequence")}`, "ok");
        if (run.source.docs.length) add(`Campaign documents found: ${run.source.docs.join(", ")}`);
      }
      run.source.warnings.forEach((w) => add(w, "warn"));
      break;
    case "fetch":
      if (state === "done") add(`${plural(run.counts.threads, "thread")} · ${plural(run.counts.prospectReplies, "prospect reply", "prospect replies")}`, "ok");
      break;
    case "classify":
      for (const g of run.groups) add(`${g.label} · ${g.replies.length} · “${(g.replies[0]?.quote ?? "").slice(0, 60)}”`, meta(g.key).hardStop ? "stop" : "agent");
      if (run.counts.needsReview) add(`${plural(run.counts.needsReview, "reply", "replies")} flagged for a human to review`, "warn");
      break;
    case "themes": {
      const themed = run.groups.filter((g) => g.themes?.length);
      if (state === "skipped") add("No group had enough replies for themes");
      else if (themed.length) add(`${plural(themed.reduce((n, g) => n + (g.themes?.length ?? 0), 0), "theme")} found across ${plural(themed.length, "group")}`, "ok");
      break;
    }
    case "tag":
      if (state === "skipped") add("Tags not written to graph8 (read-only run or writes not allowed)", "warn");
      else if (run.tagging) {
        const t = run.tagging;
        add(`Tagged ${t.tagged} · already tagged ${t.already}${t.failed ? ` · failed ${t.failed}` : ""}`, t.failed ? "warn" : "ok");
        if (t.tagsCreated.length) add(`Created tags: ${t.tagsCreated.join(", ")}`);
      }
      break;
    case "resolve":
      if (run.channels?.calls.status === "ok") add(`Dialer: ${plural(run.channels.calls.contacts.length, "person", "people")} who replied were also called`);
      if (run.audience) {
        add(`${plural(run.audience.eligible, "contact")} eligible for a follow-up`, "ok");
        const ex = Object.entries(run.audience.excluded).filter(([, n]) => n);
        if (ex.length) add(`Excluded: ${ex.map(([k, n]) => `${EXCLUSION_LABEL[k] ?? k} ${n}`).join(" · ")}`, "stop");
      }
      break;
    case "cards":
      if (state === "skipped") add("No objection groups, so no Answer Cards needed");
      else if (run.cards) {
        const c = run.cards;
        add(`${plural(c.generated, "Answer Card")} · ${plural(c.verifiedProof, "proof point")} verified word for word`, "ok");
        if (c.unverifiedClaims) add(`${plural(c.unverifiedClaims, "claim")} dropped by the grounding check`, "warn");
        if (c.failed) add(`${plural(c.failed, "card")} could not be written`, "warn");
      }
      break;
  }
  if (state === "failed" && !out.some((l) => l.tone === "stop")) add("step failed", "stop");
  // Warnings the pipeline recorded for this step ("classify: …").
  for (const e of run.errors) if (e.startsWith(`${step}:`)) add(e.slice(step.length + 1).trim(), state === "failed" ? "stop" : "warn");
  return out;
}

export function runLog(run: RunView): LogLine[] {
  const lines: LogLine[] = [];
  for (const step of STEP_ORDER) {
    for (const l of stepLines(run, step)) lines.push({ step, agent: STEP_META[step].agent, ...l });
  }
  if (run.status === "done") lines.push({ step: "cards", agent: "ReplyIQ", text: "Run complete. Pick a group to draft its follow-up.", tone: "ok" });
  if (run.status === "failed") lines.push({ step: "cards", agent: "ReplyIQ", text: "Run failed. See the notes above.", tone: "stop" });
  if (run.interrupted && run.status === "running") lines.push({ step: "cards", agent: "ReplyIQ", text: "The server stopped before the run finished. Run it again.", tone: "stop" });
  return lines;
}
