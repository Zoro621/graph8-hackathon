// Shared types (IMPLEMENTATION.md §4). Used by the pipeline, the API routes and the UI.

export type Category =
  | "interested_no_meeting"
  | "meeting_request"
  | "pricing_request"
  | "price_objection"
  | "timing_not_now"
  | "competitor_locked_in"
  | "referral_wrong_person"
  | "no_need"
  | "hard_no"
  | "unsubscribe"
  | "out_of_office"
  | "other";

export interface Reply {
  threadId: string;
  sequenceId: string;
  contactEmail: string;
  contactName?: string;
  company?: string;
  subject?: string;
  outbound?: string;
  replyText: string;
  repliedAt?: string;
  existingTags: { id: string; name: string }[];
}

export interface Classified extends Reply {
  category: Category;
  confidence: number;
  quote: string;
  referredName?: string;
  revisitHint?: string;
  needsReview: boolean;
}

export interface ProofItem {
  claim: string;
  sourceDocId: string;
  sourceDocName: string;
  excerpt: string;
  verified: boolean;
}

export interface AnswerCard {
  summary: string;
  quotes: string[];
  proofWeHave: ProofItem[];
  proofGap: string | null;
  howToAnswer: string;
  emailAngle: string;
}

export type ExclusionReason = "hard_no" | "unsubscribe" | "suppressed" | "not_found" | "no_followup_category";

export interface Group {
  key: Category;
  label: string;
  replies: Classified[];
  eligible: { contactId: number; email: string }[];
  excluded: { email: string; reason: ExclusionReason }[];
  card?: AnswerCard;
  draft?: {
    listId: number;
    campaignId: string;
    docsPatched: string[];
    status: "drafting" | "ready" | "failed";
    error?: string;
  };
}

export type StepKey = "load" | "fetch" | "classify" | "tag" | "resolve" | "cards";
export type StepStatus = "pending" | "running" | "done" | "failed" | "skipped";

export interface Run {
  id: string;
  createdAt: string;
  orgId: string;
  source: { sequenceId: string; name: string; stats?: unknown; steps?: unknown };
  steps: Record<StepKey, StepStatus>;
  counts: { threads: number; prospectReplies: number; sequencerReplies?: number };
  groups: Group[];
  errors: string[];
}

/** A sequence step as shown on the V1 → V2 diff. */
export interface SequenceStep {
  day: number;
  channel: "email";
  subject: string;
  body: string;
}

export interface SequenceSummary {
  id: string;
  name: string;
  label: string;
  status: string;
  contactCount: number;
  stepCount: number;
  threads: number;
  sequencerReplies: number;
}
