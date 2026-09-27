// LLM access (server-only). Everything else depends on the small `Llm` interface, so tests can
// inject a fake and the provider can change without touching the pipeline.
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import type { z } from "zod";
import { getEnv } from "./env";

export interface LlmUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface LlmRequest<T> {
  model: string;
  system: string;
  user: string;
  schema: z.ZodType<T>;
  name: string; // schema name shown to the model
}

export interface Llm {
  parse<T>(req: LlmRequest<T>): Promise<{ data: T; usage: LlmUsage }>;
}

export class LlmError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "LlmError";
  }
}

/** OpenAI Responses API with structured outputs (zodTextFormat). The SDK retries 429/5xx itself. */
export function createOpenAiLlm(opts: { apiKey: string; client?: OpenAI; timeoutMs?: number }): Llm {
  const openai = opts.client ?? new OpenAI({ apiKey: opts.apiKey, timeout: opts.timeoutMs ?? 90_000, maxRetries: 2 });
  return {
    async parse<T>(req: LlmRequest<T>) {
      try {
        const res = await openai.responses.parse({
          model: req.model,
          input: [
            { role: "system", content: req.system },
            { role: "user", content: req.user },
          ],
          text: { format: zodTextFormat(req.schema, req.name) },
        });
        if (res.output_parsed == null) throw new LlmError("model returned no parsable output (refusal or empty)");
        // Re-validate: the SDK parses JSON, zod enforces our constraints (ranges, enums).
        const data = req.schema.parse(res.output_parsed);
        return { data, usage: { inputTokens: res.usage?.input_tokens ?? 0, outputTokens: res.usage?.output_tokens ?? 0 } };
      } catch (err) {
        if (err instanceof LlmError) throw err;
        const e = err as { status?: number; message?: string };
        throw new LlmError(`OpenAI ${req.model}: ${e.message ?? String(err)}`, e.status);
      }
    },
  };
}

let defaultLlm: Llm | undefined;

/** The LLM configured from .env.local. */
export function llm(): Llm {
  if (!defaultLlm) defaultLlm = createOpenAiLlm({ apiKey: getEnv().OPENAI_API_KEY });
  return defaultLlm;
}
