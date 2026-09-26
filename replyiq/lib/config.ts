// Write-safety policy only. No campaign, sequence or list is configured here: ReplyIQ discovers
// those from the connected org at runtime (lib/pipeline/sources.ts).
//
// Orgs where ReplyIQ may write (tags, lists, draft campaigns) when /sandbox/status is unavailable.
// org_87325c23062e is the hackathon sandbox organisation, confirmed by the team on 26 Sep 2026
// (its /sandbox/status returns 404). G8_WRITE_ORG_ID in .env.local adds another org.
// Every other org stays refused.
export const SANDBOX_ORG_IDS: readonly string[] = ["org_87325c23062e"];
