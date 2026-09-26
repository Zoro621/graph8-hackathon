import { describe, expect, it } from "vitest";
import { classifyReplies } from "../lib/pipeline/classify";
import { buildThreadContext, chunkConversation, renderConversation, THREAD_CHAR_LIMIT } from "../lib/pipeline/compose";
import { threadToReply } from "../lib/pipeline/fetchReplies";
import type { Thread } from "../lib/g8";
import type { Reply } from "../lib/types";
import { type Digest, fakeLlm, label } from "./helpers";

type Msg = Reply["conversation"][number];
const filler = (n: number) => "We appreciate your note and will circle back with the team shortly. ".repeat(Math.ceil(n / 70)).slice(0, n);

/** A long thread: pitch, early meeting confirmation, then lots of back-and-forth, then a small latest reply. */
function longThread(extraMessages = 20, each = 900): Reply {
  const conv: Msg[] = [
    { from: "us", text: "Hi Mike, quick intro to our data platform. Worth a 20 minute look?" },
    { from: "prospect", text: "Sure, happy to chat about this next week." },
    { from: "us", text: "Your meeting for Tuesday June 3 at 1:00 PM EDT is confirmed. Invite on its way." },
  ];
  for (let i = 0; i < extraMessages; i++) conv.push({ from: i % 2 ? "us" : "prospect", text: `Note ${i}. ${filler(each)}` });
  conv.push({ from: "prospect", text: "Except the time I picked was 1 pm, not 9 am." });
  return { threadId: "long", sequenceId: "s", contactEmail: "m@example.com", replyText: conv.at(-1)!.text, conversation: conv, existingTags: [] };
}

const goodDigest: Digest = {
  events: [
    { who: "prospect", what: "agreed to a call", evidence: "Sure, happy to chat about this next week." },
    { who: "us", what: "confirmed the meeting", evidence: "Your meeting for Tuesday June 3 at 1:00 PM EDT is confirmed." },
  ],
  current_state: "Meeting booked; prospect corrected the time.",
  current_state_evidence: "Except the time I picked was 1 pm, not 9 am.",
};

describe("buildThreadContext", () => {
  it("sends the entire thread verbatim when it is under the limit (no LLM call)", async () => {
    const { llm, digestRequests } = fakeLlm(() => [], { digest: () => goodDigest });
    const r = longThread(2, 100);
    const { ctx, usage } = await buildThreadContext(r, { llm, model: "m" });
    expect(ctx.mode).toBe("full");
    expect(ctx.text).toBe(renderConversation(r.conversation));
    expect(digestRequests).toHaveLength(0);
    expect(usage.llmCalls).toBe(0);
  });

  it("composes a thread over the limit: first message + verified digest + latest messages", async () => {
    const { llm, digestRequests } = fakeLlm(() => [], { digest: () => goodDigest });
    const r = longThread();
    expect(renderConversation(r.conversation).length).toBeGreaterThan(THREAD_CHAR_LIMIT);
    const { ctx, usage } = await buildThreadContext(r, { llm, model: "m" });
    expect(ctx.mode).toBe("composed");
    expect(ctx.text.length).toBeLessThanOrEqual(THREAD_CHAR_LIMIT);
    expect(ctx.text).toContain("[FIRST MESSAGE, verbatim]");
    expect(ctx.text).toContain("quick intro to our data platform"); // first message kept
    expect(ctx.text).toContain("confirmed the meeting"); // digest event
    expect(ctx.text).toContain("Current state: Meeting booked");
    expect(ctx.text).toContain("Except the time I picked was 1 pm"); // latest message verbatim
    expect(ctx.events).toBe(2);
    expect(usage.llmCalls).toBe(digestRequests.length);
    // The composer saw the WHOLE thread, not just the ends.
    expect(digestRequests.map((q) => q.user).join("")).toContain("Note 10.");
  });

  it("drops digest points whose quote is not in the thread (grounding)", async () => {
    const invented: Digest = {
      ...goodDigest,
      events: [...goodDigest.events, { who: "prospect", what: "asked for a discount", evidence: "Can you give us a 40% discount on the annual plan?" }],
    };
    const { llm } = fakeLlm(() => [], { digest: () => invented });
    const { ctx } = await buildThreadContext(longThread(), { llm, model: "m" });
    expect(ctx.mode).toBe("composed");
    expect(ctx.dropped).toBe(1);
    expect(ctx.text).not.toContain("discount");
  });

  it("drops an unsupported current state", async () => {
    const { llm } = fakeLlm(() => [], { digest: () => ({ ...goodDigest, current_state: "They signed.", current_state_evidence: "We signed the contract today." }) });
    const { ctx } = await buildThreadContext(longThread(), { llm, model: "m" });
    expect(ctx.text).not.toContain("They signed");
  });

  it("rejects too-short evidence (a 1-2 word quote proves nothing)", async () => {
    const { llm } = fakeLlm(() => [], { digest: () => ({ ...goodDigest, events: [{ who: "us", what: "confirmed", evidence: "confirmed" }] }) });
    const { ctx } = await buildThreadContext(longThread(), { llm, model: "m" });
    expect(ctx.mode).toBe("truncated");
  });

  it("falls back to first + latest messages when nothing can be verified", async () => {
    const { llm } = fakeLlm(() => [], { digest: () => ({ events: [{ who: "us", what: "x", evidence: "this sentence is not in the thread at all" }], current_state: "", current_state_evidence: "" }) });
    const { ctx } = await buildThreadContext(longThread(), { llm, model: "m" });
    expect(ctx.mode).toBe("truncated");
    expect(ctx.text.length).toBeLessThanOrEqual(THREAD_CHAR_LIMIT);
    expect(ctx.text).toContain("quick intro to our data platform");
    expect(ctx.text).toContain("Except the time I picked was 1 pm");
    expect(ctx.text).toMatch(/earlier message\(s\) not shown/);
  });

  it("chunks a huge thread so the composer reads all of it", async () => {
    const { llm, digestRequests } = fakeLlm(() => [], { digest: () => goodDigest });
    const r = longThread(200, 900); // ~180k characters
    const { ctx } = await buildThreadContext(r, { llm, model: "m" });
    expect(digestRequests.length).toBeGreaterThan(2);
    expect(ctx.mode).toBe("composed");
    expect(ctx.text.length).toBeLessThanOrEqual(THREAD_CHAR_LIMIT);
    // every message appears in exactly one chunk
    const all = digestRequests.map((q) => q.user).join("\n");
    for (const i of [0, 99, 199]) expect(all).toContain(`Note ${i}.`);
  });

  it("respects a custom limit", async () => {
    const { llm, digestRequests } = fakeLlm(() => [], { digest: () => goodDigest });
    await buildThreadContext(longThread(2, 100), { llm, model: "m", limit: 200 });
    expect(digestRequests).toHaveLength(1);
  });
});

describe("chunkConversation", () => {
  it("keeps chunks under the size and hard-splits a single giant message", () => {
    const conv: Msg[] = [{ from: "us", text: "a".repeat(250) }, { from: "prospect", text: "b".repeat(50) }];
    const chunks = chunkConversation(conv, 100);
    expect(chunks.every((c) => c.length <= 100)).toBe(true);
    expect(chunks.join("").replace(/[^ab]/g, "").length).toBe(300);
  });
});

describe("classifyReplies with long threads", () => {
  it("classifies short threads verbatim and long ones from the composed digest", async () => {
    const short: Reply = { threadId: "short", sequenceId: "s", contactEmail: "s@example.com", replyText: "Out until June 9", conversation: [{ from: "prospect", text: "Out until June 9" }], existingTags: [] };
    const seen: Record<string, string> = {};
    const { llm } = fakeLlm(
      (items) =>
        items.map((i) => {
          const isLong = /time I picked/.test(i.latest_prospect_reply);
          seen[isLong ? "long" : "short"] = i.context;
          return label(i.id, isLong ? "meeting_booked" : "out_of_office", i.latest_prospect_reply);
        }),
      { digest: () => goodDigest },
    );
    const res = await classifyReplies([short, longThread()], { llm, model: "m" });
    expect(seen).toEqual({ short: "full", long: "composed" });
    expect(res.contexts).toEqual({ full: 1, composed: 1, truncated: 0 });
    expect(res.classified.find((c) => c.threadId === "long")).toMatchObject({ category: "meeting_booked", context: "composed" });
    expect(res.usage.llmCalls).toBeGreaterThanOrEqual(2); // composer + classifier
  });

  it("warns when a long thread had to be truncated", async () => {
    const { llm } = fakeLlm((items) => items.map((i) => label(i.id, "other", i.latest_prospect_reply)), {
      digest: () => ({ events: [], current_state: "", current_state_evidence: "" }),
    });
    const res = await classifyReplies([longThread()], { llm, model: "m" });
    expect(res.classified[0].context).toBe("truncated");
    expect(res.warnings.join()).toMatch(/too long/);
  });

  it("a composer failure fails classification (no silent guessing)", async () => {
    const { llm } = fakeLlm(() => [], {
      digest: () => {
        throw new Error("composer down");
      },
    });
    await expect(classifyReplies([longThread()], { llm, model: "m" })).rejects.toThrow("composer down");
  });

  it("packs batches by total size so large contexts don't all share one call", async () => {
    const { llm, requests } = fakeLlm((items) => items.map((i) => label(i.id, "other", i.latest_prospect_reply)));
    // 14 threads of ~20k chars each, sent in full (limit raised): the 120k budget fits ~5 per call.
    const many = Array.from({ length: 14 }, (_, i) => ({ ...longThread(), threadId: `L${i}` }));
    await classifyReplies(many, { llm, model: "m", threadCharLimit: 50_000 });
    const sizes = requests.map((q) => JSON.parse(q.user).items.length);
    expect(sizes.reduce((a: number, b: number) => a + b, 0)).toBe(14);
    expect(sizes.length).toBeGreaterThanOrEqual(3);
    for (const q of requests) expect(q.user.length).toBeLessThan(140_000);
  });

  it("packBatches closes a batch on count or on size, never leaves one empty", async () => {
    const { packBatches } = await import("../lib/pipeline/classify");
    const items = (n: number, chars: number) => Array.from({ length: n }, (_, i) => ({ id: i, chars }));
    expect(packBatches(items(45, 10), 20).map((b) => b.length)).toEqual([20, 20, 5]);
    expect(packBatches(items(5, 50_000), 20, 120_000).map((b) => b.length)).toEqual([2, 2, 1]);
    expect(packBatches(items(1, 999_999), 20, 120_000).map((b) => b.length)).toEqual([1]); // oversized item still sent
    expect(packBatches([], 20)).toEqual([]);
  });
});

describe("threadToReply keeps the entire thread", () => {
  it("no message-count or length limit; the first email is never dropped", () => {
    const messages = Array.from({ length: 12 }, (_, i) => ({
      messageId: null,
      from: null,
      to: [],
      content: i === 0 ? "ORIGINAL PITCH " + "x".repeat(2000) : `message ${i}`,
      responder: i % 2 ? "OTHER" : "USER",
      date: `2026-09-${String(10 + i).padStart(2, "0")}T10:00:00Z`,
      isDraft: false,
    }));
    const t: Thread = { id: "t", subject: null, sequenceId: "s", sequenceName: null, mailbox: null, contact: {}, messages, tags: [], summary: null, source: "emails.search" };
    const r = threadToReply(t, "s")!;
    expect(r.conversation).toHaveLength(12);
    expect(r.conversation[0].text.startsWith("ORIGINAL PITCH")).toBe(true);
    expect(r.conversation[0].text.length).toBeGreaterThan(2000);
  });
});
