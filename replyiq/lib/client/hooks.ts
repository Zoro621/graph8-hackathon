"use client";
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import type { Category } from "../types";
import {
  DRAFT_DURATION,
  RUN_DURATION,
  draftSnapshot,
  snapshot,
  type DraftSnapshot,
  type RunMeta,
  type RunSnapshot,
} from "../demo/engine";
import {
  EMPTY_MAP,
  EMPTY_RUNS,
  draftKey,
  findRunMeta,
  readDrafts,
  readLaunches,
  readRuns,
  restartRun,
  subscribe,
} from "./store";

const noop = () => () => {};
/** True after hydration; avoids reading browser-only state during SSR. */
export const useHydrated = () => useSyncExternalStore(noop, () => true, () => false);

export const useRuns = (): RunMeta[] => useSyncExternalStore(subscribe, readRuns, () => EMPTY_RUNS);
const useDrafts = () => useSyncExternalStore(subscribe, readDrafts, () => EMPTY_MAP);
const useLaunches = () => useSyncExternalStore(subscribe, readLaunches, () => EMPTY_MAP);

/** Wall clock that ticks until `until`, then stops. Null means idle. */
function useClock(until: number | null, interval = 100) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (until == null) return;
    const id = setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (t > until) clearInterval(id);
    }, interval);
    return () => clearInterval(id);
  }, [until, interval]);
  return now;
}

export interface RunState {
  snap: RunSnapshot;
  /** The finished run, used to lay out stable cluster positions while the live run fills in. */
  final: RunSnapshot;
  replay: () => void;
}

export function useRun(runId: string): RunState | null {
  const hydrated = useHydrated();
  const runs = useRuns();
  const meta = useMemo(() => findRunMeta(runs, runId), [runs, runId]);
  const now = useClock(hydrated ? meta.createdAt + RUN_DURATION + 150 : null);
  const snap = useMemo(() => snapshot(meta, Math.max(now, meta.createdAt)), [meta, now]);
  const final = useMemo(() => snapshot(meta, meta.createdAt + RUN_DURATION + 1), [meta]);
  const replay = useCallback(() => void restartRun(runId), [runId]);
  return hydrated ? { snap, final, replay } : null;
}

export function useDraft(runId: string, key: Category): DraftSnapshot {
  const startedAt = useDrafts()[draftKey(runId, key)] as number | undefined;
  const now = useClock(startedAt ? startedAt + DRAFT_DURATION + 150 : null, 120);
  return draftSnapshot(runId, key, startedAt, Math.max(now, startedAt ?? 0));
}

export const useLaunched = (runId: string, key: Category) => !!useLaunches()[draftKey(runId, key)];

export function useMediaQuery(query: string, serverValue = false) {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia(query);
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    () => window.matchMedia(query).matches,
    () => serverValue,
  );
}

export const usePrefersReducedMotion = () => useMediaQuery("(prefers-reduced-motion: reduce)");
