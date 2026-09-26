// M2: label every reply with one category. Robust by construction:
// - strict JSON schema output, re-validated with zod
// - every reply gets exactly one label (missing ones are retried alone, then fall back to "other")
// - quotes must be verbatim from the reply, otherwise replaced and the confidence capped
// - placeholder/empty replies never reach the model
import { z } from "zod";
import type { Llm, LlmUsage } from "../llm";
import { scrubPhones } from "../scrub";
import { norm } from "../text";
import { buildThreadContext, THREAD_CHAR_LIMIT, type ThreadContext } from "./compose";
import { CATEGORIES, CATEGORY_KEYS, REVIEW_THRESHOLD } from "../taxonomy";
import type { Category, Classified, Reply } from "../types";

export const BATCH_SIZE = 20;
const CONCURRENCY = 3;
const BATCH_CHAR_BUDGET = 120_000; // a batch also closes when its threads add up to this much text

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

/**
 * One model input item. `id` is a short per-batch alias (R1, R2…), not the long thread UUID:
 * near-identical UUIDs made the model swap labels between threads (seen live, 26 Sep).
 * The latest reply comes first and the company is named, so each item is easy to tell apart.
 */
function toItem(alias: string, r: Reply, ctx: ThreadContext) {
  return {
    id: alias,
    company: r.company ?? null,
    latest_prospect_reply: scrubPhones(r.replyText.slice(0, 3000)),
    subject: r.subject ?? null,
    graph8_summary: r.summary ?? null,
    context: ctx.mode, // full = entire thread verbatim; composed = verified digest; truncated = first + latest
    conversation: scrubPhones(ctx.text),
  };
}

/** True when the label's quote is not in its own reply but is verbatim in another reply of the batch. */
export function isSwapped(own: Reply, quote: string, batch: Reply[]): boolean {
  const q = norm(quote);
  if (q.length < 8 || norm(own.replyText).includes(q)) return false;
  return batch.some((o) => o !== own && norm(o.replyText).includes(q));
}

/** Pack replies into batches by count and by total context size. */
export function packBatches<T extends { chars: number }>(items: T[], size: number, charBudget = BATCH_CHAR_BUDGET): T[][] {
  const batches: T[][] = [];
  let cur: T[] = [];
  let chars = 0;
  for (const it of items) {
    if (cur.length && (cur.length >= size || chars + it.chars > charBudget)) {
      batches.push(cur);
      cur = [];
      chars = 0;
    }
    cur.push(it);
    chars += it.chars;
  }
  if (cur.length) batches.push(cur);
  return batches;
}

export { norm };

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
  composeModel?: string; // model for long-thread digests (defaults to model)
  threadCharLimit?: number; // threads longer than this get a composed digest (default 12,000)
  batchSize?: number;
  concurrency?: number;
  onProgress?: (done: number, total: number) => void;
}

export interface ClassifyResult {
  classified: Classified[];
  usage: LlmUsage & { llmCalls: number };
  warnings: string[];
  contexts: Record<ThreadContext["mode"], number>;
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
  const addUsage = (u: LlmUsage, calls = 1) => {
    usage.inputTokens += u.inputTokens;
    usage.outputTokens += u.outputTokens;
    usage.llmCalls += calls;
  };
  const warnings: string[] = [];
  const contexts = { full: 0, composed: 0, truncated: 0 };
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

  // 1) Context per thread: the entire conversation, or a grounded digest when it is over the limit.
  const concurrency = opts.concurrency ?? CONCURRENCY;
  const withCtx = await mapLimit(toModel, concurrency, async (r) => {
    const { ctx, usage: u } = await buildThreadContext(r, {
      llm: opts.llm,
      model: opts.composeModel ?? opts.model,
      limit: opts.threadCharLimit ?? THREAD_CHAR_LIMIT,
    });
    if (u.llmCalls) addUsage(u, u.llmCalls);
    contexts[ctx.mode]++;
    if (ctx.mode === "truncated") {
      warnings.push(`thread ${r.threadId.slice(0, 12)} was too long and no digest point could be verified; used first + latest messages`);
    } else if (ctx.dropped) {
      warnings.push(`thread ${r.threadId.slice(0, 12)}: ${ctx.dropped} digest point(s) dropped (quote not found in the thread)`);
    }
    return { r, ctx, chars: ctx.text.length };
  });
  const ctxById = new Map(withCtx.map((x) => [x.r.threadId, x.ctx]));

  /** One model call. Items get short aliases (R1, R2…); labels come back keyed by thread id. */
  const call = async (batch: Reply[]) => {
    const alias = new Map(batch.map((r, i) => [`R${i + 1}`, r]));
    const { data, usage: u } = await opts.llm.parse({
      model: opts.model,
      system: SYSTEM_PROMPT,
      user: JSON.stringify({ items: [...alias].map(([a, r]) => toItem(a, r, ctxById.get(r.threadId)!)) }),
      schema: LabelSchema,
      name: "reply_labels",
    });
    addUsage(u);
    return data.labels.map((l) => ({ ...l, id: alias.get(l.id.trim())?.threadId ?? `unknown:${l.id}` }));
  };
  const label = (r: Reply, l: Omit<Label, "id">): Classified => ({ ...applyLabel(r, l), context: ctxById.get(r.threadId)?.mode ?? "full" });

  // 2) Classify in batches packed by count and by total size.
  const size = Math.max(1, opts.batchSize ?? BATCH_SIZE);
  const batches = packBatches(withCtx, size).map((b) => b.map((x) => x.r));

  let done = result.size;
  opts.onProgress?.(done, unique.length);

  await mapLimit(batches, concurrency, async (batch) => {
    const byId = new Map(batch.map((r) => [r.threadId, r]));
    const labels = await call(batch); // a failure here fails the step: partial labels would mislead
    const seen = new Set<string>();
    const swapped = new Set<string>();
    for (const l of labels) {
      const r = byId.get(l.id);
      if (!r) {
        warnings.push(`model returned an unknown id (${l.id.replace(/^unknown:/, "").slice(0, 12)}); ignored`);
        continue;
      }
      if (seen.has(l.id)) continue; // keep the first label for an id
      seen.add(l.id);
      // The quote belongs to a different reply in this batch: the model crossed two items.
      if (batch.length > 1 && isSwapped(r, l.quote, batch)) {
        swapped.add(l.id);
        continue;
      }
      result.set(l.id, label(r, l));
    }
    if (swapped.size) warnings.push(`${swapped.size} label(s) were crossed between threads; re-classified one at a time`);
    // Retry skipped or crossed replies one at a time (a swap is impossible alone); then fall back to review.
    for (const r of batch.filter((x) => !seen.has(x.threadId) || swapped.has(x.threadId))) {
      try {
        const [l] = (await call([r])).filter((x) => x.id === r.threadId);
        if (l) {
          result.set(r.threadId, label(r, l));
          continue;
        }
      } catch {
        /* fall through to the fallback */
      }
      warnings.push(`no label for thread ${r.threadId.slice(0, 12)}; marked for review`);
      result.set(r.threadId, label(r, { category: "other", confidence: 0, quote: "", referred_name: null, revisit_hint: null, reason: "The model did not return a label" }));
    }
    done += batch.length;
    opts.onProgress?.(done, unique.length);
  });

  // Keep the input order.
  return { classified: unique.map((r) => result.get(r.threadId)!), usage, warnings, contexts };
}
