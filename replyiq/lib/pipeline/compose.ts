// Thread context for the classifier.
// - Thread <= THREAD_CHAR_LIMIT: the entire conversation, verbatim.
// - Longer: a "composer" LLM pass reads the WHOLE thread (in chunks if huge) and writes a digest of
//   every event that matters for intent. Each event must carry a verbatim quote from the thread, and
//   the code drops any event whose quote is not found, so the digest stays grounded. The classifier
//   then gets: first message verbatim + verified digest + latest messages verbatim.
// - If no event survives verification: first message + as many latest messages as fit ("truncated").
import { z } from "zod";
import type { Llm, LlmUsage } from "../llm";
import { norm } from "../text";
import type { Reply } from "../types";

export const THREAD_CHAR_LIMIT = 12_000;
const CHUNK_CHARS = 60_000; // composer input per call
const FIRST_MESSAGE_CHARS = 2_000;
const TAIL_CHARS = 4_000; // latest messages kept verbatim
const MIN_EVIDENCE_WORDS = 3;

export type ContextMode = "full" | "composed" | "truncated";

export interface ThreadContext {
  text: string;
  mode: ContextMode;
  events?: number; // verified digest events (composed mode)
  dropped?: number; // events dropped because their quote was not in the thread
}

type Msg = Reply["conversation"][number];

export const renderMessage = (m: Msg) => `${m.from === "us" ? "US" : "PROSPECT"}${m.date ? ` (${m.date.slice(0, 10)})` : ""}: ${m.text}`;
export const renderConversation = (conv: Msg[]) => conv.map(renderMessage).join("\n---\n");

const DigestSchema = z.object({
  events: z.array(
    z.object({
      who: z.enum(["us", "prospect"]),
      what: z.string(),
      evidence: z.string(),
    }),
  ),
  current_state: z.string(),
  current_state_evidence: z.string(),
});
type Digest = z.infer<typeof DigestSchema>;

export const COMPOSER_PROMPT = [
  "You compress a long B2B sales email thread for another model that must decide the prospect's intent.",
  "Keep EVERY event that matters for intent, in order: interest, questions, objections, pricing, competitors,",
  "meetings proposed / confirmed / rescheduled / cancelled, referrals to other people, unsubscribe or stop requests,",
  "out-of-office notices, dates and deadlines. Skip signatures, disclaimers and pleasantries.",
  "",
  "Rules:",
  "- For each event give who (us | prospect), what happened in a few words, and evidence: a short quote",
  "  (5-30 words) copied VERBATIM from the thread. Never paraphrase inside evidence.",
  "- current_state: one sentence on where the conversation stands now; current_state_evidence: a verbatim quote supporting it.",
  "- Do not add anything that is not in the thread.",
].join("\n");

/** Split messages into chunks of at most `max` rendered characters (a huge single message is hard-split). */
export function chunkConversation(conv: Msg[], max = CHUNK_CHARS): string[] {
  const chunks: string[] = [];
  let cur = "";
  const flush = () => {
    if (cur) chunks.push(cur);
    cur = "";
  };
  for (const m of conv) {
    let piece = renderMessage(m);
    while (piece.length > max) {
      flush();
      chunks.push(piece.slice(0, max));
      piece = piece.slice(max);
    }
    if (cur && cur.length + piece.length + 5 > max) flush();
    cur = cur ? `${cur}\n---\n${piece}` : piece;
  }
  if (cur) chunks.push(cur);
  return chunks;
}

const verified = (haystack: string, quote: string) =>
  quote.trim().split(/\s+/).length >= MIN_EVIDENCE_WORDS && haystack.includes(norm(quote));

/** Latest messages (newest last) that fit in `budget`; always includes the latest one (clipped if needed). */
function tail(conv: Msg[], budget: number): Msg[] {
  const out: Msg[] = [];
  let used = 0;
  for (let i = conv.length - 1; i >= 1; i--) {
    const len = renderMessage(conv[i]).length + 5;
    if (out.length > 0 && used + len > budget) break;
    out.unshift(out.length === 0 && len > budget ? { ...conv[i], text: conv[i].text.slice(-budget) } : conv[i]);
    used += len;
  }
  return out;
}

const clipFirst = (m: Msg): Msg => (m.text.length > FIRST_MESSAGE_CHARS ? { ...m, text: `${m.text.slice(0, FIRST_MESSAGE_CHARS)} …[cut]` } : m);

function truncated(conv: Msg[], limit: number): ThreadContext {
  const first = clipFirst(conv[0]);
  const firstText = renderMessage(first);
  const last = tail(conv, Math.max(1_000, limit - firstText.length - 200));
  const skipped = conv.length - 1 - last.length;
  const text = [
    "[FIRST MESSAGE, verbatim]",
    firstText,
    ...(skipped > 0 ? [`[… ${skipped} earlier message(s) not shown …]`] : []),
    "[LATEST MESSAGES, verbatim]",
    renderConversation(last),
  ].join("\n");
  return { text, mode: "truncated" };
}

export interface ComposeOptions {
  llm: Llm;
  model: string;
  limit?: number;
}

/** Context for one reply. Makes LLM calls only when the thread is over the limit. */
export async function buildThreadContext(reply: Reply, opts: ComposeOptions): Promise<{ ctx: ThreadContext; usage: LlmUsage & { llmCalls: number } }> {
  const limit = opts.limit ?? THREAD_CHAR_LIMIT;
  const usage = { inputTokens: 0, outputTokens: 0, llmCalls: 0 };
  const conv = reply.conversation.length ? reply.conversation : [{ from: "prospect" as const, text: reply.replyText }];
  const full = renderConversation(conv);
  if (full.length <= limit) return { ctx: { text: full, mode: "full" }, usage };

  // Compose over the whole thread, chunk by chunk.
  const digests: Digest[] = [];
  for (const chunk of chunkConversation(conv)) {
    const { data, usage: u } = await opts.llm.parse({
      model: opts.model,
      system: COMPOSER_PROMPT,
      user: `THREAD (part of a longer conversation if split):\n${chunk}`,
      schema: DigestSchema,
      name: "thread_digest",
    });
    usage.inputTokens += u.inputTokens;
    usage.outputTokens += u.outputTokens;
    usage.llmCalls++;
    digests.push(data);
  }

  // Ground every event against the real thread.
  const haystack = norm(full);
  const all = digests.flatMap((d) => d.events);
  const kept = all.filter((e) => verified(haystack, e.evidence));
  const dropped = all.length - kept.length;
  const last = digests.at(-1)!;
  const state = verified(haystack, last.current_state_evidence) ? last : null;
  if (kept.length === 0) return { ctx: { ...truncated(conv, limit), dropped }, usage };

  // Assemble within the limit: first message + digest + latest messages.
  const firstText = renderMessage(clipFirst(conv[0]));
  const lastMsgs = tail(conv, TAIL_CHARS);
  const header = `[COMPOSED DIGEST of the full ${conv.length}-message thread. Every point is backed by a verbatim quote checked against the thread.]`;
  const stateLine = state ? `Current state: ${state.current_state} (quote: "${state.current_state_evidence.trim()}")` : null;
  const lines = kept.map((e, i) => `${i + 1}. ${e.who === "us" ? "US" : "PROSPECT"}: ${e.what} (quote: "${e.evidence.trim()}")`);
  const fixed = ["[FIRST MESSAGE, verbatim]", firstText, header, "", stateLine ?? "", "[LATEST MESSAGES, verbatim]", renderConversation(lastMsgs)].join("\n").length;
  let budget = limit - fixed;
  const body: string[] = [];
  let omitted = 0;
  // Keep earliest and latest events first when trimming: interleave from both ends.
  const order: number[] = [];
  for (let a = 0, b = lines.length - 1; a <= b; a++, b--) {
    order.push(a);
    if (a !== b) order.push(b);
  }
  const chosen = new Set<number>();
  for (const i of order) {
    if (lines[i].length + 1 > budget) {
      omitted++;
      continue;
    }
    chosen.add(i);
    budget -= lines[i].length + 1;
  }
  lines.forEach((l, i) => {
    if (chosen.has(i)) body.push(l);
  });
  if (omitted) body.push(`(${omitted} more verified event(s) omitted for length)`);

  const text = [
    "[FIRST MESSAGE, verbatim]",
    firstText,
    header,
    ...body,
    ...(stateLine ? [stateLine] : []),
    "[LATEST MESSAGES, verbatim]",
    renderConversation(lastMsgs),
  ].join("\n");
  return { ctx: { text, mode: "composed", events: chosen.size, dropped }, usage };
}
