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
  conversation: { from: "us" | "prospect"; text: string; date?: string }[]; // the entire thread, oldest first
  summary?: string; // graph8's own thread summary, when present
  existingTags: { id: string; name: string }[];
}

export interface Classified extends Reply {
  category: Category;
  confidence: number; // 0..1; below 0.6 means needsReview
  quote: string; // short verbatim span from replyText
  referredName?: string; // person the prospect pointed us to (referral / left the company)
  revisitHint?: string; // e.g. OOO return date, "next quarter"
  reason?: string; // one-line why, for the UI
  context?: "full" | "composed" | "truncated"; // what the classifier saw (lib/pipeline/compose.ts)
  themeId?: string; // theme inside its group (lib/pipeline/themes.ts)
  tag?: { id: string; name: string; status: "tagged" | "already" | "failed"; error?: string }; // graph8 inbox tag (M3)
  needsReview: boolean;
}

/**
 * A theme inside one group, found by the AI (not hardcoded). Themes never change actions:
 * the group's category still decides follow-up / never-contact.
 */
export interface Theme {
  id: string; // stable within the run, e.g. "price_objection:per-seat-cost-too-high"
  label: string; // a few words
  description: string; // one sentence
  threadIds: string[]; // members (every reply of the group is in exactly one theme)
  quote: string; // verbatim from one member's reply
  quoteThreadId: string;
  quoteVerified: boolean; // false if the model's quote could not be found and a fallback was used
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

export type ExclusionReason =
  | "hard_no" // said no in this thread
  | "unsubscribe" // asked to be removed in this thread
  | "hard_stop_elsewhere" // the same contact said no / unsubscribe in another thread: wins everywhere
  | "suppressed" // on graph8's suppression ledger
  | "suppression_unknown" // the suppression check failed: fail closed, never contact
  | "not_found" // no graph8 contact for this reply
  | "no_followup_category"; // meeting booked / meeting request / needs review

export interface Group {
  key: Category;
  label: string;
  replies: Classified[];
  eligible: { contactId: number; email: string; threadId: string }[]; // may get a follow-up campaign (M5)
  excluded: { email: string; reason: ExclusionReason; threadId: string; contactId?: number }[];
  themes?: Theme[]; // only for groups with 2+ replies; absent if theme discovery failed
  card?: AnswerCard;
  draft?: {
    listId: number;
    campaignId: string;
    docsPatched: string[];
    status: "drafting" | "ready" | "failed";
    error?: string;
  };
}

export type StepName = "load" | "fetch" | "classify" | "themes" | "tag" | "resolve" | "cards";
export type StepState = "pending" | "running" | "done" | "failed" | "skipped";

export type RunStatus = "running" | "done" | "failed";

export interface Run {
  id: string;
  createdAt: string;
  updatedAt: string;
  status: RunStatus;
  orgId: string;
  /** What was analysed: a Studio campaign (all its sequences) or a single sequence. */
  source: {
    selector: { campaignId: string } | { sequenceId: string };
    name: string; // campaign name, or sequence name when standalone
    campaignId: string | null;
    sequences: { id: string; name: string; status: string | null }[];
    audienceListId: number | null;
    mailboxes: string[];
    docs: string[]; // campaign doc kinds found (objections, replyTemplates, emails, brief)
    warnings: string[];
  };
  steps: Record<StepName, StepState>;
  counts: { threads: number; prospectReplies: number; needsReview: number };
  usage: { inputTokens: number; outputTokens: number; llmCalls: number };
  /** M3 graph8 inbox tagging summary (absent until the tag step runs). */
  tagging?: { tagged: number; already: number; failed: number; tagsCreated: string[]; staleKept: number };
  /** M3 contact resolution summary. */
  audience?: { eligible: number; excluded: Partial<Record<ExclusionReason, number>> };
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
