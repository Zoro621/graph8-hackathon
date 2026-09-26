// Deterministic demo engine: replays the ReplyIQ pipeline (IMPLEMENTATION.md §9) on fixtures,
// as a pure function of elapsed time. The UI renders the same Run shape the real
// GET /api/runs/[runId] will return, so swapping this for the API is a one-file change.
import type { Category, Classified, Group, Run, StepKey, StepStatus } from "../types";
import { TAXONOMY, isHardStop } from "../taxonomy";
import { verifyProof } from "../grounding";
import { STEP_ORDER, STEP_META } from "../ui/theme";
import { displayName } from "../ui/format";
import { CAMPAIGN_DOCS, DEMO_ORG, RAW_CARDS, SEQUENCES, STUDIO_DOCS, THREADS, contactOf } from "./fixtures";

export const TIMELINE: Record<StepKey, [number, number]> = {
  load: [0, 900],
  fetch: [900, 2600],
  classify: [2600, 6600],
  tag: [6600, 7600],
  resolve: [7600, 8800],
  cards: [8800, 11200],
};
export const RUN_DURATION = TIMELINE.cards[1];

export interface RunMeta {
  id: string;
  sequenceId: string;
  createdAt: number;
}

export type Tone = "info" | "ok" | "warn" | "stop" | "agent";
export interface LogLine {
  at: number;
  step: StepKey;
  agent: string;
  text: string;
  tone: Tone;
}

export interface RunSnapshot {
  run: Run;
  elapsed: number;
  progress: number;
  fetched: number;
  classified: number;
  cardsReady: number;
  activeStep: StepKey | null;
  log: LogLine[];
  done: boolean;
}

const GROUP_ORDER = (c: Category) => {
  const r = TAXONOMY[c];
  if (isHardStop(c)) return 3;
  if (r.answerCard) return 0;
  if (r.followUp) return 1;
  return 2;
};

export const sequenceOf = (id: string) => SEQUENCES.find((s) => s.id === id) ?? SEQUENCES[0];

/** Replies in the order the pipeline fetches and classifies them. */
export function classifiedReplies(sequenceId: string): Classified[] {
  const seq = sequenceOf(sequenceId);
  return (THREADS[seq.id] ?? []).map((th) => {
    const c = contactOf(th.n);
    return {
      threadId: `thr_${seq.id.slice(0, 4)}_${String(th.n).padStart(2, "0")}`,
      sequenceId: seq.id,
      contactEmail: c.email,
      contactName: c.name,
      company: c.company,
      subject: `Re: ${seq.label}`,
      replyText: th.replyText,
      existingTags: [],
      category: th.category,
      confidence: th.confidence,
      quote: th.quote,
      revisitHint: th.revisitHint,
      needsReview: th.confidence < 0.6,
    };
  });
}

const isSuppressed = (email: string) =>
  Object.values(THREADS)
    .flat()
    .some((th) => th.suppressed && contactOf(th.n).email === email);

function buildGroups(replies: Classified[], withGuards: boolean, cardKeys: Set<Category>): Group[] {
  const by = new Map<Category, Classified[]>();
  for (const r of replies) by.set(r.category, [...(by.get(r.category) ?? []), r]);
  const groups: Group[] = [...by.entries()].map(([key, rs]) => {
    const g: Group = { key, label: TAXONOMY[key].label, replies: rs, eligible: [], excluded: [] };
    if (withGuards) {
      for (const r of rs) {
        const c = contactOf(Number(r.contactName?.slice(-2)));
        if (isHardStop(key)) g.excluded.push({ email: r.contactEmail, reason: key as "hard_no" | "unsubscribe" });
        else if (isSuppressed(r.contactEmail)) g.excluded.push({ email: r.contactEmail, reason: "suppressed" });
        else if (!TAXONOMY[key].followUp) g.excluded.push({ email: r.contactEmail, reason: "no_followup_category" });
        else g.eligible.push({ contactId: c.contactId, email: r.contactEmail });
      }
    }
    const raw = RAW_CARDS[key];
    if (raw && TAXONOMY[key].answerCard && cardKeys.has(key)) g.card = verifyProof(raw, STUDIO_DOCS);
    return g;
  });
  return groups.sort((a, b) => GROUP_ORDER(a.key) - GROUP_ORDER(b.key) || b.replies.length - a.replies.length);
}

export const cardCategories = (sequenceId: string) => {
  const cats = new Set(classifiedReplies(sequenceId).map((r) => r.category));
  return [...cats].filter((c) => TAXONOMY[c].answerCard && RAW_CARDS[c]);
};

function buildLog(sequenceId: string): LogLine[] {
  const seq = sequenceOf(sequenceId);
  const replies = classifiedReplies(sequenceId);
  const L: LogLine[] = [];
  const add = (step: StepKey, at: number, text: string, tone: Tone = "info") =>
    L.push({ at, step, agent: STEP_META[step].agent, text, tone });
  const span = (k: StepKey, i: number, n: number) => TIMELINE[k][0] + ((TIMELINE[k][1] - TIMELINE[k][0]) * (i + 0.5)) / n;

  add("load", 80, "Sandbox check passed · writes allowed", "ok");
  add("load", 380, `Loaded “${displayName(seq.name)}” · ${seq.stepCount} steps · ${seq.contactCount} contacts`);
  add("load", 720, `Sequencer counts ${seq.sequencerReplies} replies, inbox holds ${seq.threads} threads. Recording both.`, "warn");

  replies.forEach((r, i) =>
    add("fetch", span("fetch", i, replies.length), `Thread ${r.contactName} → prospect reply captured`),
  );
  replies.forEach((r, i) =>
    add(
      "classify",
      span("classify", i, replies.length),
      `${TAXONOMY[r.category].short} · ${Math.round(r.confidence * 100)}% · “${r.quote}”`,
      isHardStop(r.category) ? "stop" : "agent",
    ),
  );
  const cats = new Set(replies.map((r) => r.category));
  add("tag", 6800, `Ensured ${cats.size} ReplyIQ tags exist in the Inbox`);
  add("tag", 7300, `Tagged ${replies.length} threads in the graph8 Inbox`, "ok");
  const groups = buildGroups(replies, true, new Set());
  const excluded = groups.flatMap((g) => g.excluded);
  excluded.forEach((x, i) =>
    add("resolve", span("resolve", i, Math.max(excluded.length, 1)), `Excluded ${x.email} · ${x.reason.replace(/_/g, " ")}`, x.reason === "no_followup_category" ? "warn" : "stop"),
  );
  if (!excluded.length) add("resolve", 8200, "No contacts excluded", "ok");
  const cc = cardCategories(sequenceId);
  cc.forEach((c, i) => {
    const card = verifyProof(RAW_CARDS[c]!, STUDIO_DOCS);
    const rejected = (card.proofGap ?? "").split("\n").filter((l) => l.startsWith("Unverified")).length;
    add(
      "cards",
      span("cards", i, cc.length),
      `${TAXONOMY[c].short}: ${card.proofWeHave.length} proofs grounded${rejected ? `, ${rejected} claim rejected → proof gap` : ""}`,
      rejected ? "warn" : "ok",
    );
  });
  if (!cc.length) add("cards", 9800, "No Answer Card groups in this sequence", "info");
  add("cards", RUN_DURATION - 60, "Run complete. Pick a group to draft its follow-up.", "ok");
  return L.sort((a, b) => a.at - b.at);
}

export function snapshot(meta: RunMeta, now: number): RunSnapshot {
  const seq = sequenceOf(meta.sequenceId);
  const elapsed = Math.max(0, now - meta.createdAt);
  const replies = classifiedReplies(seq.id);
  const n = replies.length;
  const frac = (k: StepKey) => Math.min(1, Math.max(0, (elapsed - TIMELINE[k][0]) / (TIMELINE[k][1] - TIMELINE[k][0])));

  const steps = {} as Record<StepKey, StepStatus>;
  let activeStep: StepKey | null = null;
  for (const k of STEP_ORDER) {
    const f = frac(k);
    steps[k] = f >= 1 ? "done" : f > 0 ? "running" : "pending";
    if (steps[k] === "running") activeStep = k;
  }
  if (steps.cards === "done" && cardCategories(seq.id).length === 0) steps.cards = "skipped";

  const fetched = Math.floor(frac("fetch") * n);
  const classified = Math.floor(frac("classify") * n);
  const cc = cardCategories(seq.id);
  const cardsReady = Math.floor(frac("cards") * cc.length);
  const groups = buildGroups(replies.slice(0, classified), steps.resolve === "done", new Set(cc.slice(0, cardsReady)));

  const run: Run = {
    id: meta.id,
    createdAt: new Date(meta.createdAt).toISOString(),
    orgId: DEMO_ORG,
    source: { sequenceId: seq.id, name: seq.name },
    steps,
    counts: { threads: fetched, prospectReplies: fetched, sequencerReplies: seq.sequencerReplies },
    groups,
    errors: [],
  };
  return {
    run,
    elapsed,
    progress: Math.min(1, elapsed / RUN_DURATION),
    fetched,
    classified,
    cardsReady,
    activeStep,
    log: buildLog(seq.id).filter((l) => l.at <= elapsed),
    done: elapsed >= RUN_DURATION,
  };
}

/* ------------------------------ draft campaign ------------------------------ */

export const DRAFT_PHASES = [
  { key: "sandbox", label: "assertSandbox()", until: 700 },
  { key: "list", label: "Create list + add contacts", until: 1600 },
  { key: "brief", label: "Write campaign brief", until: 2500 },
  { key: "docs", label: "Generate campaign docs", until: 6800 },
  { key: "patch", label: "Patch Answer Card into docs", until: 7800 },
] as const;
export const DRAFT_DURATION = DRAFT_PHASES[DRAFT_PHASES.length - 1].until;

export interface DraftSnapshot {
  status: "idle" | "drafting" | "ready";
  phaseIndex: number;
  docsDone: number;
  docsTotal: number;
  listId: number;
  campaignId: string;
  docsPatched: string[];
}

const hash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

export function draftSnapshot(runId: string, key: Category, startedAt: number | undefined, now: number): DraftSnapshot {
  const h = hash(`${runId}:${key}`);
  const base = {
    docsTotal: CAMPAIGN_DOCS.length,
    listId: 40000 + (h % 9000),
    campaignId: `cmp_${h.toString(36).slice(0, 8)}`,
  };
  if (startedAt === undefined) return { ...base, status: "idle", phaseIndex: -1, docsDone: 0, docsPatched: [] };
  const e = now - startedAt;
  const phaseIndex = DRAFT_PHASES.findIndex((p) => e < p.until);
  const docsFrac = Math.min(1, Math.max(0, (e - DRAFT_PHASES[2].until) / (DRAFT_PHASES[3].until - DRAFT_PHASES[2].until)));
  const ready = e >= DRAFT_DURATION;
  return {
    ...base,
    status: ready ? "ready" : "drafting",
    phaseIndex: ready ? DRAFT_PHASES.length : phaseIndex,
    docsDone: Math.floor(docsFrac * CAMPAIGN_DOCS.length),
    docsPatched: e >= DRAFT_PHASES[3].until + 400 ? ["Messaging & Objections", "Reply Templates"] : [],
  };
}

/** Credit estimate (REPLYIQ-PLAN.md §3.9): 1 credit per email step per contact + ~1 per 1k generation tokens. */
export function creditEstimate(steps: number, contacts: number) {
  const sends = steps * contacts;
  const generation = 42;
  return { sends, generation, total: sends + generation };
}
