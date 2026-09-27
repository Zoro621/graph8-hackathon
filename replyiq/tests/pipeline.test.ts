import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { G8Client, Thread } from "../lib/g8";
import { runPipeline } from "../lib/pipeline/runPipeline";
import { createFileStore, type RunStore } from "../lib/store";
import type { Run } from "../lib/types";
import { fakeLlm, label } from "./helpers";

const thread = (id: string, text: string): Thread => ({
  id,
  subject: `Re: ${id}`,
  sequenceId: "seqA",
  sequenceName: null,
  mailbox: "a@example.com",
  contact: { id: 7, email: `${id}@example.com`, name: id, company: `Co ${id}` },
  messages: [
    { messageId: null, from: "me@example.com", to: [], content: "<p>pitch</p>", responder: "USER", date: "2026-09-24T10:00:00Z", isDraft: false },
    { messageId: null, from: `${id}@example.com`, to: [], content: text, responder: "OTHER", date: "2026-09-24T11:00:00Z", isDraft: false },
  ],
  tags: [],
  summary: null,
  source: "emails.search",
});

function fakeOrg(threads: Thread[], overrides: Partial<Record<keyof G8Client, unknown>> = {}): G8Client {
  const campaign = {
    id: "c1",
    name: "SMB Campaign",
    status: "paused",
    audience_list_id: "100",
    linked_sequences: [{ sequence_id: "seqA" }],
    documents: [{ id: "d1", file_type: "messaging_objections", content: "angles" }],
  };
  return {
    whoAmI: async () => ({ org_id: "org_test" }),
    listCampaigns: async () => [{ id: "c1", name: "SMB Campaign", status: "paused" }],
    getCampaignFull: async () => campaign,
    getSequence: async (id: string) => ({ id, name: "Seq A", status: "paused", associated_list_id: 100 }),
    getSequenceChannels: async () => [{ channel_value: "a@example.com" }],
    listThreads: async () => threads,
    findContactByEmail: async () => null,
    listGlobalDocs: async () => [{ id: "g1", displayName: "Proof Catalog", content: "We have 700M+ verified B2B contacts in the graph8 buyer graph database." }],
    getSuppression: async (id: number) => ({ contact_id: id, is_suppressed: false, active_channels: [], suppressions: [] }),
    ...overrides,
  } as unknown as G8Client;
}

/** Wraps a store to capture every saved snapshot (what a polling UI would see). */
function recording(store: RunStore) {
  const snapshots: Run[] = [];
  return {
    snapshots,
    store: { ...store, save: async (r: Run) => (snapshots.push(structuredClone(r)), store.save(r)) } as RunStore,
  };
}

let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), "replyiq-run-"));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

const categoryFor = (text: string) =>
  /office|pto/i.test(text) ? "out_of_office" : /remove/i.test(text) ? "unsubscribe" : /price|pricing/i.test(text) ? "pricing_request" : "hard_no";

describe("runPipeline (integration: sources + fetch + classify + themes + tag + resolve + store)", () => {
  const distinctContacts = (list: Thread[]) => list.map((t, i) => ({ ...t, contact: { ...t.contact, id: 100 + i } }));

  it("with writeTags: tags every thread in graph8 and resolves the audience", async () => {
    const threads = distinctContacts([thread("t1", "Out of office until June 9"), thread("t2", "Please remove me"), thread("t3", "What is the pricing?")]);
    const tagged: string[] = [];
    const created: string[] = [];
    const tags: { id: string; name: string }[] = [];
    const org = fakeOrg(threads, {
      assertWriteAllowed: async () => ({ allowed: true, via: "sandbox", orgId: "org_test" }),
      listInboxTags: async () => tags,
      createInboxTag: async (name: string) => {
        created.push(name);
        tags.push({ id: `tag-${tags.length}`, name });
      },
      tagThread: async (id: string) => {
        tagged.push(id);
        return { tagged: true };
      },
      untagThread: async () => undefined,
    });
    const { llm } = fakeLlm((items) => items.map((i) => label(i.id, categoryFor(i.latest_prospect_reply), i.latest_prospect_reply)));
    const run = await runPipeline({ g8: org, llm, store: createFileStore(dir), classifyModel: "m" }, { selector: { campaignId: "c1" }, writeTags: true });
    expect(run.status).toBe("done");
    expect(run.steps).toMatchObject({ tag: "done", resolve: "done" });
    expect(tagged.sort()).toEqual(["t1", "t2", "t3"]);
    expect(created.sort()).toEqual(["ReplyIQ · Out of office", "ReplyIQ · Pricing request", "ReplyIQ · Unsubscribe"]);
    expect(run.tagging).toMatchObject({ tagged: 3, already: 0, failed: 0 });
    expect(run.audience).toEqual({ eligible: 2, excluded: { unsubscribe: 1 } });
    expect(run.groups.flatMap((g) => g.replies).every((r) => r.tag?.status === "tagged")).toBe(true);
  });

  it("writeTags but writes not allowed: tag step skipped, nothing written, run still done", async () => {
    const { WriteNotAllowedError } = await import("../lib/g8");
    let writes = 0;
    const org = fakeOrg(distinctContacts([thread("t1", "Out of office")]), {
      assertWriteAllowed: async () => {
        throw new WriteNotAllowedError("not sandbox");
      },
      tagThread: async () => void writes++,
      createInboxTag: async () => void writes++,
    });
    const { llm } = fakeLlm((items) => items.map((i) => label(i.id, "out_of_office", i.latest_prospect_reply)));
    const run = await runPipeline({ g8: org, llm, store: createFileStore(dir), classifyModel: "m" }, { selector: { campaignId: "c1" }, writeTags: true });
    expect(run.status).toBe("done");
    expect(run.steps.tag).toBe("skipped");
    expect(writes).toBe(0);
    expect(run.errors.join()).toMatch(/tag: .*not sandbox/);
  });

  it("a resolve failure (graph8 down) fails the run: no audience without a safety check", async () => {
    const org = fakeOrg([thread("t1", "What is the pricing?")], {
      getSuppression: async () => Promise.reject(new Error("503")),
      findContactByEmail: async () => Promise.reject(new Error("503")),
    });
    const { llm } = fakeLlm((items) => items.map((i) => label(i.id, "pricing_request", i.latest_prospect_reply)));
    const run = await runPipeline({ g8: org, llm, store: createFileStore(dir), classifyModel: "m" }, { selector: { campaignId: "c1" } });
    // suppression failures are per-contact and fail closed (not a crash): contact excluded, run done
    expect(run.status).toBe("done");
    expect(run.groups[0].eligible).toEqual([]);
    expect(run.groups[0].excluded[0].reason).toBe("suppression_unknown");
  });

  it("a theme failure never fails the run", async () => {
    const threads = [thread("t1", "Out of office until June 9"), thread("t2", "Out on PTO")];
    const { llm } = fakeLlm((items) => items.map((i) => label(i.id, "out_of_office", i.latest_prospect_reply)), {
      themes: () => {
        throw new Error("themes model down");
      },
    });
    const run = await runPipeline({ g8: fakeOrg(threads), llm, store: createFileStore(dir), classifyModel: "m" }, { selector: { campaignId: "c1" } });
    expect(run.status).toBe("done");
    expect(run.steps.themes).toBe("failed");
    expect(run.groups[0].themes).toBeUndefined();
    expect(run.groups[0].replies).toHaveLength(2); // classification intact
    expect(run.errors.join()).toMatch(/themes: .*theme discovery failed/);
  });

  it("themes step is skipped when no group has 2+ replies", async () => {
    const { llm, themeRequests } = fakeLlm((items) => items.map((i) => label(i.id, "hard_no", i.latest_prospect_reply)));
    const run = await runPipeline({ g8: fakeOrg([thread("t1", "no")]), llm, store: createFileStore(dir), classifyModel: "m" }, { selector: { campaignId: "c1" } });
    expect(run.steps.themes).toBe("skipped");
    expect(themeRequests).toHaveLength(0);
  });

  it("runs load -> fetch -> classify and persists a complete run", async () => {
    const threads = [thread("t1", "Out of office until June 9"), thread("t2", "Please remove me"), thread("t3", "What is the pricing?"), thread("t4", "Out on PTO")];
    const { llm } = fakeLlm((items) => items.map((i) => label(i.id, categoryFor(i.latest_prospect_reply), i.latest_prospect_reply)));
    const base = createFileStore(dir);
    const { store, snapshots } = recording(base);

    const run = await runPipeline({ g8: fakeOrg(threads), llm, store, classifyModel: "m" }, { selector: { campaignId: "c1" } });

    expect(run.status).toBe("done");
    expect(run.steps).toEqual({ load: "done", fetch: "done", classify: "done", themes: "done", tag: "skipped", resolve: "done", cards: "done" });
    // the pricing group (an Answer Card category) got a card; OOO / unsubscribe did not
    expect(run.groups.find((g) => g.key === "pricing_request")?.card?.summary).toBe("s");
    expect(run.groups.find((g) => g.key === "out_of_office")?.card).toBeUndefined();
    expect(run.cards).toMatchObject({ generated: 1, failed: 0 });
    // resolve: hard stop (unsubscribe) excluded; pricing + OOO eligible (all share contact 7 -> deduped per group)
    const unsub = run.groups.find((g) => g.key === "unsubscribe")!;
    expect(unsub.eligible).toEqual([]);
    expect(unsub.excluded[0].reason).toBe("unsubscribe");
    // contact 7 unsubscribed in one thread -> hard stop wins everywhere
    for (const g of run.groups.filter((x) => x.key !== "unsubscribe")) {
      expect(g.eligible).toEqual([]);
      expect(g.excluded.every((e) => e.reason === "hard_stop_elsewhere")).toBe(true);
    }
    expect(run.audience?.eligible).toBe(0);
    expect(run.tagging).toBeUndefined(); // writeTags not requested
    expect(run.orgId).toBe("org_test");
    expect(run.source).toMatchObject({ name: "SMB Campaign", campaignId: "c1", audienceListId: 100, mailboxes: ["a@example.com"], docs: ["objections"] });
    expect(run.counts).toEqual({ threads: 4, prospectReplies: 4, needsReview: 0 });
    expect(run.usage.llmCalls).toBe(3); // 1 classify + 1 themes (the 2-reply OOO group) + 1 card (pricing)
    const ooo = run.groups.find((g) => g.key === "out_of_office")!;
    expect(ooo.themes?.[0].threadIds.sort()).toEqual(["t1", "t4"]);
    expect(ooo.replies.every((r) => r.themeId === ooo.themes?.[0].id)).toBe(true);
    expect(run.groups.find((g) => g.key === "unsubscribe")!.themes).toBeUndefined(); // 1 reply: skipped
    expect(run.groups.map((g) => [g.key, g.replies.length])).toEqual([
      ["pricing_request", 1],
      ["out_of_office", 2],
      ["unsubscribe", 1],
    ]);
    // Every reply lands in exactly one group.
    const ids = run.groups.flatMap((g) => g.replies.map((r) => r.threadId));
    expect(ids.sort()).toEqual(["t1", "t2", "t3", "t4"]);
    // The saved file equals the returned run.
    expect(await base.load(run.id)).toEqual(run);
    // A polling UI sees the steps progress in order.
    const states = snapshots.map((s) => `${s.steps.load}/${s.steps.fetch}/${s.steps.classify}`);
    expect(states[0]).toBe("pending/pending/pending");
    expect(states).toContain("running/pending/pending");
    expect(states).toContain("done/running/pending");
    expect(states).toContain("done/done/running");
    expect(snapshots.at(-1)?.status).toBe("done");
  });

  it("Answer Cards never use ReplyIQ's own blocks in Studio documents as proof", async () => {
    const own = "Heard in the field: teams switch within ninety days once pricing is clear to them.";
    const messagingHouse = `Our pricing is published and simple for every team size.\n\n<!-- replyiq:learnings:c1 -->\n## Heard in the field\n${own}\n<!-- /replyiq:learnings:c1 -->\n`;
    const { llm, cardRequests } = fakeLlm((items) => items.map((i) => label(i.id, "pricing_request", i.latest_prospect_reply)), {
      card: () => ({
        summary: "s",
        quotes: [],
        proof: [
          { claim: "switch fast", doc_id: "g1", excerpt: own }, // only in ReplyIQ's block: must be dropped
          { claim: "pricing is public", doc_id: "g1", excerpt: "Our pricing is published and simple for every team size." },
        ],
        proof_gap: "gap",
        how_to_answer: "h",
        email_angle: "e",
        theme_notes: [],
      }),
    });
    const g8 = fakeOrg([thread("t1", "What is the pricing?")], { listGlobalDocs: async () => [{ id: "g1", displayName: "Messaging House", content: messagingHouse }] });
    const run = await runPipeline({ g8, llm, store: createFileStore(dir), classifyModel: "m" }, { selector: { campaignId: "c1" } });
    const card = run.groups.find((g) => g.key === "pricing_request")!.card!;
    expect(card.proofWeHave.map((p) => p.claim)).toEqual(["pricing is public"]);
    expect(cardRequests.map((r) => r.user).join()).not.toContain("ninety days"); // the model never even sees it
  });

  it("records a graph8 failure on the step and never throws", async () => {
    const { llm, requests } = fakeLlm(() => []);
    const org = fakeOrg([], { listThreads: async () => Promise.reject(new Error("inbox 503")) });
    const run = await runPipeline({ g8: org, llm, store: createFileStore(dir), classifyModel: "m" }, { selector: { campaignId: "c1" } });
    expect(run.status).toBe("failed");
    expect(run.steps).toMatchObject({ load: "done", fetch: "failed", classify: "pending" });
    expect(run.errors[0]).toMatch(/^fetch: .*inbox 503/);
    expect(requests).toHaveLength(0); // never reached the LLM
  });

  it("records an LLM failure on the classify step", async () => {
    const { llm } = fakeLlm(() => {
      throw new Error("OpenAI 500");
    });
    const run = await runPipeline(
      { g8: fakeOrg([thread("t1", "hi")]), llm, store: createFileStore(dir), classifyModel: "m" },
      { selector: { campaignId: "c1" } },
    );
    expect(run.status).toBe("failed");
    expect(run.steps.classify).toBe("failed");
    expect(run.errors[0]).toMatch(/classify: .*OpenAI 500/);
    expect(run.groups).toEqual([]);
  });

  it("fails at load when the source has no readable sequences", async () => {
    const { llm } = fakeLlm(() => []);
    const org = fakeOrg([], { getCampaignFull: async () => ({ id: "c1", name: "Empty", status: "draft", linked_sequences: [], documents: [] }) });
    const run = await runPipeline({ g8: org, llm, store: createFileStore(dir), classifyModel: "m" }, { selector: { campaignId: "c1" } });
    expect(run.steps.load).toBe("failed");
    expect(run.errors[0]).toMatch(/no readable sequences/);
  });

  it("completes with zero groups and no LLM call when there are no replies", async () => {
    const { llm, requests } = fakeLlm(() => []);
    const run = await runPipeline({ g8: fakeOrg([]), llm, store: createFileStore(dir), classifyModel: "m" }, { selector: { sequenceId: "seqA" } });
    expect(run.status).toBe("done");
    expect(run.groups).toEqual([]);
    expect(requests).toHaveLength(0);
  });

  it("respects --limit", async () => {
    const threads = Array.from({ length: 10 }, (_, i) => thread(`t${i}`, `reply ${i}`));
    const { llm, requests } = fakeLlm((items) => items.map((i) => label(i.id, "other", i.latest_prospect_reply)));
    const run = await runPipeline({ g8: fakeOrg(threads), llm, store: createFileStore(dir), classifyModel: "m" }, { selector: { campaignId: "c1" }, limit: 3 });
    expect(run.counts).toMatchObject({ threads: 10, prospectReplies: 3 });
    expect(JSON.parse(requests[0].user).items).toHaveLength(3);
  });

  it("surfaces classifier warnings in run.errors without failing", async () => {
    const { llm } = fakeLlm((items) => [...items.map((i) => label(i.id, "other", i.latest_prospect_reply)), label("ghost", "other", "x")]);
    const run = await runPipeline({ g8: fakeOrg([thread("t1", "hi")]), llm, store: createFileStore(dir), classifyModel: "m" }, { selector: { campaignId: "c1" } });
    expect(run.status).toBe("done");
    expect(run.errors.join()).toMatch(/classify: model returned an unknown id/);
  });
});
