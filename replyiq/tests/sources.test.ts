import { describe, expect, it } from "vitest";
import type { CampaignDocument, G8Client, Thread } from "../lib/g8";
import { discoverSources, fetchSourceReplies, findCampaignDoc, pickDefaultSource, resolveSource } from "../lib/pipeline/sources";

const thread = (id: string, sequenceId: string | null, prospectReplied = true): Thread => ({
  id,
  subject: null,
  sequenceId,
  sequenceName: null,
  mailbox: null,
  contact: { id: 1, email: `${id}@example.com` },
  messages: [
    { messageId: null, from: null, to: [], content: "pitch", responder: "USER", date: "2026-09-24T10:00:00Z", isDraft: false },
    ...(prospectReplied
      ? [{ messageId: null, from: null, to: [], content: `reply ${id}`, responder: "OTHER", date: "2026-09-24T11:00:00Z", isDraft: false }]
      : []),
  ],
  tags: [],
  summary: null,
  source: "emails.search",
});

/** A fake org: two campaigns, three sequences, two mailboxes. Only the methods sources.ts uses. */
function fakeOrg(): G8Client {
  const byMailbox: Record<string, Thread[]> = {
    "a@example.com": [thread("t1", "seqA"), thread("t2", "seqA"), thread("t3", "seqB"), thread("t4", "seqB", false)],
    "b@example.com": [thread("t1", "seqA"), thread("t5", "seqC")], // t1 appears in both mailboxes
  };
  const campaigns = {
    c1: {
      id: "c1",
      name: "SMB Campaign",
      status: "paused",
      audience_list_id: "100",
      linked_sequences: [{ sequence_id: "seqA" }],
      documents: [
        { id: "d1", file_type: "messaging_objections", content: "angles + objections" },
        { id: "d2", display_name: "Reply Templates", content: "templates\n\n<!-- replyiq:run1:pricing_request -->\nReplyIQ's own section" },
        { id: "d3", file_type: "emails", content: "" }, // empty: must be ignored
      ],
    },
    c2: { id: "c2", name: "Other", status: "draft", linked_sequences: [{ sequence_id: "seqB" }], documents: [] },
  } as const;
  const seqs = {
    seqA: { id: "seqA", name: "Seq A", status: "paused", contact_count: 7000, associated_list_id: 100 },
    seqB: { id: "seqB", name: "Seq B", status: "completed", contact_count: 10, associated_list_id: 200 },
    seqC: { id: "seqC", name: "Seq C", status: "completed", contact_count: 5, associated_list_id: null },
  } as const;
  return {
    listInboxMailboxes: async () => Object.keys(byMailbox),
    searchEmailThreads: async (mbs: string[]) => mbs.flatMap((m) => byMailbox[m] ?? []),
    listSequences: async () => Object.values(seqs),
    listCampaigns: async () => Object.values(campaigns).map(({ id, name, status }) => ({ id, name, status })),
    getCampaignFull: async (id: string) => campaigns[id as keyof typeof campaigns],
    getSequence: async (id: string) => seqs[id as keyof typeof seqs],
    getSequenceChannels: async (id: string) => (id === "seqA" ? [{ channel_value: "a@example.com" }] : []),
    listThreads: async (seqId: string) =>
      [...new Map(Object.values(byMailbox).flat().filter((t) => t.sequenceId === seqId).map((t) => [t.id, t])).values()],
  } as unknown as G8Client;
}

describe("discoverSources", () => {
  it("counts replies per sequence across mailboxes, deduped, most replies first", async () => {
    const sources = await discoverSources(fakeOrg());
    expect(sources.map((s) => [s.sequenceId, s.replyThreads])).toEqual([
      ["seqA", 2], // t1 counted once although it is in two mailboxes
      ["seqB", 1], // t4 has no prospect message
      ["seqC", 1],
    ]);
    expect(sources[0]).toMatchObject({ campaignId: "c1", campaignName: "SMB Campaign" });
    expect(sources[0].mailboxes.sort()).toEqual(["a@example.com", "b@example.com"]);
    expect(sources[2].campaignId).toBeNull();
  });

  it("defaults to the campaign of the source with the most replies", async () => {
    expect(pickDefaultSource(await discoverSources(fakeOrg()))).toEqual({ campaignId: "c1" });
    expect(pickDefaultSource([])).toBeNull();
  });

  it("falls back to a bare sequence when it has no campaign", () => {
    const s = { sequenceId: "seqC", sequenceName: "C", sequenceStatus: null, contactCount: 1, campaignId: null, campaignName: null, replyThreads: 3, mailboxes: [] };
    expect(pickDefaultSource([s])).toEqual({ sequenceId: "seqC" });
  });
});

describe("resolveSource", () => {
  it("resolves a campaign into its sequences, audience, mailboxes and docs", async () => {
    const ctx = await resolveSource(fakeOrg(), { campaignId: "c1" });
    expect(ctx.sequences.map((s) => s.id)).toEqual(["seqA"]);
    expect(ctx.audienceListId).toBe(100);
    expect(ctx.mailboxes).toEqual(["a@example.com"]);
    expect(Object.keys(ctx.docs).sort()).toEqual(["objections", "replyTemplates"]); // empty emails doc ignored
    expect(ctx.docs.replyTemplates?.content).toBe("templates"); // ReplyIQ's own section is never grounding
    expect(ctx.warnings).toEqual([]);
  });

  it("resolves a sequence and finds the campaign that links it", async () => {
    const ctx = await resolveSource(fakeOrg(), { sequenceId: "seqB" });
    expect(ctx.campaign?.id).toBe("c2");
    expect(ctx.warnings).toContain("no Messaging & Objections document found on the campaign");
  });

  it("a standalone sequence has no campaign and no warnings about docs", async () => {
    const ctx = await resolveSource(fakeOrg(), { sequenceId: "seqC" });
    expect(ctx.campaign).toBeNull();
    expect(ctx.docs).toEqual({});
  });

  it("fetches replies across the source's sequences", async () => {
    const org = fakeOrg();
    const ctx = await resolveSource(org, { campaignId: "c1" });
    const { threads, replies } = await fetchSourceReplies(org, ctx);
    expect(threads).toBe(2);
    expect(replies.map((r) => r.threadId).sort()).toEqual(["t1", "t2"]);
  });
});

describe("findCampaignDoc", () => {
  const docs: CampaignDocument[] = [
    { id: "1", file_type: "campaign_brief", display_name: "Campaign Brief" },
    { id: "2", display_name: "Objection Handling v2" },
    { id: "3", file_type: "email_copy" },
  ];
  it("matches by file_type first, then by name", () => {
    expect(findCampaignDoc(docs, "brief")?.id).toBe("1");
    expect(findCampaignDoc(docs, "objections")?.id).toBe("2");
    expect(findCampaignDoc(docs, "emails")?.id).toBe("3");
    expect(findCampaignDoc(docs, "replyTemplates")).toBeUndefined();
  });
});
