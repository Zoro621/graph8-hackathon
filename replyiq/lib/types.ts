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
  quotes: string[]; // verbatim from the group's replies
  proofWeHave: ProofItem[]; // verified items only (excerpt found in the source document)
  proofGap: string | null; // missing proof, plus any claims that failed grounding
  howToAnswer: string;
  emailAngle: string;
  themeNotes: { themeId: string; label: string; howToAnswer: string }[]; // one per theme of the group
  unverifiedClaims: string[]; // claims dropped because their excerpt was not in the document
  sources: { docId: string; name: string; kind: "global" | "campaign" }[]; // documents the card was given
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
  draft?: CampaignDraft;
}

/** M5: a follow-up campaign drafted in graph8 Studio for one group. Nothing is sent or launched. */
export interface CampaignDraft {
  status: "drafting" | "ready" | "failed";
  listId?: number;
  listTitle?: string;
  campaignId?: string;
  campaignName?: string;
  /** Who the campaign targets. For referrals: the NAMED people (referredBy = who pointed to them). */
  audience: { contactId: number; email: string; threadId: string; referredBy?: string }[];
  audienceNotes: string[]; // e.g. referred people not found in the CRM, contacts graph8 warned about
  docsPatched: string[]; // campaign doc file types that now carry the ReplyIQ Answer Card / notes
  docsPending: string[]; // docs still generating when we stopped waiting (patch later)
  docsFailed: string[]; // docs graph8 Studio failed to generate (ReplyIQ fills the ones it owns)
  generation: "complete" | "in_progress" | "unknown";
  timingNote?: string; // advisory: when to launch (e.g. after OOO return dates)
  /** The follow-up emails, as a graph8 Sequencer DRAFT (no sender attached, never run by ReplyIQ). */
  sequence?: SequenceDraft;
  warnings: string[];
  error?: string;
  createdAt: string;
  updatedAt: string;
}

/** Result of fact-checking one email: deterministic checks plus a model audit against the allowed facts. */
export interface EmailCheck {
  ok: boolean;
  issues: string[];
  audited: boolean; // false when the model audit could not run (then `ok` rests on the deterministic checks)
}

/** A fact an email may state: verbatim from a company document. */
export interface EmailFact {
  claim: string;
  excerpt: string;
  source: string; // document name
}

export interface SequenceDraft {
  status: "ready" | "failed";
  sequenceId?: string;
  sequenceName?: string;
  ownerEmail?: string;
  /** Step 1 is written per contact by graph8's AI at send time; step 2 is ReplyIQ's checked text. */
  steps: { order: number; inputType: "ON_DEMAND" | "MANUAL_TEMPLATE"; delayDays: number; subject?: string }[];
  instructions: string; // what graph8's AI is told for step 1
  facts: EmailFact[]; // the only product facts either email may state
  doNotClaim: string[]; // proof gaps: never claimed
  originalRules: string[]; // rules carried over from the original campaign's AI steps
  manualEmail?: { subject: string; body: string; check: EmailCheck; attempts: number };
  /** graph8's AI drafts of step 1 for a few contacts (nothing sent), each fact-checked by ReplyIQ. */
  previews?: { contactId: number; email: string; subject: string; body: string; check: EmailCheck }[];
  previewCredits?: number; // graph8's own estimate for the previews
  verified: boolean; // read back from graph8 after creation
  senderAttached: false; // ReplyIQ never attaches a sender: a person does, then launches
  warnings: string[];
  error?: string;
  updatedAt: string;
}

/** Suggested additions to company-wide Studio documents, applied only after a person approves. */
export interface StudioLearnings {
  status: "proposed" | "applied" | "removed" | "failed";
  proposedAt: string;
  appliedAt?: string;
  removedAt?: string;
  proposals: {
    docId: string;
    docName: string;
    kind: "messaging" | "proof";
    key: string; // block key: one block per source campaign, replaced (not duplicated) on re-runs
    section: string; // the exact text to add
    action: "append" | "replace" | "unchanged";
    baseVersion?: number;
    savedVersion?: number;
    /** The document exactly as it was before ReplyIQ's first save (local only; data/runs is gitignored). */
    backup?: string;
  }[];
  error?: string;
}

export type StepName = "load" | "fetch" | "classify" | "themes" | "tag" | "resolve" | "cards";
export type StepState = "pending" | "running" | "done" | "failed" | "skipped";

export type RunStatus = "running" | "done" | "failed";

export interface Run {
  id: string;
  createdAt: string;
  updatedAt: string;
  /** When the pipeline ended (done or failed). Drafts and learnings later move updatedAt, not this. */
  finishedAt?: string;
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
  /** M4 Answer Card summary. */
  cards?: { generated: number; failed: number; verifiedProof: number; unverifiedClaims: number };
  /** Suggested company-wide Studio additions (proposed from the Answer Cards; saved only after approval). */
  learnings?: StudioLearnings;
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
  version?: number; // bumps on every save (graph8 keeps a DocumentVersion per save)
  updatedAt?: string;
}
