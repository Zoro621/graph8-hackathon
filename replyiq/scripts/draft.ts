// Draft a follow-up campaign in graph8 Studio for one group of a saved run (M5). Nothing is sent.
// Usage: npm run draft -- [--run <runId>] [--group <key>] [--force] [--patch-only] [--refresh-docs] [--wait <seconds>]
//                          [--sequence-only] [--no-sequence] [--refresh-sequence] [--rebuild-sequence] [--previews <n>]
//        no --group: lists the groups that can be drafted for the run (latest run by default)
//        --sequence-only: build (or preview) the follow-up sequence of an existing draft, nothing else
//        --refresh-sequence: re-write the existing sequence's steps in place (no second sequence)
//        --previews <n>: graph8's AI drafts step 1 for up to n contacts now (spends ~9 credits each; nothing sent)
//        --retime: out of office only: split by return date again and recount step 1's waits from today (no model)
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
  const has = (flag: string) => process.argv.includes(flag);
  const draft = await draftCampaign(
    {
      g8: g8(),
      llm: llm(),
      model: env.OPENAI_REASON_MODEL,
      store,
      minAudience: env.MIN_GROUP_SIZE,
      timeoutMs: wait,
      ownerEmail: env.G8_SEQUENCE_OWNER_EMAIL,
      log: (m) => console.log(m),
    },
    {
      runId: run.id,
      groupKey,
      force: has("--force"),
      patchOnly: has("--patch-only") || has("--refresh-docs"),
      refreshDocs: has("--refresh-docs"),
      sequenceOnly: has("--sequence-only"),
      skipSequence: has("--no-sequence"),
      rebuildSequence: has("--rebuild-sequence"),
      refreshSequence: has("--refresh-sequence"),
      retime: has("--retime"),
      previews: arg("--previews") ? Number(arg("--previews")) : 0,
    },
  );

  console.log(`\nDraft for "${groupKey}": status=${draft.status}`);
  if (draft.error) console.log(`  error: ${draft.error}`);
  const firstWave = draft.sequence?.waves?.find((w) => w.slot === 0);
  if (draft.listId) console.log(`  list: ${draft.listId} "${draft.listTitle}" (${firstWave ? `${firstWave.contacts.length} of the ${draft.audience.length} contacts; later return dates have their own lists` : `${draft.audience.length} contacts`})`);
  if (draft.campaignId) console.log(`  campaign: ${draft.campaignId} "${draft.campaignName}"  (Studio: https://app.graph8.com/studio?campaignId=${draft.campaignId})`);
  console.log(`  documents: generation=${draft.generation} patched=[${draft.docsPatched.join(", ")}] pending=[${draft.docsPending.join(", ")}] studioFailed=[${(draft.docsFailed ?? []).join(", ")}]`);
  if (draft.timingNote) console.log(`  timing: ${draft.timingNote}`);
  for (const n of draft.audienceNotes) console.log(`  audience note: ${n}`);
  const box = (subject: string, body: string) => [`    ┌ ${subject}`, ...body.split("\n").map((l) => `    │ ${l}`), "    └"].join("\n");
  const seq = draft.sequence;
  if (seq) {
    console.log(`\n  follow-up sequence: ${seq.status}${seq.sequenceId ? ` ${seq.sequenceId} "${seq.sequenceName}"` : ""}${seq.error ? ` (${seq.error})` : ""}`);
    if (seq.sequenceId) console.log(`    owner ${seq.ownerEmail}; read back from graph8: ${seq.verified ? "matches" : "NOT verified"}; sender attached: no (a person launches it)`);
    for (const st of seq.steps) console.log(`    step ${st.order} (waits ${st.delayDays} day(s)): ${st.inputType === "ON_DEMAND" ? "graph8's AI writes each person's email from ReplyIQ's instructions" : `ReplyIQ's text: "${st.subject}"`}`);
    if (seq.waves?.length) console.log(`    return dates (waits counted on ${seq.wavesCountedOn}):`);
    for (const w of seq.waves ?? []) {
      const who = w.contacts.map((c) => `${c.email}${c.returnOn ? ` back ${c.returnOn}${c.assumed ? " (assumed)" : ""}` : ""}`).join(", ");
      console.log(`      slot ${w.slot} ${w.status === "retired" ? "not needed (list emptied)" : `${w.key === "now" ? "back already, sends on launch" : `first email ${w.firstEmailOn}, step 1 waits ${w.delayDays} day(s)`}: ${who}`}`);
      if (w.sequenceId) console.log(`        list ${w.listId}, sequence ${w.sequenceId} "${w.sequenceName}"${w.status === "retired" ? "" : `, read back: ${w.verified ? "matches" : "NOT verified"}`}${w.error ? ` (${w.error})` : ""}`);
    }
    console.log(`    facts allowed: ${seq.facts.length}; never claim: ${seq.doNotClaim.length}; rules from the original campaign: ${seq.originalRules.length}`);
    if (seq.manualEmail) {
      const m = seq.manualEmail;
      console.log(`    step 2 fact-check: ${m.check.ok ? "passed" : "FAILED"} after ${m.attempts} attempt(s)${m.check.issues.length ? `: ${m.check.issues.join(" | ")}` : ""}`);
      console.log(box(m.subject, m.body));
    }
    for (const p of seq.previews ?? []) {
      console.log(`    preview for ${p.email}: ${p.check.ok ? "passed the fact-check" : `${p.check.issues.length} issue(s): ${p.check.issues.join(" | ")}`}`);
      console.log(box(p.subject, p.body));
    }
    if (seq.previews) console.log(`    previews: ${seq.previews.length}, ~${seq.previewCredits ?? "?"} credits (graph8's estimate)`);
    for (const w of seq.warnings) console.log(`    sequence warning: ${w}`);
  }
  for (const w of draft.warnings) console.log(`  warning: ${w}`);
  console.log("  Nothing was sent. Launching stays behind ENABLE_LAUNCH and human approval.");
  process.exit(draft.status === "failed" ? 1 : 0);
}

main().catch((err) => {
  console.error("Draft crashed:", describeError(err));
  process.exit(1);
});
