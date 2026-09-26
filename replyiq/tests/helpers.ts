import type { Llm, LlmRequest } from "../lib/llm";
import type { Reply } from "../lib/types";

export function reply(id: string, text: string, extra: Partial<Reply> = {}): Reply {
  return {
    threadId: id,
    sequenceId: "seq1",
    contactEmail: `${id}@example.com`,
    contactId: 1,
    replyText: text,
    conversation: [
      { from: "us", text: "our pitch" },
      { from: "prospect", text },
    ],
    existingTags: [],
    ...extra,
  };
}

type Label = { id: string; category: string; confidence: number; quote: string; referred_name: string | null; revisit_hint: string | null; reason: string };

/**
 * A fake LLM. `answer` receives the batch items the pipeline sent and returns labels.
 * Records every request so tests can assert batching and prompts.
 */
export type Digest = {
  events: { who: "us" | "prospect"; what: string; evidence: string }[];
  current_state: string;
  current_state_evidence: string;
};

export function fakeLlm(
  answer: (items: { id: string; latest_prospect_reply: string; conversation: string; context: string }[]) => Label[] | Promise<Label[]>,
  opts: { digest?: (threadText: string) => Digest | Promise<Digest> } = {},
) {
  const requests: LlmRequest<unknown>[] = [];
  const digestRequests: LlmRequest<unknown>[] = [];
  const llm: Llm = {
    async parse<T>(req: LlmRequest<T>) {
      if (req.name === "thread_digest") {
        digestRequests.push(req as LlmRequest<unknown>);
        if (!opts.digest) throw new Error("unexpected composer call");
        return { data: req.schema.parse(await opts.digest(req.user)), usage: { inputTokens: 1000, outputTokens: 50 } };
      }
      requests.push(req as LlmRequest<unknown>);
      const { items } = JSON.parse(req.user) as { items: { id: string; latest_prospect_reply: string; conversation: string; context: string }[] };
      const labels = await answer(items);
      // Validate through the real schema, like the real client does.
      return { data: req.schema.parse({ labels }), usage: { inputTokens: 100, outputTokens: 10 } };
    },
  };
  return { llm, requests, digestRequests };
}

/** A label that quotes the start of the reply verbatim. */
export const label = (id: string, category: string, text: string, extra: Partial<Label> = {}): Label => ({
  id,
  category,
  confidence: 0.9,
  quote: text.slice(0, 30),
  referred_name: null,
  revisit_hint: null,
  reason: "because",
  ...extra,
});
