// LIVE WRITE TEST (sandbox org only): tags a synthetic [DEMO] sequence in graph8, reads the threads
// back, and proves re-runs are idempotent. The source is found at runtime: the sequence whose name
// starts with "[DEMO]" and has the most replies. Skips if there is none or writes are not allowed.
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getEnv } from "../../lib/env";
import { g8 } from "../../lib/g8";
import { llm } from "../../lib/llm";
import { runPipeline } from "../../lib/pipeline/runPipeline";
import { discoverSources } from "../../lib/pipeline/sources";
import { createFileStore } from "../../lib/store";
import { isHardStop, TAG_PREFIX, tagNameOf } from "../../lib/taxonomy";
import type { Run } from "../../lib/types";

let dir: string;
let demoSeq: string | undefined;
let allowed = false;

beforeAll(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), "replyiq-tag-live-"));
  const client = g8();
  allowed = (await client.writePolicy()).allowed;
  const sources = await discoverSources(client);
  demoSeq = sources.find((s) => s.sequenceName.startsWith("[DEMO]") && s.replyThreads > 0)?.sequenceId;
});
afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});

const run = async (): Promise<Run> => {
  const env = getEnv();
  return runPipeline(
    { g8: g8(), llm: llm(), store: createFileStore(dir), classifyModel: env.OPENAI_CLASSIFY_MODEL, themeModel: env.OPENAI_REASON_MODEL },
    { selector: { sequenceId: demoSeq! }, writeTags: true },
  );
};

describe("LIVE tagging in graph8 (sandbox, synthetic [DEMO] data)", () => {
  it("tags every thread with its category, verified by reading graph8 back; re-run is idempotent", async (ctx) => {
    if (!allowed || !demoSeq) return ctx.skip();

    const first = await run();
    expect(first.status, first.errors.join("\n")).toBe("done");
    expect(first.steps.tag).toBe("done");
    expect(first.tagging?.failed).toBe(0);

    // Read the threads back from graph8: each carries the tag of its current category.
    const threads = await g8().listThreads(demoSeq);
    const byId = new Map(threads.map((t) => [t.id, t]));
    const replies = first.groups.flatMap((g) => g.replies);
    expect(replies.length).toBeGreaterThan(0);
    for (const r of replies) {
      const names = byId.get(r.threadId)!.tags.map((t) => t.name);
      expect(names, `thread ${r.threadId}`).toContain(tagNameOf(r.category));
      expect(r.tag?.status).toMatch(/tagged|already/);
    }

    // The tags exist once each and are not auto-applied by graph8's AI.
    const tags = (await g8().listInboxTags()).filter((t) => t.name.startsWith(TAG_PREFIX));
    expect(new Set(tags.map((t) => t.name)).size).toBe(tags.length);
    for (const t of tags) expect(t.ai_can_apply).not.toBe(true);

    // Second run: nothing new to create for unchanged categories, no failures, no duplicates.
    const second = await run();
    expect(second.status).toBe("done");
    expect(second.tagging?.failed).toBe(0);
    const unchanged = second.groups.flatMap((g) => g.replies).filter((r) => replies.find((x) => x.threadId === r.threadId)?.category === r.category);
    for (const r of unchanged) expect(r.tag?.status).toBe("already");
    const tagsAfter = (await g8().listInboxTags()).filter((t) => t.name.startsWith(TAG_PREFIX));
    expect(new Set(tagsAfter.map((t) => t.name)).size).toBe(tagsAfter.length);

    // Safety: hard stops never end up in an audience.
    for (const g of second.groups) for (const e of g.eligible) expect(isHardStop(second.groups.flatMap((x) => x.replies).find((r) => r.threadId === e.threadId)!.category)).toBe(false);
  });
});
