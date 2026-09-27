// The revised strategy for one follow-up, built from every channel's evidence (channels.ts): why the original
// sequence didn't convert this group, the angle, who to focus on, a day-by-day plan across email and calls,
// and a call script with a voicemail. Guardrails, like the emails:
//   - every number in the diagnosis and targeting must appear in the evidence lines (else that line is dropped)
//   - the email steps are the follow-up sequence's own (day 0, day STEP2_DELAY_DAYS); the plan can't move them
//   - the call script and voicemail may only state the verified facts: they go through the same fact-check
//     as the emails, and only a script that passes is written into the Studio campaign
import { z } from "zod";
import { describeError } from "../g8";
import type { Llm } from "../llm";
import { categoryInfo } from "../taxonomy";
import type { CampaignStrategy, EmailFact, Group, Run } from "../types";
import { evidenceLines } from "./channels";
import { fullCheck, numbersIn, STEP2_DELAY_DAYS } from "./followupSequence";

const StrategySchema = z.object({
  diagnosis: z.array(z.string()).min(1).max(4),
  angle: z.string(),
  targeting: z.object({ focus: z.string(), avoid: z.string() }),
  plan: z.array(z.object({ day: z.number().int().min(0).max(30), channel: z.enum(["email", "call"]), goal: z.string() })).min(1).max(6),
  call_script: z
    .object({
      opener: z.string(),
      questions: z.array(z.string()).max(3),
      objections: z.array(z.object({ objection: z.string(), answer: z.string() })).max(4),
      close: z.string(),
      voicemail: z.string(),
    })
    .nullable(),
});

export const STRATEGY_PROMPT = [
  "You are a B2B outbound strategist. A sequence has finished; you are planning the follow-up for ONE group of prospects who replied for the same reason.",
  "EVIDENCE lists what happened on graph8's channels (sequencer funnel, inbox replies, dialer outcomes, meetings). FACTS are the only true statements about the product.",
  "Return:",
  "- diagnosis: 2-4 short bullets on why the original sequence did not convert this group. Every number you use must be copied exactly from EVIDENCE. Never invent or compute numbers.",
  "- angle: one sentence, the new angle for this group.",
  "- targeting: focus = who in this group to prioritise and why; avoid = who to leave out and why. Use EVIDENCE only.",
  `- plan: the steps by day. It MUST contain the two email steps as given in EMAIL_STEPS (day 0 and day ${STEP2_DELAY_DAYS}). Add at most 2 call steps, and only when EVIDENCE supports calling (for example contacts were reachable by phone, or email alone reached few). Each step has a one-line goal.`,
  "- call_script: only if the plan has a call step, else null. opener (one or two sentences), up to 3 discovery questions, objection handling for the objections seen in QUOTES and the card, close, and a voicemail under 60 words.",
  "  In the script, only state product facts from FACTS; for anything else, offer to follow up. Never claim anything in DO_NOT_CLAIM. Merge fields allowed: {{first_name}}, {{company}}.",
  "Plain English, no hype, no em dashes.",
].join("\n");

export interface StrategyDeps {
  llm: Llm;
  model: string;
  auditModel?: string;
}

/** Notes about dropped diagnosis / targeting lines (not problems of the call script). */
const GROUNDING_NOTE = /^(diagnosis line dropped|targeting used a number)/;

/** Diagnosis and targeting lines whose numbers are not all in the evidence are dropped (never shown, never written). */
function groundNumbers(lines: string[], evidence: string[]): { kept: string[]; dropped: string[] } {
  const known = new Set(evidence.flatMap(numbersIn));
  const kept: string[] = [];
  const dropped: string[] = [];
  for (const l of lines) (numbersIn(l).every((n) => known.has(n)) ? kept : dropped).push(l);
  return { kept, dropped };
}

export async function planStrategy(deps: StrategyDeps, run: Run, group: Group, facts: EmailFact[], doNotClaim: string[], now = new Date()): Promise<CampaignStrategy> {
  const evidence = evidenceLines(run, run.channels, group.key);
  const info = categoryInfo(group.key);
  const quotes = [...new Set(group.replies.map((r) => r.quote.replace(/\s+/g, " ").trim()))].slice(0, 6);
  const ask = async (fix: string[] = []) =>
    (
      await deps.llm.parse({
        model: deps.model,
        system: STRATEGY_PROMPT,
        user: JSON.stringify({
          GROUP: { reason: info.label, definition: info.definition, replies: group.replies.length, eligible: group.eligible.length },
          QUOTES: quotes,
          CARD: group.card ? { summary: group.card.summary, how_to_answer: group.card.howToAnswer, proof_gap: group.card.proofGap ?? null } : null,
          EVIDENCE: evidence,
          EMAIL_STEPS: [
            { day: 0, channel: "email", note: "step 1, written per contact by graph8's AI from the verified facts" },
            { day: STEP2_DELAY_DAYS, channel: "email", note: "step 2, ReplyIQ's fact-checked email" },
          ],
          FACTS: facts.map((f) => `${f.claim}: "${f.excerpt}"`),
          DO_NOT_CLAIM: doNotClaim,
          ...(fix.length ? { CALL_SCRIPT_FAILED_FACT_CHECK: fix, INSTRUCTION: "Rewrite the call script so every product statement is in FACTS; for anything else, offer to follow up without implying what the answer will be." } : {}),
        }),
        schema: StrategySchema,
        name: "followup_strategy",
      })
    ).data;

  // One rewrite when the call script fails the fact-check, with the problems as feedback (like step 2).
  let data = await ask();
  let result = await validate(deps, data, evidence, facts, doNotClaim);
  if (result.callScript && !result.check.ok && result.check.audited) {
    const retry = await ask(result.check.issues.filter((i) => !GROUNDING_NOTE.test(i))); // only the script's own problems
    const second = await validate(deps, retry, evidence, facts, doNotClaim);
    if (second.check.ok || !second.callScript) [data, result] = [retry, second];
  }
  return { ...result, angle: data.angle.trim(), evidence, createdAt: now.toISOString() };
}

async function validate(
  deps: StrategyDeps,
  data: z.infer<typeof StrategySchema>,
  evidence: string[],
  facts: EmailFact[],
  doNotClaim: string[],
): Promise<Omit<CampaignStrategy, "angle" | "evidence" | "createdAt">> {
  const issues: string[] = [];
  const diagnosis = groundNumbers(data.diagnosis, evidence);
  for (const d of diagnosis.dropped) issues.push(`diagnosis line dropped (a number not in the evidence): "${d.slice(0, 120)}"`);
  const targeting = groundNumbers([data.targeting.focus, data.targeting.avoid], evidence);
  if (targeting.dropped.length) issues.push("targeting used a number not in the evidence; it was left out");
  const focus = targeting.kept.includes(data.targeting.focus) ? data.targeting.focus : "";
  const avoid = targeting.kept.includes(data.targeting.avoid) ? data.targeting.avoid : "";

  // The email steps are the sequence's own; calls at most 2, never on an email day's slot conflict.
  const calls = data.plan.filter((p) => p.channel === "call").slice(0, 2);
  const emailGoal = (day: number) => data.plan.find((p) => p.channel === "email" && p.day === day)?.goal;
  const plan: CampaignStrategy["plan"] = [
    { day: 0, channel: "email" as const, goal: emailGoal(0) ?? "Answer what they asked, with the verified facts" },
    { day: STEP2_DELAY_DAYS, channel: "email" as const, goal: emailGoal(STEP2_DELAY_DAYS) ?? "A short nudge with one next step" },
    ...calls,
  ].sort((a, b) => a.day - b.day || (a.channel === "email" ? -1 : 1));

  let callScript: CampaignStrategy["callScript"];
  let check: CampaignStrategy["check"] = { ok: true, issues: [], audited: false };
  if (calls.length && data.call_script) {
    callScript = data.call_script;
    const body = [
      callScript.opener,
      ...callScript.questions,
      ...callScript.objections.flatMap((o) => [o.objection, o.answer]),
      callScript.close,
      `Voicemail: ${callScript.voicemail}`,
    ].join("\n\n");
    try {
      check = await fullCheck(deps.llm, deps.auditModel ?? deps.model, { subject: "Call script", body }, facts, doNotClaim, [], {
        mergeFields: true,
        minWords: 20,
        maxWords: 450,
        position: "A phone call script and voicemail for a follow-up, not an email",
      });
    } catch (err) {
      check = { ok: false, issues: [`fact-check unavailable (${describeError(err)}); not verified`], audited: false };
    }
  }

  return {
    diagnosis: diagnosis.kept,
    targeting: { focus, avoid },
    plan,
    ...(callScript ? { callScript } : {}),
    check: { ...check, issues: [...issues, ...check.issues] },
  };
}

/** The strategy as a section of the Studio campaign brief. The call script is included only once it passed the fact-check. */
export function strategySection(s: CampaignStrategy): string {
  const lines = ["## Revised strategy (ReplyIQ, from every graph8 channel)", ""];
  if (s.diagnosis.length) lines.push("**Why the original didn't convert this group:**", ...s.diagnosis.map((d) => `- ${d}`), "");
  if (s.angle) lines.push(`**New angle:** ${s.angle}`, "");
  if (s.targeting.focus) lines.push(`**Focus on:** ${s.targeting.focus}`);
  if (s.targeting.avoid) lines.push(`**Leave out:** ${s.targeting.avoid}`);
  lines.push("", "**Plan:**", ...s.plan.map((p) => `- Day ${p.day}, ${p.channel}: ${p.goal}`), "");
  const script = s.callScript;
  if (script && s.check.ok) {
    lines.push(
      "**Call script (fact-checked):**",
      `- Opener: ${script.opener}`,
      ...script.questions.map((q) => `- Ask: ${q}`),
      ...script.objections.map((o) => `- If they say "${o.objection}": ${o.answer}`),
      `- Close: ${script.close}`,
      `- Voicemail: ${script.voicemail}`,
    );
  }
  return lines.join("\n").trim();
}
