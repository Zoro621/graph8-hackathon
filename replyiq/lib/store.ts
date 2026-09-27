// Run state as one JSON file per run in data/runs/. Atomic writes (temp file + rename) so a
// reader polling the file never sees half a run.
import { mkdir, readdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { customAlphabet } from "nanoid";
import type { RedisClient } from "./redis";
import type { Run } from "./types";

const newId = customAlphabet("0123456789abcdefghijklmnopqrstuvwxyz", 12);
const ID_RE = /^[a-z0-9]{12}$/;

// On Windows a rename onto a file that another process has open (a UI poll reading it, OneDrive or
// antivirus scanning it) fails with EPERM/EACCES/EBUSY for a moment. Retry with backoff (~3 s total).
const RETRYABLE = new Set(["EPERM", "EACCES", "EBUSY"]);
export async function renameWithRetry(
  from: string,
  to: string,
  opts: { attempts?: number; renameImpl?: typeof rename; sleep?: (ms: number) => Promise<void> } = {},
): Promise<void> {
  const attempts = opts.attempts ?? 8;
  const doRename = opts.renameImpl ?? rename;
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  for (let i = 0; ; i++) {
    try {
      return await doRename(from, to);
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (!code || !RETRYABLE.has(code) || i >= attempts - 1) {
        await rm(from, { force: true }).catch(() => {});
        throw err;
      }
      await sleep(25 * 2 ** i);
    }
  }
}

let tmpSeq = 0;

export interface RunStore {
  newRunId(): string;
  save(run: Run): Promise<void>;
  load(id: string): Promise<Run | null>;
  list(): Promise<Pick<Run, "id" | "createdAt" | "status" | "counts">[]>;
}

export function createFileStore(dir = path.join(process.cwd(), "data", "runs")): RunStore {
  const file = (id: string) => {
    if (!ID_RE.test(id)) throw new Error(`Invalid run id: ${id}`); // blocks path traversal
    return path.join(dir, `${id}.json`);
  };
  const store: RunStore = {
    newRunId: () => newId(),
    async save(run) {
      await mkdir(dir, { recursive: true });
      const target = file(run.id);
      const tmp = `${target}.${process.pid}.${Date.now()}.${tmpSeq++}.tmp`;
      await writeFile(tmp, JSON.stringify(run, null, 2), "utf8");
      await renameWithRetry(tmp, target);
    },
    async load(id) {
      try {
        return JSON.parse(await readFile(file(id), "utf8")) as Run;
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
        throw err;
      }
    },
    async list() {
      let names: string[] = [];
      try {
        names = (await readdir(dir)).filter((n) => /^[a-z0-9]{12}\.json$/.test(n));
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
        throw err;
      }
      const runs = await Promise.all(names.map((n) => store.load(n.replace(/\.json$/, "")).catch(() => null)));
      return runs
        .filter((r): r is Run => r !== null)
        .map(({ id, createdAt, status, counts }) => ({ id, createdAt, status, counts }))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },
  };
  return store;
}

/**
 * Runs in Redis (Upstash): one key per run plus a sorted index by creation time. For serverless hosts, where
 * there is no disk to keep run files on and each request may reach a different instance.
 */
export function createRedisStore(redis: RedisClient, prefix = "replyiq"): RunStore {
  const key = (id: string) => {
    if (!ID_RE.test(id)) throw new Error(`Invalid run id: ${id}`);
    return `${prefix}:run:${id}`;
  };
  const index = `${prefix}:runs`;
  const store: RunStore = {
    newRunId: () => newId(),
    async save(run) {
      await redis.pipeline([
        ["SET", key(run.id), JSON.stringify(run)],
        ["ZADD", index, Date.parse(run.createdAt) || Date.now(), run.id],
      ]);
    },
    async load(id) {
      const raw = await redis.cmd<string | null>("GET", key(id));
      return raw ? (JSON.parse(raw) as Run) : null;
    },
    async list() {
      const ids = (await redis.cmd<string[]>("ZRANGE", index, 0, -1, "REV")) ?? [];
      if (!ids.length) return [];
      const raws = await redis.cmd<(string | null)[]>("MGET", ...ids.map(key));
      return raws
        .map((raw) => (raw ? (JSON.parse(raw) as Run) : null))
        .filter((r): r is Run => r !== null)
        .map(({ id, createdAt, status, counts }) => ({ id, createdAt, status, counts }));
    },
  };
  return store;
}
