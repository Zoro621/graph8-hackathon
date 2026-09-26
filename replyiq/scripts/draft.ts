// Draft a follow-up campaign in graph8 Studio for one group of a saved run (M5). Nothing is sent.
// Usage: npm run draft -- [--run <runId>] [--group <key>] [--force] [--patch-only] [--refresh-docs] [--wait <seconds>]
//        no --group: lists the groups that can be drafted for the run (latest run by default)
import "./load-env";
import { getEnv } from "../lib/env";
import { describeError, g8 } from "../lib/g8";
import { llm } from "../lib/llm";
import { draftableGroups, draftCampaign } from "../lib/pipeline/draftCampaign";
import { createFileStore } from "../lib/store";
import type { Category } from "../lib/types";

const arg = (flag: string) => {
  const i = process.argv.indexOf(flag);
  return i > -1 ? process.argv[i + 1] : undefined;
};

async function main() {
  const env = getEnv();
  const store = createFileStore();
  const runId = arg("--run") ?? (await store.list()).find((r) => r.status === "done")?.id;
  if (!runId) throw new Error("No finished run found. Run `npm run run:cli` first.");
  const run = await store.load(runId);
  if (!run) throw new Error(`Run ${runId} not found`);

  const groupKey = arg("--group") as Category | undefined;
  if (!groupKey) {
    console.log(`Run ${run.id} (${run.source.name}). Groups that can get a follow-up campaign:`);
    for (const g of draftableGroups(run)) {
      const extra = g.key === "referral_wrong_person" ? `, ${g.referrals} named referral(s) to look up` : "";
      console.log(`  --group ${g.key.padEnd(24)} ${g.label} (${g.eligible} eligible${extra})${g.hasCard ? " [Answer Card]" : ""}`);
    }
    return;
  }

  const wait = arg("--wait") ? Number(arg("--wait")) * 1000 : undefined;
  const draft = await draftCampaign(
    { g8: g8(), llm: llm(), model: env.OPENAI_REASON_MODEL, store, minAudience: env.MIN_GROUP_SIZE, timeoutMs: wait, log: (m) => console.log(m) },
    { runId: run.id, groupKey, force: process.argv.includes("--force"), patchOnly: process.argv.includes("--patch-only") || process.argv.includes("--refresh-docs"), refreshDocs: process.argv.includes("--refresh-docs") },
  );

  console.log(`\nDraft for "${groupKey}": status=${draft.status}`);
  if (draft.error) console.log(`  error: ${draft.error}`);
  if (draft.listId) console.log(`  list: ${draft.listId} "${draft.listTitle}" (${draft.audience.length} contacts)`);
  if (draft.campaignId) console.log(`  campaign: ${draft.campaignId} "${draft.campaignName}"  (Studio: https://app.graph8.com/studio?campaignId=${draft.campaignId})`);
  console.log(`  documents: generation=${draft.generation} patched=[${draft.docsPatched.join(", ")}] pending=[${draft.docsPending.join(", ")}] studioFailed=[${(draft.docsFailed ?? []).join(", ")}]`);
  if (draft.timingNote) console.log(`  timing: ${draft.timingNote}`);
  for (const n of draft.audienceNotes) console.log(`  audience note: ${n}`);
  for (const w of draft.warnings) console.log(`  warning: ${w}`);
  console.log("  Nothing was sent. Launching stays behind ENABLE_LAUNCH and human approval.");
  process.exit(draft.status === "failed" ? 1 : 0);
}

main().catch((err) => {
  console.error("Draft crashed:", describeError(err));
  process.exit(1);
});
