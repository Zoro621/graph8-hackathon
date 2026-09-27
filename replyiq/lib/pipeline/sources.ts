// Discovers what ReplyIQ can analyse in the connected org, and resolves one choice into its full
// chain (Studio campaign -> sequences -> audience list -> mailboxes -> campaign docs).
// Nothing here is tied to a specific campaign: everything comes from the API at runtime.
import type { CampaignDocument, CampaignFull, G8Client, SequenceDetail, Thread } from "../g8";
import { docText } from "../g8";
import { withoutOwnSections } from "../text";
import type { Reply, SourceSummary } from "../types";
import { threadToReply } from "./fetchReplies";

// ---------- campaign documents: found by type, then by name ----------

export type CampaignDocKind = "objections" | "replyTemplates" | "emails" | "brief";

const DOC_MATCHERS: Record<CampaignDocKind, { fileTypes: string[]; name: RegExp }> = {
  objections: { fileTypes: ["messaging_objections"], name: /objection/i },
  replyTemplates: { fileTypes: ["reply_templates"], name: /reply\s*templates?/i },
  emails: { fileTypes: ["emails", "email_copy"], name: /^emails?$|email\s*copy/i },
  brief: { fileTypes: ["campaign_brief"], name: /brief/i },
};

/** The campaign document of a given kind, matched by Studio file_type first, then display name. */
export function findCampaignDoc(docs: CampaignDocument[], kind: CampaignDocKind): CampaignDocument | undefined {
  const m = DOC_MATCHERS[kind];
  return (
    docs.find((d) => d.file_type && m.fileTypes.includes(d.file_type)) ??
    docs.find((d) => m.name.test(d.display_name ?? d.name ?? ""))
  );
}

// ---------- discovery ----------

const hasProspectMessage = (t: Thread) => t.messages.some((m) => m.responder === "OTHER" && !m.isDraft);

/** sequence id -> the Studio campaign that links it. */
async function campaignLinks(client: G8Client): Promise<Map<string, { id: string; name: string }>> {
  const campaigns = await client.listCampaigns();
  const fulls = await Promise.all(campaigns.map((c) => client.getCampaignFull(c.id).catch(() => null)));
  const map = new Map<string, { id: string; name: string }>();
  fulls.forEach((f, i) => {
    for (const l of f?.linked_sequences ?? []) map.set(l.sequence_id, { id: campaigns[i].id, name: campaigns[i].name });
  });
  return map;
}

/**
 * Every sequence in the org with its reply count, most replies first.
 * One pass over each inbox mailbox (no campaign filter) counts replies for all sequences at once.
 */
export async function discoverSources(client: G8Client): Promise<SourceSummary[]> {
  const mailboxes = await client.listInboxMailboxes();
  const [sequences, links, perMailbox] = await Promise.all([
    client.listSequences(),
    campaignLinks(client),
    Promise.all(mailboxes.map(async (mb) => ({ mb, threads: await client.searchEmailThreads([mb]) }))),
  ]);

  const counts = new Map<string, { ids: Set<string>; mailboxes: Set<string> }>();
  for (const { mb, threads } of perMailbox) {
    for (const t of threads) {
      if (!t.sequenceId || !hasProspectMessage(t)) continue;
      const c = counts.get(t.sequenceId) ?? { ids: new Set(), mailboxes: new Set() };
      c.ids.add(t.id);
      c.mailboxes.add(mb);
      counts.set(t.sequenceId, c);
    }
  }

  return sequences
    .map((s) => {
      const link = links.get(s.id);
      const c = counts.get(s.id);
      return {
        sequenceId: s.id,
        sequenceName: s.name ?? s.id,
        sequenceStatus: s.status,
        contactCount: s.contact_count,
        campaignId: link?.id ?? null,
        campaignName: link?.name ?? null,
        replyThreads: c?.ids.size ?? 0,
        mailboxes: [...(c?.mailboxes ?? [])],
      };
    })
    .sort((a, b) => b.replyThreads - a.replyThreads || (b.contactCount ?? 0) - (a.contactCount ?? 0));
}

// ---------- resolving one choice ----------

export interface SourceContext {
  campaign: CampaignFull | null;
  sequences: SequenceDetail[];
  audienceListId: number | null;
  mailboxes: string[]; // sender mailboxes attached to the sequences
  docs: Partial<Record<CampaignDocKind, { id: string; name: string; content: string }>>;
  warnings: string[];
}

export type SourceSelector = { campaignId: string } | { sequenceId: string };

/**
 * Resolve a Studio campaign (all its linked sequences) or a single sequence (plus the campaign that
 * links it, if any) into everything the pipeline needs.
 */
export async function resolveSource(client: G8Client, sel: SourceSelector): Promise<SourceContext> {
  const warnings: string[] = [];
  let campaign: CampaignFull | null = null;
  let sequenceIds: string[];

  if ("campaignId" in sel) {
    campaign = await client.getCampaignFull(sel.campaignId);
    sequenceIds = (campaign.linked_sequences ?? []).map((l) => l.sequence_id);
    if (sequenceIds.length === 0) warnings.push("the campaign has no linked sequences");
  } else {
    sequenceIds = [sel.sequenceId];
    const link = (await campaignLinks(client)).get(sel.sequenceId);
    if (link) campaign = await client.getCampaignFull(link.id);
  }

  const sequences = (await Promise.all(sequenceIds.map((id) => client.getSequence(id).catch(() => null)))).filter(
    (s): s is SequenceDetail => s !== null,
  );
  if (sequences.length < sequenceIds.length) warnings.push(`${sequenceIds.length - sequences.length} linked sequence(s) could not be read`);

  const channels = (await Promise.all(sequences.map((s) => client.getSequenceChannels(s.id).catch(() => [])))).flat();
  const mailboxes = [...new Set(channels.map((c) => c.channel_value).filter((v): v is string => Boolean(v)))];

  const campaignList = campaign?.audience_list_id ? Number(campaign.audience_list_id) : null;
  const seqList = sequences.find((s) => s.associated_list_id)?.associated_list_id ?? null;
  if (campaignList && seqList && campaignList !== seqList) warnings.push(`campaign audience ${campaignList} differs from sequence list ${seqList}`);

  const docs: SourceContext["docs"] = {};
  for (const kind of Object.keys(DOC_MATCHERS) as CampaignDocKind[]) {
    const d = findCampaignDoc(campaign?.documents ?? [], kind);
    const content = d ? withoutOwnSections(docText(d)) : "";
    if (d && content) docs[kind] = { id: d.id, name: d.display_name ?? d.name ?? kind, content };
  }
  if (campaign && !docs.objections) warnings.push("no Messaging & Objections document found on the campaign");

  return { campaign, sequences, audienceListId: campaignList ?? seqList, mailboxes, docs, warnings };
}

/** Replies across every sequence of a resolved source, deduped by thread. */
export async function fetchSourceReplies(client: Pick<G8Client, "listThreads">, ctx: Pick<SourceContext, "sequences">) {
  const seen = new Set<string>();
  const replies: Reply[] = [];
  let threads = 0;
  for (const s of ctx.sequences) {
    for (const t of await client.listThreads(s.id)) {
      if (seen.has(t.id)) continue;
      seen.add(t.id);
      threads++;
      const r = threadToReply(t, s.id);
      if (r) replies.push(r);
    }
  }
  return { threads, replies };
}

/** Pick a source: explicit ids win; otherwise the campaign/sequence with the most replies. */
export function pickDefaultSource(sources: SourceSummary[]): SourceSelector | null {
  const top = sources.find((s) => s.replyThreads > 0);
  if (!top) return null;
  return top.campaignId ? { campaignId: top.campaignId } : { sequenceId: top.sequenceId };
}
