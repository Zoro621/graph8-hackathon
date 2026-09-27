// Run the ReplyIQ pipeline from the terminal: load -> fetch -> classify -> themes -> tag -> resolve -> cards.
// Usage: npm run run:cli -- [--campaign <id> | --sequence <id>] [--limit <n>] [--no-tag]
//        (no selector = the source with the most replies, discovered at runtime)
//        --no-tag: do not write ReplyIQ tags to graph8 (read-only run)
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
  const writeTags = !process.argv.includes("--no-tag");

  let selector: SourceSelector | null = campaignId ? { campaignId } : sequenceId ? { sequenceId } : null;
  if (!selector) {
    selector = pickDefaultSource(await discoverSources(client));
    if (!selector) throw new Error("No sequence with replies found in this org.");
    console.log(`No source given; using the one with the most replies: ${JSON.stringify(selector)}`);
  }

  const run = await runPipeline(
    {
      g8: client,
      llm: llm(),
      store: createFileStore(),
      classifyModel: env.OPENAI_CLASSIFY_MODEL,
      themeModel: env.OPENAI_REASON_MODEL,
      cardModel: env.OPENAI_REASON_MODEL,
      log: (m) => console.log(m),
    },
    { selector, limit, writeTags },
  );

  console.log(`\nRun ${run.id}  status=${run.status}  source="${run.source.name}"`);
  console.log(`steps: ${Object.entries(run.steps).map(([k, v]) => `${k}=${v}`).join(" ")}`);
  console.log(
    `threads=${run.counts.threads} replies=${run.counts.prospectReplies} needsReview=${run.counts.needsReview} llmCalls=${run.usage.llmCalls} tokens=${run.usage.inputTokens}+${run.usage.outputTokens}`,
  );
  for (const g of run.groups) {
    const info = categoryInfo(g.key);
    console.log(`\n■ ${g.label} (${g.replies.length})  follow-up: ${info.followUp}${info.answerCard ? "  [Answer Card]" : ""}  eligible: ${g.eligible.length}`);
    const reasons: Record<string, number> = {};
    for (const e of g.excluded) reasons[e.reason] = (reasons[e.reason] ?? 0) + 1;
    if (Object.keys(reasons).length) console.log(`   excluded: ${Object.entries(reasons).map(([k, v]) => `${k}=${v}`).join(" ")}`);
    if (g.card) {
      const c = g.card;
      console.log(`   ┌ ANSWER CARD: ${c.summary}`);
      for (const q of c.quotes) console.log(`   │ “${q.slice(0, 100)}”`);
      for (const p of c.proofWeHave) console.log(`   │ ✓ ${p.claim}  [${p.sourceDocName}]\n   │     "${p.excerpt.slice(0, 110)}"`);
      console.log(`   │ ⚠ proof gap: ${c.proofGap ?? "none"}`);
      console.log(`   │ how to answer: ${c.howToAnswer}`);
      console.log(`   │ email angle: ${c.emailAngle}`);
      for (const n of c.themeNotes) console.log(`   │ ◆ ${n.label}: ${n.howToAnswer}`);
      console.log(`   └ sources: ${c.sources.map((s) => s.name).join(", ")}`);
    }
    for (const th of g.themes ?? []) {
      console.log(`   ◆ ${th.label} (${th.threadIds.length})  "${th.quote.slice(0, 70)}"${th.quoteVerified ? "" : "  [quote unverified]"}`);
    }
    for (const r of g.replies) {
      const extra = [
        r.referredName && `→ ${r.referredName}`,
        r.revisitHint && `⟳ ${r.revisitHint}`,
        r.needsReview && "⚠ review",
        r.tag && `#${r.tag.status}`,
      ]
        .filter(Boolean)
        .join("  ");
      console.log(`   ${r.confidence.toFixed(2)}  ${(r.company ?? r.contactEmail).slice(0, 24).padEnd(24)} "${r.quote.replace(/\s+/g, " ").slice(0, 80)}"  ${extra}`);
    }
  }
  if (run.tagging) {
    const t = run.tagging;
    console.log(`\ngraph8 tags: tagged=${t.tagged} already=${t.already} failed=${t.failed} created=[${t.tagsCreated.join(", ")}] staleKept=${t.staleKept}`);
  }
  if (run.audience) console.log(`audience: eligible=${run.audience.eligible} excluded=${JSON.stringify(run.audience.excluded)}`);
  if (run.cards) console.log(`answer cards: generated=${run.cards.generated} failed=${run.cards.failed} verifiedProof=${run.cards.verifiedProof} unverifiedDropped=${run.cards.unverifiedClaims}`);
  if (run.errors.length) console.log(`\nnotes:\n  ${run.errors.join("\n  ")}`);
  console.log(`\nSaved: data/runs/${run.id}.json`);
  process.exit(run.status === "done" ? 0 : 1);
}

main().catch((err) => {
  console.error("Run crashed:", describeError(err));
  process.exit(1);
});
