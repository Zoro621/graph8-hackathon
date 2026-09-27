// The app's API, as plain functions over the backend library. Route handlers (app/api/*) only parse the
// request and call these; every dependency is passed in, so tests run them with a fake org and fake LLM.
import { G8Error } from "@graph8/sdk";
import { z } from "zod";
import type { G8Client } from "../g8";
import { describeError, WriteNotAllowedError } from "../g8";
import type { Llm } from "../llm";
import type { RunStore } from "../store";
import { CATEGORY_KEYS, allowsFollowUpCampaign, categoryInfo } from "../taxonomy";
import type { CampaignDraft, Category, Run, SourceSummary, StudioLearnings } from "../types";
import { emptyRun, runPipeline } from "../pipeline/runPipeline";
import { discoverSources } from "../pipeline/sources";
import { DraftError, draftCampaign } from "../pipeline/draftCampaign";
import { LearningsError, applyLearnings, proposeLearnings, removeLearnings } from "../pipeline/studioLearnings";
import type { GroupView, LearningsView, RunSummary, RunView, StatusView } from "../api-types";
import { activeJob, claim, release } from "./jobs";

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

export async function getStatus(deps: ServiceDeps): Promise<StatusView> {
  const base = { configured: true, missing: [], launchEnabled: deps.env.ENABLE_LAUNCH, minGroupSize: deps.env.MIN_GROUP_SIZE };
  try {
    const [write, usage] = await Promise.all([deps.g8.writePolicy(), deps.g8.getUsage().catch(() => null)]);
    const credits = usage ? (usage.available_credits ?? usage.credits ?? null) : null;
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
  claim(runId, "pipeline");
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
    } finally {
      release(runId);
    }
  });
  return { runId };
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

/** The run as the UI needs it: no full conversations, no document backups, plus live job state. */
export function toRunView(run: Run): RunView {
  const job = activeJob(run.id);
  const groups: GroupView[] = run.groups.map((g) => ({
    ...g,
    replies: g.replies.map(({ conversation, ...r }) => ({ ...r, messages: conversation.length })),
  }));
  const working = run.status === "running" || run.groups.some((g) => g.draft?.status === "drafting");
  return { ...run, groups, learnings: stripLearnings(run.learnings), job, interrupted: working && !job };
}

export async function getRunView(deps: ServiceDeps, id: string): Promise<RunView> {
  return toRunView(await loadRun(deps, id));
}

export async function listRunSummaries(deps: ServiceDeps, limit = 12): Promise<RunSummary[]> {
  const list = (await deps.store.list()).slice(0, limit);
  const runs = await Promise.all(list.map((r) => deps.store.load(r.id).catch(() => null)));
  return runs
    .filter((r): r is Run => r !== null)
    .map((r) => ({
      id: r.id,
      createdAt: r.createdAt,
      status: r.status,
      name: r.source.name,
      replies: r.counts.prospectReplies,
      groups: r.groups.map((g) => ({ key: g.key, count: g.replies.length })),
      draftable: r.groups.filter((g) => allowsFollowUpCampaign(g.key) && (g.key === "referral_wrong_person" ? g.replies.some((x) => x.referredName) : g.eligible.length >= deps.env.MIN_GROUP_SIZE)).length,
      drafts: r.groups.filter((g) => g.draft?.status === "ready").length,
      job: activeJob(r.id),
    }));
}

// ---------- drafts ----------

export const DraftBody = z.object({
  /** create: list + Studio campaign + follow-up sequence. patch: add the Answer Card to docs that were still generating. previews: graph8 drafts step 1 for a few contacts. */
  action: z.enum(["create", "patch", "previews"]).default("create"),
  previews: z.number().int().min(0).max(3).default(0),
});

const DRAFT_WAIT_MS = 150_000; // keeps a draft inside a 5-minute function; unfinished docs are patched later

export async function startDraft(deps: ServiceDeps, runId: string, key: string, body: unknown): Promise<{ runId: string; group: Category }> {
  const input = DraftBody.parse(body ?? {});
  if (!(CATEGORY_KEYS as string[]).includes(key)) throw new ApiError(404, "group_not_found", `Unknown group ${key}`);
  const groupKey = key as Category;
  const run = await loadRun(deps, runId);
  const group = run.groups.find((g) => g.key === groupKey);
  if (!group) throw new ApiError(404, "group_not_found", `This run has no "${key}" group`);
  if (!allowsFollowUpCampaign(groupKey)) throw new ApiError(409, "not_possible", `"${group.label}" never gets a follow-up campaign (${categoryInfo(groupKey).followUp})`);
  if (run.steps.resolve !== "done") throw new ApiError(409, "not_possible", "The run's audience was not resolved; run the analysis again first");
  if (input.action !== "create" && !group.draft?.campaignId) throw new ApiError(409, "not_possible", "Create the draft first");
  await deps.g8.assertWriteAllowed();
  if (!claim(runId, "draft", groupKey)) throw new ApiError(409, "busy", "Another job is already working on this run");

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
          sequenceOnly: input.action === "previews",
          previews: input.action === "previews" ? Math.max(1, input.previews) : input.previews,
        },
      );
    } catch (err) {
      // draftCampaign records its own failures; this only catches errors thrown before it saved anything.
      await recordDraftFailure(deps, runId, groupKey, describeError(err)).catch(() => {});
    } finally {
      release(runId);
    }
  });
  return { runId, group: groupKey };
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

export const LearningsBody = z.object({ action: z.enum(["propose", "apply", "remove"]) });

/** Propose is read-only; apply and remove write to Studio. All are short, so they run inside the request. */
export async function runLearnings(deps: ServiceDeps, runId: string, body: unknown): Promise<LearningsView> {
  const { action } = LearningsBody.parse(body ?? {});
  await loadRun(deps, runId);
  if (action !== "propose") await deps.g8.assertWriteAllowed();
  if (!claim(runId, "learnings")) throw new ApiError(409, "busy", "Another job is already working on this run");
  try {
    const ldeps = { g8: deps.g8, store: deps.store, log: deps.log };
    const result = action === "propose" ? await proposeLearnings(ldeps, runId) : action === "apply" ? await applyLearnings(ldeps, runId) : await removeLearnings(ldeps, runId);
    return stripLearnings(result)!;
  } finally {
    release(runId);
  }
}
