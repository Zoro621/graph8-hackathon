// The app's API, as plain functions over the backend library. Route handlers (app/api/*) only parse the
// request and call these; every dependency is passed in, so tests run them with a fake org and fake LLM.
import { G8Error } from "@graph8/sdk";
import { z } from "zod";
import type { G8Client } from "../g8";
import { describeError, WriteNotAllowedError } from "../g8";
import type { Llm } from "../llm";
import type { RunStore } from "../store";
import { CATEGORY_KEYS, allowsFollowUpCampaign, categoryInfo } from "../taxonomy";
import type { CampaignDraft, Category, Group, Run, SourceSummary, StudioLearnings } from "../types";
import { emptyRun, runPipeline } from "../pipeline/runPipeline";
import { discoverSources } from "../pipeline/sources";
import { DraftError, draftCampaign, nameKey, parsePersonNames } from "../pipeline/draftCampaign";
import { enrichAndRecount } from "../pipeline/referralEnrich";
import { toPlainText } from "../pipeline/fetchReplies";
import { LearningsError, applyLearnings, proposeLearnings, removeLearnings } from "../pipeline/studioLearnings";
import {
  OTHER_ORG_REASON,
  type Draftability,
  type GroupView,
  type JobView,
  type LearningsView,
  type OriginalView,
  type PreviousDraft,
  type RunSummary,
  type RunView,
  type StatusView,
  type StepView,
} from "../api-types";
import { activeJob, memoryJobs, type JobLock } from "./jobs";

export interface ServiceDeps {
  g8: G8Client;
  llm: Llm;
  store: RunStore;
  env: {
    OPENAI_CLASSIFY_MODEL: string;
    OPENAI_REASON_MODEL: string;
    MIN_GROUP_SIZE: number;
    ENABLE_LAUNCH: boolean;
    G8_SEQUENCE_OWNER_EMAIL?: string;
  };
  /** The one-job-per-run lock: in-process locally (default), in Redis on serverless hosts. */
  jobs?: JobLock;
  /** Runs work after the response is sent (next/server `after` in routes; awaited in tests). */
  schedule: (task: () => Promise<void>) => void;
  log?: (msg: string) => void;
}

/** An error with an HTTP status, mapped to `{ error: { code, message } }` by the route helper. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** Maps library errors to HTTP errors. */
export function toApiError(err: unknown): ApiError {
  if (err instanceof ApiError) return err;
  if (err instanceof z.ZodError) return new ApiError(400, "invalid_request", err.issues.map((i) => `${i.path.join(".") || "body"}: ${i.message}`).join("; "));
  if (err instanceof WriteNotAllowedError) return new ApiError(403, "write_not_allowed", err.message);
  if (err instanceof DraftError || err instanceof LearningsError) return new ApiError(409, "not_possible", err.message);
  if (err instanceof G8Error) return new ApiError(502, "graph8_error", describeError(err));
  return new ApiError(500, "internal_error", describeError(err));
}

// ---------- status ----------

// graph8's usage endpoint can take many seconds; the balance is cached briefly so pages show it at once.
const CREDITS_TTL_MS = 60_000;
const creditsCache = new WeakMap<object, { at: number; credits: number }>(); // per graph8 client
async function creditsLeft(deps: ServiceDeps): Promise<number | null> {
  const hit = creditsCache.get(deps.g8);
  if (hit && Date.now() - hit.at < CREDITS_TTL_MS) return hit.credits;
  const usage = await deps.g8.getUsage().catch(() => null);
  const credits = usage ? (usage.available_credits ?? usage.credits ?? null) : null;
  if (credits != null) creditsCache.set(deps.g8, { at: Date.now(), credits });
  return credits ?? hit?.credits ?? null;
}

export async function getStatus(deps: ServiceDeps): Promise<StatusView> {
  const base = { configured: true, missing: [], launchEnabled: deps.env.ENABLE_LAUNCH, minGroupSize: deps.env.MIN_GROUP_SIZE };
  try {
    const [write, credits] = await Promise.all([deps.g8.writePolicy(), creditsLeft(deps)]);
    return { ...base, write, credits };
  } catch (err) {
    return { ...base, error: describeError(err) };
  }
}

// ---------- sources ----------

const SOURCES_TTL_MS = 60_000;
let sourcesCache: { at: number; value: Promise<SourceSummary[]> } | null = null;

/** Every sequence with its reply count. Discovery makes several graph8 calls, so results are cached briefly. */
export async function listSources(deps: ServiceDeps, opts: { refresh?: boolean } = {}): Promise<SourceSummary[]> {
  if (!opts.refresh && sourcesCache && Date.now() - sourcesCache.at < SOURCES_TTL_MS) return sourcesCache.value;
  const value = discoverSources(deps.g8);
  sourcesCache = { at: Date.now(), value };
  value.catch(() => (sourcesCache = null)); // never cache a failure
  return value;
}

export function clearSourcesCache() {
  sourcesCache = null;
}

// ---------- runs ----------

const lock = (deps: ServiceDeps) => deps.jobs ?? memoryJobs;

/** The org the API key opens (the client caches it after the first call); undefined when graph8 can't be reached. */
async function keyOrg(deps: ServiceDeps): Promise<string | undefined> {
  try {
    return (await deps.g8.writePolicy()).orgId;
  } catch {
    return undefined;
  }
}

/** A run saved with another key belongs to another org: its contacts, replies and campaigns don't exist in this one. */
export const fromOtherOrg = (run: Pick<Run, "orgId">, org: string | undefined) => Boolean(org && run.orgId && run.orgId !== org);

async function assertSameOrg(deps: ServiceDeps, run: Run) {
  if (fromOtherOrg(run, await keyOrg(deps))) throw new ApiError(409, "other_org", `${OTHER_ORG_REASON}. It can be read, but not drafted or used to change Studio.`);
}

async function loadRun(deps: ServiceDeps, id: string): Promise<Run> {
  if (!/^[a-z0-9]{12}$/.test(id)) throw new ApiError(404, "run_not_found", `Run ${id} not found`);
  const run = await deps.store.load(id);
  if (!run) throw new ApiError(404, "run_not_found", `Run ${id} not found`);
  return run;
}

export const StartRunBody = z
  .object({
    sequenceId: z.string().min(1).max(100).optional(),
    campaignId: z.string().min(1).max(100).optional(),
    writeTags: z.boolean().default(true),
  })
  .refine((b) => Boolean(b.sequenceId) !== Boolean(b.campaignId), { message: "give exactly one of sequenceId or campaignId" });

/** Saves an empty run right away (so the UI can poll it), then runs the pipeline in the background. */
export async function startRun(deps: ServiceDeps, body: unknown): Promise<{ runId: string }> {
  const input = StartRunBody.parse(body);
  const selector = input.campaignId ? { campaignId: input.campaignId } : { sequenceId: input.sequenceId! };
  const runId = deps.store.newRunId();
  await deps.store.save(emptyRun(runId, selector, new Date()));
  await lock(deps).claim(runId, "pipeline");
  deps.schedule(async () => {
    try {
      await runPipeline(
        {
          g8: deps.g8,
          llm: deps.llm,
          store: deps.store,
          classifyModel: deps.env.OPENAI_CLASSIFY_MODEL,
          themeModel: deps.env.OPENAI_REASON_MODEL,
          cardModel: deps.env.OPENAI_REASON_MODEL,
          log: deps.log,
        },
        { selector, runId, writeTags: input.writeTags },
      );
    } catch (err) {
      // runPipeline records step failures itself; this only catches a crash (e.g. the run file can't be saved).
      await recordRunFailure(deps, runId, describeError(err)).catch(() => {});
    } finally {
      await lock(deps).release(runId);
    }
  });
  return { runId };
}

async function recordRunFailure(deps: ServiceDeps, runId: string, error: string) {
  const run = await deps.store.load(runId);
  if (!run || run.status !== "running") return;
  const now = new Date().toISOString();
  run.status = "failed";
  run.errors.push(`run stopped: ${error}`);
  run.finishedAt = now;
  run.updatedAt = now;
  await deps.store.save(run);
}

const stripLearnings = (l: StudioLearnings | undefined): LearningsView | undefined =>
  l && {
    ...l,
    proposals: l.proposals.map((p) => {
      const { backup, ...rest } = p;
      void backup; // document backups stay on the server
      return rest;
    }),
  };

/**
 * Same rules as draftCampaign: a follow-up category, a resolved audience, and at least `min` targets.
 * Referrals target the people named in the replies (looked up in the CRM at draft time), not the sender.
 * The draft looks each name up within that reply's company, so a name counts once per company. This is an
 * upper bound: the draft still enforces the minimum on the contacts it actually finds.
 */
export function draftability(run: Pick<Run, "steps" | "orgId">, g: Group, min: number, org?: string): Draftability {
  const referral = g.key === "referral_wrong_person";
  // Referrals: the run's CRM lookup when it ran (who can actually be reached), else the names as an upper bound.
  const named = referral ? new Set(g.replies.flatMap((r) => parsePersonNames(r.referredName).map((n) => `${nameKey(n)}|${nameKey(r.company ?? "")}`))).size : 0;
  const targets = referral ? (g.referralLookup?.found ?? named) : g.eligible.length;
  if (!allowsFollowUpCampaign(g.key)) return { ok: false, targets, reason: `${g.label} never gets a follow-up campaign` };
  if (fromOtherOrg(run, org)) return { ok: false, targets, reason: OTHER_ORG_REASON };
  if (run.steps.resolve !== "done") return { ok: false, targets, reason: "The audience has not been checked yet" };
  if (targets < min) {
    const reason = !referral
      ? `Needs at least ${min} eligible contacts; this group has ${targets}`
      : g.referralLookup
        ? `Needs at least ${min} named people in the CRM; ${targets} of the ${g.referralLookup.named} named are there (the rest would need an enrichment lookup, which costs credits and needs approval)`
        : `Needs at least ${min} named people to look up; the replies name ${targets}`;
    return { ok: false, targets, reason };
  }
  return { ok: true, targets };
}

/** The run as the UI needs it: no full conversations, no document backups, plus live job state. */
export function toRunView(run: Run, minGroup = 2, org?: string, previous: Partial<Record<Category, PreviousDraft>> = {}, job: JobView | null = activeJob(run.id)): RunView {
  const groups: GroupView[] = run.groups.map((g) => ({
    ...g,
    replies: g.replies.map(({ conversation, ...r }) => ({ ...r, messages: conversation.length })),
    draftable: draftability(run, g, minGroup, org),
    ...(previous[g.key] ? { previousDraft: previous[g.key] } : {}),
  }));
  const working = run.status === "running" || run.groups.some((g) => g.draft?.status === "drafting");
  return { ...run, groups, learnings: stripLearnings(run.learnings), job, interrupted: working && !job, otherOrg: fromOtherOrg(run, org) };
}

/** Runs of the same campaign (or standalone sequence) are one source: their drafts can be taken over. */
export const sourceKey = (run: Pick<Run, "source">) => run.source.campaignId ?? ("sequenceId" in run.source.selector ? run.source.selector.sequenceId : "");

/**
 * For each group of `run` without a draft of its own: the newest earlier run's draft of that group for the
 * same source (same org, still its own, with a campaign), which this run can take over.
 */
export async function previousDrafts(deps: ServiceDeps, run: Run): Promise<Partial<Record<Category, PreviousDraft>>> {
  const open = run.groups.filter((g) => !g.draft?.campaignId && allowsFollowUpCampaign(g.key)).map((g) => g.key);
  if (!open.length || run.status !== "done" || !sourceKey(run)) return {};
  const out: Partial<Record<Category, PreviousDraft>> = {};
  for (const { id } of await deps.store.list()) {
    if (id === run.id) continue;
    const other = await deps.store.load(id).catch(() => null);
    if (!other || other.orgId !== run.orgId || sourceKey(other) !== sourceKey(run)) continue;
    for (const key of open) {
      const d = other.groups.find((g) => g.key === key)?.draft;
      if (!d?.campaignId || !d.listId || d.supersededBy) continue;
      if (out[key] && out[key]!.updatedAt >= d.updatedAt) continue;
      out[key] = { runId: other.id, campaignId: d.campaignId, ...(d.campaignName ? { campaignName: d.campaignName } : {}), status: d.status, updatedAt: d.updatedAt, audience: d.audience.length };
    }
  }
  return out;
}

export async function getRunView(deps: ServiceDeps, id: string): Promise<RunView> {
  // The lock is read BEFORE the run file. A job releases its lock only after its last save, so reading the
  // lock first can never pair a "drafting" file with "no job"; the other order did (the scan of earlier runs
  // between the two reads took about a second), and the page then froze on a false "interrupted".
  const job = await lock(deps).active(id);
  const run = await loadRun(deps, id);
  const org = await keyOrg(deps);
  return toRunView(run, deps.env.MIN_GROUP_SIZE, org, fromOtherOrg(run, org) ? {} : await previousDrafts(deps, run), job);
}

/** Recent runs of the org the key opens. Runs saved with another key stay reachable by URL, read-only. */
export async function listRunSummaries(deps: ServiceDeps, limit = 12): Promise<RunSummary[]> {
  const org = await keyOrg(deps);
  const runs: Run[] = [];
  for (const r of await deps.store.list()) {
    const run = await deps.store.load(r.id).catch(() => null);
    if (run && !fromOtherOrg(run, org)) runs.push(run);
    if (runs.length === limit) break;
  }
  const jobsById = new Map(await Promise.all(runs.map(async (r) => [r.id, await lock(deps).active(r.id)] as const)));
  return runs.map((r) => ({
      id: r.id,
      createdAt: r.createdAt,
      status: r.status,
      name: r.source.name,
      replies: r.counts.prospectReplies,
      groups: r.groups.map((g) => ({ key: g.key, count: g.replies.length })),
      draftable: r.groups.filter((g) => draftability(r, g, deps.env.MIN_GROUP_SIZE).ok).length,
      drafts: r.groups.filter((g) => g.draft?.status === "ready").length,
      job: jobsById.get(r.id) ?? null,
    }));
}

// ---------- drafts ----------

export const DraftBody = z
  .object({
    /**
     * create: list + Studio campaign + follow-up sequence. patch: add the Answer Card to docs that were still generating.
     * previews: graph8 drafts step 1 for a few contacts. rewrite: re-write the follow-up emails (and the channel plan)
     * in the same Sequencer draft. adopt: take over an earlier run's draft of this group (`fromRunId`) instead of creating one.
     */
    action: z.enum(["create", "patch", "previews", "rewrite", "adopt", "enrich"]).default("create"),
    previews: z.number().int().min(0).max(3).default(0),
    fromRunId: z.string().regex(/^[a-z0-9]{12}$/).optional(),
  })
  .refine((b) => (b.action === "adopt") === Boolean(b.fromRunId), { message: "fromRunId is required for adopt, and only for adopt" });

const DRAFT_WAIT_MS = 150_000; // keeps a draft inside a 5-minute function; unfinished docs are patched later

export async function startDraft(deps: ServiceDeps, runId: string, key: string, body: unknown): Promise<{ runId: string; group: Category }> {
  const input = DraftBody.parse(body ?? {});
  if (!(CATEGORY_KEYS as string[]).includes(key)) throw new ApiError(404, "group_not_found", `Unknown group ${key}`);
  const groupKey = key as Category;
  const run = await loadRun(deps, runId);
  const group = run.groups.find((g) => g.key === groupKey);
  if (!group) throw new ApiError(404, "group_not_found", `This run has no "${key}" group`);
  await assertSameOrg(deps, run);
  if (!allowsFollowUpCampaign(groupKey))
    throw new ApiError(409, "not_possible", categoryInfo(groupKey).followUp === "rep" ? `"${group.label}" goes to a rep, not a follow-up campaign` : `"${group.label}" is never re-contacted, so it gets no follow-up campaign`);
  if (run.steps.resolve !== "done") throw new ApiError(409, "not_possible", "The run's audience was not resolved; run the analysis again first");
  if (group.draft?.supersededBy) throw new ApiError(409, "taken_over", `A newer run (${group.draft.supersededBy}) took this draft over; continue there`);
  if (input.action === "enrich") {
    // Referrals only: look the named people up in graph8 (paid, ~2-4 credits each) and add them to the CRM, so
    // the draft has someone to reach. Approved by the hold on the page; nothing is added to a list here.
    if (groupKey !== "referral_wrong_person") throw new ApiError(409, "not_possible", "Only referral groups have named people to look up");
    await assertSameOrg(deps, run);
    await deps.g8.assertWriteAllowed();
    if (!(await lock(deps).claim(runId, "enrich", groupKey))) throw new ApiError(409, "busy", "Another job is already working on this run");
    deps.schedule(async () => {
      try {
        const result = await enrichAndRecount(deps.g8, group, deps.log);
        deps.log?.(`  referral: ${result.created.length} contact(s) added after ${result.lookups} lookup(s)`);
      } catch (err) {
        group.referralLookup = { found: group.referralLookup?.found ?? 0, named: group.referralLookup?.named ?? 0, notes: [`lookup failed: ${describeError(err)}`], enrichedAt: new Date().toISOString() };
      } finally {
        run.updatedAt = new Date().toISOString();
        await deps.store.save(run).catch(() => {});
        await lock(deps).release(runId);
      }
    });
    return { runId, group: groupKey };
  }
  const fresh = input.action === "create" || input.action === "adopt";
  if (!fresh && !group.draft?.campaignId) throw new ApiError(409, "not_possible", "Create the draft first");
  if (input.action === "rewrite" && group.draft?.sequence?.status !== "ready") throw new ApiError(409, "not_possible", "This draft has no follow-up emails to rewrite yet");
  if (input.action === "adopt" && group.draft?.campaignId) throw new ApiError(409, "not_possible", "This run already has its own draft for this group");
  // Same preflight the UI shows, so a direct request can't start a draft that is bound to fail.
  if (fresh) {
    const d = draftability(run, group, deps.env.MIN_GROUP_SIZE);
    if (!d.ok) throw new ApiError(409, "not_possible", d.reason ?? "This group can't be drafted");
  }
  const earlier = input.action === "adopt" ? await takeoverSource(deps, run, groupKey, input.fromRunId!) : null;
  await deps.g8.assertWriteAllowed();
  if (!(await lock(deps).claim(runId, "draft", groupKey))) throw new ApiError(409, "busy", "Another job is already working on this run");
  if (earlier) {
    // The earlier run is written too (marked taken over): hold its lock for that write.
    if (!(await lock(deps).claim(earlier.run.id, "draft", groupKey))) {
      await lock(deps).release(runId);
      throw new ApiError(409, "busy", "A job is working on the earlier run; try again when it finishes");
    }
    try {
      const at = new Date().toISOString();
      group.draft = { ...earlier.draft, status: "drafting", adoptedFrom: earlier.run.id, supersededBy: undefined, strategy: undefined, error: undefined, warnings: [], updatedAt: at };
      run.updatedAt = at;
      await deps.store.save(run);
      earlier.group.draft = { ...earlier.draft, supersededBy: run.id, updatedAt: at };
      earlier.run.updatedAt = at;
      await deps.store.save(earlier.run);
    } catch (err) {
      await lock(deps).release(runId);
      throw err;
    } finally {
      await lock(deps).release(earlier.run.id);
    }
  }

  deps.schedule(async () => {
    try {
      await draftCampaign(
        {
          g8: deps.g8,
          llm: deps.llm,
          model: deps.env.OPENAI_REASON_MODEL,
          store: deps.store,
          minAudience: deps.env.MIN_GROUP_SIZE,
          timeoutMs: DRAFT_WAIT_MS,
          ownerEmail: deps.env.G8_SEQUENCE_OWNER_EMAIL,
          log: deps.log,
        },
        {
          runId,
          groupKey,
          patchOnly: input.action === "patch",
          sequenceOnly: input.action === "previews" || input.action === "rewrite",
          refreshSequence: input.action === "rewrite",
          // Resuming a takeover that stopped part-way continues it, so the earlier run's section is still replaced.
          adopt: input.action === "adopt" || (input.action === "create" && Boolean(group.draft?.adoptedFrom)),
          previews: input.action === "previews" ? Math.max(1, input.previews) : input.previews,
        },
      );
    } catch (err) {
      // draftCampaign records its own failures; this only catches errors thrown before it saved anything.
      await recordDraftFailure(deps, runId, groupKey, describeError(err)).catch(() => {});
    } finally {
      await lock(deps).release(runId);
    }
  });
  return { runId, group: groupKey };
}

// ---------- the original sequence (V1), for the V1 -> V2 view ----------

const ORIGINAL_TTL_MS = 5 * 60_000;
const originalCache = new Map<string, { at: number; value: Promise<OriginalView> }>();

/** The run's source sequences as they are in graph8 now: each step's delay, subject and text. Read-only, cached briefly. */
export async function getOriginal(deps: ServiceDeps, runId: string): Promise<OriginalView> {
  const run = await loadRun(deps, runId);
  await assertSameOrg(deps, run);
  const hit = originalCache.get(runId);
  if (hit && Date.now() - hit.at < ORIGINAL_TTL_MS) return hit.value;
  const value = (async (): Promise<OriginalView> => {
    const errors: string[] = [];
    const sequences: OriginalView["sequences"] = [];
    for (const s of run.source.sequences.slice(0, 3)) {
      try {
        const raw = (await deps.g8.getSequenceSteps(s.id)).steps ?? [];
        const steps: StepView[] = raw
          .map((step) => {
            const data = (step.step_data ?? {}) as Record<string, unknown>;
            const instructions = typeof data.instructions === "string" ? data.instructions.trim() : "";
            const body = toPlainText(typeof data.body === "string" ? data.body : "");
            // Only ON_DEMAND steps are written by graph8's AI. A fixed-text step can carry a note in
            // `instructions` too (the [DEMO] steps do); that note is not the email.
            const ai = step.input_type === "ON_DEMAND";
            return {
              order: Number(step.step_order ?? 0),
              day: Math.round(Number(step.time_interval ?? 0) / 86_400),
              kind: ai ? ("ai" as const) : ("template" as const),
              ...(typeof data.subject === "string" && data.subject.trim() ? { subject: data.subject.trim() } : {}),
              text: (ai ? instructions || body : body || instructions).slice(0, 6_000),
            };
          })
          .sort((a, b) => a.order - b.order);
        sequences.push({ id: s.id, name: s.name, steps });
      } catch (err) {
        errors.push(`${s.name}: ${describeError(err)}`);
      }
    }
    return { sequences, errors };
  })();
  originalCache.set(runId, { at: Date.now(), value });
  value.catch(() => originalCache.delete(runId));
  return value;
}

/** The earlier run's draft that `run` may take over: same org and source, a list and campaign, not already taken over. */
async function takeoverSource(deps: ServiceDeps, run: Run, key: Category, fromRunId: string) {
  if (fromRunId === run.id) throw new ApiError(409, "not_possible", "A run can't take over its own draft");
  const earlier = await loadRun(deps, fromRunId);
  if (earlier.orgId !== run.orgId || sourceKey(earlier) !== sourceKey(run) || !sourceKey(run))
    throw new ApiError(409, "not_possible", "That draft belongs to a different campaign; only a draft of the same campaign can be taken over");
  const group = earlier.groups.find((g) => g.key === key);
  const draft = group?.draft;
  if (!group || !draft?.campaignId || !draft.listId) throw new ApiError(409, "not_possible", "The earlier run has no draft of this group to take over");
  if (draft.supersededBy) throw new ApiError(409, "taken_over", `That draft was already taken over by run ${draft.supersededBy}`);
  if (await lock(deps).active(earlier.id)) throw new ApiError(409, "busy", "A job is working on the earlier run; try again when it finishes");
  return { run: earlier, group, draft };
}

async function recordDraftFailure(deps: ServiceDeps, runId: string, key: Category, error: string) {
  const run = await deps.store.load(runId);
  const group = run?.groups.find((g) => g.key === key);
  if (!run || !group) return;
  const now = new Date().toISOString();
  const base: CampaignDraft = group.draft ?? { status: "failed", audience: [], audienceNotes: [], docsPatched: [], docsPending: [], docsFailed: [], generation: "unknown", warnings: [], createdAt: now, updatedAt: now };
  group.draft = { ...base, status: "failed", error, updatedAt: now };
  run.updatedAt = now;
  await deps.store.save(run);
}

// ---------- company-wide learnings ----------

/** Saving a run's block replaced any older run's block for the same campaign: their records now say so. */
async function markReplaced(deps: ServiceDeps, newer: Run, keys: string[]) {
  for (const { id } of await deps.store.list()) {
    if (id === newer.id || (await lock(deps).active(id))) continue; // a run with a job is rewritten by that job
    const run = await deps.store.load(id).catch(() => null);
    const l = run?.learnings;
    if (!run || run.orgId !== newer.orgId || l?.status !== "applied" || !l.proposals.some((p) => keys.includes(p.key))) continue;
    run.learnings = { ...l, status: "replaced", replacedBy: newer.id };
    run.updatedAt = new Date().toISOString();
    await deps.store.save(run);
  }
}

export const LearningsBody = z.object({ action: z.enum(["propose", "apply", "remove"]) });

/** Propose is read-only; apply and remove write to Studio. All are short, so they run inside the request. */
export async function runLearnings(deps: ServiceDeps, runId: string, body: unknown): Promise<LearningsView> {
  const { action } = LearningsBody.parse(body ?? {});
  const run = await loadRun(deps, runId);
  await assertSameOrg(deps, run);
  // Keeps the run's record true to Studio: a new proposal would overwrite the record of a block that is saved there.
  if (action === "propose" && run.learnings?.status === "applied") throw new ApiError(409, "not_possible", "These learnings are saved in Studio; take them out first to propose again");
  // Studio holds one ReplyIQ block per campaign: once a newer run replaced it, this run's text is no longer there.
  if (action !== "propose" && run.learnings?.status === "replaced")
    throw new ApiError(409, "not_possible", "A newer run saved its own block for this campaign in Studio; take it out from that run, or propose this run's text again");
  if (action !== "propose") await deps.g8.assertWriteAllowed();
  if (!(await lock(deps).claim(runId, "learnings"))) throw new ApiError(409, "busy", "Another job is already working on this run");
  try {
    const ldeps = { g8: deps.g8, store: deps.store, log: deps.log };
    const result = action === "propose" ? await proposeLearnings(ldeps, runId) : action === "apply" ? await applyLearnings(ldeps, runId) : await removeLearnings(ldeps, runId);
    if (action === "apply" && result.status === "applied") await markReplaced(deps, run, result.proposals.map((p) => p.key));
    return stripLearnings(result)!;
  } finally {
    await lock(deps).release(runId);
  }
}
