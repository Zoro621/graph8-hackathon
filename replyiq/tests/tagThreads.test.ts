import { describe, expect, it } from "vitest";
import { WriteNotAllowedError } from "../lib/g8";
import { ensureTags, tagThreads } from "../lib/pipeline/tagThreads";
import type { Category, Classified, Group } from "../lib/types";
import { reply } from "./helpers";

const cl = (id: string, category: Category, existingTags: { id: string; name: string }[] = []): Classified => ({
  ...reply(id, `reply ${id}`, { existingTags }),
  category,
  confidence: 0.9,
  quote: `reply ${id}`,
  needsReview: false,
});
const grp = (key: Category, replies: Classified[]): Group => ({ key, label: key, replies, eligible: [], excluded: [] });

function fakeClient(initial: { id: string; name: string }[] = [], opts: { failTag?: string[]; failUntag?: boolean; notAllowed?: boolean } = {}) {
  const tags = [...initial];
  const log = { created: [] as string[], tagged: [] as [string, string[]][], untagged: [] as [string, string][], listCalls: 0, inFlight: 0, maxInFlight: 0 };
  const client = {
    assertWriteAllowed: async () => {
      if (opts.notAllowed) throw new WriteNotAllowedError("not sandbox");
      return { allowed: true as const, via: "sandbox" as const, orgId: "o" };
    },
    listInboxTags: async () => {
      log.listCalls++;
      return [...tags];
    },
    createInboxTag: async (name: string) => {
      log.created.push(name);
      tags.push({ id: `id-${name}`, name });
      return undefined;
    },
    tagThread: async (threadId: string, ids: string[]) => {
      log.inFlight++;
      log.maxInFlight = Math.max(log.maxInFlight, log.inFlight);
      await new Promise((r) => setTimeout(r, 2));
      log.inFlight--;
      if (opts.failTag?.includes(threadId)) throw new Error("graph8 500");
      log.tagged.push([threadId, ids]);
      return { tagged: true };
    },
    untagThread: async (threadId: string, tagId: string) => {
      if (opts.failUntag) throw new Error("Email not found");
      log.untagged.push([threadId, tagId]);
      return undefined;
    },
  };
  return { client, log, tags };
}

describe("ensureTags", () => {
  it("creates only missing tags, reuses existing by name (case-insensitive), re-lists once", async () => {
    const { client, log } = fakeClient([{ id: "t-ooo", name: "replyiq · out of office" }]);
    const { ids, created } = await ensureTags(client, ["out_of_office", "referral_wrong_person", "referral_wrong_person"]);
    expect(created).toEqual(["ReplyIQ · Referral"]);
    expect(ids.get("out_of_office")).toBe("t-ooo");
    expect(ids.get("referral_wrong_person")).toBe("id-ReplyIQ · Referral");
    expect(log.listCalls).toBe(2);
  });

  it("does not re-list when nothing was created", async () => {
    const { client, log } = fakeClient([{ id: "a", name: "ReplyIQ · Hard no" }]);
    await ensureTags(client, ["hard_no"]);
    expect(log.listCalls).toBe(1);
  });

  it("throws if a created tag cannot be found afterwards", async () => {
    const { client } = fakeClient();
    client.createInboxTag = async () => undefined; // graph8 'created' but it never appears
    await expect(ensureTags(client, ["hard_no"])).rejects.toThrow(/not found after creating/);
  });
});

describe("tagThreads", () => {
  it("tags every reply with its category tag and records the status", async () => {
    const { client, log } = fakeClient();
    const res = await tagThreads(client, [grp("out_of_office", [cl("a", "out_of_office"), cl("b", "out_of_office")]), grp("hard_no", [cl("c", "hard_no")])]);
    expect(res).toMatchObject({ tagged: 3, already: 0, failed: 0 });
    expect(log.tagged.map(([id]) => id).sort()).toEqual(["a", "b", "c"]);
    expect(res.groups[1].replies[0].tag).toEqual({ id: "id-ReplyIQ · Hard no", name: "ReplyIQ · Hard no", status: "tagged" });
  });

  it("skips threads that already carry the tag (idempotent re-runs)", async () => {
    const { client, log } = fakeClient([{ id: "t-ooo", name: "ReplyIQ · Out of office" }]);
    const res = await tagThreads(client, [grp("out_of_office", [cl("a", "out_of_office", [{ id: "t-ooo", name: "ReplyIQ · Out of office" }]), cl("b", "out_of_office")])]);
    expect(res).toMatchObject({ tagged: 1, already: 1 });
    expect(log.tagged.map(([id]) => id)).toEqual(["b"]);
    expect(log.created).toEqual([]);
  });

  it("removes an old ReplyIQ tag when the category changed, but never touches other tags", async () => {
    const { client, log } = fakeClient([{ id: "t-ooo", name: "ReplyIQ · Out of office" }]);
    const res = await tagThreads(client, [
      grp("referral_wrong_person", [
        cl("a", "referral_wrong_person", [
          { id: "t-ooo", name: "ReplyIQ · Out of office" },
          { id: "g8-interested", name: "Interested" }, // graph8's own tag: leave alone
        ]),
      ]),
    ]);
    expect(res.staleRemoved).toBe(1);
    expect(log.untagged).toEqual([["a", "t-ooo"]]);
  });

  it("keeps and reports a stale tag graph8 refuses to remove", async () => {
    const { client } = fakeClient([{ id: "t-ooo", name: "ReplyIQ · Out of office" }], { failUntag: true });
    const res = await tagThreads(client, [grp("hard_no", [cl("a", "hard_no", [{ id: "t-ooo", name: "ReplyIQ · Out of office" }])])]);
    expect(res.staleKept).toBe(1);
    expect(res.tagged).toBe(1);
    expect(res.warnings.join()).toMatch(/still carries old tag/);
  });

  it("warnings name the person, not the thread id", async () => {
    const { client } = fakeClient([{ id: "t-ooo", name: "ReplyIQ · Out of office" }], { failUntag: true, failTag: ["thread-b-0001"] });
    const named = { ...cl("thread-a-0001", "hard_no", [{ id: "t-ooo", name: "ReplyIQ · Out of office" }]), contactName: "Dana Reyes", company: "Acme" };
    const res = await tagThreads(client, [grp("hard_no", [named, cl("thread-b-0001", "hard_no")])]);
    expect(res.warnings).toContain('Dana Reyes (Acme): thread still carries old tag "ReplyIQ · Out of office" (graph8 would not remove it)');
    expect(res.warnings).toContain("thread-b-0001@example.com: could not tag the thread (graph8 500)");
    expect(res.warnings.join()).not.toMatch(/thread-a-0001/);
  });

  it("a failing thread is recorded and never stops the others", async () => {
    const { client, log } = fakeClient([], { failTag: ["b"] });
    const res = await tagThreads(client, [grp("out_of_office", [cl("a", "out_of_office"), cl("b", "out_of_office"), cl("c", "out_of_office")])]);
    expect(res).toMatchObject({ tagged: 2, failed: 1 });
    expect(log.tagged.map(([id]) => id).sort()).toEqual(["a", "c"]);
    expect(res.groups[0].replies.find((r) => r.threadId === "b")?.tag).toMatchObject({ status: "failed", error: "graph8 500" });
  });

  it("refuses before any write when writes are not allowed", async () => {
    const { client, log } = fakeClient([], { notAllowed: true });
    await expect(tagThreads(client, [grp("hard_no", [cl("a", "hard_no")])])).rejects.toBeInstanceOf(WriteNotAllowedError);
    expect(log.created).toEqual([]);
    expect(log.tagged).toEqual([]);
  });

  it("limits concurrency and does not mutate the input", async () => {
    const { client, log } = fakeClient();
    const input = [grp("out_of_office", Array.from({ length: 12 }, (_, i) => cl(`r${i}`, "out_of_office")))];
    await tagThreads(client, input, { concurrency: 3 });
    expect(log.maxInFlight).toBeLessThanOrEqual(3);
    expect(input[0].replies[0].tag).toBeUndefined();
  });
});
