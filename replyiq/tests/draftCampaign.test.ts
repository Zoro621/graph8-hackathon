import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { CampaignCreateBody, CampaignDocument, SequenceCreateBody, SequenceDetail } from "../lib/g8";
import { WriteNotAllowedError } from "../lib/g8";
import {
  buildBrief,
  campaignFields,
  draftCampaign,
  DraftError,
  LIMITS,
  marker,
  parsePersonNames,
  referralTargets,
  upsertSection,
} from "../lib/pipeline/draftCampaign";
import { emptyRun } from "../lib/pipeline/runPipeline";
import { createFileStore, type RunStore } from "../lib/store";
import type { Category, Classified, Group, Run } from "../lib/types";
import { reply } from "./helpers";

const cl = (id: string, category: Category, extra: Partial<Classified> = {}): Classified => ({
  ...reply(id, `reply ${id}`, { contactId: extra.contactId ?? Number(id.replace(/\D/g, "") || 1), contactEmail: `${id}@example.com`, company: "Acme" }),
  category,
  confidence: 0.9,
  quote: `reply ${id}`,
  needsReview: false,
  ...extra,
});

function makeRun(groups: Group[]): Run {
  const run = emptyRun("abcdefghijkl", { campaignId: "c1" }, new Date("2026-09-26T10:00:00Z"));
  run.status = "done";
  run.steps.resolve = "done";
  run.source = { ...run.source, name: "SMB Campaign", campaignId: "c1", sequences: [{ id: "src-seq", name: "SMB sequence", status: "paused" }] };
  run.groups = groups;
  return run;
}

const pricing = (): Group => ({
  key: "pricing_request",
  label: "Pricing request",
  replies: [cl("p1", "pricing_request"), cl("p2", "pricing_request")],
  eligible: [
    { contactId: 1, email: "p1@example.com", threadId: "p1" },
    { contactId: 2, email: "p2@example.com", threadId: "p2" },
  ],
  excluded: [],
  card: {
    summary: "They want prices.",
    quotes: ["reply p1"],
    proofWeHave: [{ claim: "Flat price.", sourceDocId: "d1", sourceDocName: "Pricing Matrix", excerpt: "The Team Plan is $99/month for unlimited users.", verified: true }],
    proofGap: "No cost estimator.",
    howToAnswer: "Send the published pricing.",
    emailAngle: "Here are the prices you asked for.",
    themeNotes: [],
    unverifiedClaims: [],
    sources: [],
  },
});

/** Fake graph8: records every write; docs evolve per poll. */
function fakeG8(opts: { docs?: CampaignDocument[][]; suppressed?: number[]; suppressionFails?: number[]; notAllowed?: boolean; sequenceFails?: boolean; contacts?: { id: number; first_name: string; last_name: string; work_email: string }[] } = {}) {
  const log = { lists: [] as { title: string; key?: string }[], added: [] as number[][], campaigns: [] as { body: CampaignCreateBody; key?: string }[], updates: [] as { docId: string; content: string }[], sequences: [] as { body: SequenceCreateBody; key?: string }[], polls: 0 };
  const seqDetail = (id: string, listId: number | null): SequenceDetail => ({
    id, name: "seq", status: "draft", user_email: "owner@example.com", step_count: null, contact_count: null, sequence_kind: "cold_outbound",
    associated_list_id: listId, created_at: null, updated_at: null, description: null, finish_on_reply: true, pinned_mailbox_id: null,
  });
  const docContent = new Map<string, string>();
  const docsSeq = opts.docs ?? [[
    { id: "o", file_type: "messaging_objections", status: "completed" },
    { id: "r", file_type: "reply_templates", status: "completed" },
    { id: "b", file_type: "campaign_brief", status: "completed" },
  ]];
  docContent.set("o", "# Messaging & Objections\n\nStudio text.");
  docContent.set("r", "# Reply Templates\n\nStudio text.");
  const g8 = {
    assertWriteAllowed: async () => {
      if (opts.notAllowed) throw new WriteNotAllowedError("not sandbox");
      return { allowed: true as const, via: "sandbox" as const, orgId: "o" };
    },
    searchContacts: async (q: { name?: string }) => (opts.contacts ?? []).filter((c) => c.last_name === q.name).map((c) => ({ ...c, job_title: null, company_id: null })),
    getSuppression: async (id: number) => {
      if (opts.suppressionFails?.includes(id)) throw new Error("ledger down");
      return { contact_id: id, is_suppressed: opts.suppressed?.includes(id) ?? false, active_channels: [], suppressions: [] };
    },
    createList: async (title: string, _d: string, key?: string) => {
      log.lists.push({ title, key });
      return { id: 77, title };
    },
    addContactsToList: async (_id: number, ids: number[]) => {
      log.added.push(ids);
      return { conflictSkipped: false };
    },
    createCampaign: async (body: CampaignCreateBody, key?: string) => {
      log.campaigns.push({ body, key });
      return { id: `camp-${log.campaigns.length}`, name: String(body.name), status: "copy_in_progress", generation_status: "in_progress" };
    },
    getCampaign: async (id: string) => ({ id, name: "x", status: "draft" }),
    listCampaignDocs: async () => docsSeq[Math.min(log.polls++, docsSeq.length - 1)],
    getCampaignDoc: async (_c: string, docId: string) => ({ id: docId, content: docContent.get(docId) ?? "" }),
    updateCampaignDoc: async (_c: string, docId: string, content: string) => {
      log.updates.push({ docId, content });
      docContent.set(docId, content);
      return { id: docId };
    },
    getCampaignFull: async () => ({ id: "c1", name: "SMB Campaign", status: "paused", target_persona: "RevOps leaders" }),
    // follow-up sequence (M5b)
    listGlobalDocs: async () => [],
    createSequence: async (body: SequenceCreateBody, key?: string) => {
      if (opts.sequenceFails) throw new Error("sequencer down");
      log.sequences.push({ body, key });
      return { id: `seq-${log.sequences.length}`, name: body.name, status: "draft" };
    },
    updateSequenceStep: async () => ({}),
    addSequenceSteps: async () => ({}),
    getSequence: async (id: string) => seqDetail(id, id === "src-seq" ? null : (log.sequences.at(-1)?.body.associated_list_id ?? null)),
    getSequenceSteps: async (id: string) => ({ sequence_id: id, steps: id === "src-seq" ? [] : ((log.sequences.at(-1)?.body.steps ?? []) as unknown as Record<string, unknown>[]) }),
    findContactByEmail: async (email: string) => ({ id: 1, first_name: "Pat", last_name: "Lee", work_email: email, job_title: "VP Sales", company_id: null }),
    estimateEmailDraft: async () => ({ estimated_credits: 9 }),
    generateEmailDraft: async () => ({ subject: "your agenda", body: "Hi Pat, here it is." }),
  };
  return { g8, log, docContent };
}

let dir: string;
let store: RunStore;
beforeEach(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), "replyiq-draft-"));
  store = createFileStore(dir);
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

const deps = (g8: ReturnType<typeof fakeG8>["g8"]) => ({ g8, llm: null, model: "m", store, pollMs: 0, timeoutMs: 1_000, sleep: async () => {} });

describe("draftCampaign", () => {
  it("creates list + campaign, appends the Answer Card to completed docs, saves a ready draft", async () => {
    await store.save(makeRun([pricing()]));
    const { g8, log, docContent } = fakeG8();
    const d = await draftCampaign(deps(g8), { runId: "abcdefghijkl", groupKey: "pricing_request" });
    expect(d.status).toBe("ready");
    expect(log.lists[0]).toMatchObject({ key: "replyiq:abcdefghijkl:pricing_request:list" });
    expect(log.added).toEqual([[1, 2]]);
    const body = log.campaigns[0].body;
    expect(body).toMatchObject({ audience_list_id: "77", target_channels: ["email"], auto_generate_documents: true, category: "Outbound" });
    expect(String(body.name).length).toBeLessThanOrEqual(LIMITS.name);
    expect(String(body.brief)).toContain("do NOT claim this:** No cost estimator.");
    expect(docContent.get("o")).toMatch(/^# Messaging & Objections\n\nStudio text\.\n\n<!-- replyiq:abcdefghijkl:pricing_request -->/);
    expect(docContent.get("o")).toContain('Flat price: "The Team Plan is $99/month for unlimited users."'); // claim punctuation cleaned
    expect(d.docsPatched.sort()).toEqual(["messaging_objections", "reply_templates"]); // a completed brief stays Studio's
    const saved = await store.load("abcdefghijkl");
    expect(saved?.groups[0].draft?.campaignId).toBe("camp-1");
  });

  it("fills docs Studio failed to generate, leaves generating ones pending, patches them later", async () => {
    await store.save(makeRun([pricing()]));
    const { g8, log, docContent } = fakeG8({
      docs: [
        [
          { id: "o", file_type: "messaging_objections", status: "failed" },
          { id: "r", file_type: "reply_templates", status: "generating" },
          { id: "b", file_type: "campaign_brief", status: "failed" },
        ],
      ],
    });
    docContent.set("o", "");
    const d = await draftCampaign(deps(g8), { runId: "abcdefghijkl", groupKey: "pricing_request" });
    expect(d.status).toBe("ready");
    expect(d.docsFailed.sort()).toEqual(["campaign_brief", "messaging_objections"]);
    expect(d.docsPending).toEqual(["reply_templates"]);
    expect(docContent.get("o")).toMatch(/^<!-- replyiq:/); // written into the empty failed doc
    expect(docContent.get("b")).toContain("# ReplyIQ follow-up: Pricing request");
    expect(log.updates.find((u) => u.docId === "r")).toBeUndefined(); // generating: untouched

    // Later: generation finished -> patch-only reuses the campaign and patches the pending doc.
    const later = fakeG8();
    later.docContent.set("o", docContent.get("o")!);
    const d2 = await draftCampaign(deps(later.g8), { runId: "abcdefghijkl", groupKey: "pricing_request", patchOnly: true });
    expect(later.log.campaigns).toHaveLength(0);
    expect(later.log.lists).toHaveLength(0);
    expect(d2.docsPatched).toContain("reply_templates");
    expect(d2.campaignId).toBe("camp-1");
  });

  it("re-running never duplicates: same campaign, marker-guarded docs", async () => {
    await store.save(makeRun([pricing()]));
    const { g8, log } = fakeG8();
    await draftCampaign(deps(g8), { runId: "abcdefghijkl", groupKey: "pricing_request" });
    await draftCampaign(deps(g8), { runId: "abcdefghijkl", groupKey: "pricing_request" });
    expect(log.campaigns).toHaveLength(1);
    expect(log.updates.filter((u) => u.docId === "o")).toHaveLength(1);
  });

  it("re-checks hard stops and suppression right before adding anyone (fail closed)", async () => {
    const g = pricing();
    g.eligible.push({ contactId: 3, email: "p3@example.com", threadId: "p3" }, { contactId: 4, email: "p4@example.com", threadId: "p4" }, { contactId: 5, email: "p5@example.com", threadId: "p5" });
    const stop: Group = { key: "unsubscribe", label: "Unsubscribe", replies: [cl("u5", "unsubscribe", { contactId: 5 })], eligible: [], excluded: [] };
    await store.save(makeRun([g, stop]));
    const { g8, log } = fakeG8({ suppressed: [3], suppressionFails: [4] });
    const d = await draftCampaign(deps(g8), { runId: "abcdefghijkl", groupKey: "pricing_request" });
    expect(log.added).toEqual([[1, 2]]);
    expect(d.audienceNotes.join(" ")).toMatch(/p3@example.com: suppressed/);
    expect(d.audienceNotes.join(" ")).toMatch(/p4@example.com: suppression check failed; excluded/);
    expect(d.audienceNotes.join(" ")).toMatch(/p5@example.com: said no/);
  });

  it("below the minimum audience: failed draft, nothing written", async () => {
    const g = pricing();
    g.eligible = g.eligible.slice(0, 1);
    await store.save(makeRun([g]));
    const { g8, log } = fakeG8();
    const d = await draftCampaign(deps(g8), { runId: "abcdefghijkl", groupKey: "pricing_request" });
    expect(d.status).toBe("failed");
    expect(d.error).toMatch(/only 1 contact/);
    expect(log.lists).toHaveLength(0);
    expect(log.campaigns).toHaveLength(0);
  });

  it("refuses groups that never get a follow-up, missing runs/groups, and unsafe writes", async () => {
    const hardNo: Group = { key: "hard_no", label: "Hard no", replies: [cl("h1", "hard_no")], eligible: [], excluded: [] };
    await store.save(makeRun([pricing(), hardNo]));
    const { g8 } = fakeG8();
    await expect(draftCampaign(deps(g8), { runId: "abcdefghijkl", groupKey: "hard_no" })).rejects.toBeInstanceOf(DraftError);
    await expect(draftCampaign(deps(g8), { runId: "zzzzzzzzzzzz", groupKey: "pricing_request" })).rejects.toThrow(/not found/);
    await expect(draftCampaign(deps(g8), { runId: "abcdefghijkl", groupKey: "no_need" })).rejects.toThrow(/no "no_need" group/);
    const blocked = fakeG8({ notAllowed: true });
    await expect(draftCampaign(deps(blocked.g8), { runId: "abcdefghijkl", groupKey: "pricing_request" })).rejects.toBeInstanceOf(WriteNotAllowedError);
    expect(blocked.log.lists).toHaveLength(0);
  });

  it("referral drafts target the NAMED people found in the CRM, not the person who left", async () => {
    const ref: Group = {
      key: "referral_wrong_person",
      label: "Referral",
      replies: [
        cl("r1", "referral_wrong_person", { referredName: "Kurt Huegin", contactName: "Old Contact" }),
        cl("r2", "referral_wrong_person", { referredName: "Jane Roe and Sam Poe" }),
        cl("r3", "referral_wrong_person", { referredName: "their team leaders" }),
      ],
      eligible: [{ contactId: 1, email: "r1@example.com", threadId: "r1" }],
      excluded: [],
    };
    await store.save(makeRun([ref]));
    const { g8, log } = fakeG8({
      contacts: [
        { id: 501, first_name: "Kurt", last_name: "Huegin", work_email: "kurt@acme.example.com" },
        { id: 502, first_name: "Jane", last_name: "Roe", work_email: "jane@acme.example.com" },
      ],
    });
    const d = await draftCampaign(deps(g8), { runId: "abcdefghijkl", groupKey: "referral_wrong_person" });
    expect(d.status).toBe("ready");
    expect(log.added).toEqual([[501, 502]]);
    expect(d.audience[0]).toMatchObject({ contactId: 501, referredBy: "Old Contact" });
    expect(d.audienceNotes.join(" ")).toMatch(/Sam Poe .*not in the CRM/);
    expect(d.audienceNotes.join(" ")).toMatch(/their team leaders/);
  });
});

describe("draftCampaign: follow-up sequence stage", () => {
  it("builds a draft sequence on the draft's list and links the Studio campaign; no sender, owner from the original", async () => {
    await store.save(makeRun([pricing()]));
    const { g8, log } = fakeG8();
    const d = await draftCampaign(deps(g8), { runId: "abcdefghijkl", groupKey: "pricing_request" });
    expect(d.status).toBe("ready");
    expect(d.sequence?.status).toBe("ready");
    expect(log.sequences).toHaveLength(1);
    const body = log.sequences[0].body;
    expect(body).toMatchObject({ associated_list_id: 77, campaign_id: "camp-1", user_email: "owner@example.com", finish_on_reply: true });
    expect(body).not.toHaveProperty("channels");
    expect(log.sequences[0].key).toBe("replyiq:abcdefghijkl:pricing_request:sequence");
    // no model in these tests: step 1 only (graph8's AI, grounded instructions), and a warning says so
    expect(body.steps).toHaveLength(1);
    expect(body.steps![0]).toMatchObject({ step_type: "EMAIL", input_type: "ON_DEMAND" });
    expect(body.steps![0].step_data.instructions).toContain("No cost estimator.");
    expect(d.sequence?.warnings.join(" ")).toMatch(/no model configured/);
    expect(d.sequence?.verified).toBe(true);
    // re-running reuses the sequence
    await draftCampaign(deps(g8), { runId: "abcdefghijkl", groupKey: "pricing_request" });
    expect(log.sequences).toHaveLength(1);
  });

  it("sequenceOnly builds the sequence for an existing draft without touching list, campaign or docs", async () => {
    await store.save(makeRun([pricing()]));
    await draftCampaign(deps(fakeG8().g8), { runId: "abcdefghijkl", groupKey: "pricing_request", skipSequence: true });
    const { g8, log } = fakeG8();
    const d = await draftCampaign(deps(g8), { runId: "abcdefghijkl", groupKey: "pricing_request", sequenceOnly: true });
    expect(d.status).toBe("ready");
    expect(log.lists).toHaveLength(0);
    expect(log.campaigns).toHaveLength(0);
    expect(log.updates).toHaveLength(0);
    expect(log.polls).toBe(0);
    expect(log.sequences).toHaveLength(1);
  });

  it("sequenceOnly needs an existing draft; skipSequence builds none; a sequencer failure never fails the draft", async () => {
    await store.save(makeRun([pricing()]));
    await expect(draftCampaign(deps(fakeG8().g8), { runId: "abcdefghijkl", groupKey: "pricing_request", sequenceOnly: true })).rejects.toBeInstanceOf(DraftError);
    const skip = fakeG8();
    await draftCampaign(deps(skip.g8), { runId: "abcdefghijkl", groupKey: "pricing_request", skipSequence: true });
    expect(skip.log.sequences).toHaveLength(0);
    const down = fakeG8({ sequenceFails: true });
    const d = await draftCampaign(deps(down.g8), { runId: "abcdefghijkl", groupKey: "pricing_request", sequenceOnly: true });
    expect(d.status).toBe("ready");
    expect(d.sequence?.status).toBe("failed");
    expect(d.warnings.join(" ")).toMatch(/follow-up sequence not created: .*sequencer down/);
  });
});

describe("helpers", () => {
  it("parsePersonNames keeps people, drops roles and emails", () => {
    expect(parsePersonNames("Claudia Boehringer and Annie Nash")).toEqual(["Claudia Boehringer", "Annie Nash"]);
    expect(parsePersonNames("“Steve Pinchotti”")).toEqual(["Steve Pinchotti"]);
    expect(parsePersonNames("one of their team leaders")).toEqual([]);
    expect(parsePersonNames("redacted@example.com")).toEqual([]);
    expect(parsePersonNames("Rob")).toEqual([]); // a first name alone is not searchable
    expect(parsePersonNames(undefined)).toEqual([]);
  });

  it("referralTargets requires an exact, unambiguous match", async () => {
    const g: Group = { key: "referral_wrong_person", label: "Referral", replies: [cl("r", "referral_wrong_person", { referredName: "Kurt Huegin" })], eligible: [], excluded: [] };
    const two = { searchContacts: async () => [1, 2].map((id) => ({ id, first_name: "Kurt", last_name: "Huegin", work_email: `k${id}@x.com`, job_title: null, company_id: null })) };
    expect((await referralTargets(two, g)).notes[0]).toMatch(/ambiguous/);
    const partial = { searchContacts: async () => [{ id: 1, first_name: "Kurtis", last_name: "Huegin", work_email: "k@x.com", job_title: null, company_id: null }] };
    expect((await referralTargets(partial, g)).found).toEqual([]);
  });

  it("upsertSection appends once, and refresh replaces only our own section", () => {
    const m = marker("run1", "pricing_request");
    const other = marker("run1", "no_need");
    const first = upsertSection("Studio text.", `${m}\nOLD`, m, false)!;
    expect(first).toBe(`Studio text.\n\n${m}\nOLD\n`);
    expect(upsertSection(first, `${m}\nNEW`, m, false)).toBeNull();
    const withOther = `${first}\n${other}\nOTHER SECTION\n`;
    const refreshed = upsertSection(withOther, `${m}\nNEW`, m, true)!;
    expect(refreshed).toContain("Studio text.");
    expect(refreshed).toContain(`${m}\nNEW`);
    expect(refreshed).not.toContain("OLD");
    expect(refreshed).toContain(`${other}\nOTHER SECTION`);
  });

  it("buildBrief: verbatim quotes (deduped), verified proof, proof gap as a rule, timing for later groups", () => {
    const g = pricing();
    g.replies = [cl("a", "pricing_request", { quote: "Send pricing" }), cl("b", "pricing_request", { quote: "send  pricing" })];
    const brief = buildBrief(makeRun([g]), g, 2);
    expect(brief.match(/Send pricing/gi)).toHaveLength(1);
    expect(brief).toContain('"The Team Plan is $99/month for unlimited users." (source: Pricing Matrix)');
    expect(brief).toContain("do NOT claim this:** No cost estimator.");
    const ooo: Group = { key: "out_of_office", label: "Out of office", replies: [cl("o", "out_of_office", { revisitHint: "June 9" })], eligible: [], excluded: [] };
    expect(buildBrief(makeRun([ooo]), ooo, 1)).toMatch(/Return dates mentioned: June 9/);
  });

  it("campaignFields falls back safely when the model fails, and clips to API limits", async () => {
    const g = pricing();
    const failing = { parse: async () => Promise.reject(new Error("down")) };
    const f = await campaignFields(failing, "m", makeRun([g]), g, "x".repeat(500));
    expect(f.source).toBe("fallback");
    expect(f.primary_hook).toBe("Here are the prices you asked for.");
    const long = { parse: async () => ({ data: { primary_hook: "h", core_concept: "c", goal: "g".repeat(400), target_persona: "p".repeat(400) }, usage: { inputTokens: 0, outputTokens: 0 } }) };
    const f2 = await campaignFields(long as never, "m", makeRun([g]), g, null);
    expect(f2.goal.length).toBeLessThanOrEqual(LIMITS.goal);
    expect(f2.target_persona.length).toBeLessThanOrEqual(LIMITS.persona);
  });
});
