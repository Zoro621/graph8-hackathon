// One background job per run at a time (pipeline, draft or learnings). Every job loads the whole run file
// and saves it back, so two at once would overwrite each other's results.
// Locally the lock is in-process, kept on globalThis so dev hot reloads don't forget running jobs; a restart
// loses them, which the run view reports as `interrupted`. On serverless hosts it lives in Redis (redisJobs).
import type { Category } from "../types";
import type { JobKind, JobView } from "../api-types";
import type { RedisClient } from "../redis";

interface Job {
  kind: JobKind;
  group?: Category;
  startedAt: number;
}

const g = globalThis as typeof globalThis & { __replyiqJobs?: Map<string, Job> };
const jobs: Map<string, Job> = (g.__replyiqJobs ??= new Map());

export function activeJob(runId: string): JobView | null {
  const j = jobs.get(runId);
  return j ? { kind: j.kind, ...(j.group ? { group: j.group } : {}), startedAt: new Date(j.startedAt).toISOString() } : null;
}

/** Claims the run for a job. Returns false when another job already holds it. */
export function claim(runId: string, kind: JobKind, group?: Category): boolean {
  if (jobs.has(runId)) return false;
  jobs.set(runId, { kind, group, startedAt: Date.now() });
  return true;
}

export function release(runId: string) {
  jobs.delete(runId);
}

/** For tests. */
export function resetJobs() {
  jobs.clear();
}

/** Where the one-job-per-run lock lives: this process (local, tests) or Redis (several serverless instances). */
export interface JobLock {
  active(runId: string): Promise<JobView | null>;
  claim(runId: string, kind: JobKind, group?: Category): Promise<boolean>;
  release(runId: string): Promise<void>;
}

export const memoryJobs: JobLock = {
  active: async (runId) => activeJob(runId),
  claim: async (runId, kind, group) => claim(runId, kind, group),
  release: async (runId) => release(runId),
};

/**
 * The lock in Redis: SET NX with an expiry a little past the longest function (300 s), so a job whose
 * function was killed frees the run on its own and the run then reads as interrupted.
 */
export function redisJobs(redis: RedisClient, opts: { prefix?: string; ttlSeconds?: number } = {}): JobLock {
  const key = (runId: string) => `${opts.prefix ?? "replyiq"}:job:${runId}`;
  const ttl = opts.ttlSeconds ?? 330;
  return {
    async active(runId) {
      const raw = await redis.cmd<string | null>("GET", key(runId));
      return raw ? (JSON.parse(raw) as JobView) : null;
    },
    async claim(runId, kind, group) {
      const job: JobView = { kind, ...(group ? { group } : {}), startedAt: new Date().toISOString() };
      return (await redis.cmd<string | null>("SET", key(runId), JSON.stringify(job), "NX", "EX", ttl)) === "OK";
    },
    async release(runId) {
      await redis.cmd("DEL", key(runId));
    },
  };
}
