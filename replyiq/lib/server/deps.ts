import "server-only";
import { after } from "next/server";
import { getEnv } from "../env";
import { g8 } from "../g8";
import { llm } from "../llm";
import { createFileStore } from "../store";
import { ApiError, type ServiceDeps } from "./service";

const REQUIRED = ["G8_API_KEY", "OPENAI_API_KEY"] as const;

/** Which required keys are missing (names only, never values). */
export const missingKeys = () => REQUIRED.filter((k) => !process.env[k]);

let deps: Omit<ServiceDeps, "schedule"> | undefined;

/** The real graph8 client, OpenAI and run store, built from .env.local. Throws 503 until the keys are set. */
export function getDeps(): ServiceDeps {
  const missing = missingKeys();
  if (missing.length) throw new ApiError(503, "not_configured", `Missing ${missing.join(", ")} in .env.local`);
  if (!deps) {
    const env = getEnv();
    deps = {
      g8: g8(),
      llm: llm(),
      store: createFileStore(),
      env,
      log: (m) => console.log(`[replyiq] ${m}`),
    };
  }
  return { ...deps, schedule: (task) => after(task) };
}
