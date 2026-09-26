// Orchestrates a run: load -> fetch -> classify -> themes -> tag -> resolve -> cards. Every step's state and any error is persisted, and the function never throws for
// a pipeline failure: the run file is the source of truth (the UI polls it).
import type { G8Client } from "../g8";
import { describeError, WriteNotAllowedError } from "../g8";
import type { Llm } from "../llm";
import type { RunStore } from "../store";
import type { Run, StepName } from "../types";
import { classifyReplies } from "./classify";
import { groupReplies } from "./group";
import { discoverThemes } from "./themes";
import { resolveContacts } from "./resolveContacts";
import { generateCards, wantsCard } from "./cards";
import type { SourceDoc } from "./retrieve";
import { tagThreads } from "./tagThreads";
import { fetchSourceReplies, resolveSource, type SourceSelector } from "./sources";

export interface PipelineDeps {
  g8: G8Client;
  llm: Llm;
  store: RunStore;
  classifyModel: string;
  themeModel?: string; // defaults to classifyModel
  cardModel?: string; // defaults to themeModel, then classifyModel
  now?: () => Date;
  log?: (msg: string) => void;
}

export interface PipelineOptions {
  selector: SourceSelector;
  runId?: string;
  limit?: number; // cap replies (testing / cost control)
  /** Write ReplyIQ tags to graph8 threads (M3). Off unless asked: library callers opt in explicitly. */
  writeTags?: boolean;
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

    // Tag threads in graph8 (writes). Non-critical: failures are recorded, the run continues.
    if (!opts.writeTags) {
      run.steps.tag = "skipped";
    } else {
      run.steps.tag = "running";
      await persist();
      log("▶ tag");
      try {
        const res = await tagThreads(deps.g8, run.groups);
        run.groups = res.groups;
        run.tagging = { tagged: res.tagged, already: res.already, failed: res.failed, tagsCreated: res.tagsCreated, staleKept: res.staleKept };
        run.errors.push(...res.warnings.map((w) => `tag: ${w}`));
        const total = res.tagged + res.already + res.failed;
        run.steps.tag = total > 0 && res.failed === total ? "failed" : "done";
        log(`  tagged ${res.tagged}, already ${res.already}, failed ${res.failed}`);
      } catch (err) {
        run.steps.tag = err instanceof WriteNotAllowedError ? "skipped" : "failed";
        run.errors.push(`tag: ${describeError(err)}`);
      }
    }

    // Who may get a follow-up campaign. Critical for safety: a failure fails the run.
    await step("resolve", async () => {
      const res = await resolveContacts(deps.g8, run.groups);
      run.groups = res.groups;
      run.audience = { eligible: res.eligible, excluded: res.excluded };
      run.errors.push(...res.warnings.map((w) => `resolve: ${w}`));
      log(`  eligible ${res.eligible}, excluded ${JSON.stringify(res.excluded)}`);
    });

    // Answer Cards for objection / interest groups. Non-critical: failures become warnings.
    if (!run.groups.some(wantsCard)) {
      run.steps.cards = "skipped";
    } else {
      run.steps.cards = "running";
      await persist();
      log("▶ cards");
      try {
        const docs: SourceDoc[] = Object.values(ctx.docs)
          .filter((d): d is NonNullable<typeof d> => Boolean(d))
          .map((d) => ({ id: d.id, name: `Campaign: ${d.name}`, kind: "campaign" as const, content: d.content }));
        try {
          const global = await deps.g8.listGlobalDocs();
          docs.push(...global.filter((d) => d.content).map((d) => ({ id: d.id, name: d.displayName, kind: "global" as const, content: d.content })));
        } catch (err) {
          run.errors.push(`cards: Studio documents unavailable (${describeError(err)}); cards use campaign documents only`);
        }
        const res = await generateCards(run.groups, { llm: deps.llm, model: deps.cardModel ?? deps.themeModel ?? deps.classifyModel, docs });
        run.groups = res.groups;
        run.usage.inputTokens += res.usage.inputTokens;
        run.usage.outputTokens += res.usage.outputTokens;
        run.usage.llmCalls += res.usage.llmCalls;
        run.errors.push(...res.warnings.map((w) => `cards: ${w}`));
        const cards = run.groups.map((g) => g.card).filter((c): c is NonNullable<typeof c> => Boolean(c));
        run.cards = {
          generated: res.generated,
          failed: res.failed,
          verifiedProof: cards.reduce((n, c) => n + c.proofWeHave.length, 0),
          unverifiedClaims: cards.reduce((n, c) => n + c.unverifiedClaims.length, 0),
        };
        run.steps.cards = res.generated === 0 ? "failed" : "done";
        log(`  ${res.generated} card(s), ${run.cards.verifiedProof} verified proof point(s)`);
      } catch (err) {
        run.steps.cards = "failed";
        run.errors.push(`cards: ${describeError(err)}`);
      }
    }

    run.status = "done";
  } catch {
    run.status = "failed";
  }
  await persist();
  return run;
}
