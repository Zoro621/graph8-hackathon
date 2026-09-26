// M2: label every reply with one category. Robust by construction:
// - strict JSON schema output, re-validated with zod
// - every reply gets exactly one label (missing ones are retried alone, then fall back to "other")
// - quotes must be verbatim from the reply, otherwise replaced and the confidence capped
// - placeholder/empty replies never reach the model
import { z } from "zod";
import type { Llm, LlmUsage } from "../llm";
import { scrubPhones } from "../scrub";
import { CATEGORIES, CATEGORY_KEYS, REVIEW_THRESHOLD } from "../taxonomy";
import type { Category, Classified, Reply } from "../types";

export const BATCH_SIZE = 20;
const CONCURRENCY = 3;
const MAX_CONVERSATION_CHARS = 2400;

const LabelSchema = z.object({
  labels: z.array(
    z.object({
      id: z.string(),
      category: z.enum(CATEGORY_KEYS),
      confidence: z.number(),
      quote: z.string(),
      referred_name: z.string().nullable(),
      revisit_hint: z.string().nullable(),
      reason: z.string(),
    }),
  ),
});
type Label = z.infer<typeof LabelSchema>["labels"][number];

export const SYSTEM_PROMPT = [
  "You label replies to B2B cold-email campaigns so a sales team knows what to do next.",
  "For each item pick exactly ONE category. Read the whole conversation, not only the latest message:",
  "a thread can end with a small detail (a time correction) after a meeting was already confirmed.",
  "",
  "Categories:",
  ...CATEGORIES.map((c) => `- ${c.key}: ${c.definition}`),
  "",
  "Rules:",
  "- Use only what the text says. Never guess intent that is not there.",
  "- quote: copy a short span (max ~25 words) VERBATIM from the prospect's latest reply that justifies the label.",
  "- referred_name: the person the prospect points to (replacement, colleague, manager), else null.",
  "- revisit_hint: a return date or timing mentioned (\"June 9\", \"next quarter\"), else null.",
  "- reason: one short sentence explaining the label.",
  "- confidence: 0 to 1. Use below 0.6 when the text is ambiguous.",
  "- Return one label per input id, using the exact ids given.",
].join("\n");

/** Replies the model must not see: nothing to classify. */
export function preLabel(r: Reply): Omit<Label, "id"> | null {
  const text = r.replyText.trim();
  if (text.length < 2) return { category: "other", confidence: 1, quote: "", referred_name: null, revisit_hint: null, reason: "Empty reply" };
  if (/original private reply omitted|\[anonymi[sz]ed history\]/i.test(text)) {
    return { category: "other", confidence: 1, quote: text.slice(0, 80), referred_name: null, revisit_hint: null, reason: "Placeholder text: the original reply was removed" };
  }
  return null;
}

function toItem(r: Reply) {
  let convo = r.conversation.map((m) => `${m.from === "us" ? "US" : "PROSPECT"}: ${m.text}`).join("\n---\n");
  if (convo.length > MAX_CONVERSATION_CHARS) convo = "…" + convo.slice(-MAX_CONVERSATION_CHARS);
  return {
    id: r.threadId,
    subject: r.subject ?? null,
    graph8_summary: r.summary ?? null,
    conversation: scrubPhones(convo),
    latest_prospect_reply: scrubPhones(r.replyText.slice(0, 1500)),
  };
}

/** Comparison form: case, quote marks, dashes, whitespace, and broken/invisible characters don't matter. */
export const norm = (s: string) =>
  s
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\uFFFD\u200B-\u200D\uFEFF]/g, "") // replacement char (bad encoding), zero-width chars
    .replace(/["'“”«»„‘’‚`]/g, "") // quote marks: bad encodings often turn them into U+FFFD
    .replace(/[‐‑‒–—−]/g, "-")
    .replace(/\s+/g, " ")
    .trim();

/** Apply a label to a reply, enforcing the invariants. */
export function applyLabel(r: Reply, l: Omit<Label, "id">): Classified {
  let confidence = Number.isFinite(l.confidence) ? Math.min(1, Math.max(0, l.confidence)) : 0;
  let quote = l.quote.trim();
  const haystack = norm(r.replyText);
  const verbatim = quote.length > 0 && haystack.includes(norm(quote));
  if (!verbatim) {
    quote = r.replyText.replace(/\s+/g, " ").trim().slice(0, 140);
    if (l.category !== "other" || l.quote) confidence = Math.min(confidence, 0.5);
  }
  return {
    ...r,
    category: l.category as Category,
    confidence,
    quote,
    referredName: l.referred_name?.trim() || undefined,
    revisitHint: l.revisit_hint?.trim() || undefined,
    reason: l.reason?.trim() || undefined,
    needsReview: confidence < REVIEW_THRESHOLD,
  };
}

export interface ClassifyOptions {
  llm: Llm;
  model: string;
  batchSize?: number;
  concurrency?: number;
  onProgress?: (done: number, total: number) => void;
}

export interface ClassifyResult {
  classified: Classified[];
  usage: LlmUsage & { llmCalls: number };
  warnings: string[];
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
    }
  });
  await Promise.all(workers);
  return out;
}

export async function classifyReplies(replies: Reply[], opts: ClassifyOptions): Promise<ClassifyResult> {
  const usage = { inputTokens: 0, outputTokens: 0, llmCalls: 0 };
  const warnings: string[] = [];
  const result = new Map<string, Classified>();

  // Duplicate thread ids would make "exactly one label per id" ambiguous.
  const unique = [...new Map(replies.map((r) => [r.threadId, r])).values()];
  if (unique.length < replies.length) warnings.push(`${replies.length - unique.length} duplicate thread(s) ignored`);

  const toModel: Reply[] = [];
  for (const r of unique) {
    const pre = preLabel(r);
    if (pre) result.set(r.threadId, applyLabel(r, pre));
    else toModel.push(r);
  }

  const call = async (batch: Reply[]) => {
    const { data, usage: u } = await opts.llm.parse({
      model: opts.model,
      system: SYSTEM_PROMPT,
      user: JSON.stringify({ items: batch.map(toItem) }),
      schema: LabelSchema,
      name: "reply_labels",
    });
    usage.inputTokens += u.inputTokens;
    usage.outputTokens += u.outputTokens;
    usage.llmCalls++;
    return data.labels;
  };

  const size = Math.max(1, opts.batchSize ?? BATCH_SIZE);
  const batches: Reply[][] = [];
  for (let i = 0; i < toModel.length; i += size) batches.push(toModel.slice(i, i + size));

  let done = result.size;
  opts.onProgress?.(done, unique.length);

  await mapLimit(batches, opts.concurrency ?? CONCURRENCY, async (batch) => {
    const byId = new Map(batch.map((r) => [r.threadId, r]));
    const labels = await call(batch); // a failure here fails the step: partial labels would mislead
    const seen = new Set<string>();
    for (const l of labels) {
      const r = byId.get(l.id);
      if (!r) {
        warnings.push(`model returned an unknown id (${l.id.slice(0, 12)}); ignored`);
        continue;
      }
      if (seen.has(l.id)) continue; // keep the first label for an id
      seen.add(l.id);
      result.set(l.id, applyLabel(r, l));
    }
    // Retry the ones the model skipped, one at a time; then fall back to "other" for review.
    for (const r of batch.filter((x) => !seen.has(x.threadId))) {
      try {
        const [l] = (await call([r])).filter((x) => x.id === r.threadId);
        if (l) {
          result.set(r.threadId, applyLabel(r, l));
          continue;
        }
      } catch {
        /* fall through to the fallback */
      }
      warnings.push(`no label for thread ${r.threadId.slice(0, 12)}; marked for review`);
      result.set(
        r.threadId,
        applyLabel(r, { category: "other", confidence: 0, quote: "", referred_name: null, revisit_hint: null, reason: "The model did not return a label" }),
      );
    }
    done += batch.length;
    opts.onProgress?.(done, unique.length);
  });

  // Keep the input order.
  return { classified: unique.map((r) => result.get(r.threadId)!), usage, warnings };
}
