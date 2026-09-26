// Orgs where ReplyIQ may write (tags, lists, draft campaigns).
// org_87325c23062e is the hackathon sandbox organisation, confirmed by the team on 26 Sep 2026.
// Its /sandbox/status returns 404, so it is allowlisted here instead. Every other org stays refused.
// G8_WRITE_ORG_ID in .env.local adds one more org without a code change.
export const SANDBOX_ORG_IDS: readonly string[] = ["org_87325c23062e"];

/**
 * The reference campaign ReplyIQ is built and demoed on: the graph8 team's real
 * "Kill Your Tool Stack — Tech SMB Sales" campaign (CIENCE reactivation), chosen by the team on 26 Sep 2026.
 * Chain verified live by `npm run spike`: Studio campaign -> linked sequence -> audience list -> mailbox -> replies.
 */
export const REFERENCE = {
  orgId: "org_87325c23062e",
  studioCampaignId: "6a5f3380-e200-577d-b057-e705ffbc7e7a", // [Full campaign] Kill Your Tool Stack — Tech SMB Sales
  sequenceId: "e470a095-5a1a-5a3e-874e-450ef15a9253", // [Full copy] Kill Your Tool Stack — Tech SMB Sales v2 - Sequence
  audienceListId: 1900262001, // [Full campaign] Tech SMB Sales contacts (7,531)
  mailbox: "campaign-saad@example.com",
  inboxWorkspaceId: "916ffd65-679f-5afe-99b5-6209a325a452", // Graph8 Tech SMB Sales — full campaign
  /** Campaign documents ReplyIQ reads (V1) and later appends Answer Cards to (by file_type). */
  docs: { objections: "messaging_objections", replyTemplates: "reply_templates", emails: "emails", brief: "campaign_brief" },
} as const;
