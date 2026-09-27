import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { G8Client, Thread } from "../lib/g8";
import { WriteNotAllowedError } from "../lib/g8";
import { createFileStore, type RunStore } from "../lib/store";
import { emptyRun } from "../lib/pipeline/runPipeline";
import { claim, resetJobs } from "../lib/server/jobs";
import { ApiError, getRunView, listRunSummaries, runLearnings, startDraft, startRun, toApiError, toRunView, type ServiceDeps } from "../lib/server/service";
import { runLog } from "../lib/ui/runLog";
import { fakeLlm, label } from "./helpers";

const thread = (id: string, text: string, contactId: number): Thread => ({
  id,
  subject: `Re: ${id}`,
  sequenceId: "seqA",
  sequenceName: null,
  mailbox: "a@example.com",
  contact: { id: contactId, email: `${id}@example.com`, name: `Person ${id}`, company: `Co ${id}` },
  messages: [
    { messageId: null, from: "me@example.com", to: [], content: "<p>pitch</p>", responder: "USER", date: "2026-09-24T10:00:00Z", isDraft: false },
    { messageId: null, from: `${id}@example.com`, to: [], content: text, responder: "OTHER", date: "2026-09-24T11:00:00Z", isDraft: false },
  ],
  tags: [],
  summary: null,
  source: "emails.search",
});

const THREADS = [thread("t1", "What is the pricing for a team of ten?", 101), thread("t2", "What does it cost per seat, roughly?", 102), thread("t3", "Please remove me from your list", 103)];

function fakeOrg(overrides: Partial<Record<keyof G8Client, unknown>> = {}): G8Client {
  return {
    whoAmI: async () => ({ org_id: "org_test" }),
    listCampaigns: async () => [],
    getCampaignFull: async () => ({ id: "c1", name: "C", status: null }),
    getSequence: async (id: string) => ({ id, name: "[DEMO] Seq A", status: "paused", associated_list_id: 100 }),
    getSequenceChannels: async () => [],
    listThreads: async () => THREADS,
    findContactByEmail: async () => null,
    listGlobalDocs: async () => [],
    getSuppression: async (id: number) => ({ contact_id: id, is_suppressed: false, active_channels: [], suppressions: [] }),
    writePolicy: async () => ({ allowed: true, via: "org_allowlist", orgId: "org_test" }),
    assertWriteAllowed: async () => ({ allowed: true, via: "org_allowlist", orgId: "org_test" }),
    getUsage: async () => ({ available_credits: 900 }),
    ...overrides,
  } as unknown as G8Client;
}

const categoryFor = (text: string) => (/remove/i.test(text) ? "unsubscribe" : "pricing_request");

let dir: string;
let store: RunStore;
let tasks: (() => Promise<void>)[];

function deps(g8 = fakeOrg()): ServiceDeps {
  const { llm } = fakeLlm((items) => items.map((i) => label(i.id, categoryFor(i.latest_prospect_reply), i.latest_prospect_reply)));
  return {
    g8,
    llm,
    store,
    env: { OPENAI_CLASSIFY_MODEL: "m", OPENAI_REASON_MODEL: "m", MIN_GROUP_SIZE: 2, ENABLE_LAUNCH: false },
    schedule: (t) => void tasks.push(t),
  };
}
const drain = async () => {
  while (tasks.length) await tasks.shift()!();
};

beforeEach(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), "replyiq-api-"));
  store = createFileStore(dir);
  tasks = [];
  resetJobs();
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("startRun", () => {
  it("rejects a body without exactly one source", async () => {
    await expect(startRun(deps(), {})).rejects.toThrow();
    const err = await startRun(deps(), { sequenceId: "a", campaignId: "b" }).catch((e) => toApiError(e));
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).status).toBe(400);
  });

  it("saves the run before the pipeline starts, then the pipeline fills it in the background", async () => {
    const d = deps();
    const { runId } = await startRun(d, { sequenceId: "seqA", writeTags: false });
    const early = await getRunView(d, runId);
    expect(early.status).toBe("running");
    expect(early.job?.kind).toBe("pipeline");
    expect(early.interrupted).toBe(false);

    await drain();
    const done = await getRunView(d, runId);
    expect(done.status).toBe("done");
    expect(done.job).toBeNull();
    expect(Date.parse(done.finishedAt!)).toBeGreaterThanOrEqual(Date.parse(done.createdAt)); // drafts later move updatedAt, not this
    expect(done.otherOrg).toBe(false);
    expect(done.source.name).toBe("[DEMO] Seq A");
    expect(done.groups.map((g) => g.key).sort()).toEqual(["pricing_request", "unsubscribe"]);
    // The view never ships full conversations.
    const reply = done.groups[0].replies[0] as unknown as Record<string, unknown>;
    expect(reply.conversation).toBeUndefined();
    expect(reply.messages).toBe(2);
  });
});

describe("getRunView", () => {
  it("404s unknown and malformed ids without touching the disk path", async () => {
    for (const id of ["abcdefabcdef", "../../etc/passwd"]) {
      const err = await getRunView(deps(), id).catch((e) => e);
      expect(err).toBeInstanceOf(ApiError);
      expect(err.status).toBe(404);
    }
  });

  it("reports a run that says it's running but has no job as interrupted", async () => {
    const run = emptyRun(store.newRunId(), { sequenceId: "seqA" }, new Date());
    await store.save(run);
    expect(toRunView(run).interrupted).toBe(true);
    claim(run.id, "pipeline");
    expect(toRunView(run).interrupted).toBe(false);
  });
});

describe("startDraft guards", () => {
  async function finishedRun(d: ServiceDeps) {
    const { runId } = await startRun(d, { sequenceId: "seqA", writeTags: false });
    await drain();
    return runId;
  }

  it("refuses unknown groups, groups that never get a follow-up, and runs with a job", async () => {
    const d = deps();
    const runId = await finishedRun(d);
    expect((await startDraft(d, runId, "nope", {}).catch((e) => e)).status).toBe(404);
    expect((await startDraft(d, runId, "competitor_locked_in", {}).catch((e) => e)).status).toBe(404); // not in this run
    expect((await startDraft(d, runId, "unsubscribe", {}).catch((e) => e)).status).toBe(409);
    expect((await startDraft(d, runId, "pricing_request", { action: "patch" }).catch((e) => e)).status).toBe(409); // nothing to patch yet
    claim(runId, "learnings");
    expect((await startDraft(d, runId, "pricing_request", {}).catch((e) => e)).code).toBe("busy");
    expect(tasks).toHaveLength(0);
  });

  it("applies the draftability preflight to direct requests (nothing scheduled)", async () => {
    const d = { ...deps(), env: { ...deps().env, MIN_GROUP_SIZE: 3 } };
    const runId = await finishedRun(d);
    const err = await startDraft(d, runId, "pricing_request", {}).catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(409);
    expect(err.message).toMatch(/at least 3 eligible contacts/);
    expect(tasks).toHaveLength(0);
  });

  it("maps a refused write to 403 before anything is scheduled", async () => {
    const d = deps(
      fakeOrg({
        assertWriteAllowed: async () => {
          throw new WriteNotAllowedError("org not allowlisted");
        },
      }),
    );
    const runId = await finishedRun(d);
    const err = toApiError(await startDraft(d, runId, "pricing_request", {}).catch((e) => e));
    expect(err.status).toBe(403);
    expect(tasks).toHaveLength(0);
  });
});

describe("learnings and summaries", () => {
  it("propose on a run without Answer Cards is a 409, and releases the run", async () => {
    const d = deps();
    const { runId } = await startRun(d, { sequenceId: "seqA", writeTags: false });
    await drain();
    const err = toApiError(await runLearnings(d, runId, { action: "propose" }).catch((e) => e));
    expect(err.status).toBe(409);
    expect((await getRunView(d, runId)).job).toBeNull();
    expect(toApiError(await runLearnings(d, runId, { action: "nope" }).catch((e) => e)).status).toBe(400);
  });

  it("won't propose over learnings that are saved in Studio (the record would stop matching Studio)", async () => {
    const d = deps();
    const { runId } = await startRun(d, { sequenceId: "seqA", writeTags: false });
    await drain();
    const run = (await store.load(runId))!;
    await store.save({ ...run, learnings: { status: "applied", proposedAt: run.createdAt, appliedAt: run.createdAt, proposals: [] } });
    const err = await runLearnings(d, runId, { action: "propose" }).catch((e) => e);
    expect(err).toMatchObject({ status: 409, code: "not_possible" });
    expect(err.message).toMatch(/take them out first/);
    expect((await store.load(runId))!.learnings!.status).toBe("applied");
  });

  it("saving a run's learnings marks an older run's block for the same campaign as replaced", async () => {
    const d = deps();
    const older = await startRun(d, { sequenceId: "seqA", writeTags: false }).then(async ({ runId }) => (await drain(), runId));
    const newer = await startRun(d, { sequenceId: "seqA", writeTags: false }).then(async ({ runId }) => (await drain(), runId));
    const proposal = { docId: "mh", docName: "Messaging House", kind: "messaging" as const, key: "seqA", section: "S", action: "append" as const };
    const applied = { status: "applied" as const, proposedAt: "t", appliedAt: "t", proposals: [proposal] };
    await store.save({ ...(await store.load(older))!, learnings: applied });
    await store.save({ ...(await store.load(newer))!, learnings: { status: "proposed", proposedAt: "t", proposals: [proposal] } });
    const studio = new Map([["mh", { id: "mh", displayName: "Messaging House", content: "Company text.", version: 3 }]]);
    const g8 = fakeOrg({
      getGlobalDoc: async (id: string) => ({ ...studio.get(id)! }),
      updateGlobalDoc: async (id: string, content: string) => void studio.set(id, { ...studio.get(id)!, content, version: studio.get(id)!.version + 1 }),
    });
    expect((await runLearnings(deps(g8), newer, { action: "apply" })).status).toBe("applied");
    expect((await store.load(older))!.learnings).toMatchObject({ status: "replaced", replacedBy: newer });
    // The older run can no longer take out (or re-save) what is now the newer run's block.
    for (const action of ["remove", "apply"]) expect(await runLearnings(deps(g8), older, { action }).catch((e) => e)).toMatchObject({ status: 409, code: "not_possible" });
  });

  it("a pipeline crash (the run can't be saved) marks the run failed instead of leaving it running", async () => {
    const d = deps();
    // The pipeline's final save fails (e.g. a Windows file lock that outlasts the retries).
    const flaky: RunStore = {
      ...store,
      save: async (r) => {
        if (r.status === "done") throw new Error("EPERM: operation not permitted, rename");
        return store.save(r);
      },
    };
    const { runId } = await startRun({ ...d, store: flaky }, { sequenceId: "seqA", writeTags: false });
    await drain();
    const run = await getRunView(d, runId);
    expect(run.status).toBe("failed");
    expect(run.errors.join()).toMatch(/run stopped: .*EPERM/);
    expect(run.job).toBeNull();
  });

  it("summarises recent runs", async () => {
    const d = deps();
    await startRun(d, { sequenceId: "seqA", writeTags: false });
    await drain();
    const [s] = await listRunSummaries(d);
    expect(s).toMatchObject({ status: "done", name: "[DEMO] Seq A", replies: 3, job: null });
    expect(s.draftable).toBe(1); // pricing (2 eligible); unsubscribe never
  });
});

describe("runs saved with a key for another graph8 org", () => {
  async function runIn(d: ServiceDeps, orgId: string) {
    const { runId } = await startRun(d, { sequenceId: "seqA", writeTags: false });
    await drain();
    await store.save({ ...(await store.load(runId))!, orgId });
    return runId;
  }

  it("can be read, but never drafted or used to change Studio, and leave the recent list", async () => {
    const d = deps();
    const runId = await runIn(d, "org_other");
    const view = await getRunView(d, runId);
    expect(view.otherOrg).toBe(true);
    expect(view.groups.find((g) => g.key === "pricing_request")!.draftable).toMatchObject({ ok: false, reason: expect.stringMatching(/different graph8 org/) });
    for (const action of ["create", "patch", "previews"]) expect((await startDraft(d, runId, "pricing_request", { action }).catch((e) => e)).code).toBe("other_org");
    for (const action of ["propose", "apply", "remove"]) expect((await runLearnings(d, runId, { action }).catch((e) => e)).code).toBe("other_org");
    expect(tasks).toHaveLength(0);
    expect(await listRunSummaries(d)).toEqual([]);
  });

  it("hides nothing when graph8 can't say which org the key opens", async () => {
    const d = deps();
    await runIn(d, "org_other");
    await runIn(d, "org_test");
    const offline = deps(
      fakeOrg({
        writePolicy: async () => {
          throw new Error("graph8 unreachable");
        },
      }),
    );
    expect(await listRunSummaries(offline)).toHaveLength(2);
    expect(await listRunSummaries(d)).toHaveLength(1);
  });
});

describe("runLog", () => {
  it("describes a finished run from its real state", async () => {
    const d = deps();
    const { runId } = await startRun(d, { sequenceId: "seqA", writeTags: false });
    await drain();
    const lines = runLog(await getRunView(d, runId));
    const text = lines.map((l) => l.text).join("\n");
    expect(text).toContain("3 prospect replies");
    expect(text).toContain("Pricing request · 2");
    expect(text).toContain("Tags not written");
    expect(lines.at(-1)?.text).toContain("Run complete");
  });
});
