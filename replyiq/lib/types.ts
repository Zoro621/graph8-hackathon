// Shared contract between the graph8 track (Person 1) and the AI/UI track (Person 2).
// Change only by agreement. Field names follow the verified graph8 API schemas.

export type Category =
  | "interested_no_meeting"
  | "meeting_request"
  | "meeting_booked"
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
  threadId: string; // InboxThreadResponse.id, used for POST /inbox/{id}/tag
  sequenceId: string;
  contactEmail: string; // thread.contact.email (falls back to the prospect message's from_address)
  contactId?: number; // graph8 contact id when the inbox returns it (emails/search does)
  contactName?: string;
  company?: string;
  subject?: string;
  outbound?: string; // first message with responder USER or AI
  replyText: string; // latest message with responder OTHER, quoted history stripped
  repliedAt?: string;
  conversation: { from: "us" | "prospect"; text: string; date?: string }[]; // last messages, oldest first
  summary?: string; // graph8's own thread summary, when present
  existingTags: { id: string; name: string }[];
}

export interface Classified extends Reply {
  category: Category;
  confidence: number; // 0..1; below 0.6 means needsReview
  quote: string; // short verbatim span from replyText
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
  proofWeHave: ProofItem[]; // verified items only
  proofGap: string | null; // includes claims that failed grounding
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

export type StepName = "load" | "fetch" | "classify" | "tag" | "resolve" | "cards";
export type StepState = "pending" | "running" | "done" | "failed" | "skipped";

export interface Run {
  id: string;
  createdAt: string;
  orgId: string;
  source: { sequenceId: string; name: string; stats?: unknown; steps?: unknown };
  steps: Record<StepName, StepState>;
  counts: { threads: number; prospectReplies: number; sequencerReplies?: number };
  groups: Group[];
  errors: string[];
}

/**
 * Something ReplyIQ can analyse: one sequence, plus the Studio campaign it belongs to (if any).
 * Discovered at runtime from the org (lib/pipeline/sources.ts); nothing is hardcoded.
 */
export interface SourceSummary {
  sequenceId: string;
  sequenceName: string;
  sequenceStatus: string | null;
  contactCount: number | null;
  campaignId: string | null; // Studio campaign linking this sequence
  campaignName: string | null;
  replyThreads: number; // threads with at least one prospect message
  mailboxes: string[]; // inbox mailboxes the replies were found in
}

/** A Studio Global Context document, as returned by GET /global-context/documents. */
export interface StudioDoc {
  id: string;
  displayName: string;
  fileType?: string;
  category?: string;
  content: string;
}
