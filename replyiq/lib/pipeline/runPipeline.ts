// Orchestrates a run. M2 covers load -> fetch -> classify -> themes; tag/resolve/cards stay "pending" until
// M3/M4 plug in. Every step's state and any error is persisted, and the function never throws for
// a pipeline failure: the run file is the source of truth (the UI polls it).
import type { G8Client } from "../g8";
import { describeError } from "../g8";
import type { Llm } from "../llm";
import type { RunStore } from "../store";
import type { Run, StepName } from "../types";
import { classifyReplies } from "./classify";
import { groupReplies } from "./group";
import { discoverThemes } from "./themes";
import { fetchSourceReplies, resolveSource, type SourceSelector } from "./sources";

export interface PipelineDeps {
  g8: G8Client;
  llm: Llm;
  store: RunStore;
  classifyModel: string;
  themeModel?: string; // defaults to classifyModel
  now?: () => Date;
  log?: (msg: string) => void;
}

export interface PipelineOptions {
  selector: SourceSelector;
  runId?: string;
  limit?: number; // cap replies (testing / cost control)
}

export function emptyRun(id: string, selector: SourceSelector, now: Date): Run {
  const ts = now.toISOString();
  return {
    id,
    createdAt: ts,
    updatedAt: ts,
    status: "running",
    orgId: "",
    source: { selector, name: "", campaignId: null, sequences: [], audienceListId: null, mailboxes: [], docs: [], warnings: [] },
    steps: { load: "pending", fetch: "pending", classify: "pending", themes: "pending", tag: "pending", resolve: "pending", cards: "pending" },
    counts: { threads: 0, prospectReplies: 0, needsReview: 0 },
    usage: { inputTokens: 0, outputTokens: 0, llmCalls: 0 },
    groups: [],
    errors: [],
  };
}

export async function runPipeline(deps: PipelineDeps, opts: PipelineOptions): Promise<Run> {
  const now = deps.now ?? (() => new Date());
  const log = deps.log ?? (() => {});
  const run = emptyRun(opts.runId ?? deps.store.newRunId(), opts.selector, now());
  const persist = async () => {
    run.updatedAt = now().toISOString();
    await deps.store.save(run);
  };

  const step = async <T>(name: StepName, fn: () => Promise<T>): Promise<T> => {
    run.steps[name] = "running";
    await persist();
    log(`▶ ${name}`);
    try {
      const out = await fn();
      run.steps[name] = "done";
      await persist();
      return out;
    } catch (err) {
      run.steps[name] = "failed";
      run.errors.push(`${name}: ${describeError(err)}`);
      throw err;
    }
  };

  try {
    await persist();

    const ctx = await step("load", async () => {
      const [ctx, me] = await Promise.all([resolveSource(deps.g8, opts.selector), deps.g8.whoAmI()]);
      run.orgId = me.org_id;
      run.source = {
        selector: opts.selector,
        name: ctx.campaign?.name ?? ctx.sequences[0]?.name ?? "(unknown)",
        campaignId: ctx.campaign?.id ?? null,
        sequences: ctx.sequences.map((s) => ({ id: s.id, name: s.name ?? s.id, status: s.status })),
        audienceListId: ctx.audienceListId,
        mailboxes: ctx.mailboxes,
        docs: Object.keys(ctx.docs),
        warnings: ctx.warnings,
      };
      if (ctx.sequences.length === 0) throw new Error("the selected source has no readable sequences");
      return ctx;
    });

    const replies = await step("fetch", async () => {
      const { threads, replies } = await fetchSourceReplies(deps.g8, ctx);
      const capped = opts.limit ? replies.slice(0, opts.limit) : replies;
      run.counts.threads = threads;
      run.counts.prospectReplies = capped.length;
      log(`  ${threads} threads, ${replies.length} prospect replies${opts.limit ? ` (using ${capped.length})` : ""}`);
      return capped;
    });

    await step("classify", async () => {
      if (replies.length === 0) {
        run.groups = [];
        return;
      }
      const res = await classifyReplies(replies, {
        llm: deps.llm,
        model: deps.classifyModel,
        onProgress: (d, t) => log(`  classified ${d}/${t}`),
      });
      run.groups = groupReplies(res.classified);
      run.counts.needsReview = res.classified.filter((c) => c.needsReview).length;
      run.usage = res.usage;
      run.errors.push(...res.warnings.map((w) => `classify: ${w}`));
    });

    // Themes add detail but are not critical: failures become warnings, never a failed run.
    run.steps.themes = "running";
    await persist();
    log("▶ themes");
    try {
      const res = await discoverThemes(run.groups, { llm: deps.llm, model: deps.themeModel ?? deps.classifyModel });
      run.groups = res.groups;
      run.usage.inputTokens += res.usage.inputTokens;
      run.usage.outputTokens += res.usage.outputTokens;
      run.usage.llmCalls += res.usage.llmCalls;
      run.errors.push(...res.warnings.map((w) => `themes: ${w}`));
      const eligible = run.groups.filter((g) => g.replies.length >= 2).length;
      const withThemes = run.groups.filter((g) => g.themes?.length).length;
      run.steps.themes = eligible === 0 ? "skipped" : withThemes === 0 ? "failed" : "done";
    } catch (err) {
      run.steps.themes = "failed";
      run.errors.push(`themes: ${describeError(err)}`);
    }

    run.status = "done";
  } catch {
    run.status = "failed";
  }
  await persist();
  return run;
}
