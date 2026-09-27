// Company-wide Studio learnings: turn a run's Answer Cards into additions to the org's Global Studio
// documents, which graph8's AI grounds new campaigns on. So every future campaign starts knowing what
// prospects objected to and how to answer.
//   Messaging House  <- "Heard in the field": verbatim quotes, how to answer, verified proof, don't-claim
//   Proof Catalog    <- "Proof we still need": the proof gaps, so marketing sees the missing assets
// Always two steps: propose (read-only; stored on the run for a person to review), then apply (only after
// approval). Apply writes exactly the reviewed text, re-reads each document right before saving, and
// touches ONLY ReplyIQ's own block (between start/end markers; one block per source campaign, replaced on
// re-runs), so other people's text is never changed.
// Undo: removeLearnings takes ReplyIQ's block out again (the rest of the document is left as it is), and
// apply keeps a local backup of each document as it was before ReplyIQ's first save. Do not rely on graph8's
// version history for this: observed 27 Sep, a document's FIRST save through the API became version 1 with
// the new text, so the text from before it was not kept there.
import type { G8Client } from "../g8";
import { describeError } from "../g8";
import type { RunStore } from "../store";
import { normLoose } from "../text";
import type { Group, Run, StudioDoc, StudioLearnings } from "../types";

export class LearningsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LearningsError";
  }
}

export const blockStart = (key: string) => `<!-- replyiq:learnings:${key} -->`;
export const blockEnd = (key: string) => `<!-- /replyiq:learnings:${key} -->`;
const oneLine = (s: string) => s.replace(/\s+/g, " ").trim();
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Put ReplyIQ's block into a document: append if absent, else replace only what is between its markers. */
export function upsertBlock(content: string, key: string, body: string): { next: string; action: "append" | "replace" | "unchanged" } {
  const start = blockStart(key);
  const end = blockEnd(key);
  const block = `${start}\n${body.trim()}\n${end}`;
  const i = content.indexOf(start);
  if (i === -1) return { next: content.trim() ? `${content.trimEnd()}\n\n${block}\n` : `${block}\n`, action: "append" };
  const j = content.indexOf(end, i);
  if (j === -1) throw new LearningsError(`the ReplyIQ block for ${key} has no end marker; fix it in Studio before re-applying`);
  const next = `${content.slice(0, i)}${block}${content.slice(j + end.length)}`;
  return { next, action: next === content ? "unchanged" : "replace" };
}

/** Take ReplyIQ's block out (with the blank line append added before it). Everything else is left alone. */
export function removeBlock(content: string, key: string): { next: string; removed: boolean } {
  const start = blockStart(key);
  const end = blockEnd(key);
  const i = content.indexOf(start);
  if (i === -1) return { next: content, removed: false };
  const j = content.indexOf(end, i);
  if (j === -1) throw new LearningsError(`the ReplyIQ block for ${key} has no end marker; remove it by hand in Studio`);
  const before = content.slice(0, i).replace(/\n{1,2}$/, "");
  const after = content.slice(j + end.length).replace(/^\n/, "");
  return { next: after ? `${before}\n${after}` : before, removed: true };
}

/** One block per analysed source, so re-running the same campaign replaces its block instead of adding one. */
export const learningsKey = (run: Run) => run.source.campaignId ?? ("sequenceId" in run.source.selector ? run.source.selector.sequenceId : run.id);

/** Global documents by name, never by id (orgs name them the same way; Studio creates them). */
export function findTargetDoc(docs: StudioDoc[], kind: "messaging" | "proof"): StudioDoc | undefined {
  const [exact, loose] = kind === "messaging" ? [/messaging house/i, /messaging/i] : [/proof catalog/i, /\bproof\b/i];
  return docs.find((d) => exact.test(d.displayName)) ?? docs.find((d) => loose.test(d.displayName));
}

/** Distinct quotes, first spelling kept (bulk campaigns get identical replies). */
const quotesOf = (g: Group, n: number) => {
  const seen = new Map<string, string>();
  for (const r of g.replies) if (!seen.has(oneLine(r.quote).toLowerCase())) seen.set(oneLine(r.quote).toLowerCase(), oneLine(r.quote));
  return [...seen.values()].slice(0, n);
};

export function messagingBlock(run: Run, groups: Group[], date: string): string {
  const replies = groups.reduce((n, g) => n + g.replies.length, 0);
  const lines = [
    `## Heard in the field: ${run.source.name}`,
    `_Added by ReplyIQ on ${date} from ${plural(replies, "real reply", "real replies")}, after a person approved it. Quotes are verbatim; proof is verbatim from company documents._`,
  ];
  for (const g of groups) {
    const card = g.card!;
    lines.push("", `### ${g.label} (${plural(g.replies.length, "reply", "replies")})`, ...quotesOf(g, 3).map((q) => `> "${q.slice(0, 220)}"`), "", `**How to answer:** ${oneLine(card.howToAnswer)}`);
    if (card.proofWeHave.length) lines.push("", "**Proof to use:**", ...card.proofWeHave.map((p) => `- ${oneLine(p.claim).replace(/[.;:,]+$/, "")}: "${oneLine(p.excerpt)}" (${p.sourceDocName})`));
    if (card.proofGap) lines.push("", `**Don't claim (no proof yet):** ${oneLine(card.proofGap)}`);
  }
  return lines.join("\n");
}

export function proofBlock(run: Run, groups: Group[], date: string): string | null {
  const gaps = groups.filter((g) => g.card?.proofGap);
  if (!gaps.length) return null;
  return [
    `## Proof we still need: ${run.source.name}`,
    `_Added by ReplyIQ on ${date}, after a person approved it: what prospects asked about that company documents can't yet answer._`,
    "",
    ...gaps.map((g) => `- **${g.label}** (${plural(g.replies.length, "reply", "replies")}, e.g. "${quotesOf(g, 1)[0]?.slice(0, 120) ?? ""}"): ${oneLine(g.card!.proofGap!)}`),
  ].join("\n");
}

export interface LearningsDeps {
  g8: Pick<G8Client, "listGlobalDocs" | "assertWriteAllowed" | "getGlobalDoc" | "updateGlobalDoc">;
  store: RunStore;
  now?: () => Date;
  log?: (m: string) => void;
}

/** Read-only: build the proposed additions from the run's Answer Cards and store them on the run. */
export async function proposeLearnings(deps: LearningsDeps, runId: string): Promise<StudioLearnings> {
  const now = (deps.now ?? (() => new Date()))();
  const run = await deps.store.load(runId);
  if (!run) throw new LearningsError(`run ${runId} not found`);
  const groups = run.groups.filter((g) => g.card);
  if (!groups.length) throw new LearningsError("this run has no Answer Cards to learn from");
  const docs = await deps.g8.listGlobalDocs();
  const date = now.toISOString().slice(0, 10);
  const key = learningsKey(run);
  const proposals: StudioLearnings["proposals"] = [];
  for (const [kind, body] of [
    ["messaging", messagingBlock(run, groups, date)],
    ["proof", proofBlock(run, groups, date)],
  ] as const) {
    if (!body) continue;
    const listed = findTargetDoc(docs, kind);
    if (!listed) continue;
    // The list endpoint has no save counter (current_version), so read the document itself.
    const doc = await deps.g8.getGlobalDoc(listed.id);
    proposals.push({ docId: listed.id, docName: listed.displayName, kind, key, section: body, action: upsertBlock(doc.content, key, body).action, ...(doc.version != null ? { baseVersion: doc.version } : {}) });
  }
  if (!proposals.length) throw new LearningsError("no Messaging House or Proof Catalog document found in Studio Global");
  run.learnings = { status: "proposed", proposedAt: now.toISOString(), proposals };
  run.updatedAt = now.toISOString();
  await deps.store.save(run);
  return run.learnings;
}

/** After approval: save exactly the proposed blocks, re-reading each document first; verify by reading back. */
export async function applyLearnings(deps: LearningsDeps, runId: string): Promise<StudioLearnings> {
  const now = () => (deps.now ?? (() => new Date()))().toISOString();
  const run = await deps.store.load(runId);
  if (!run) throw new LearningsError(`run ${runId} not found`);
  const learnings = run.learnings;
  if (!learnings?.proposals.length) throw new LearningsError("nothing proposed for this run; propose first and review it");
  const save = async () => {
    run.updatedAt = now();
    await deps.store.save(run);
    return learnings;
  };
  try {
    await deps.g8.assertWriteAllowed();
    for (const p of learnings.proposals) {
      const fresh = await deps.g8.getGlobalDoc(p.docId);
      const { next, action } = upsertBlock(fresh.content, p.key, p.section);
      if (p.backup === undefined && !fresh.content.includes(blockStart(p.key))) p.backup = fresh.content; // before ReplyIQ's first save
      if (action !== "unchanged") await deps.g8.updateGlobalDoc(p.docId, next);
      const back = await deps.g8.getGlobalDoc(p.docId);
      const starts = back.content.split(blockStart(p.key)).length - 1;
      if (starts !== 1 || !normLoose(back.content).includes(normLoose(p.section))) throw new Error(`${p.docName}: the saved document does not contain the approved block exactly once`);
      p.action = action;
      if (back.version != null) p.savedVersion = back.version;
      deps.log?.(`  ${p.docName}: ${action} (version ${fresh.version ?? "?"} -> ${back.version ?? "?"})`);
    }
    learnings.status = "applied";
    learnings.appliedAt = now();
    learnings.error = undefined;
  } catch (err) {
    learnings.status = "failed";
    learnings.error = describeError(err);
  }
  return save();
}

/** Undo: take ReplyIQ's block out of each document it was applied to; verify it is gone by reading back. */
export async function removeLearnings(deps: LearningsDeps, runId: string): Promise<StudioLearnings> {
  const now = () => (deps.now ?? (() => new Date()))().toISOString();
  const run = await deps.store.load(runId);
  if (!run) throw new LearningsError(`run ${runId} not found`);
  const learnings = run.learnings;
  if (!learnings?.proposals.length) throw new LearningsError("nothing was proposed or applied for this run");
  try {
    await deps.g8.assertWriteAllowed();
    for (const p of learnings.proposals) {
      const fresh = await deps.g8.getGlobalDoc(p.docId);
      const { next, removed } = removeBlock(fresh.content, p.key);
      if (removed) await deps.g8.updateGlobalDoc(p.docId, next);
      const back = await deps.g8.getGlobalDoc(p.docId);
      if (back.content.includes(blockStart(p.key))) throw new Error(`${p.docName}: the ReplyIQ block is still there after saving`);
      if (back.version != null) p.savedVersion = back.version;
      deps.log?.(`  ${p.docName}: ${removed ? "block removed" : "no block to remove"}`);
    }
    learnings.status = "removed";
    learnings.removedAt = now();
    learnings.error = undefined;
  } catch (err) {
    learnings.status = "failed";
    learnings.error = describeError(err);
  }
  run.updatedAt = now();
  await deps.store.save(run);
  return learnings;
}
