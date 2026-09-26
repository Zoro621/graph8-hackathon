// Orgs where ReplyIQ may write (tags, lists, draft campaigns).
// org_87325c23062e is the hackathon sandbox organisation, confirmed by the team on 26 Sep 2026.
// Its /sandbox/status returns 404, so it is allowlisted here instead. Every other org stays refused.
// G8_WRITE_ORG_ID in .env.local adds one more org without a code change.
export const SANDBOX_ORG_IDS: readonly string[] = ["org_87325c23062e"];
