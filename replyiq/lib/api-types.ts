// Response shapes of the app's own API routes (app/api/*). Safe to import from client code.
import type { Category, Classified, Group, Run, SourceSummary, StudioLearnings } from "./types";
import type { WritePolicy } from "./g8";

export type WritePolicyView = WritePolicy;

export type { SourceSummary };

/** A reply as the UI sees it: the full conversation stays on the server (it can be long and personal). */
export type ReplyView = Omit<Classified, "conversation"> & { messages: number };

/** Whether a follow-up can be drafted, decided by the server with the same rules the draft applies. */
export interface Draftability {
  ok: boolean;
  targets: number; // eligible contacts, or for referrals the distinct people named
  reason?: string;
}

/** An earlier run's draft of the same group for the same campaign, which this run can take over instead of creating a new one. */
export interface PreviousDraft {
  runId: string;
  campaignId: string;
  campaignName?: string;
  status: "drafting" | "ready" | "failed";
  updatedAt: string;
  audience: number;
}

export type GroupView = Omit<Group, "replies"> & { replies: ReplyView[]; draftable: Draftability; previousDraft?: PreviousDraft };

/** One step of a sequence as the V1 -> V2 view shows it. */
export interface StepView {
  order: number;
  day: number; // days after the previous step
  kind: "ai" | "template"; // written per contact by graph8's AI at send time, or a fixed template
  subject?: string;
  text: string; // the template body, or the instructions graph8's AI follows
}

/** The original sequence(s) of a run, read live from graph8 (read-only). */
export interface OriginalView {
  sequences: { id: string; name: string; steps: StepView[] }[];
  errors: string[];
}

/** Why a run saved with another graph8 key is read-only (shown by the server and the UI). */
export const OTHER_ORG_REASON = "This run was made in a different graph8 org than the one your API key opens";

/** Learnings without the local document backups (those never leave the server). */
export type LearningsView = Omit<StudioLearnings, "proposals"> & {
  proposals: Omit<StudioLearnings["proposals"][number], "backup">[];
};

export type JobKind = "pipeline" | "draft" | "learnings" | "enrich";
export interface JobView {
  kind: JobKind;
  group?: Category;
  startedAt: string;
}

export type RunView = Omit<Run, "groups" | "learnings"> & {
  groups: GroupView[];
  learnings?: LearningsView;
  /** The background job working on this run right now, if any. */
  job: JobView | null;
  /** The run (or a draft) says it is still working, but no job is running: the server restarted mid-way. */
  interrupted: boolean;
  /** Saved with a key for another graph8 org: readable, but never drafted or used to change Studio. */
  otherOrg: boolean;
};

export interface RunSummary {
  id: string;
  createdAt: string;
  status: Run["status"];
  name: string;
  replies: number;
  groups: { key: Category; count: number }[];
  draftable: number;
  drafts: number;
  job: JobView | null;
}

export interface StatusView {
  configured: boolean;
  missing: string[];
  launchEnabled: boolean;
  minGroupSize: number;
  write?: WritePolicyView;
  credits?: number | null;
  error?: string;
}

export interface ApiErrorBody {
  error: { code: string; message: string };
}
