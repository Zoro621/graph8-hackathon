import { mkdtemp, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { emptyRun } from "../lib/pipeline/runPipeline";
import { createFileStore } from "../lib/store";

let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), "replyiq-store-"));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("file store", () => {
  it("round-trips a run and lists newest first", async () => {
    const store = createFileStore(dir);
    const a = emptyRun(store.newRunId(), { sequenceId: "s" }, new Date("2026-09-26T10:00:00Z"));
    const b = emptyRun(store.newRunId(), { campaignId: "c" }, new Date("2026-09-26T11:00:00Z"));
    await store.save(a);
    await store.save(b);
    expect(await store.load(a.id)).toEqual(a);
    expect((await store.list()).map((r) => r.id)).toEqual([b.id, a.id]);
  });

  it("returns null for a missing run and [] for a missing directory", async () => {
    const store = createFileStore(path.join(dir, "nope"));
    expect(await store.load("aaaaaaaaaaaa")).toBeNull();
    expect(await store.list()).toEqual([]);
  });

  it("rejects ids that could escape the directory", async () => {
    const store = createFileStore(dir);
    await expect(store.load("../../etc/passwd")).rejects.toThrow(/Invalid run id/);
    await expect(store.save({ ...emptyRun("x", { sequenceId: "s" }, new Date()), id: "../evil" })).rejects.toThrow(/Invalid run id/);
  });

  it("leaves no temp files behind and overwrites in place", async () => {
    const store = createFileStore(dir);
    const run = emptyRun(store.newRunId(), { sequenceId: "s" }, new Date());
    await store.save(run);
    await store.save({ ...run, status: "done" });
    expect(await readdir(dir)).toEqual([`${run.id}.json`]);
    expect((await store.load(run.id))?.status).toBe("done");
  });

  it("skips corrupt files when listing", async () => {
    const store = createFileStore(dir);
    const { writeFile } = await import("node:fs/promises");
    await writeFile(path.join(dir, "abcdefghijkl.json"), "{not json", "utf8");
    await store.save(emptyRun(store.newRunId(), { sequenceId: "s" }, new Date()));
    expect(await store.list()).toHaveLength(1);
  });

  it("ids are 12 lowercase alphanumerics and unique", () => {
    const store = createFileStore(dir);
    const ids = new Set(Array.from({ length: 500 }, () => store.newRunId()));
    expect(ids.size).toBe(500);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9]{12}$/);
  });
});
