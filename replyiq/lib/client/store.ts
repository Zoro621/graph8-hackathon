"use client";
// Browser-side run state for demo mode: a tiny external store over localStorage.
// Per-viewer only; every read/write is guarded. Components subscribe via useSyncExternalStore.
import { nanoid } from "nanoid";
import type { Category } from "../types";
import type { RunMeta } from "../demo/engine";
import { SEQUENCES } from "../demo/fixtures";

const RUNS = "replyiq:runs";
const DRAFTS = "replyiq:drafts";
const LAUNCHES = "replyiq:launches";

export const EMPTY_RUNS: RunMeta[] = [];
export const EMPTY_MAP: Record<string, number> = {};

const listeners = new Set<() => void>();
export function subscribe(cb: () => void) {
  listeners.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
}
const emit = () => listeners.forEach((l) => l());

// Parsed values are cached by their raw string so snapshots stay referentially stable.
const cache = new Map<string, { raw: string | null; val: unknown }>();
function read<T>(key: string, fallback: T): T {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(key);
  } catch {}
  const hit = cache.get(key);
  if (hit && hit.raw === raw) return hit.val as T;
  let val: T = fallback;
  try {
    if (raw) val = JSON.parse(raw) as T;
  } catch {}
  cache.set(key, { raw, val });
  return val;
}
function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
  emit();
}

export const readRuns = () => read<RunMeta[]>(RUNS, EMPTY_RUNS);
export const readDrafts = () => read<Record<string, number>>(DRAFTS, EMPTY_MAP);
export const readLaunches = () => read<Record<string, number>>(LAUNCHES, EMPTY_MAP);

/** Run ids carry the sequence prefix so a shared link still resolves without local state. */
export function createRun(sequenceId: string): RunMeta {
  const meta = { id: `${sequenceId.slice(0, 8)}-${nanoid(6)}`, sequenceId, createdAt: Date.now() };
  write(RUNS, [meta, ...readRuns()].slice(0, 12));
  return meta;
}

/** Finds a run; unknown ids (shared links) resolve to a finished run of the matching sequence. */
export function findRunMeta(runs: RunMeta[], id: string): RunMeta {
  const found = runs.find((r) => r.id === id);
  if (found) return found;
  const seq = SEQUENCES.find((s) => s.id.startsWith(id.split("-")[0])) ?? SEQUENCES[0];
  return { id, sequenceId: seq.id, createdAt: 0 };
}

/** Replays a run from the start (demo mode only). */
export function restartRun(id: string): RunMeta {
  const meta = { ...findRunMeta(readRuns(), id), createdAt: Date.now() };
  write(RUNS, [meta, ...readRuns().filter((r) => r.id !== id)].slice(0, 12));
  return meta;
}

export const draftKey = (runId: string, key: Category) => `${runId}:${key}`;

export function startDraft(runId: string, key: Category) {
  const all = { ...readDrafts() };
  all[draftKey(runId, key)] ??= Date.now();
  write(DRAFTS, all);
}

export function recordLaunch(runId: string, key: Category) {
  write(LAUNCHES, { ...readLaunches(), [draftKey(runId, key)]: Date.now() });
}
