// The follow-up EMAILS for a drafted group, as a graph8 Sequencer draft. This is the path graph8's own
// campaigns use (the team's SMB sequence: step 1 ON_DEMAND, step 2 manual). The Studio campaign
// generator loses its emails in this org (see IMPLEMENTATION.md), so ReplyIQ does not depend on it.
//
//   step 1  EMAIL, ON_DEMAND  graph8's AI writes each contact's email at send time from ReplyIQ's
//                             grounded instructions: what the group asked, verified facts, never-claim list
//   step 2  EMAIL, MANUAL     ReplyIQ's short follow-up, fact-checked before it is saved
//
// Facts: the Answer Card's verified proof, plus a few more picked by a model from the company's
// documents and the ORIGINAL sequence's own copy (the team's approved pitch), each kept only if its
// excerpt is verbatim in the source. Both steps may state these facts and nothing else about the company.
//
// Fact-check (both the step 2 text and any preview of step 1):
//   deterministic: every number must appear in a verified fact; merge fields from a fixed list; no
//                  placeholders; length; the original campaign's hard rules (e.g. a banned word, no dashes)
//   model audit:   a second model lists any statement about the company that the facts don't support
// The sequence is created with NO sender attached and is never run here: a person connects a mailbox and
// launches it. Optional previews: graph8's AI drafts step 1 for a few contacts now (spends credits; nothing
// is saved or sent) and ReplyIQ checks each one for the approval screen.
import { z } from "zod";
import type { EmailDraftBody, G8Client, SequenceCreateBody, SequenceStepConfig } from "../g8";
import { describeError, docText } from "../g8";
import type { Llm } from "../llm";
import { categoryInfo } from "../taxonomy";
import { norm, normLoose, wordCount } from "../text";
import type { CampaignDraft, EmailCheck, EmailFact, Group, Run, SequenceDraft } from "../types";
import { buildQuery } from "./cards";
import { toPlainText } from "./fetchReplies";
import { retrieve, type SourceDoc } from "./retrieve";

export const STEP2_DELAY_DAYS = 4;
const STEP1_POSITION = "Step 1: the first email after the prospect replied to the original campaign; it follows up on their reply.";
const STEP2_POSITION = `Step 2: sent ${STEP2_DELAY_DAYS} days after step 1 (which followed up on their reply) if they have not answered.`;
export const MERGE_TAGS = ["first_name", "last_name", "company", "title", "sender_name"] as const;
const MAX_FACTS = 6;
const MAX_QUOTES = 4;
const VOICE_DOC = /brand voice|style guide|writing style|compliance/i;
const clip = (s: string, n: number) => (s.length <= n ? s : `${s.slice(0, n - 1).trimEnd()}…`);
const oneLine = (s: string) => s.replace(/\s+/g, " ").trim();

// ---------- rules carried over from the original campaign ----------

/**
 * The "Hard rules" (Never/Don't/Avoid lines) and the first sentence of the "Voice:" line of the original
 * campaign's AI-step instructions, so the follow-up sounds like the same team. Content rules ("DO name
 * X") are left out: they steer the original pitch, not a follow-up.
 */
export function originalRules(instructionTexts: string[]): string[] {
  const out: string[] = [];
  for (const text of instructionTexts) {
    let inRules = false;
    for (const raw of text.split(/\r?\n/)) {
      const line = raw.trim();
      if (/^(hard rules|rules|don'?ts)\s*:?\s*$/i.test(line)) {
        inRules = true;
        continue;
      }
      if (/^voice\s*:/i.test(line)) {
        out.push(line.split(/(?<=\.)\s+/)[0]);
        continue;
      }
      if (!inRules || line === "") continue;
      if (/^[-*•]\s+/.test(line)) {
        const rule = line.replace(/^[-*•]\s+/, "");
        if (/^(never|don'?t|do not|avoid|no)\b/i.test(rule)) out.push(rule);
        continue;
      }
      inRules = false;
    }
  }
  return [...new Set(out)].slice(0, 12);
}

/** Machine-checkable parts of those rules: a banned word, no em/en dashes. `test` is true on a violation. */
export function ruleChecks(rules: string[]): { message: string; test: (t: string) => boolean }[] {
  const out = new Map<string, (t: string) => boolean>();
  for (const r of rules) {
    const w = r.match(/never use the words?\s+["“'‘]?([A-Za-z][A-Za-z-]*)["”'’]?/i);
    if (w) {
      const re = new RegExp(`\\b${w[1]}\\b`, "i");
      out.set(`uses "${w[1]}", which the original campaign forbids`, (t) => re.test(t));
    }
    if (/\b(em|en) dash/i.test(r)) out.set("uses an em or en dash, which the original campaign forbids", (t) => /[—–]/.test(t));
  }
  return [...out].map(([message, test]) => ({ message, test }));
}

// ---------- deterministic checks ----------

const NUMBER = /(?<![A-Za-z0-9])\$?\d[\d,]*(?:\.\d+)?\s?(?:%|[kKmMbB](?![A-Za-z])\+?|\+)?/g;

/** Numbers (prices, counts, percentages) in a text, normalised; list markers ("1." / "2)") ignored. */
export function numbersIn(text: string): string[] {
  const t = text.replace(/^\s*\d+[.)]\s/gm, " ");
  return [...new Set((t.match(NUMBER) ?? []).map((n) => n.replace(/[\s,]/g, "").replace(/\.$/, "").toLowerCase()).filter((n) => /\d/.test(n)))];
}

const PLACEHOLDER = /\[[A-Z][A-Za-z .'-]{1,40}\]|<(?:first ?name|name|company|title)>|\{(?!\{)[a-z_ ]+\}(?!\})|\bTODO\b|\bX{3,}\b|\blorem ipsum\b/i;

/**
 * Checks that need no model. `allowed` = the verified fact texts the email may draw numbers from.
 * `mergeFields`: true for templates (step 2), false for a rendered email (a preview) where none may remain.
 */
export function checkEmail(
  email: { subject: string; body: string },
  allowed: string[],
  rules: string[],
  opts: { mergeFields: boolean; minWords?: number; maxWords?: number },
): string[] {
  const issues: string[] = [];
  const text = `${email.subject}\n${email.body}`;
  if (!email.subject.trim()) issues.push("empty subject line");
  if (email.subject.length > 90) issues.push(`subject line is ${email.subject.length} characters (max 90)`);
  const words = wordCount(email.body);
  if (words < (opts.minWords ?? 15)) issues.push(`body is only ${words} words`);
  if (words > (opts.maxWords ?? 160)) issues.push(`body is ${words} words (max ${opts.maxWords ?? 160})`);

  const tags = [...text.matchAll(/\{\{\s*([^}]+?)\s*\}\}/g)].map((m) => m[1].toLowerCase());
  if (!opts.mergeFields && tags.length) issues.push(`unfilled merge field(s): ${tags.join(", ")}`);
  if (opts.mergeFields) for (const t of new Set(tags)) if (!(MERGE_TAGS as readonly string[]).includes(t)) issues.push(`unknown merge field {{${t}}}`);
  if ((text.match(/\{\{/g) ?? []).length !== (text.match(/\}\}/g) ?? []).length) issues.push("unbalanced merge-field braces");
  const ph = text.match(PLACEHOLDER);
  if (ph) issues.push(`placeholder left in the text: "${ph[0]}"`);

  const known = new Set(allowed.flatMap(numbersIn));
  const stray = numbersIn(text).filter((n) => !known.has(n));
  if (stray.length) issues.push(`number(s) not found in any verified fact: ${stray.join(", ")}`);

  for (const r of ruleChecks(rules)) if (r.test(text)) issues.push(r.message);
  return issues;
}

// ---------- model audit ----------

const AuditSchema = z.object({ unsupported: z.array(z.object({ sentence: z.string(), reason: z.string() })) });

export const AUDIT_PROMPT = [
  "You are a strict fact-checker for a sales email.",
  "FACTS are the only true statements about the sender's company and product. DO_NOT_CLAIM lists things the company has no proof for.",
  "List every sentence of the email that states or implies something about the sender's company, product, pricing, customers,",
  "results, documents or availability that is NOT supported by FACTS, or that claims anything in DO_NOT_CLAIM.",
  "Greetings, questions, offers to help, statements about the recipient or their own request, and wording about the email or meeting itself",
  "(\"a sample outline\", \"what I would walk you through\") are fine. Be strict about product capabilities, pricing, customers, results and documents.",
  "Merge fields like {{first_name}} are fine. POSITION says where the email sits in the sequence: references that fit it",
  "(\"following up on your reply\", \"in case my last note got buried\" for a later step) are fine. Return an empty list when everything is supported.",
].join("\n");

export async function auditEmail(
  llm: Llm,
  model: string,
  email: { subject: string; body: string },
  facts: EmailFact[],
  doNotClaim: string[],
  position = "",
): Promise<string[]> {
  const { data } = await llm.parse({
    model,
    system: AUDIT_PROMPT,
    user: JSON.stringify({ POSITION: position || null, FACTS: facts.map((f) => `${f.claim}: "${f.excerpt}"`), DO_NOT_CLAIM: doNotClaim, EMAIL: { subject: email.subject, body: email.body } }),
    schema: AuditSchema,
    name: "email_audit",
  });
  return data.unsupported.map((u) => `unsupported: "${clip(oneLine(u.sentence), 140)}" (${u.reason})`);
}

async function fullCheck(
  llm: Llm | null,
  model: string,
  email: { subject: string; body: string },
  facts: EmailFact[],
  doNotClaim: string[],
  rules: string[],
  opts: { mergeFields: boolean; minWords?: number; maxWords?: number; position?: string },
  extra: string[] = [],
  ownData: string[] = [], // the recipient's own details (name, company): numbers there are not claims
): Promise<EmailCheck> {
  const issues = [...extra, ...checkEmail(email, [...facts.map((f) => f.excerpt), ...ownData], rules, opts)];
  let audited = false;
  if (llm) {
    try {
      issues.push(...(await auditEmail(llm, model, email, facts, doNotClaim, opts.position)));
      audited = true;
    } catch (err) {
      issues.push(`fact-check model unavailable (${describeError(err)}); not verified`);
    }
  }
  return { ok: issues.length === 0 && audited, issues, audited };
}

// ---------- instructions for graph8's AI (step 1) ----------

/** Distinct quotes, first spelling kept (bulk campaigns get identical replies). */
const distinctQuotes = (g: Group) => {
  const seen = new Map<string, string>();
  for (const r of g.replies) if (!seen.has(oneLine(r.quote).toLowerCase())) seen.set(oneLine(r.quote).toLowerCase(), oneLine(r.quote));
  return [...seen.values()].slice(0, MAX_QUOTES);
};

/** The taxonomy definition without the classifier's own notes (sentences naming internal fields like revisit_hint). */
export const publicDefinition = (def: string) =>
  def
    .split(/(?<=\.)\s+/)
    .filter((sentence) => !/\b[a-z]+_[a-z_]+\b/.test(sentence))
    .join(" ");

/** What the follow-up should achieve: the card's angle, the category's angle, else by follow-up type. */
export function goalFor(group: Group): string {
  const info = categoryInfo(group.key);
  if (group.card?.emailAngle) return group.card.emailAngle;
  if (info.angle) return info.angle;
  return info.followUp === "later" ? "Re-open the conversation now that they are back, with one or two lines on the original offer." : "Follow up on what they told us.";
}

/** The step 1 prompt, assembled by code from grounded data only (same shape as graph8's own AI steps). */
export function stepInstructions(run: Run, group: Group, facts: EmailFact[], doNotClaim: string[], rules: string[]): string {
  const info = categoryInfo(group.key);
  const card = group.card;
  const reopen = info.followUp === "later" || group.key === "referral_wrong_person";
  const lines = [
    `Write a short follow-up email to a prospect who replied to our "${run.source.name}" campaign. Their reply was grouped as "${group.label}": ${publicDefinition(info.definition)}`,
    "",
    "What people in this group said (verbatim):",
    ...distinctQuotes(group).map((q) => `- "${clip(q, 200)}"`),
    "",
    `Goal: ${goalFor(group)}`,
  ];
  if (card) lines.push(`How to answer: ${card.howToAnswer}`, ...card.themeNotes.map((n) => `- ${n.label}: ${n.howToAnswer}`));
  if (group.key === "referral_wrong_person") lines.push("A colleague at their company named them as the right person. Open by saying a colleague suggested reaching out; do not name the colleague.");
  if (info.followUp === "later") lines.push("They were away or asked for later. This goes out after they are back: acknowledge it briefly and do not mention specific dates.");
  lines.push(
    "",
    "Subject line: 6 words max, lowercase, specific to what they asked, no exclamation points.",
    reopen
      ? "Body: 60 to 120 words. Greet them with first_name. Re-open the conversation briefly, then give one or two lines on the original offer from the facts. End with one short question."
      : "Body: 60 to 120 words. Greet them with first_name. Answer their request first. End with one short question.",
    "",
    "Facts you may use (verbatim from company documents). State nothing else about the company, product, pricing or customers:",
    ...(facts.length ? facts.map((f) => `- ${f.claim}: "${oneLine(f.excerpt)}" (${f.source})`) : ["- None. Do not state product facts; keep to their request and a question."]),
  );
  if (doNotClaim.length) lines.push("", "Never claim (we have no proof for this):", ...doNotClaim.map((d) => `- ${d}`));
  lines.push(
    "",
    "Personalization: use only first_name, last_name, company name and title. Never invent details, news or activity.",
    "Hard rules:",
    "- Do not promise or attach documents, decks, case studies or links that are not in the facts above.",
    "- No calendar links.",
  );
  if (rules.length) lines.push("", "Rules from the original campaign (keep them):", ...rules.map((r) => `- ${r}`));
  return lines.join("\n");
}

// ---------- ReplyIQ's step 2 text ----------

const WriterSchema = z.object({
  subject: z.string(),
  body: z.string(),
  claims: z.array(z.object({ source_id: z.string(), claim: z.string(), excerpt: z.string() })),
});

export const WRITER_PROMPT = [
  "You write ONE short follow-up email: step 2 of a sequence, sent 4 days after step 1 if the prospect has not replied.",
  "Step 1 already followed up on what they said. Step 2 is a brief, friendly nudge that adds at most one useful fact and ends with one short question.",
  "- Use ONLY the FACTS for any statement about the company, product, pricing or customers. List every such statement in `claims`",
  "  with the fact's id as source_id and an excerpt of 6-40 words copied VERBATIM from that fact (no ellipses).",
  "- Never claim anything in DO_NOT_CLAIM. Never promise documents, decks or links that are not in the facts.",
  "- Merge fields allowed: {{first_name}}, {{company}}, {{sender_name}}. No other placeholders or brackets.",
  "- 40 to 90 words, plain text paragraphs separated by blank lines, greeting with {{first_name}}, sign off with {{sender_name}}.",
  "- Follow VOICE and ORIGINAL_RULES. Subject: 6 words max, lowercase, no exclamation points.",
].join("\n");

interface WriterSource {
  id: string;
  docId: string;
  docName: string;
  text: string;
  claim?: string;
}

/** Verify each claimed excerpt is verbatim in its source document (or the card's verified excerpt). */
export function verifyClaims(
  claims: z.infer<typeof WriterSchema>["claims"],
  sources: WriterSource[],
  docs: Map<string, string>,
): { facts: EmailFact[]; issues: string[] } {
  const facts: EmailFact[] = [];
  const issues: string[] = [];
  for (const c of claims) {
    const src = sources.find((s) => s.id === c.source_id);
    const hay = normLoose(`${docs.get(src?.docId ?? "") ?? ""}\n${src?.text ?? ""}`);
    if (!src) issues.push(`claim cites unknown source ${c.source_id}: "${clip(c.claim, 80)}"`);
    else if (wordCount(c.excerpt) < 6 || !hay.includes(normLoose(c.excerpt))) issues.push(`claim not found verbatim in "${src.docName}": "${clip(c.claim, 80)}"`);
    else facts.push({ claim: oneLine(c.claim).replace(/[.;:,]+$/, ""), excerpt: oneLine(c.excerpt), source: src.docName });
  }
  return { facts, issues };
}

const FactsSchema = z.object({ facts: z.array(z.object({ source_id: z.string(), claim: z.string(), excerpt: z.string() })) });

export const FACTS_PROMPT = [
  "Pick up to 6 facts that a follow-up email to this group of prospects can state.",
  "Each fact: source_id (the exact id of a SOURCE), claim (one short sentence), excerpt (6-40 words copied VERBATIM from that source, no ellipses).",
  "Prefer facts that answer what they said. When they made no request (away, out of office, referred us to someone), prefer the original campaign's core offer.",
  "Never pick anything in DO_NOT_CLAIM. Skip slogans without substance. Fewer strong facts beat many weak ones.",
].join("\n");

/** Model-picked facts, each kept only if its excerpt is verbatim in its source. */
async function selectFacts(deps: SequenceDeps, run: Run, group: Group, sources: WriterSource[], docs: Map<string, string>, doNotClaim: string[]) {
  if (!deps.llm || !sources.length) return { facts: [] as EmailFact[], issues: [] as string[] };
  const info = categoryInfo(group.key);
  const { data } = await deps.llm.parse({
    model: deps.model,
    system: FACTS_PROMPT,
    user: JSON.stringify({
      GROUP: `${group.label}: ${publicDefinition(info.definition)}`,
      ORIGINAL_CAMPAIGN: run.source.name,
      WHAT_THEY_SAID: distinctQuotes(group),
      GOAL: goalFor(group),
      SOURCES: sources.map((s) => ({ id: s.id, doc: s.docName, text: s.text })),
      DO_NOT_CLAIM: doNotClaim,
    }),
    schema: FactsSchema,
    name: "followup_facts",
  });
  return verifyClaims(data.facts.slice(0, MAX_FACTS), sources, docs);
}

/** Plain text with blank-line paragraphs -> the HTML the sequencer stores (merge fields untouched). */
export function toHtml(text: string): string {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return text
    .trim()
    .split(/\n\s*\n/)
    .map((p) => `<p>${esc(p.trim()).replace(/\n/g, "<br>")}</p>`)
    .join("\n");
}

// ---------- orchestration ----------

export type SequenceClient = Pick<
  G8Client,
  | "assertWriteAllowed"
  | "createSequence"
  | "updateSequenceStep"
  | "addSequenceSteps"
  | "getSequence"
  | "getSequenceSteps"
  | "listGlobalDocs"
  | "getCampaignFull"
  | "findContactByEmail"
  | "estimateEmailDraft"
  | "generateEmailDraft"
>;

export interface SequenceDeps {
  g8: SequenceClient;
  llm: Llm | null;
  model: string; // writes step 2
  auditModel?: string; // fact-check (defaults to `model`)
  ownerEmail?: string; // sequence owner; defaults to the original sequence's owner
  agentName?: string; // graph8 textual agent for previews (default "default")
  now?: () => Date;
  log?: (m: string) => void;
}

export interface SequenceOptions {
  previews?: number; // graph8 drafts of step 1 for up to N contacts (spends credits); 0 = none
  rebuild?: boolean; // create a new sequence even if one exists
  refresh?: boolean; // re-write the existing draft sequence's steps in place (e.g. after the card changed)
}

async function loadDocs(g8: SequenceClient, run: Run, warnings: string[]) {
  const docs: SourceDoc[] = [];
  try {
    for (const d of await g8.listGlobalDocs()) if (d.content) docs.push({ id: d.id, name: d.displayName, kind: "global", content: d.content });
  } catch (err) {
    warnings.push(`Studio documents unavailable (${describeError(err)})`);
  }
  if (run.source.campaignId) {
    try {
      for (const d of (await g8.getCampaignFull(run.source.campaignId)).documents ?? []) {
        const content = docText(d);
        if (content) docs.push({ id: d.id, name: `Campaign: ${d.display_name ?? d.name ?? d.file_type ?? d.id}`, kind: "campaign", content });
      }
    } catch (err) {
      warnings.push(`original campaign documents unavailable (${describeError(err)})`);
    }
  }
  return { facts: docs.filter((d) => !VOICE_DOC.test(d.name)), voice: docs.filter((d) => VOICE_DOC.test(d.name)), all: new Map(docs.map((d) => [d.id, d.content])) };
}

/** The original sequence's own copy: its AI-step instructions (rules + approved pitch) and manual emails. */
async function loadOriginalCopy(g8: SequenceClient, run: Run): Promise<{ rules: string[]; sources: WriterSource[] }> {
  const instructions: string[] = [];
  const sources: WriterSource[] = [];
  for (const s of run.source.sequences.slice(0, 3)) {
    try {
      for (const step of (await g8.getSequenceSteps(s.id)).steps ?? []) {
        const data = (step.step_data ?? {}) as Record<string, unknown>;
        const ins = typeof data.instructions === "string" ? data.instructions.trim() : "";
        const copy = [typeof data.subject === "string" ? data.subject : "", typeof data.body === "string" ? toPlainText(data.body) : ""].filter(Boolean).join("\n");
        if (ins) instructions.push(ins);
        const text = [ins, copy].filter(Boolean).join("\n\n");
        if (text) sources.push({ id: `O${sources.length + 1}`, docId: `sequence:${s.id}:${String(step.step_order)}`, docName: `Original sequence, step ${String(step.step_order)}`, text: clip(text, 3_000) });
      }
    } catch {
      /* optional */
    }
  }
  return { rules: originalRules(instructions), sources };
}

/** Write step 2 from the verified facts, check it, and rewrite once with the problems if it fails. */
async function writeStep2(deps: SequenceDeps, run: Run, group: Group, facts: EmailFact[], voice: string, doNotClaim: string[], rules: string[]): Promise<SequenceDraft["manualEmail"]> {
  if (!deps.llm) return undefined;
  const info = categoryInfo(group.key);
  const factSources: WriterSource[] = facts.map((f, i) => ({ id: `X${i + 1}`, docId: "", docName: f.source, text: f.excerpt }));
  let feedback: string[] = [];
  let last: SequenceDraft["manualEmail"];
  for (let attempt = 1; attempt <= 2; attempt++) {
    const { data } = await deps.llm.parse({
      model: deps.model,
      system: WRITER_PROMPT,
      user: JSON.stringify({
        GROUP: `${group.label}: ${publicDefinition(info.definition)}`,
        ORIGINAL_CAMPAIGN: run.source.name,
        WHAT_THEY_SAID: distinctQuotes(group),
        GOAL: goalFor(group),
        HOW_TO_ANSWER: group.card?.howToAnswer ?? null,
        FACTS: factSources.map((s) => ({ id: s.id, source: s.docName, text: s.text })),
        DO_NOT_CLAIM: doNotClaim,
        VOICE: voice || null,
        ORIGINAL_RULES: rules,
        ...(feedback.length ? { FIX_THESE_PROBLEMS_FROM_YOUR_LAST_DRAFT: feedback } : {}),
      }),
      schema: WriterSchema,
      name: "followup_email",
    });
    const email = { subject: data.subject.trim(), body: data.body.trim() };
    const verified = verifyClaims(data.claims, factSources, new Map());
    const check = await fullCheck(deps.llm, deps.auditModel ?? deps.model, email, facts, doNotClaim, rules, { mergeFields: true, minWords: 25, maxWords: 120, position: STEP2_POSITION }, verified.issues);
    last = { ...email, check, attempts: attempt };
    if (check.ok) break;
    feedback = check.issues;
  }
  return last;
}

const dedupeFacts = (fs: EmailFact[]) => [...new Map(fs.map((f) => [norm(f.excerpt), f])).values()];

/** graph8's AI drafts step 1 for up to `n` contacts; ReplyIQ fact-checks each. Failures are per contact. */
export async function previewStep1(deps: SequenceDeps, run: Run, group: Group, draft: CampaignDraft, seq: SequenceDraft, n: number): Promise<void> {
  const previews: NonNullable<SequenceDraft["previews"]> = [];
  let credits = 0;
  for (const a of draft.audience.slice(0, n)) {
    try {
      const contact = await deps.g8.findContactByEmail(a.email);
      const company = group.replies.find((r) => r.threadId === a.threadId)?.company;
      const first = contact?.first_name ?? a.email.split("@")[0];
      const last = contact?.last_name ?? "";
      const body: EmailDraftBody = {
        contact_id: a.contactId,
        contact_work_email: a.email,
        first_name: first,
        last_name: last,
        instructions: seq.instructions,
        // What the sequencer knows at send time: CRM fields, not the reply (so the preview matches the send).
        lead_info: [`${first} ${last}`.trim(), contact?.job_title, company && `at ${company}`].filter(Boolean).join(", "),
        agent_name: deps.agentName ?? "default",
        ...(seq.sequenceId ? { sequence_id: seq.sequenceId } : {}),
        ...(draft.campaignId ? { studio_campaign_id: draft.campaignId } : {}),
        step_order: 1,
      };
      try {
        credits += (await deps.g8.estimateEmailDraft(body))?.estimated_credits ?? 0;
      } catch {
        /* the price is informational */
      }
      const out = await deps.g8.generateEmailDraft(body);
      const email = { subject: out.subject.trim(), body: toPlainText(out.body) || out.body };
      const check = await fullCheck(deps.llm, deps.auditModel ?? deps.model, email, seq.facts, seq.doNotClaim, seq.originalRules, { mergeFields: false, minWords: 20, maxWords: 220, position: STEP1_POSITION }, [], [body.lead_info, a.email]);
      previews.push({ contactId: a.contactId, email: a.email, ...email, check });
      deps.log?.(`  preview for ${a.email}: ${check.ok ? "passed" : `${check.issues.length} issue(s)`}`);
    } catch (err) {
      seq.warnings.push(`preview for ${a.email} failed: ${describeError(err)}`);
    }
  }
  seq.previews = previews;
  seq.previewCredits = credits;
}

/** Everything the steps are built from: rules, never-claim list, verified facts, step 2 text, step 1 instructions. */
async function compose(deps: SequenceDeps, run: Run, group: Group, seq: SequenceDraft): Promise<void> {
  const warnings = seq.warnings;
  const docs = await loadDocs(deps.g8, run, warnings);
  const original = await loadOriginalCopy(deps.g8, run);
  seq.originalRules = original.rules;
  for (const o of original.sources) docs.all.set(o.docId, o.text);
  const card = group.card;
  seq.doNotClaim = [card?.proofGap, ...(card?.unverifiedClaims ?? [])].filter((x): x is string => Boolean(x?.trim())).map(oneLine);
  const cardFacts: EmailFact[] = (card?.proofWeHave ?? []).map((p) => ({ claim: oneLine(p.claim).replace(/[.;:,]+$/, ""), excerpt: oneLine(p.excerpt), source: p.sourceDocName }));

  // Where more facts may come from: the original sequence's copy, then the best document passages for this group.
  const sources: WriterSource[] = [
    ...original.sources,
    ...retrieve(docs.facts, `${buildQuery(group)}\n${goalFor(group)}`, { budgetChars: 8_000, perDocCap: 2 }).map((p, i) => ({ id: `P${i + 1}`, docId: p.docId, docName: p.docName, text: p.text })),
  ];
  const voice = retrieve(docs.voice, "email tone voice style words to avoid do and don't compliance rules for outbound email", { budgetChars: 4_000, perDocCap: 2 })
    .map((p) => `[${p.docName}] ${p.text}`)
    .join("\n\n");

  // Facts both steps may state: the card's verified proof first, then verified picks from the sources.
  let picked: EmailFact[] = [];
  try {
    const sel = await selectFacts(deps, run, group, sources, docs.all, seq.doNotClaim);
    picked = sel.facts;
    if (sel.issues.length) warnings.push(`${sel.issues.length} suggested fact(s) dropped: not verbatim in their source`);
  } catch (err) {
    warnings.push(`fact selection unavailable (${describeError(err)}); using the Answer Card's proof only`);
  }
  seq.facts = dedupeFacts([...cardFacts, ...picked]).slice(0, MAX_FACTS);

  seq.manualEmail = await writeStep2(deps, run, group, seq.facts, voice, seq.doNotClaim, seq.originalRules);
  if (!deps.llm) warnings.push("no model configured: step 2 was not written, the sequence has step 1 only");
  else if (seq.manualEmail && !seq.manualEmail.check.ok) warnings.push(`step 2 failed the fact-check twice and was left out: ${seq.manualEmail.check.issues.slice(0, 3).join(" | ")}`);
  seq.instructions = stepInstructions(run, group, seq.facts, seq.doNotClaim, seq.originalRules);
}

const step1Config = (seq: SequenceDraft): SequenceStepConfig => ({ step_order: 1, step_type: "EMAIL", input_type: "ON_DEMAND", time_interval: 0, step_data: { instructions: seq.instructions, email_type: "html" } });
const step2Config = (m: { subject: string; body: string }): SequenceStepConfig => ({
  step_order: 2,
  step_type: "EMAIL",
  input_type: "MANUAL_TEMPLATE",
  time_interval: STEP2_DELAY_DAYS * 86_400,
  step_data: { subject: m.subject, body: toHtml(m.body), email_type: "html" },
});
const summarise = (configs: SequenceStepConfig[]): SequenceDraft["steps"] =>
  configs.map((c) => ({ order: c.step_order, inputType: c.input_type, delayDays: Math.round(c.time_interval / 86_400), ...(c.step_data.subject ? { subject: c.step_data.subject } : {}) }));

type StoredStep = { id?: string; step_order?: number; input_type?: string; time_interval?: number; step_data?: { instructions?: string; subject?: string; body?: string } };
const sortedSteps = (steps: Record<string, unknown>[] | undefined) => ((steps ?? []) as StoredStep[]).slice().sort((a, b) => Number(a.step_order) - Number(b.step_order));

/** Compare what graph8 stored with what was sent. */
async function readBack(g8: SequenceClient, id: string, listId: number, expected: SequenceStepConfig[]): Promise<string[]> {
  const [detail, stored] = await Promise.all([g8.getSequence(id), g8.getSequenceSteps(id)]);
  const problems: string[] = [];
  if (detail.associated_list_id != null && Number(detail.associated_list_id) !== listId) problems.push(`list ${detail.associated_list_id}, expected ${listId}`);
  const got = sortedSteps(stored.steps);
  if (got.length !== expected.length) problems.push(`${got.length} step(s), expected ${expected.length}`);
  if (String(got[0]?.input_type).toUpperCase() !== "ON_DEMAND") problems.push("step 1 is not written on demand");
  if (norm(got[0]?.step_data?.instructions ?? "") !== norm(expected[0].step_data.instructions ?? "")) problems.push("step 1 instructions differ from what was sent");
  if (expected[1] && norm(got[1]?.step_data?.subject ?? "") !== norm(expected[1].step_data.subject ?? "")) problems.push("step 2 subject differs from what was sent");
  return problems;
}

/**
 * Create the follow-up sequence for a drafted group (needs the draft's list). Reuses an existing one
 * unless `rebuild` (a new sequence) or `refresh` (re-write its steps in place). Throws only on
 * preconditions; graph8 errors are returned as a failed SequenceDraft.
 */
export async function buildFollowupSequence(deps: SequenceDeps, run: Run, group: Group, draft: CampaignDraft, opts: SequenceOptions = {}): Promise<SequenceDraft> {
  const now = () => (deps.now ?? (() => new Date()))().toISOString();
  const log = deps.log ?? (() => {});
  if (!draft.listId) throw new Error("the draft has no audience list yet");

  const existing = draft.sequence;
  if (existing?.sequenceId && !opts.rebuild && !opts.refresh) {
    const seq: SequenceDraft = { ...existing, warnings: [] };
    if ((opts.previews ?? 0) > 0) await previewStep1(deps, run, group, draft, seq, opts.previews!); // asked for: fresh previews
    seq.updatedAt = now();
    return seq;
  }

  const inPlace = Boolean(existing?.sequenceId && opts.refresh && !opts.rebuild);
  const seq: SequenceDraft = inPlace
    ? { ...existing!, status: "failed", error: undefined, previews: undefined, previewCredits: undefined, verified: false, warnings: [] }
    : { status: "failed", steps: [], instructions: "", facts: [], doNotClaim: [], originalRules: [], verified: false, senderAttached: false, warnings: [], updatedAt: now() };
  const warnings = seq.warnings;
  try {
    await deps.g8.assertWriteAllowed();
    await compose(deps, run, group, seq);
    const configs = [step1Config(seq), ...(seq.manualEmail?.check.ok ? [step2Config(seq.manualEmail)] : [])];

    if (inPlace) {
      // Re-write the existing draft's steps; never a second sequence.
      const id = seq.sequenceId!;
      const stored = sortedSteps((await deps.g8.getSequenceSteps(id)).steps);
      const s1 = stored.find((x) => Number(x.step_order) === 1);
      const s2 = stored.find((x) => Number(x.step_order) === 2);
      if (!s1?.id) throw new Error("the existing sequence has no step 1 to refresh");
      await deps.g8.updateSequenceStep(id, String(s1.id), { input_type: "ON_DEMAND", step_data: configs[0].step_data });
      if (configs[1]) {
        if (s2?.id) await deps.g8.updateSequenceStep(id, String(s2.id), { input_type: "MANUAL_TEMPLATE", time_interval: configs[1].time_interval, step_data: configs[1].step_data });
        else await deps.g8.addSequenceSteps(id, [configs[1]]);
      } else if (s2) {
        // The new step 2 failed its check: keep the one already there (it passed when it was written).
        warnings.push("the new step 2 failed the fact-check; the previous step 2 was kept");
        configs.push({ step_order: 2, step_type: "EMAIL", input_type: "MANUAL_TEMPLATE", time_interval: Number(s2.time_interval ?? STEP2_DELAY_DAYS * 86_400), step_data: { subject: s2.step_data?.subject, body: s2.step_data?.body, email_type: "html" } });
        seq.manualEmail = existing?.manualEmail ?? seq.manualEmail;
      }
      log(`  sequence ${id} refreshed in place (${configs.length} step(s))`);
    } else {
      // Owner: the original sequence's owner unless configured.
      let owner = deps.ownerEmail;
      if (!owner && run.source.sequences[0]) owner = (await deps.g8.getSequence(run.source.sequences[0].id)).user_email ?? undefined;
      if (!owner) throw new Error("no sequence owner email: set G8_SEQUENCE_OWNER_EMAIL");
      seq.ownerEmail = owner;
      const name = clip(`ReplyIQ · ${group.label} follow-up · ${run.source.name}`, 200);
      const body: SequenceCreateBody = {
        name,
        description: clip(`ReplyIQ follow-up for "${group.label}" (run ${run.id}). Step 1: graph8's AI writes each email from ReplyIQ's grounded instructions. Step 2: ReplyIQ's fact-checked text. No sender attached; a person launches it.`, 500),
        user_email: owner,
        finish_on_reply: true,
        send_in_same_thread: true,
        wait_for_new_contacts: false,
        associated_list_id: draft.listId,
        ...(draft.campaignId ? { campaign_id: draft.campaignId } : {}),
        steps: configs,
      };
      const created = await deps.g8.createSequence(body, `replyiq:${run.id}:${group.key}:sequence${opts.rebuild ? `:${Date.now()}` : ""}`);
      if (!created?.id) throw new Error("graph8 did not return a sequence id");
      seq.sequenceId = created.id;
      seq.sequenceName = created.name ?? name;
      log(`  sequence ${seq.sequenceId} created (${created.status ?? "draft"}), ${configs.length} step(s), no sender attached`);
    }
    seq.steps = summarise(configs);

    try {
      const problems = await readBack(deps.g8, seq.sequenceId!, draft.listId, configs);
      seq.verified = problems.length === 0;
      if (problems.length) warnings.push(`read-back mismatch: ${problems.join("; ")}`);
    } catch (err) {
      warnings.push(`could not read the sequence back (${describeError(err)})`);
    }

    seq.status = "ready";
    if ((opts.previews ?? 0) > 0) await previewStep1(deps, run, group, draft, seq, opts.previews!);
  } catch (err) {
    seq.status = "failed";
    seq.error = describeError(err);
  }
  seq.updatedAt = now();
  return seq;
}

/**
 * Read-only check of a recorded follow-up sequence against graph8 (live tests, e2e): the draft's list is
 * attached, it is not running, no sender is attached, and the steps are what ReplyIQ recorded.
 */
export async function verifyRecordedSequence(g8: Pick<G8Client, "getSequence" | "getSequenceSteps" | "getSequenceChannels">, draft: CampaignDraft): Promise<string[]> {
  const seq = draft.sequence;
  if (!seq?.sequenceId) return ["no sequence recorded"];
  const [detail, stored, channels] = await Promise.all([g8.getSequence(seq.sequenceId), g8.getSequenceSteps(seq.sequenceId), g8.getSequenceChannels(seq.sequenceId)]);
  const problems: string[] = [];
  if (Number(detail.associated_list_id) !== draft.listId) problems.push(`sequence list ${detail.associated_list_id}, expected ${draft.listId}`);
  if (/live|running|active|scheduling/i.test(String(detail.status ?? ""))) problems.push(`sequence is ${detail.status}`);
  if (channels.length) problems.push(`${channels.length} sender(s) attached`);
  const got = sortedSteps(stored.steps);
  if (got.length !== seq.steps.length) problems.push(`${got.length} step(s) in graph8, ${seq.steps.length} recorded`);
  if (String(got[0]?.input_type).toUpperCase() !== "ON_DEMAND") problems.push("step 1 is not written on demand");
  if (norm(got[0]?.step_data?.instructions ?? "") !== norm(seq.instructions)) problems.push("step 1 instructions differ from the recorded ones");
  const s2 = seq.steps.find((x) => x.order === 2);
  if (s2 && norm(got[1]?.step_data?.subject ?? "") !== norm(s2.subject ?? "")) problems.push("step 2 subject differs from the recorded one");
  return problems;
}
