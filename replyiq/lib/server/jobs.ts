// One background job per run at a time (pipeline, draft or learnings). Every job loads the whole run file
// and saves it back, so two at once would overwrite each other's results.
// In-process only: kept on globalThis so dev hot reloads don't forget running jobs. A restart loses them,
// which the run view reports as `interrupted`.
import type { Category } from "../types";
import type { JobKind, JobView } from "../api-types";

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
