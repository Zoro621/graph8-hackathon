import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { emptyRun } from "../lib/pipeline/runPipeline";
import {
  applyLearnings,
  blockEnd,
  blockStart,
  findTargetDoc,
  LearningsError,
  messagingBlock,
  proofBlock,
  proposeLearnings,
  removeBlock,
  removeLearnings,
  upsertBlock,
} from "../lib/pipeline/studioLearnings";
import { createFileStore, type RunStore } from "../lib/store";
import type { Classified, Group, Run, StudioDoc } from "../lib/types";
import { reply } from "./helpers";

const cl = (id: string, quote: string): Classified => ({ ...reply(id, quote), category: "pricing_request", confidence: 0.9, quote, needsReview: false });

const pricing = (): Group => ({
  key: "pricing_request",
  label: "Pricing request",
  replies: [cl("p1", "Send pricing details"), cl("p2", "send  pricing details")],
  eligible: [],
  excluded: [],
  card: {
    summary: "s",
    quotes: [],
    proofWeHave: [{ claim: "Team plan price.", sourceDocId: "d1", sourceDocName: "Pricing Matrix", excerpt: "The Team Plan is $99/month for unlimited users.", verified: true }],
    proofGap: "No per-action credit table.",
    howToAnswer: "Answer with the published price.",
    emailAngle: "e",
    themeNotes: [],
    unverifiedClaims: [],
    sources: [],
  },
});

function makeRun(groups: Group[]): Run {
  const run = emptyRun("abcdefghijkl", { campaignId: "camp-src" }, new Date("2026-09-27T10:00:00Z"));
  run.status = "done";
  run.source = { ...run.source, name: "[DEMO] OrbitDesk", campaignId: "camp-src" };
  run.groups = groups;
  return run;
}

/** Fake Studio: documents with versions; every save bumps the version. */
function fakeStudio(opts: { notAllowed?: boolean; saveDrops?: boolean } = {}) {
  const docs = new Map<string, StudioDoc>([
    ["mh", { id: "mh", displayName: "Messaging House", content: "# Messaging House\n\nOriginal text.", version: 1 }],
    ["pc", { id: "pc", displayName: "Proof Catalog", content: "# Proof Catalog\n\nNo case studies yet.", version: 3 }],
    ["vp", { id: "vp", displayName: "Value Props", content: "x", version: 1 }],
  ]);
  const saves: { id: string; content: string }[] = [];
  const g8 = {
    listGlobalDocs: async () => [...docs.values()],
    assertWriteAllowed: async () => {
      if (opts.notAllowed) throw new Error("writes not allowed");
      return { allowed: true as const, via: "sandbox" as const, orgId: "o" };
    },
    getGlobalDoc: async (id: string) => ({ ...docs.get(id)! }),
    updateGlobalDoc: async (id: string, content: string) => {
      saves.push({ id, content });
      const d = docs.get(id)!;
      docs.set(id, { ...d, content: opts.saveDrops ? d.content : content, version: (d.version ?? 0) + 1 });
      return {};
    },
  };
  return { g8, docs, saves };
}

let dir: string;
let store: RunStore;
beforeEach(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), "replyiq-learn-"));
  store = createFileStore(dir);
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("blocks", () => {
  it("upsertBlock appends once, replaces only between its markers, and never touches other text", () => {
    const first = upsertBlock("Studio text.", "k1", "V1");
    expect(first).toEqual({ next: `Studio text.\n\n${blockStart("k1")}\nV1\n${blockEnd("k1")}\n`, action: "append" });
    const withOthers = `${first.next}\nSomeone added this later.\n`;
    const second = upsertBlock(withOthers, "k1", "V2");
    expect(second.action).toBe("replace");
    expect(second.next).toContain("Someone added this later.");
    expect(second.next).toContain(`${blockStart("k1")}\nV2\n${blockEnd("k1")}`);
    expect(second.next).not.toContain("V1");
    expect(upsertBlock(second.next, "k1", "V2").action).toBe("unchanged");
    expect(upsertBlock(second.next, "k2", "OTHER").next).toContain(`${blockStart("k1")}\nV2`); // other sources keep their block
    expect(() => upsertBlock(`${blockStart("k1")}\nno end`, "k1", "x")).toThrow(LearningsError);
  });

  it("removeBlock restores the document exactly, keeping text others added after the block", () => {
    const original = "# Messaging House\n\nOriginal text.";
    const applied = upsertBlock(original, "k1", "BLOCK").next;
    expect(removeBlock(applied, "k1")).toEqual({ next: original, removed: true });
    const edited = `${applied}\nAdded later by a teammate.\n`;
    expect(removeBlock(edited, "k1").next).toBe(`${original}\n\nAdded later by a teammate.\n`);
    expect(removeBlock(original, "k1")).toEqual({ next: original, removed: false });
    expect(() => removeBlock(`x ${blockStart("k1")} no end`, "k1")).toThrow(LearningsError);
  });

  it("messaging block: deduped verbatim quotes, answer, verified proof, don't-claim; proof block lists gaps", () => {
    const run = makeRun([pricing()]);
    const m = messagingBlock(run, run.groups, "2026-09-27");
    expect(m).toContain("## Heard in the field: [DEMO] OrbitDesk");
    expect(m.match(/send pricing details/gi)).toHaveLength(1);
    expect(m).toContain("**How to answer:** Answer with the published price.");
    expect(m).toContain('- Team plan price: "The Team Plan is $99/month for unlimited users." (Pricing Matrix)');
    expect(m).toContain("**Don't claim (no proof yet):** No per-action credit table.");
    expect(proofBlock(run, run.groups, "2026-09-27")).toContain('- **Pricing request** (2 replies, e.g. "Send pricing details"): No per-action credit table.');
    const noGap = pricing();
    noGap.card!.proofGap = null;
    expect(proofBlock(run, [noGap], "d")).toBeNull();
  });

  it("finds target documents by name", () => {
    const docs = [...fakeStudio().docs.values()];
    expect(findTargetDoc(docs, "messaging")?.id).toBe("mh");
    expect(findTargetDoc(docs, "proof")?.id).toBe("pc");
    expect(findTargetDoc([{ id: "x", displayName: "Value Props", content: "" }], "proof")).toBeUndefined();
  });
});

describe("propose -> apply", () => {
  it("propose is read-only and stores the reviewed text on the run", async () => {
    await store.save(makeRun([pricing()]));
    const { g8, saves } = fakeStudio();
    const l = await proposeLearnings({ g8, store }, "abcdefghijkl");
    expect(saves).toHaveLength(0);
    expect(l.status).toBe("proposed");
    expect(l.proposals.map((p) => [p.docName, p.kind, p.action, p.baseVersion, p.key])).toEqual([
      ["Messaging House", "messaging", "append", 1, "camp-src"],
      ["Proof Catalog", "proof", "append", 3, "camp-src"],
    ]);
    expect((await store.load("abcdefghijkl"))?.learnings?.status).toBe("proposed");
  });

  it("propose reads each document itself: graph8's list has no save counter (it always says version 1)", async () => {
    await store.save(makeRun([pricing()]));
    const { g8 } = fakeStudio();
    const listed = await g8.listGlobalDocs();
    g8.listGlobalDocs = async () => listed.map((d) => ({ ...d, version: 1 }));
    g8.getGlobalDoc = async (id: string) => ({ ...listed.find((d) => d.id === id)!, version: 6 });
    const l = await proposeLearnings({ g8, store }, "abcdefghijkl");
    expect(l.proposals.map((p) => p.baseVersion)).toEqual([6, 6]);
  });

  it("apply saves exactly the proposal into the fresh document, keeps others' edits, verifies, records versions", async () => {
    await store.save(makeRun([pricing()]));
    const { g8, docs, saves } = fakeStudio();
    const proposed = await proposeLearnings({ g8, store }, "abcdefghijkl");
    // someone edits the Messaging House between review and approval
    docs.set("mh", { ...docs.get("mh")!, content: `${docs.get("mh")!.content}\n\nEdited by a teammate.`, version: 2 });
    const l = await applyLearnings({ g8, store }, "abcdefghijkl");
    expect(l.status).toBe("applied");
    expect(saves).toHaveLength(2);
    expect(docs.get("mh")!.content).toContain("Edited by a teammate.");
    expect(docs.get("mh")!.content).toContain(proposed.proposals[0].section);
    expect(l.proposals.map((p) => p.savedVersion)).toEqual([3, 4]);
    // applying again changes nothing
    const again = await applyLearnings({ g8, store }, "abcdefghijkl");
    expect(again.proposals.map((p) => p.action)).toEqual(["unchanged", "unchanged"]);
    expect(saves).toHaveLength(2);
  });

  it("apply keeps a local backup of each document as it was before ReplyIQ's first save; remove restores it", async () => {
    await store.save(makeRun([pricing()]));
    const { g8, docs } = fakeStudio();
    const before = docs.get("mh")!.content;
    await proposeLearnings({ g8, store }, "abcdefghijkl");
    const applied = await applyLearnings({ g8, store }, "abcdefghijkl");
    expect(applied.proposals[0].backup).toBe(before);
    await applyLearnings({ g8, store }, "abcdefghijkl"); // re-apply: the backup stays the pre-ReplyIQ text
    expect((await store.load("abcdefghijkl"))!.learnings!.proposals[0].backup).toBe(before);
    const removed = await removeLearnings({ g8, store }, "abcdefghijkl");
    expect(removed.status).toBe("removed");
    expect(docs.get("mh")!.content).toBe(before);
    expect(docs.get("pc")!.content).not.toContain("replyiq:learnings");
    const blocked = await removeLearnings({ g8: fakeStudio({ notAllowed: true }).g8, store }, "abcdefghijkl");
    expect(blocked.status).toBe("failed");
  });

  it("apply needs a proposal and fails safely when writes are refused or the save did not stick", async () => {
    await store.save(makeRun([pricing()]));
    await expect(applyLearnings({ g8: fakeStudio().g8, store }, "abcdefghijkl")).rejects.toThrow(/nothing proposed/);
    await proposeLearnings({ g8: fakeStudio().g8, store }, "abcdefghijkl");
    const blocked = fakeStudio({ notAllowed: true });
    expect(await applyLearnings({ g8: blocked.g8, store }, "abcdefghijkl")).toMatchObject({ status: "failed", error: expect.stringMatching(/not allowed/) });
    expect(blocked.saves).toHaveLength(0);
    const dropped = await applyLearnings({ g8: fakeStudio({ saveDrops: true }).g8, store }, "abcdefghijkl");
    expect(dropped).toMatchObject({ status: "failed", error: expect.stringMatching(/does not contain the approved block/) });
  });

  it("refuses runs without Answer Cards", async () => {
    const g = pricing();
    delete g.card;
    await store.save(makeRun([g]));
    await expect(proposeLearnings({ g8: fakeStudio().g8, store }, "abcdefghijkl")).rejects.toThrow(/no Answer Cards/);
  });
});
