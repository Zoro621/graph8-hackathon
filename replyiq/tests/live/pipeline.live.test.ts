// LIVE end-to-end: real graph8 + real OpenAI + a temp run store. Discovers the source at runtime
// (nothing hardcoded) and checks invariants that must hold for ANY campaign. Writes nothing to graph8.
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getEnv } from "../../lib/env";
import { g8, type G8Client } from "../../lib/g8";
import { llm } from "../../lib/llm";
import { norm } from "../../lib/pipeline/classify";
import { runPipeline } from "../../lib/pipeline/runPipeline";
import { discoverSources, pickDefaultSource } from "../../lib/pipeline/sources";
import { createFileStore } from "../../lib/store";
import { CATEGORY_KEYS, REVIEW_THRESHOLD } from "../../lib/taxonomy";
import type { Run, SourceSummary } from "../../lib/types";

let dir: string;
let client: G8Client;
let writes = 0;
let sources: SourceSummary[];

beforeAll(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), "replyiq-live-"));
  const real = g8();
  // Any write attempt fails the suite: M2 must be read-only.
  client = { ...real, write: async () => (writes++, Promise.reject(new Error("write attempted in a read-only test"))) } as G8Client;
  sources = await discoverSources(client);
});
afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});

function assertRunInvariants(run: Run) {
  expect(run.status, run.errors.join("\n")).toBe("done");
  expect(run.steps).toMatchObject({ load: "done", fetch: "done", classify: "done" });
  const all = run.groups.flatMap((g) => g.replies);
  // every reply exactly once
  expect(new Set(all.map((r) => r.threadId)).size).toBe(all.length);
  expect(all.length).toBe(run.counts.prospectReplies);
  // groups are keyed correctly and only use known categories
  for (const g of run.groups) {
    expect(CATEGORY_KEYS).toContain(g.key);
    for (const r of g.replies) expect(r.category).toBe(g.key);
  }
  for (const r of all) {
    expect(r.confidence).toBeGreaterThanOrEqual(0);
    expect(r.confidence).toBeLessThanOrEqual(1);
    expect(r.needsReview).toBe(r.confidence < REVIEW_THRESHOLD);
    expect(r.contactId, `thread ${r.threadId} has no contact id`).toBeTypeOf("number");
    // quote is verbatim from the reply, or the reply was flagged for review
    if (!r.needsReview) expect(norm(r.replyText)).toContain(norm(r.quote));
  }
  expect(run.counts.needsReview).toBe(all.filter((r) => r.needsReview).length);
  expect(writes).toBe(0);
}

describe("LIVE pipeline (graph8 + OpenAI)", () => {
  it("discovers at least one source with replies", () => {
    expect(sources.some((s) => s.replyThreads > 0)).toBe(true);
  });

  it("runs the default source (most replies) end to end", async () => {
    const selector = pickDefaultSource(sources)!;
    const env = getEnv();
    const run = await runPipeline({ g8: client, llm: llm(), store: createFileStore(dir), classifyModel: env.OPENAI_CLASSIFY_MODEL }, { selector });
    assertRunInvariants(run);
    const top = sources.find((s) => s.replyThreads > 0)!;
    expect(run.counts.prospectReplies).toBeGreaterThanOrEqual(top.replyThreads); // campaign may span several sequences
    expect(run.groups.length).toBeGreaterThan(1);
    // saved file matches
    expect(await createFileStore(dir).load(run.id)).toEqual(run);
  });

  it("runs every other source with replies, selected by sequence", async () => {
    const env = getEnv();
    const rest = sources.filter((s) => s.replyThreads > 0).slice(1);
    for (const s of rest) {
      const run = await runPipeline(
        { g8: client, llm: llm(), store: createFileStore(dir), classifyModel: env.OPENAI_CLASSIFY_MODEL },
        { selector: { sequenceId: s.sequenceId } },
      );
      assertRunInvariants(run);
      expect(run.counts.prospectReplies).toBe(s.replyThreads);
    }
  });

  it("labels are consistent: two runs on the same source agree on >= 90% of replies", async () => {
    const env = getEnv();
    const selector = pickDefaultSource(sources)!;
    const deps = { g8: client, llm: llm(), store: createFileStore(dir), classifyModel: env.OPENAI_CLASSIFY_MODEL };
    const [a, b] = await Promise.all([runPipeline(deps, { selector }), runPipeline(deps, { selector })]);
    const cat = (r: Run) => new Map(r.groups.flatMap((g) => g.replies.map((x) => [x.threadId, x.category] as const)));
    const ca = cat(a);
    const cb = cat(b);
    const same = [...ca].filter(([id, c]) => cb.get(id) === c).length;
    const diffs = [...ca].filter(([id, c]) => cb.get(id) !== c).map(([id, c]) => `${id.slice(0, 8)}: ${c} vs ${cb.get(id)}`);
    expect(same / ca.size, diffs.join("\n")).toBeGreaterThanOrEqual(0.9);
    // Hard stops must never flip: a person who asked to stop can't become contactable on a re-run.
    for (const [id, c] of ca) if (c === "unsubscribe" || c === "hard_no") expect(["unsubscribe", "hard_no"]).toContain(cb.get(id));
  });

  it("fails cleanly (no throw) for a sequence that does not exist", async () => {
    const env = getEnv();
    const run = await runPipeline(
      { g8: client, llm: llm(), store: createFileStore(dir), classifyModel: env.OPENAI_CLASSIFY_MODEL },
      { selector: { sequenceId: "00000000-0000-0000-0000-000000000000" } },
    );
    expect(run.status).toBe("failed");
    expect(run.steps.load).toBe("failed");
    expect(run.errors.length).toBeGreaterThan(0);
  });
});
