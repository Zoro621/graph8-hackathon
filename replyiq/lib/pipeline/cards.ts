// M4: Answer Cards. For each objection / interest group: what they said, the proof the company has,
// the proof it lacks (the "proof gap"), and how to answer. Grounded by construction:
// - the model only sees passages retrieved from the company's own documents (retrieve.ts)
// - every proof point must quote its document verbatim; the code checks the excerpt against the FULL
//   document (markdown-insensitive) and moves anything unverifiable to the proof gap
// - quotes must be verbatim from the group's replies
// - a card with no verified proof must say so in the proof gap
// Non-critical: a failed card is a warning; the run continues.
import { z } from "zod";
import type { Llm, LlmUsage } from "../llm";
import { scrubPhones } from "../scrub";
import { categoryInfo } from "../taxonomy";
import { norm, normLoose, wordCount } from "../text";
import type { AnswerCard, Group, ProofItem } from "../types";
import { retrieve, type Passage, type SourceDoc } from "./retrieve";

const MIN_EXCERPT_WORDS = 6;
const MAX_REPLIES_IN_PROMPT = 25;
const CONCURRENCY = 2;

const CardSchema = z.object({
  summary: z.string(),
  quotes: z.array(z.string()),
  proof: z.array(z.object({ claim: z.string(), doc_id: z.string(), excerpt: z.string() })),
  proof_gap: z.string().nullable(),
  how_to_answer: z.string(),
  email_angle: z.string(),
  theme_notes: z.array(z.object({ theme_id: z.string(), how_to_answer: z.string() })),
});
type RawCard = z.infer<typeof CardSchema>;

export const CARD_PROMPT = [
  "You write an Answer Card for a B2B sales team: how to respond to a group of prospect replies that share an objection or intent.",
  "Use ONLY the company documents provided in <doc> tags. Never invent numbers, customers, logos, case studies or quotes.",
  "",
  "Fields:",
  "- summary: one line, what these prospects are saying.",
  "- quotes: 1-3 short spans copied VERBATIM from the replies.",
  "- proof: evidence from the documents that answers this objection. For each: claim (short, your words),",
  "  doc_id (the exact id attribute of the <doc>), excerpt (8-40 words copied VERBATIM from that doc, no ellipses).",
  "  Only include proof that genuinely answers the objection. Fewer strong items beat many weak ones.",
  "- proof_gap: the specific proof the company is MISSING to answer this well (e.g. \"no case study with an ROI number for teams under 50 reps\"),",
  "  or null only if the documents fully cover it. If the documents themselves say proof is missing, say so.",
  "- how_to_answer: 2-4 sentences a rep can follow, grounded in the proof above.",
  "- email_angle: one sentence, the angle for a follow-up email to this group.",
  "- theme_notes: for EACH theme id given, one sentence on how to handle that theme specifically.",
].join("\n");

/** Query for retrieval: the group's meaning plus what the prospects actually said. */
export function buildQuery(group: Group): string {
  const info = categoryInfo(group.key);
  return [
    info.label,
    info.angle ?? "",
    ...(group.themes ?? []).map((t) => `${t.label}. ${t.description}`),
    ...group.replies.slice(0, MAX_REPLIES_IN_PROMPT).map((r) => `${r.replyText} ${r.reason ?? ""}`),
  ].join("\n");
}

const renderPassages = (ps: Passage[]) =>
  ps.map((p) => `<doc id="${p.docId}" name="${p.docName.replace(/"/g, "'")}" kind="${p.kind}">\n${p.text}\n</doc>`).join("\n");

/** Turn the model's card into a grounded AnswerCard. */
export function validateCard(group: Group, raw: RawCard, docs: SourceDoc[], sent: Passage[]): { card: AnswerCard; warnings: string[] } {
  const warnings: string[] = [];
  const byId = new Map(docs.map((d) => [d.id, d]));
  const looseDocs = new Map<string, string>();
  const loose = (d: SourceDoc) => {
    if (!looseDocs.has(d.id)) looseDocs.set(d.id, normLoose(d.content));
    return looseDocs.get(d.id)!;
  };

  // Quotes: verbatim from some reply of the group.
  const replyTexts = group.replies.map((r) => norm(r.replyText));
  let quotes = raw.quotes.map((q) => q.trim()).filter((q) => wordCount(q) >= 3 && replyTexts.some((t) => t.includes(norm(q))));
  quotes = [...new Set(quotes)].slice(0, 3);
  if (quotes.length === 0) {
    quotes = group.replies.filter((r) => !r.needsReview).slice(0, 2).map((r) => r.quote).filter(Boolean);
    if (raw.quotes.length) warnings.push("card quotes were not verbatim; used the classifier's verified quotes");
  }

  // Proof: excerpt must be verbatim in the full document it names.
  const proofWeHave: ProofItem[] = [];
  const unverifiedClaims: string[] = [];
  const seen = new Set<string>();
  for (const p of raw.proof) {
    const doc = byId.get(p.doc_id.trim());
    const excerpt = p.excerpt.trim().replace(/^\.{3}|\.{3}$/g, "").trim();
    const key = normLoose(excerpt);
    if (seen.has(key)) continue;
    seen.add(key);
    if (doc && wordCount(excerpt) >= MIN_EXCERPT_WORDS && loose(doc).includes(key)) {
      proofWeHave.push({ claim: p.claim.trim(), sourceDocId: doc.id, sourceDocName: doc.name, excerpt, verified: true });
    } else {
      unverifiedClaims.push(p.claim.trim());
      warnings.push(`unverified proof dropped (${doc ? "excerpt not found in the document" : `unknown doc id ${p.doc_id.slice(0, 12)}`}): ${p.claim.slice(0, 60)}`);
    }
  }

  let proofGap = raw.proof_gap?.trim() || null;
  if (unverifiedClaims.length) {
    const note = `Unverified (not found in the documents): ${unverifiedClaims.join("; ")}`;
    proofGap = proofGap ? `${proofGap} ${note}` : note;
  }
  if (proofWeHave.length === 0 && !proofGap) proofGap = "No supporting proof was found in the company's documents for this objection.";

  const themeIds = new Map((group.themes ?? []).map((t) => [t.id, t.label]));
  const themeNotes = raw.theme_notes
    .filter((n) => themeIds.has(n.theme_id.trim()) && n.how_to_answer.trim())
    .map((n) => ({ themeId: n.theme_id.trim(), label: themeIds.get(n.theme_id.trim())!, howToAnswer: n.how_to_answer.trim() }))
    .filter((n, i, all) => all.findIndex((x) => x.themeId === n.themeId) === i);

  const sources = [...new Map(sent.map((p) => [p.docId, { docId: p.docId, name: p.docName, kind: p.kind }])).values()];
  return {
    card: {
      summary: raw.summary.trim(),
      quotes,
      proofWeHave,
      proofGap,
      howToAnswer: raw.how_to_answer.trim(),
      emailAngle: raw.email_angle.trim(),
      themeNotes,
      unverifiedClaims,
      sources,
    },
    warnings,
  };
}

export interface CardsOptions {
  llm: Llm;
  model: string;
  docs: SourceDoc[]; // Studio Global docs + the campaign's own docs
  budgetChars?: number;
  concurrency?: number;
}

export interface CardsResult {
  groups: Group[];
  generated: number;
  failed: number;
  usage: LlmUsage & { llmCalls: number };
  warnings: string[];
}

/** Groups that get a card: objection / interest categories with at least one reply. */
export const wantsCard = (g: Group) => categoryInfo(g.key).answerCard && g.replies.length > 0;

export async function generateCards(groups: Group[], opts: CardsOptions): Promise<CardsResult> {
  const usage = { inputTokens: 0, outputTokens: 0, llmCalls: 0 };
  const warnings: string[] = [];
  const out = groups.map((g) => ({ ...g }));
  const todo = out.filter(wantsCard);
  let generated = 0;
  let failed = 0;

  let next = 0;
  const worker = async () => {
    while (next < todo.length) {
      const g = todo[next++];
      try {
        const sent = retrieve(opts.docs, buildQuery(g), { budgetChars: opts.budgetChars });
        if (sent.length === 0) warnings.push(`${g.label}: no company documents available; card will rely on the proof gap`);
        const info = categoryInfo(g.key);
        const payload = {
          group: { name: info.label, definition: info.definition, reply_count: g.replies.length },
          replies: g.replies.slice(0, MAX_REPLIES_IN_PROMPT).map((r) => ({ company: r.company ?? null, reply: scrubPhones(r.replyText.slice(0, 1200)), why: r.reason ?? null })),
          themes: (g.themes ?? []).map((t) => ({ id: t.id, label: t.label, description: t.description, count: t.threadIds.length })),
        };
        const { data, usage: u } = await opts.llm.parse({
          model: opts.model,
          system: CARD_PROMPT,
          user: `${JSON.stringify(payload)}\n\nCOMPANY DOCUMENTS:\n${renderPassages(sent)}`,
          schema: CardSchema,
          name: "answer_card",
        });
        usage.inputTokens += u.inputTokens;
        usage.outputTokens += u.outputTokens;
        usage.llmCalls++;
        const { card, warnings: w } = validateCard(g, data, opts.docs, sent);
        warnings.push(...w.map((x) => `${g.label}: ${x}`));
        g.card = card;
        generated++;
      } catch (err) {
        failed++;
        warnings.push(`${g.label}: Answer Card failed (${err instanceof Error ? err.message : String(err)})`);
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(opts.concurrency ?? CONCURRENCY, todo.length) }, worker));
  return { groups: out, generated, failed, usage, warnings };
}
