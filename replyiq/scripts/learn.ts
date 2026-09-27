// Company-wide Studio learnings from a run's Answer Cards (lib/pipeline/studioLearnings.ts).
// Two steps, on purpose: the default only PREVIEWS what would be added (read-only) and stores it on the
// run; --apply saves exactly that reviewed text to the Global Studio documents; --remove takes it out again.
// Usage: npm run learn -- [--run <runId>] [--apply | --remove]
import "./load-env";
import { describeError, g8 } from "../lib/g8";
import { applyLearnings, proposeLearnings, removeLearnings } from "../lib/pipeline/studioLearnings";
import { createFileStore } from "../lib/store";

const arg = (flag: string) => {
  const i = process.argv.indexOf(flag);
  return i > -1 ? process.argv[i + 1] : undefined;
};

async function main() {
  const store = createFileStore();
  let runId = arg("--run");
  if (!runId) {
    for (const r of await store.list()) {
      const run = r.status === "done" ? await store.load(r.id) : null;
      if (run?.groups.some((g) => g.card)) {
        runId = run.id;
        break;
      }
    }
  }
  if (!runId) throw new Error("No finished run with Answer Cards. Run `npm run run:cli` first.");
  const deps = { g8: g8(), store, log: (m: string) => console.log(m) };

  if (process.argv.includes("--remove")) {
    const l = await removeLearnings(deps, runId);
    if (l.status !== "removed") throw new Error(l.error ?? "remove failed");
    console.log(`\nReplyIQ's blocks were taken out of: ${l.proposals.map((p) => p.docName).join(", ")}. The rest of each document is unchanged.`);
    return;
  }

  if (!process.argv.includes("--apply")) {
    const l = await proposeLearnings(deps, runId);
    console.log(`Run ${runId}: proposed additions to company-wide Studio documents (nothing saved yet)\n`);
    for (const p of l.proposals) {
      console.log(`■ ${p.docName} (${p.action}${p.baseVersion != null ? `, now version ${p.baseVersion}` : ""})`);
      console.log(p.section.split("\n").map((line) => `   │ ${line}`).join("\n"), "\n");
    }
    console.log(`Review the text above. To save it: npm run learn -- --run ${runId} --apply`);
    return;
  }

  const l = await applyLearnings(deps, runId);
  if (l.status !== "applied") throw new Error(l.error ?? "apply failed");
  console.log(`\nSaved to Studio. To take it out again: npm run learn -- --run ${runId} --remove`);
  for (const p of l.proposals) console.log(`  ${p.docName}: ${p.action}${p.savedVersion != null ? `, now version ${p.savedVersion}` : ""}`);
}

main().catch((err) => {
  console.error("Learn failed:", describeError(err));
  process.exit(1);
});
