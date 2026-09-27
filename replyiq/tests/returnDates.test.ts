import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { CampaignCreateBody, SequenceCreateBody, SequenceDetail, SequenceStepConfig } from "../lib/g8";
import type { Llm, LlmRequest } from "../lib/llm";
import { draftCampaign } from "../lib/pipeline/draftCampaign";
import { verifyRecordedSequence } from "../lib/pipeline/followupSequence";
import { dayLabel, firstWorkingDayAfter, planReturnWaves, resolveReturnDate, wavesSummary } from "../lib/pipeline/returnDates";
import { emptyRun } from "../lib/pipeline/runPipeline";
import { createFileStore, type RunStore } from "../lib/store";
import type { Classified, Group, Run } from "../lib/types";
import { reply } from "./helpers";

// The real out-of-office replies of the team's SMB campaign (26 Sep run), replied on Fri 18 Sep 2026.
const REPLIED = "2026-09-18T18:27:06Z";
const TODAY = "2026-09-27";

describe("reading a return date", () => {
  it.each([
    ["5/26 - 6/5", "2026-06-05"], // a range gives its last day
    ["Monday July 6, 2026", "2026-07-06"],
    ["June 9", "2026-06-09"], // no year: 264 days ahead is too far, so it is the June before the reply
    ["Thursday, June 3rd, 2026", "2026-06-03"],
    ["6/8/26", "2026-06-08"],
    ["March 19th", "2026-03-19"], // an auto-reply left on after they came back
    ["Monday the 1st of June", "2026-06-01"],
    ["Monday", "2026-09-21"], // the Monday after a Friday reply
    ["next week", "2026-09-21"],
    ["back in two weeks", "2026-10-02"],
    ["tomorrow", "2026-09-19"],
    ["26/5", "2026-05-26"], // day first when the first number can't be a month
    ["until October 6", "2026-10-06"],
  ])("%s -> %s", (hint, day) => {
    expect(resolveReturnDate(hint, REPLIED, TODAY)).toBe(day);
  });

  it("returns null when there is no date to read", () => {
    for (const hint of [undefined, "", "limited access to email", "next quarter", "June 31"]) expect(resolveReturnDate(hint, REPLIED, TODAY)).toBeNull();
  });

  it("places a date without a year ahead of the reply when it is soon", () => {
    expect(resolveReturnDate("Jan 4", "2026-12-20T09:00:00Z", TODAY)).toBe("2027-01-04");
    expect(resolveReturnDate("Monday", undefined, TODAY)).toBe("2026-09-28"); // no reply date: counted from today
  });

  it("the first email goes the working day after they are back", () => {
    expect(firstWorkingDayAfter("2026-10-01")).toBe("2026-10-02"); // Thu -> Fri
    expect(firstWorkingDayAfter("2026-10-02")).toBe("2026-10-05"); // Fri -> Mon
    expect(firstWorkingDayAfter("2026-10-03")).toBe("2026-10-05"); // Sat -> Mon
    expect(dayLabel("2026-10-05")).toBe("Mon 5 Oct");
  });
});

// ---------- the group ----------

const ooo = (id: string, n: number, hint?: string): Classified => ({
  ...reply(id, `out of office ${hint ?? ""}`, { contactId: n, contactEmail: `${id}@example.com`, company: "Acme", repliedAt: REPLIED }),
  category: "out_of_office",
  confidence: 0.95,
  quote: "I am out of the office",
  revisitHint: hint,
  needsReview: false,
});

function oooGroup(): Group {
  const replies = [ooo("a", 1, "June 9"), ooo("b", 2, "until October 6"), ooo("c", 3), ooo("d", 4, "Oct 3")];
  return { key: "out_of_office", label: "Out of office", replies, eligible: replies.map((r) => ({ contactId: r.contactId!, email: r.contactEmail, threadId: r.threadId })), excluded: [] };
}

describe("splitting the group by return date", () => {
  it("already back first, then one wave per first-email day; no date = two weeks after the reply", () => {
    const g = oooGroup();
    const waves = planReturnWaves(g, g.eligible, TODAY);
    expect(waves.map((w) => [w.key, w.firstEmailOn, w.delayDays, w.contacts.map((c) => c.contactId)])).toEqual([
      ["now", TODAY, 0, [1]],
      ["2026-10-05", "2026-10-05", 8, [3, 4]], // back Fri 2 Oct (assumed) and Sat 3 Oct: both emailed Monday
      ["2026-10-07", "2026-10-07", 10, [2]],
    ]);
    expect(waves[1]).toMatchObject({ returnOn: "2026-10-03" });
    expect(waves[1].contacts.find((c) => c.contactId === 3)).toMatchObject({ returnOn: "2026-10-02", assumed: true });
    expect(waves[0].contacts[0]).toMatchObject({ returnOn: "2026-06-09", said: "June 9" });
    const text = wavesSummary(waves, TODAY);
    expect(text).toContain("1 person back already: first email when the draft is launched");
    expect(text).toContain("2 people back by Sat 3 Oct: first email Mon 5 Oct (step 1 waits 8 days after launch)");
    expect(text).toContain("1 person gave no return date: assumed back 14 days after replying.");
    expect(text).toContain("set on Sun 27 Sep");
    expect(text).not.toMatch(/no delayed start/);
  });

  it("everyone back already is one wave that sends on launch, with nothing to recount", () => {
    const g = oooGroup();
    const waves = planReturnWaves(g, g.eligible, "2026-11-01");
    expect(waves.map((w) => [w.key, w.delayDays, w.contacts.length])).toEqual([["now", 0, 4]]);
    expect(wavesSummary(waves, "2026-11-01")).not.toMatch(/Recount/);
  });
});

// ---------- in graph8: one list and Sequencer draft per date ----------

const STEP2 = {
  subject: "back in your inbox",
  body: "Hi {{first_name}},\n\nHope the time away went well. I wanted to bring my earlier note back to the top of your inbox now that you are settling in, in case it helps {{company}}.\n\nWould a short call make sense?\n\n{{sender_name}}",
  claims: [],
};

function fakeLlm() {
  const calls: string[] = [];
  const llm: Llm = {
    async parse<T>(req: LlmRequest<T>) {
      calls.push(req.name);
      const data =
        req.name === "followup_facts" ? { facts: [] } : req.name === "followup_email" ? STEP2 : req.name === "email_audit" ? { unsupported: [] } : req.name === "campaign_fields" ? { primary_hook: "h", core_concept: "c", goal: "g", target_persona: "p" } : null;
      if (!data) throw new Error(`no fake answer for ${req.name}`); // the strategy is optional: a warning
      return { data: req.schema.parse(data), usage: { inputTokens: 1, outputTokens: 1 } };
    },
  };
  return { llm, calls };
}

/** graph8 with real lists and sequences: idempotency keys replay, steps and names are stored. */
function fakeGraph8() {
  const lists = new Map<number, Set<number>>();
  const listKeys = new Map<string, number>();
  const seqs = new Map<string, { listId: number; name: string; steps: Record<string, unknown>[] }>();
  const seqKeys = new Map<string, string>();
  const docs = new Map<string, string>([["o", "# Messaging & Objections\n\nStudio text."]]);
  const log = { lists: [] as string[], sequences: [] as string[], renames: [] as string[], briefs: [] as string[] };
  let nextList = 77;
  const detail = (id: string, listId: number | null): SequenceDetail => ({
    id, name: seqs.get(id)?.name ?? "src", status: "draft", user_email: "owner@example.com", step_count: null, contact_count: null, sequence_kind: "cold_outbound",
    associated_list_id: listId, created_at: null, updated_at: null, description: null, finish_on_reply: true, pinned_mailbox_id: null,
  });
  const g8 = {
    assertWriteAllowed: async () => ({ allowed: true as const, via: "sandbox" as const, orgId: "o" }),
    searchContacts: async () => [],
    getSuppression: async (id: number) => ({ contact_id: id, is_suppressed: false, active_channels: [], suppressions: [] }),
    searchCallResults: async () => [],
    createList: async (title: string, _d: string, key?: string) => {
      if (key && listKeys.has(key)) return { id: listKeys.get(key)!, title };
      const id = nextList++;
      lists.set(id, new Set());
      if (key) listKeys.set(key, id);
      log.lists.push(title);
      return { id, title };
    },
    addContactsToList: async (id: number, ids: number[]) => {
      for (const x of ids) lists.get(id)!.add(x);
      return { conflictSkipped: false };
    },
    removeContactsFromList: async (id: number, ids: number[]) => {
      for (const x of ids) lists.get(id)!.delete(x);
      return undefined;
    },
    listContactsOfList: async (id: number) => [...(lists.get(id) ?? [])].map((x) => ({ id: x, work_email: `${x}@example.com` })),
    createCampaign: async (body: CampaignCreateBody) => ({ id: "camp-1", name: String(body.name), status: "draft", generation_status: "in_progress" }),
    updateCampaign: async (_id: string, fields: { brief?: string }) => {
      log.briefs.push(fields.brief ?? "");
      return {};
    },
    getCampaign: async (id: string) => ({ id, name: "x", status: "draft" }),
    listCampaignDocs: async () => [{ id: "o", file_type: "messaging_objections", status: "completed" }],
    getCampaignDoc: async (_c: string, id: string) => ({ id, content: docs.get(id) ?? "" }),
    updateCampaignDoc: async (_c: string, id: string, content: string) => {
      docs.set(id, content);
      return { id };
    },
    getCampaignFull: async () => ({ id: "c1", name: "SMB Campaign", status: "paused" }),
    listGlobalDocs: async () => [],
    createSequence: async (body: SequenceCreateBody, key?: string) => {
      if (key && seqKeys.has(key)) return { id: seqKeys.get(key)!, name: body.name, status: "draft" };
      const id = `seq-${seqs.size + 1}`;
      seqs.set(id, { listId: body.associated_list_id!, name: body.name, steps: (body.steps ?? []).map((s) => ({ ...s, id: `${id}-${s.step_order}` })) });
      if (key) seqKeys.set(key, id);
      log.sequences.push(body.name);
      return { id, name: body.name, status: "draft" };
    },
    updateSequenceStep: async (sid: string, stepId: string, patch: Record<string, unknown>) => {
      const s = seqs.get(sid)!;
      s.steps = s.steps.map((x) => (x.id === stepId ? { ...x, ...patch } : x));
      return {};
    },
    addSequenceSteps: async (sid: string, steps: SequenceStepConfig[]) => {
      seqs.get(sid)!.steps.push(...steps.map((s) => ({ ...s, id: `${sid}-${s.step_order}` })));
      return {};
    },
    updateSequence: async (sid: string, patch: { name?: string }) => {
      if (patch.name && patch.name !== seqs.get(sid)!.name) log.renames.push(patch.name);
      if (patch.name) seqs.get(sid)!.name = patch.name;
      return {};
    },
    getSequence: async (id: string) => detail(id, seqs.get(id)?.listId ?? null),
    getSequenceSteps: async (id: string) => ({ sequence_id: id, steps: seqs.get(id)?.steps ?? [] }),
    getSequenceChannels: async () => [],
    findContactByEmail: async () => null,
    estimateEmailDraft: async () => ({ estimated_credits: 9 }),
    generateEmailDraft: async () => ({ subject: "s", body: "b" }),
  };
  const wait = (sid: string) => Number(seqs.get(sid)!.steps.find((s) => s.step_order === 1)!.time_interval) / 86_400;
  const members = (id: number) => [...lists.get(id)!].sort();
  return { g8, log, seqs, wait, members, docs };
}

let dir: string;
let store: RunStore;
beforeEach(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), "replyiq-waves-"));
  store = createFileStore(dir);
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

async function savedRun(): Promise<Run> {
  const run = emptyRun("abcdefghijkl", { campaignId: "c1" }, new Date("2026-09-27T09:00:00Z"));
  run.status = "done";
  run.orgId = "o";
  run.steps = { load: "done", fetch: "done", classify: "done", themes: "done", tag: "done", resolve: "done", cards: "done" };
  run.source = { ...run.source, name: "SMB Campaign", campaignId: "c1", sequences: [{ id: "src-seq", name: "SMB sequence", status: "paused" }] };
  run.groups = [oooGroup()];
  await store.save(run);
  return run;
}

describe("out-of-office drafts in graph8: one Sequencer draft per return date", () => {
  it("drafts each date on its own list with step 1 waiting until they're back, then recounts without a model", async () => {
    await savedRun();
    const f = fakeGraph8();
    const { llm, calls } = fakeLlm();
    const at = (day: string) => () => new Date(`${day}T10:00:00Z`);
    const deps = { g8: f.g8, llm, model: "m", store, pollMs: 0, timeoutMs: 1_000, sleep: async () => {}, now: at(TODAY) };

    const d = await draftCampaign(deps, { runId: "abcdefghijkl", groupKey: "out_of_office" });
    expect(d.status).toBe("ready");
    const seq = d.sequence!;
    expect(seq.status).toBe("ready");
    expect(seq.verified).toBe(true);
    // The campaign's own list holds only the people already back; later dates get their own lists and drafts.
    expect(f.members(d.listId!)).toEqual([1]);
    expect(seq.waves!.map((w) => [w.slot, w.key, w.delayDays, w.listId, w.status])).toEqual([
      [0, "now", 0, 77, "ready"],
      [1, "2026-10-05", 8, 78, "ready"],
      [2, "2026-10-07", 10, 79, "ready"],
    ]);
    expect(f.members(78)).toEqual([3, 4]);
    expect(f.members(79)).toEqual([2]);
    expect([f.wait(seq.waves![0].sequenceId!), f.wait(seq.waves![1].sequenceId!), f.wait(seq.waves![2].sequenceId!)]).toEqual([0, 8, 10]);
    // Same checked steps in every draft; only step 1's wait differs.
    for (const w of seq.waves!) {
      const steps = f.seqs.get(w.sequenceId!)!.steps;
      expect(steps).toHaveLength(2);
      expect((steps[0].step_data as { instructions: string }).instructions).toBe(seq.instructions);
      expect((steps[1].step_data as { subject: string }).subject).toBe(STEP2.subject);
    }
    expect(seq.waves!.map((w) => w.sequenceName)).toEqual([
      "ReplyIQ · Out of office follow-up · back already · SMB Campaign",
      "ReplyIQ · Out of office follow-up · back by Sat 3 Oct · SMB Campaign",
      "ReplyIQ · Out of office follow-up · back by Tue 6 Oct · SMB Campaign",
    ]);
    expect(d.timingNote).toContain("2 people back by Sat 3 Oct: first email Mon 5 Oct");
    expect(f.docs.get("o")).toContain("Timed to their return dates");
    expect(await verifyRecordedSequence(f.g8, d)).toEqual([]);

    // Nine days later: the 5 Oct wave is back, so it joins "back already" and its draft is emptied, not left full.
    calls.length = 0;
    const r = await draftCampaign({ ...deps, now: at("2026-10-06") }, { runId: "abcdefghijkl", groupKey: "out_of_office", retime: true, sequenceOnly: true });
    expect(calls).toEqual([]); // no model: the same checked emails
    expect(f.log.sequences).toHaveLength(3); // no new sequence or list
    expect(f.log.lists).toHaveLength(3); // the campaign's own list and one per later date
    const waves = r.sequence!.waves!;
    expect(waves.map((w) => [w.slot, w.key, w.delayDays, w.status])).toEqual([
      [0, "now", 0, "ready"],
      [2, "2026-10-07", 1, "ready"],
      [1, "", 0, "retired"],
    ]);
    expect(f.members(77)).toEqual([1, 3, 4]);
    expect(f.members(78)).toEqual([]);
    expect(f.wait(waves[1].sequenceId!)).toBe(1);
    expect(f.seqs.get(waves[2].sequenceId!)!.name).toMatch(/not needed \(empty list\)/);
    expect(r.timingNote).toContain("3 people back already");
    expect(f.log.briefs.at(-1)).toContain("set on Tue 6 Oct");
    expect(r.sequence!.verified).toBe(true);
    expect(await verifyRecordedSequence(f.g8, r)).toEqual([]);

    // A new later date reuses the spare draft instead of making another one.
    const run = (await store.load("abcdefghijkl"))!;
    const g = run.groups[0];
    g.replies.push(ooo("e", 5, "until October 20"));
    g.draft!.audience.push({ contactId: 5, email: "e@example.com", threadId: "e" });
    await store.save(run);
    const r2 = await draftCampaign({ ...deps, now: at("2026-10-06") }, { runId: "abcdefghijkl", groupKey: "out_of_office", retime: true, sequenceOnly: true });
    expect(f.log.sequences).toHaveLength(3);
    expect(r2.sequence!.waves!.map((w) => [w.slot, w.key, w.status])).toEqual([
      [0, "now", "ready"],
      [2, "2026-10-07", "ready"],
      [1, "2026-10-21", "ready"],
    ]);
    expect(f.members(78)).toEqual([5]);
    expect(f.wait(r2.sequence!.waves![2].sequenceId!)).toBe(15);
    expect(await verifyRecordedSequence(f.g8, r2)).toEqual([]);
  });

  it("a newer run taking over a one-sequence draft (made before the split) splits it: same campaign and sequence, one new list per later date", async () => {
    // The earlier run's draft: one list with everyone and one sequence that would email them all on launch.
    await savedRun();
    const f = fakeGraph8();
    const deps = { g8: f.g8, llm: fakeLlm().llm, model: "m", store, pollMs: 0, timeoutMs: 1_000, sleep: async () => {}, now: () => new Date(`${TODAY}T10:00:00Z`) };
    const first = await draftCampaign(deps, { runId: "abcdefghijkl", groupKey: "out_of_office" });
    await f.g8.addContactsToList(first.listId!, [2, 3, 4]); // as the old code left it
    const old = { ...first, sequence: { ...first.sequence!, waves: undefined, wavesCountedOn: undefined } };
    for (const w of first.sequence!.waves!.slice(1)) f.seqs.delete(w.sequenceId!);

    // A newer run of the same campaign takes it over (the service copies the draft onto the new run first).
    const newer = await savedRun();
    newer.id = "mnopqrstuvwx";
    newer.groups[0].draft = { ...old, status: "drafting", adoptedFrom: "abcdefghijkl" };
    await store.save(newer);
    const campaignsBefore = f.log.briefs.length;
    const d = await draftCampaign(deps, { runId: "mnopqrstuvwx", groupKey: "out_of_office", adopt: true });
    expect(d.status).toBe("ready");
    expect(d.campaignId).toBe(first.campaignId);
    expect(d.sequence!.sequenceId).toBe(first.sequence!.sequenceId);
    expect(f.members(d.listId!)).toEqual([1]); // the old list now holds only the people already back
    expect(d.sequence!.waves!.map((w) => [w.slot, w.key, w.delayDays, w.status])).toEqual([
      [0, "now", 0, "ready"],
      [1, "2026-10-05", 8, "ready"],
      [2, "2026-10-07", 10, "ready"],
    ]);
    expect(f.log.briefs.length).toBeGreaterThan(campaignsBefore);
    expect(await verifyRecordedSequence(f.g8, d)).toEqual([]);
  });

  it("the read-back names a wait graph8 didn't keep and a wave list that drifted", async () => {
    await savedRun();
    const f = fakeGraph8();
    const deps = { g8: f.g8, llm: fakeLlm().llm, model: "m", store, pollMs: 0, timeoutMs: 1_000, sleep: async () => {}, now: () => new Date(`${TODAY}T10:00:00Z`) };
    const d = await draftCampaign(deps, { runId: "abcdefghijkl", groupKey: "out_of_office" });
    const later = d.sequence!.waves![2];
    f.seqs.get(later.sequenceId!)!.steps[0].time_interval = 0;
    await f.g8.addContactsToList(later.listId!, [9]);
    const problems = (await verifyRecordedSequence(f.g8, d)).join(" | ");
    expect(problems).toMatch(/back by Tue 6 Oct: step 1 waits 0 day\(s\) in graph8, recorded 10 day\(s\)/);
    expect(problems).toMatch(/back by Tue 6 Oct: list 79 holds 2 contact\(s\), recorded 1/);
  });

  it("recounting is refused for groups that aren't timed by return date", async () => {
    const run = await savedRun();
    run.groups[0].key = "timing_not_now";
    await store.save(run);
    const f = fakeGraph8();
    const deps = { g8: f.g8, llm: null, model: "m", store, pollMs: 0, timeoutMs: 1_000, sleep: async () => {} };
    await expect(draftCampaign(deps, { runId: "abcdefghijkl", groupKey: "timing_not_now", retime: true, sequenceOnly: true })).rejects.toThrow(/only an out-of-office draft/);
  });
});
