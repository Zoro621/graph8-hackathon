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
  opts: {
    digest?: (threadText: string) => Digest | Promise<Digest>;
    themes?: (payload: ThemesPayload) => ThemesAnswer | Promise<ThemesAnswer>;
  } = {},
) {
  const requests: LlmRequest<unknown>[] = [];
  const digestRequests: LlmRequest<unknown>[] = [];
  const themeRequests: LlmRequest<unknown>[] = [];
  const llm: Llm = {
    async parse<T>(req: LlmRequest<T>) {
      if (req.name === "group_themes") {
        themeRequests.push(req as LlmRequest<unknown>);
        const payload = JSON.parse(req.user) as ThemesPayload;
        // Default: everything in one theme, quoting the first reply verbatim.
        const answer = opts.themes
          ? await opts.themes(payload)
          : { themes: [{ label: "All alike", description: "d", members: payload.items.map((i) => i.id), quote_member: payload.items[0].id, quote: payload.items[0].reply }] };
        return { data: req.schema.parse(answer), usage: { inputTokens: 500, outputTokens: 40 } };
      }
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
  return { llm, requests, digestRequests, themeRequests };
}

export type ThemesPayload = {
  group: { name: string; definition: string };
  items: { id: string; company: string | null; reply: string; why_in_this_group: string | null; referred_to: string | null; timing: string | null }[];
};
export type ThemesAnswer = { themes: { label: string; description: string; members: string[]; quote_member: string; quote: string }[] };

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
