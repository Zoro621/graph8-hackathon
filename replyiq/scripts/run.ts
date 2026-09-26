// Run the ReplyIQ pipeline from the terminal (M2: load -> fetch -> classify).
// Usage: npm run run:cli -- [--campaign <id> | --sequence <id>] [--limit <n>]
//        (no selector = the source with the most replies, discovered at runtime)
import "./load-env";
import { getEnv } from "../lib/env";
import { describeError, g8 } from "../lib/g8";
import { llm } from "../lib/llm";
import { runPipeline } from "../lib/pipeline/runPipeline";
import { discoverSources, pickDefaultSource, type SourceSelector } from "../lib/pipeline/sources";
import { createFileStore } from "../lib/store";
import { categoryInfo } from "../lib/taxonomy";

const arg = (flag: string) => {
  const i = process.argv.indexOf(flag);
  return i > -1 ? process.argv[i + 1] : undefined;
};

async function main() {
  const env = getEnv();
  const client = g8();
  const campaignId = arg("--campaign");
  const sequenceId = arg("--sequence");
  const limit = arg("--limit") ? Number(arg("--limit")) : undefined;

  let selector: SourceSelector | null = campaignId ? { campaignId } : sequenceId ? { sequenceId } : null;
  if (!selector) {
    selector = pickDefaultSource(await discoverSources(client));
    if (!selector) throw new Error("No sequence with replies found in this org.");
    console.log(`No source given; using the one with the most replies: ${JSON.stringify(selector)}`);
  }

  const run = await runPipeline(
    { g8: client, llm: llm(), store: createFileStore(), classifyModel: env.OPENAI_CLASSIFY_MODEL, log: (m) => console.log(m) },
    { selector, limit },
  );

  console.log(`\nRun ${run.id}  status=${run.status}  source="${run.source.name}"`);
  console.log(`steps: ${Object.entries(run.steps).map(([k, v]) => `${k}=${v}`).join(" ")}`);
  console.log(`threads=${run.counts.threads} replies=${run.counts.prospectReplies} needsReview=${run.counts.needsReview} llmCalls=${run.usage.llmCalls} tokens=${run.usage.inputTokens}+${run.usage.outputTokens}`);
  for (const g of run.groups) {
    const info = categoryInfo(g.key);
    console.log(`\n■ ${g.label} (${g.replies.length})  follow-up: ${info.followUp}${info.answerCard ? "  [Answer Card]" : ""}`);
    for (const r of g.replies) {
      const extra = [r.referredName && `→ ${r.referredName}`, r.revisitHint && `⟳ ${r.revisitHint}`, r.needsReview && "⚠ review"].filter(Boolean).join("  ");
      console.log(`   ${r.confidence.toFixed(2)}  ${(r.company ?? r.contactEmail).slice(0, 24).padEnd(24)} "${r.quote.replace(/\s+/g, " ").slice(0, 80)}"  ${extra}`);
    }
  }
  if (run.errors.length) console.log(`\nnotes:\n  ${run.errors.join("\n  ")}`);
  console.log(`\nSaved: data/runs/${run.id}.json`);
  process.exit(run.status === "done" ? 0 : 1);
}

main().catch((err) => {
  console.error("Run crashed:", describeError(err));
  process.exit(1);
});
