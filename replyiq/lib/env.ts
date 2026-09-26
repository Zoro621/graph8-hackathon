import { z } from "zod";

// Server-only: read from app/api/* and scripts/*, never from components.
// Validation is lazy so `next build` works before keys exist.

const boolish = z
  .enum(["true", "false", "1", "0"])
  .default("false")
  .transform((v) => v === "true" || v === "1");

const schema = z.object({
  G8_API_BASE: z.url().default("https://be.graph8.com/api/v1"),
  G8_API_KEY: z.string().min(1, "G8_API_KEY is missing (use a sandbox personal key)"),
  // Explicit opt-in for writes when /sandbox/status is unavailable. Must equal the key's org id.
  G8_WRITE_ORG_ID: z.string().trim().min(1).optional().or(z.literal("").transform(() => undefined)),
  OPENAI_API_KEY: z.string().min(1, "OPENAI_API_KEY is missing"),
  OPENAI_CLASSIFY_MODEL: z.string().default("gpt-6-luna"),
  OPENAI_REASON_MODEL: z.string().default("gpt-6-sol"),
  ENABLE_LAUNCH: boolish,
  MIN_GROUP_SIZE: z.coerce.number().int().min(1).default(2),
});

export type Env = z.infer<typeof schema>;

let cached: Env | undefined;

export function getEnv(): Env {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `- ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Invalid environment. Create .env.local (variables listed in README.md).\n${issues}`);
  }
  cached = parsed.data;
  return cached;
}

/** Which required keys are present, without exposing their values. */
export function envStatus() {
  return {
    g8Key: Boolean(process.env.G8_API_KEY),
    openaiKey: Boolean(process.env.OPENAI_API_KEY),
    launchEnabled: ["true", "1"].includes(process.env.ENABLE_LAUNCH ?? ""),
  };
}
