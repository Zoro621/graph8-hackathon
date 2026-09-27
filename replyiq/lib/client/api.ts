"use client";
// Typed calls to the app's API routes, plus a tiny shared cache: every component reading the same URL
// shares one request and one result, and polling stops as soon as nothing is running.
import { useEffect, useSyncExternalStore } from "react";
import type { ApiErrorBody, LearningsView, OriginalView, RunSummary, RunView, SourceSummary, StatusView } from "../api-types";
import type { Category } from "../types";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, { cache: "no-store", ...init, headers: { "Content-Type": "application/json", ...init?.headers } });
  } catch {
    throw new ApiError(0, "network", "Can't reach the ReplyIQ server");
  }
  const text = await res.text();
  const json = text ? (JSON.parse(text) as unknown) : null;
  if (!res.ok) {
    const e = (json as ApiErrorBody | null)?.error;
    throw new ApiError(res.status, e?.code ?? "http_error", e?.message ?? `Request failed (${res.status})`);
  }
  return json as T;
}

const post = <T>(url: string, body: unknown) => request<T>(url, { method: "POST", body: JSON.stringify(body) });

export const keys = {
  status: "/api/status",
  sources: "/api/sources",
  runs: "/api/runs",
  run: (id: string) => `/api/runs/${encodeURIComponent(id)}`,
  original: (id: string) => `/api/runs/${encodeURIComponent(id)}/original`,
};

export const api = {
  startRun: (body: { sequenceId: string } | { campaignId: string }) => post<{ runId: string }>(keys.runs, body),
  draft: (runId: string, group: Category, body: { action: "create" | "patch" | "previews" | "rewrite" | "adopt"; previews?: number; fromRunId?: string }) =>
    post<{ runId: string; group: Category }>(`${keys.run(runId)}/groups/${group}/draft`, body),
  learnings: (runId: string, action: "propose" | "apply" | "remove") => post<LearningsView>(`${keys.run(runId)}/learnings`, { action }),
  refreshSources: () => request<SourceSummary[]>(`${keys.sources}?refresh=1`),
};

// ---------- shared cache ----------

export interface Resource<T> {
  data?: T;
  error?: ApiError;
  loading: boolean;
}

const EMPTY: Resource<never> = { loading: true };
const snaps = new Map<string, Resource<unknown>>();
const listeners = new Map<string, Set<() => void>>();
const inflight = new Map<string, Promise<void>>();

function publish(key: string, snap: Resource<unknown>) {
  snaps.set(key, snap);
  listeners.get(key)?.forEach((l) => l());
}

/** Re-fetches a URL (deduped). Keeps the last good data if the refetch fails. */
export function revalidate(key: string): Promise<void> {
  const running = inflight.get(key);
  if (running) return running;
  const p = request<unknown>(key)
    .then((data) => publish(key, { data, loading: false }))
    .catch((error: ApiError) => publish(key, { data: snaps.get(key)?.data, error, loading: false }))
    .finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}

/** Puts known data in the cache (e.g. a response that already contains it). */
export const prime = <T>(key: string, data: T) => publish(key, { data, loading: false });

function subscribe(key: string) {
  return (cb: () => void) => {
    const set = listeners.get(key) ?? new Set();
    set.add(cb);
    listeners.set(key, set);
    return () => set.delete(cb);
  };
}

/**
 * Reads a GET endpoint. `poll` returns the refresh interval for the current data (ms), or 0 to stop.
 * Polling pauses while the tab is hidden and catches up the moment it is shown again.
 */
export function useResource<T>(key: string | null, poll?: (data: T | undefined) => number): Resource<T> & { refresh: () => Promise<void> } {
  const snap = useSyncExternalStore(
    key ? subscribe(key) : noopSubscribe,
    () => (key ? ((snaps.get(key) as Resource<T>) ?? EMPTY) : EMPTY),
    () => EMPTY,
  );
  useEffect(() => {
    if (key) void revalidate(key);
  }, [key]);
  const every = key && poll ? poll(snap.data) : 0;
  useEffect(() => {
    if (!key || !every) return;
    const tick = () => {
      if (document.visibilityState === "visible") void revalidate(key);
    };
    const id = setInterval(tick, every);
    // Coming back to the tab refreshes at once instead of showing what was true when it was hidden.
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [key, every]);
  return { ...snap, refresh: () => (key ? revalidate(key) : Promise.resolve()) };
}

const noopSubscribe = () => () => {};

// ---------- hooks ----------

export const useStatus = () => useResource<StatusView>(keys.status);
export const useSources = (enabled = true) => useResource<SourceSummary[]>(enabled ? keys.sources : null);

/** Recent runs; refreshes every few seconds while any of them is still working. */
export const useRunSummaries = (enabled = true) =>
  useResource<RunSummary[]>(enabled ? keys.runs : null, (d) => (d?.some((r) => r.status === "running" || r.job) ? 4000 : 0));

/**
 * One run; polls every 1.5 s while the pipeline, a draft or learnings job is working on it. A run that has
 * just been reported as interrupted keeps polling for a few seconds: a job's last save and the release of its
 * lock are not one instant, so the first "interrupted" can be a job that is finishing, not one that died.
 */
export const useRunView = (id: string | null) =>
  useResource<RunView>(id ? keys.run(id) : null, (d) => (isWorking(d) ? 1500 : d && recentlyInterrupted(d) ? 2000 : 0));

const INTERRUPTED_GRACE_POLLS = 4; // 4 more polls at 2 s = 8 s of grace
const interruptedPolls = new Map<string, { n: number; last: RunView }>();
function recentlyInterrupted(run: RunView): boolean {
  if (!run.interrupted) {
    interruptedPolls.delete(run.id);
    return false;
  }
  // Counted per response (same object = same poll), not per render.
  const prev = interruptedPolls.get(run.id);
  const n = prev ? (prev.last === run ? prev.n : prev.n + 1) : 1;
  interruptedPolls.set(run.id, { n, last: run });
  return n <= INTERRUPTED_GRACE_POLLS;
}

/** The run's original sequence (V1), read live from graph8 once per view. */
export const useOriginal = (id: string | null) => useResource<OriginalView>(id ? keys.original(id) : null);

export const isWorking = (run: RunView | undefined) =>
  Boolean(run && !run.interrupted && (run.status === "running" || run.job || run.groups.some((g) => g.draft?.status === "drafting")));
