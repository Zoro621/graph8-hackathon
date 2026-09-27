import "server-only";
import { after } from "next/server";
import { getEnv } from "../env";
import { g8 } from "../g8";
import { llm } from "../llm";
import { createRedis, redisConfig } from "../redis";
import { createFileStore, createRedisStore } from "../store";
import { memoryJobs, redisJobs } from "./jobs";
import { ApiError, type ServiceDeps } from "./service";

const REQUIRED = ["G8_API_KEY", "OPENAI_API_KEY"] as const;

/** On Vercel there is no disk to keep runs on, and requests reach different instances: runs and job locks need Redis. */
const REDIS_HINT = "KV_REST_API_URL and KV_REST_API_TOKEN (Upstash Redis from the Vercel Marketplace)";

/** Which required settings are missing (names only, never values). */
export const missingKeys = () => [...REQUIRED.filter((k) => !process.env[k]), ...(process.env.VERCEL && !redisConfig() ? [REDIS_HINT] : [])];

let deps: Omit<ServiceDeps, "schedule"> | undefined;

/** The real graph8 client, OpenAI, run store and job lock, from the environment. Throws 503 until it is complete. */
export function getDeps(): ServiceDeps {
  const missing = missingKeys();
  if (missing.length) throw new ApiError(503, "not_configured", `Missing ${missing.join(", ")}`);
  if (!deps) {
    const env = getEnv();
    const cfg = redisConfig();
    const redis = cfg ? createRedis(cfg) : null;
    deps = {
      g8: g8(),
      llm: llm(),
      // Redis when configured (serverless hosts); run files under data/runs otherwise (one local server).
      store: redis ? createRedisStore(redis) : createFileStore(),
      jobs: redis ? redisJobs(redis) : memoryJobs,
      env,
      log: (m) => console.log(`[replyiq] ${m}`),
    };
  }
  return { ...deps, schedule: (task) => after(task) };
}
