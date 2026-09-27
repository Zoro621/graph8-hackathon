// graph8 Developer API client (server-only).
// Built on @graph8/sdk request(): retries 429/5xx/network with backoff, honours Retry-After,
// adds Idempotency-Key on writes, and throws G8Error on non-2xx.
import { G8Error, request, type RequestOptions } from "@graph8/sdk";
import { SANDBOX_ORG_IDS } from "./config";
import { getEnv } from "./env";
import type { StudioDoc } from "./types";

// ---------- Response shapes (from openapi.json + observed responses, 26 Sep 2026) ----------

export interface Pagination {
  page?: number;
  limit?: number;
  total?: number;
  has_next?: boolean;
  next_cursor?: string | null;
}

export interface SandboxStatus {
  sandbox: boolean;
  environment: string;
  org_id: string;
  message: string;
}

export interface WhoAmI {
  org_id: string;
  user_id?: string;
  role?: string;
  role_name?: string;
}

export interface SequenceListItem {
  id: string;
  name: string | null;
  status: string | null;
  user_email: string | null;
  step_count: number | null;
  contact_count: number | null;
  sequence_kind: string | null;
  associated_list_id: number | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface SequenceDetail extends SequenceListItem {
  description: string | null;
  finish_on_reply: boolean;
  pinned_mailbox_id: number | null;
  send_in_same_thread?: boolean;
  textual_agent_name?: string | null;
}

export interface SequenceStats {
  total_contacts: number;
  step_stats: Record<string, unknown>[];
  skip_reason_breakdown: Record<string, unknown>;
}

export interface SequenceSteps {
  sequence_id: string;
  steps: Record<string, unknown>[];
}

/** One message, normalised across GET /inbox and POST /inbox/emails/search. */
export interface ThreadMessage {
  messageId: string | null;
  from: string | null;
  to: string[];
  content: string; // plain or HTML; see toPlainText()
  responder: "USER" | "AI" | "OTHER" | string | null; // OTHER = the prospect
  date: string | null;
  isDraft: boolean;
}

/** One email thread, normalised. `id` is the id POST /inbox/{id}/tag expects. */
export interface Thread {
  id: string;
  subject: string | null;
  sequenceId: string | null;
  sequenceName: string | null;
  mailbox: string | null;
  contact: { id?: number; email?: string; name?: string; company?: string };
  messages: ThreadMessage[];
  tags: { id: string; name: string }[];
  summary: string | null;
  source: "emails.search" | "inbox";
}

export interface InboxTag {
  id: string;
  name: string;
  [k: string]: unknown;
}

export interface ContactListItem {
  id: number | null;
  first_name: string | null;
  last_name: string | null;
  work_email: string | null;
  job_title: string | null;
  company_id: number | null;
}

/** POST /enrichment/lookup/{person,company}: `data` is provider-shaped (email / work_email, domain, job_title, linkedin_url). */
export interface LookupResult {
  found: boolean;
  confidence?: number;
  data?: Record<string, unknown> | null;
}

export interface SuppressionStatus {
  contact_id: number;
  is_suppressed: boolean;
  active_channels: string[];
  suppressions: Record<string, unknown>[];
}

export type Mailbox = Record<string, unknown> & { id?: number; connection_status?: string; is_archived?: boolean };

export interface CreditBalance {
  credits?: number;
  held_credits?: number;
  available_credits?: number;
  total_used?: number;
}

export interface CampaignDocument {
  id: string;
  file_type?: string;
  display_name?: string;
  name?: string;
  status?: string;
  version?: number;
  content?: string;
  meta_data?: { content?: string };
}

/**
 * One sequence step (POST /sequences `steps[]`). ON_DEMAND: graph8's AI writes each contact's email at
 * send time from `instructions` (hand-written copy is refused on these). MANUAL_TEMPLATE: fixed copy.
 */
export interface SequenceStepConfig {
  step_order: number;
  step_type: "EMAIL";
  input_type: "ON_DEMAND" | "MANUAL_TEMPLATE";
  time_interval: number; // seconds after the previous step
  step_data: { instructions?: string; subject?: string; body?: string; email_type?: "html" | "text" };
}

/** POST /sequences body. No channels: a sequence without a sender cannot send. */
export interface SequenceCreateBody {
  name: string;
  description?: string;
  user_email: string;
  finish_on_reply?: boolean;
  send_in_same_thread?: boolean;
  wait_for_new_contacts?: boolean;
  associated_list_id?: number;
  campaign_id?: string;
  steps?: SequenceStepConfig[];
}

/** POST /sequencer/content/email/{estimate,generate} body: graph8's AI drafting ONE contact's email. */
export interface EmailDraftBody {
  contact_id: number;
  contact_work_email: string;
  first_name: string;
  last_name: string;
  instructions: string;
  lead_info: string;
  agent_name: string;
  studio_campaign_id?: string;
  sequence_id?: string;
  step_order?: number;
  provider?: string;
  model?: string;
}

export interface EmailDraftEstimate {
  estimated_credits?: number;
  capped?: boolean;
  cap?: number;
  model?: string;
  cached?: boolean;
}

/** POST /campaigns body (field limits from the docs: name 255, category 100, persona 200, goal 255). */
export interface CampaignCreateBody {
  name: string;
  category?: string;
  brief?: string;
  core_concept?: string;
  primary_hook?: string;
  target_persona?: string;
  goal?: string;
  audience_list_id?: string;
  target_channels?: string[];
  auto_generate_documents?: boolean;
}

export interface CampaignCreated {
  id: string;
  name?: string;
  status?: string; // "copy_in_progress" when generating, else "draft"
  generation_status?: string; // in_progress | skipped | failed_to_dispatch
  total_documents?: number;
  audience_list_id?: string;
}

export interface CampaignListItem {
  id: string;
  name: string;
  status: string | null;
  goal?: string | null;
  target_persona?: string | null;
  created_at?: string | null;
}

export interface CampaignFull {
  id: string;
  name: string;
  status: string | null;
  goal?: string | null;
  target_persona?: string | null;
  brief?: string | null;
  core_concept?: string | null;
  primary_hook?: string | null;
  channels?: string[];
  audience_list_id?: string | null;
  audience?: { list_id?: string; name?: string; item_count?: number } | null;
  documents?: CampaignDocument[];
  sequence?: { steps?: { step_id: string; day: number; condition?: string | null; stop_on_reply?: boolean }[] } | null;
  step_catalog?: { steps?: Record<string, Record<string, unknown>> } | null;
  linked_sequences?: { sequence_id: string; status?: string }[];
  is_launched?: boolean;
}

export interface CampaignMetrics {
  campaign_id: string;
  metric_status: "available" | "zero" | "stale" | "unknown" | "missing" | string;
  email_metrics: Record<string, number> | null;
  send_receipts?: { dispatched?: number; succeeded?: number; last_dispatched_at?: string } | null;
  is_running?: boolean;
  sequence_count?: number;
}

/** GET /sequences/{id}/reports (only the fields ReplyIQ reads). */
export interface SequenceReport {
  overview?: { total_contacts?: number; reply_rate?: number; meetings_booked?: number; meeting_booked_rate?: number };
  step_breakdown?: { step_order?: number; step_type?: string; step_name?: string; status_counts?: Record<string, number> }[];
}

/** One dialer call outcome from /voice/call-results/search (only the fields ReplyIQ reads). */
export interface CallResult {
  id?: string | number;
  contact_id?: number | string | null;
  disposition?: string | null;
  summary?: string | null;
  sentiment?: string | null;
  transcript?: unknown;
  call_evaluation_result?: unknown;
  call_start_date?: string | null;
  created_at?: string | null;
}

/** A recorded meeting (GET /inbox/meetings). */
export interface MeetingItem {
  id?: string | number;
  contact_id?: number | null;
  title?: string | null;
  status?: string | null;
  analysis?: { summary?: string; objections?: string[]; next_steps?: string[] } | null;
  key_topics?: string[] | null;
}

/** A booked appointment (GET /appointments/bookings). */
export interface BookingItem {
  uid?: string;
  status?: string | null;
  sequence_id?: string | null;
  attendees?: { email?: string; no_show?: boolean }[];
}

/** Document text from a campaign document (content may sit top-level or in meta_data). */
export const docText =(d: CampaignDocument | undefined) => d?.content ?? d?.meta_data?.content ?? "";

interface Envelope<T> {
  data: T;
  pagination?: Pagination | null;
}

// ---------- Errors ----------

/** A readable one-line description of any error thrown by the client. */
export function describeError(err: unknown): string {
  if (err instanceof G8Error) {
    const detail =
      typeof err.detail === "string" ? err.detail : err.detail ? JSON.stringify(err.detail).slice(0, 300) : "";
    const parts = [`graph8 ${err.status || "network"} ${err.type}`, err.message];
    if (detail && detail !== err.message) parts.push(detail);
    if (err.requestId) parts.push(`request ${err.requestId}`);
    return parts.join(" | ");
  }
  return err instanceof Error ? err.message : String(err);
}

export class WriteNotAllowedError extends Error {
  constructor(reason: string) {
    super(`Refusing to write to graph8: ${reason}`);
    this.name = "WriteNotAllowedError";
  }
}

// ---------- Client ----------

export interface G8ClientOptions {
  base: string;
  apiKey: string;
  /** Orgs where writes are allowed even when /sandbox/status is unavailable (sandbox orgs on production). */
  writeOrgIds?: readonly string[];
  fetchImpl?: typeof fetch;
  sleepImpl?: (ms: number) => Promise<void>;
  maxRetries?: number;
}

export type WritePolicy =
  | { allowed: true; via: "sandbox" | "org_allowlist"; orgId: string }
  | { allowed: false; reason: string; orgId?: string };

const MAX_PAGES = 50;
const SEARCH_PAGE_SIZE = 50;

export function createG8Client(opts: G8ClientOptions) {
  const send = <T>(path: string, o: Omit<RequestOptions, "fetchImpl" | "sleepImpl">) =>
    request<T>(opts.base, path, opts.apiKey, {
      maxRetries: opts.maxRetries ?? 2,
      ...o,
      ...(opts.fetchImpl ? { fetchImpl: opts.fetchImpl } : {}),
      ...(opts.sleepImpl ? { sleepImpl: opts.sleepImpl } : {}),
    });
  const sleep = opts.sleepImpl ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));

  // graph8 returned a spurious 401 "Invalid API key" under a burst of parallel requests (27 Sep; the same
  // key succeeded right before and after). Reads (GETs, and POST searches flagged `read`) are retried once;
  // writes never are, and a key that is really invalid fails again.
  const call = async <T>(path: string, o: Omit<RequestOptions, "fetchImpl" | "sleepImpl"> = {}, read = (o.method ?? "GET") === "GET") => {
    try {
      return await send<T>(path, o);
    } catch (err) {
      if (!(err instanceof G8Error && err.status === 401) || !read) throw err;
      await sleep(1000);
      return send<T>(path, o);
    }
  };

  const get = async <T>(path: string, query?: Record<string, unknown>) =>
    (await call<Envelope<T>>(path, { query })).data;

  const getPage = async <T>(path: string, query?: Record<string, unknown>) => {
    const res = await call<Envelope<T[]>>(path, { query });
    return { data: res.data ?? [], pagination: res.pagination ?? null };
  };

  let policyCache: WritePolicy | undefined;

  const client = {
    // ---------- safety ----------
    sandboxStatus: () => get<SandboxStatus>("/sandbox/status"),
    whoAmI: () => get<WhoAmI>("/roles/me/permissions"),

    /**
     * Decide whether writes are allowed. Fails closed:
     * 1. /sandbox/status says sandbox=true, or
     * 2. the key's org (from /roles/me/permissions) is in the allowlist (lib/config.ts + G8_WRITE_ORG_ID).
     */
    async writePolicy(): Promise<WritePolicy> {
      if (policyCache) return policyCache;
      try {
        const s = await client.sandboxStatus();
        if (s?.sandbox === true) return (policyCache = { allowed: true, via: "sandbox", orgId: s.org_id });
      } catch (err) {
        if (!(err instanceof G8Error && err.status === 404)) throw err; // 404 = not the sandbox environment
      }
      const me = await client.whoAmI();
      const allow = opts.writeOrgIds ?? [];
      if (!me?.org_id || !allow.includes(me.org_id)) {
        return (policyCache = {
          allowed: false,
          orgId: me?.org_id,
          reason: `org ${me?.org_id ?? "?"} is not the graph8 developer sandbox and is not in the write allowlist (${allow.join(", ") || "empty"})`,
        });
      }
      return (policyCache = { allowed: true, via: "org_allowlist", orgId: me.org_id });
    },

    /** Call before every write. Throws WriteNotAllowedError unless writePolicy() allows it. */
    async assertWriteAllowed(): Promise<WritePolicy & { allowed: true }> {
      const p = await client.writePolicy();
      if (!p.allowed) throw new WriteNotAllowedError(p.reason);
      return p;
    },

    /** Guarded write: checks the policy first, then sends. */
    async write<T>(
      method: "POST" | "PUT" | "PATCH" | "DELETE",
      path: string,
      body?: unknown,
      idempotencyKey?: string,
      query?: Record<string, unknown>,
    ) {
      await client.assertWriteAllowed();
      return (await call<Envelope<T>>(path, { method, body, idempotencyKey, query }))?.data;
    },

    // ---------- inbox tag writes (all guarded by write()) ----------
    /** Create an inbox tag. The response carries no id, so callers re-read listInboxTags(). */
    createInboxTag: (name: string, description: string) =>
      client.write("POST", "/inbox/tags", { name, description, ai_can_apply: false }, `replyiq-tag:${name}`),
    /** Attach tags to an email thread. Idempotent on graph8's side (verified 26 Sep). */
    tagThread: (threadId: string, tagIds: string[]) =>
      client.write<{ tagged?: boolean; tag_count?: number }>("POST", `/inbox/${encodeURIComponent(threadId)}/tag`, { tag_ids: tagIds }, undefined, { channel: "email" }),
    /**
     * Take a tag off an email thread. NOTE: observed 26 Sep that /inbox/channels/* returns 404 for
     * seeded threads (it cannot see them), so callers must treat failure as non-fatal.
     */
    untagThread: (threadId: string, tagId: string) =>
      client.write("DELETE", `/inbox/channels/${encodeURIComponent(threadId)}/tags`, undefined, undefined, { tag_id: tagId, channel_type: "email" }),

    // ---------- sequences ----------
    async listSequences(): Promise<SequenceListItem[]> {
      const out: SequenceListItem[] = [];
      for (let page = 1; page <= MAX_PAGES; page++) {
        const { data, pagination } = await getPage<SequenceListItem>("/sequences", { page, limit: 100 });
        out.push(...data);
        if (!pagination?.has_next || data.length === 0) break;
      }
      return out;
    },
    getSequence: (id: string) => get<SequenceDetail>(`/sequences/${encodeURIComponent(id)}`),
    getSequenceSteps: (id: string) => get<SequenceSteps>(`/sequences/${encodeURIComponent(id)}/steps`),
    getSequenceStats: (id: string) => get<SequenceStats>(`/sequences/${encodeURIComponent(id)}/stats`),

    // ---------- inbox ----------
    /** Addresses of every inbox mailbox (needed by POST /inbox/emails/search). */
    async listInboxMailboxes(): Promise<string[]> {
      const data = await get<{ items?: { email?: string }[] } | { email?: string }[]>("/inbox/mailboxes/all");
      const items = Array.isArray(data) ? data : (data?.items ?? []);
      return [...new Set(items.map((m) => m.email).filter((e): e is string => Boolean(e)))];
    },

    /**
     * POST /inbox/emails/search. A read despite the verb; returns thread ids, contact ids and tags.
     * Searched ONE mailbox at a time: observed 26 Sep that passing several mailboxes in one call
     * drops results (the [DEMO] threads came back 0 with two mailboxes, 10 with one).
     */
    async searchEmailThreads(mailboxes: string[], campaignIds: string[] = []): Promise<Thread[]> {
      // The same thread can show up under more than one mailbox, so dedupe by id.
      const byId = new Map<string, Thread>();
      for (const mailbox of mailboxes) {
        let seen = 0;
        for (let page = 1; page <= MAX_PAGES; page++) {
          const res = await call<Envelope<{ items?: Record<string, unknown>[]; total?: number }>>("/inbox/emails/search", {
            method: "POST",
            query: { page, page_size: SEARCH_PAGE_SIZE },
            body: { mailboxes: [mailbox], ...(campaignIds.length ? { campaign_ids: campaignIds } : {}) },
            maxRetries: opts.maxRetries ?? 2,
          }, true);
          const items = res.data?.items ?? [];
          for (const t of items.map(fromSearchItem)) if (!byId.has(t.id)) byId.set(t.id, t);
          seen += items.length;
          if (items.length === 0 || seen >= (res.data?.total ?? seen)) break;
        }
      }
      return [...byId.values()];
    },

    /** GET /inbox filtered by sequence, following pagination. */
    async listInboxThreads(sequenceId: string): Promise<Thread[]> {
      const out: Thread[] = [];
      for (let page = 1; page <= MAX_PAGES; page++) {
        const { data, pagination } = await getPage<Record<string, unknown>>("/inbox", {
          channel: "email",
          sequence_id: sequenceId,
          page,
          page_size: 100,
        });
        out.push(...data.map((t) => fromInboxItem(t, sequenceId)));
        if (!pagination?.has_next || data.length === 0) break;
      }
      return out;
    },

    /**
     * Every email thread for a sequence. Uses both readers and merges by thread id:
     * the seeded [DEMO] threads only come back from emails/search; others only from GET /inbox.
     */
    async listThreads(sequenceId: string): Promise<Thread[]> {
      const mailboxes = await client.listInboxMailboxes();
      const [searched, inbox] = await Promise.all([
        client.searchEmailThreads(mailboxes, [sequenceId]),
        client.listInboxThreads(sequenceId),
      ]);
      const byId = new Map<string, Thread>();
      for (const t of [...searched, ...inbox]) if (!byId.has(t.id)) byId.set(t.id, t);
      return [...byId.values()].filter((t) => !t.sequenceId || t.sequenceId === sequenceId);
    },

    getThread: async (threadId: string) =>
      fromInboxItem(await get<Record<string, unknown>>(`/inbox/${encodeURIComponent(threadId)}`, { channel: "email" }), null),

    /** Existing inbox tags (the read side of POST /inbox/tags). */
    async listInboxTags(): Promise<InboxTag[]> {
      // Spec types this as a free-form object, so it may or may not use the {data} envelope.
      const res = await call<Record<string, unknown>>("/workflows/inbox-tags");
      return normaliseTagList(res?.data ?? res);
    },

    // ---------- contacts ----------
    async findContactByEmail(email: string): Promise<ContactListItem | null> {
      const { data } = await getPage<ContactListItem>("/contacts", { email, limit: 1 });
      return data[0] ?? null;
    },
    getSuppression: (contactId: number) => get<SuppressionStatus>(`/contacts/${contactId}/suppression`),

    // ---------- Studio ----------
    async listGlobalDocs(): Promise<StudioDoc[]> {
      const data = await get<Record<string, unknown>[]>("/global-context/documents", { include_content: true });
      return (data ?? []).map(toStudioDoc);
    },

    // ---------- M5: lists + draft campaigns (writes guarded by write()) ----------
    createList: (title: string, description: string, idempotencyKey?: string) =>
      client.write<{ id: number; title: string; total?: number }>("POST", "/lists", { title, type: "contacts", description }, idempotencyKey),

    /**
     * Add contacts to a list. On 409 CONFLICT_REVIEW_REQUIRED (contacts graph8 warns about, e.g.
     * already in other outreach) retry with skip_all: warned contacts are left out, never forced in.
     */
    async addContactsToList(listId: number, contactIds: number[]): Promise<{ conflictSkipped: boolean; detail?: unknown }> {
      try {
        await client.write("POST", `/lists/${listId}/contacts`, { contact_ids: contactIds });
        return { conflictSkipped: false };
      } catch (err) {
        if (!(err instanceof G8Error && err.status === 409)) throw err;
        await client.write("POST", `/lists/${listId}/contacts`, { contact_ids: contactIds, conflict_resolution: "skip_all" });
        return { conflictSkipped: true, detail: err.detail };
      }
    },
    async listContactsOfList(listId: number): Promise<{ id: number | null; work_email: string | null }[]> {
      const out: { id: number | null; work_email: string | null }[] = [];
      for (let page = 1; page <= MAX_PAGES; page++) {
        const { data, pagination } = await getPage<{ id: number | null; work_email: string | null }>(`/lists/${listId}/contacts`, { page, limit: 100 });
        out.push(...data);
        if (!pagination?.has_next || data.length === 0) break;
      }
      return out;
    },
    /** CRM contact search (free). `name` matches first OR last name, partially: filter exactly yourself. */
    async searchContacts(q: { name?: string; company_name?: string; limit?: number }): Promise<ContactListItem[]> {
      const { data } = await getPage<ContactListItem>("/contacts", { ...q, limit: q.limit ?? 25 });
      return data;
    },

    // ---------- paid lookups (guarded by write(): they spend credits, and only run after a person holds the button) ----------
    /** POST /enrichment/lookup/company by name: the company's domain. About 1-2 credits. */
    lookupCompany: (name: string) => client.write<LookupResult>("POST", "/enrichment/lookup/company", { name }),
    /** POST /enrichment/lookup/person by name + company domain: the person's work email. About 1-2 credits. */
    lookupPerson: (q: { first_name: string; last_name: string; company_domain: string }) => client.write<LookupResult>("POST", "/enrichment/lookup/person", q),
    /** POST /contacts: a CRM contact (no list). Idempotent per email. */
    createContact: (body: { first_name: string; last_name: string; work_email: string; company_domain?: string; job_title?: string; linkedin_url?: string }) =>
      client.write<ContactListItem>("POST", "/contacts", body, `replyiq-contact:${body.work_email.toLowerCase()}`),
    createCampaign: (body: CampaignCreateBody, idempotencyKey?: string) =>
      client.write<CampaignCreated>("POST", "/campaigns", body, idempotencyKey),
    getCampaign: (id: string) => get<{ id: string; name: string; status: string | null; documents?: { id: string; name?: string; type?: string }[] }>(`/campaigns/${encodeURIComponent(id)}`),
    async listCampaignDocs(id: string): Promise<CampaignDocument[]> {
      const data = await get<{ documents?: CampaignDocument[] } | CampaignDocument[]>(`/campaigns/${encodeURIComponent(id)}/documents`);
      return Array.isArray(data) ? data : (data?.documents ?? []);
    },
    getCampaignDoc: (id: string, docId: string) =>
      get<CampaignDocument>(`/campaigns/${encodeURIComponent(id)}/documents/${encodeURIComponent(docId)}`),
    /**
     * PUT the document's text. `status` is the document's Studio status: a document graph8's generator left
     * `failed` keeps that badge even after ReplyIQ fills it, unless the write says it is now `completed`.
     */
    updateCampaignDoc: (id: string, docId: string, content: string, status?: "completed") =>
      client.write<CampaignDocument>("PUT", `/campaigns/${encodeURIComponent(id)}/documents/${encodeURIComponent(docId)}`, { content, ...(status ? { status } : {}) }),

    // ---------- Studio campaigns ----------
    async listCampaigns(): Promise<CampaignListItem[]> {
      const out: CampaignListItem[] = [];
      for (let page = 1; page <= MAX_PAGES; page++) {
        const { data, pagination } = await getPage<CampaignListItem>("/campaigns", { page, limit: 100 });
        out.push(...data);
        if (!pagination?.has_next || data.length === 0) break;
      }
      return out;
    },
    /** Campaign + audience + ALL documents with content + sequence + step catalog + linked_sequences. */
    getCampaignFull: (id: string) => get<CampaignFull>(`/campaigns/${encodeURIComponent(id)}/full`),
    getCampaignMetrics: (id: string, days = 30) =>
      get<CampaignMetrics>(`/campaigns/${encodeURIComponent(id)}/metrics`, { days }),

    /** Take contacts out of a list (e.g. when a newer run's audience replaces an adopted draft's). Guarded write. */
    removeContactsFromList: (listId: number, contactIds: number[]) => client.write("DELETE", `/lists/${listId}/contacts`, { contact_ids: contactIds }),
    /** Update a campaign's content fields (brief, hook, persona...). Guarded write; never launches. */
    updateCampaign: (id: string, fields: Partial<Pick<CampaignCreateBody, "brief" | "core_concept" | "primary_hook" | "target_persona" | "goal">>) =>
      client.write<Record<string, unknown>>("PATCH", `/campaigns/${encodeURIComponent(id)}`, fields),

    // ---------- other Engage channels (read-only) ----------
    /** A sequence's full report: overview, per-step funnel, engagement. */
    getSequenceReport: (id: string) => get<SequenceReport>(`/sequences/${encodeURIComponent(id)}/reports`),
    /** Dialer call outcomes, newest first. READ-ONLY despite the POST; filters by disposition, paged. */
    async searchCallResults(q: { dispositions?: string[]; page?: number; pageSize?: number } = {}): Promise<CallResult[]> {
      const body = { ...(q.dispositions ? { dispositions: q.dispositions } : {}), page: q.page ?? 1, page_size: q.pageSize ?? 100 };
      const data = (await call<Envelope<{ items?: CallResult[]; call_results?: CallResult[] }>>("/voice/call-results/search", { method: "POST", body }, true)).data;
      return data?.items ?? data?.call_results ?? [];
    },
    /** Recorded meetings with their analysis (objections, next steps). */
    async listMeetings(limit = 50): Promise<MeetingItem[]> {
      const data = await get<{ items?: MeetingItem[]; meetings?: MeetingItem[] } | MeetingItem[]>("/inbox/meetings", { limit });
      return Array.isArray(data) ? data : (data?.items ?? data?.meetings ?? []);
    },
    /** Booked appointments; each carries the sequence it came from and no-show flags. */
    async listBookings(take = 100): Promise<BookingItem[]> {
      const data = await get<{ items?: BookingItem[]; bookings?: BookingItem[] } | BookingItem[]>("/appointments/bookings", { take });
      return Array.isArray(data) ? data : (data?.items ?? data?.bookings ?? []);
    },
    async countNurtures(): Promise<number> {
      const data = await get<{ nurtures?: unknown[]; total?: number }>("/nurtures");
      return data?.total ?? data?.nurtures?.length ?? 0;
    },
    async countNewsletters(): Promise<number> {
      const data = await get<unknown[] | { items?: unknown[]; total?: number }>("/newsletters");
      return Array.isArray(data) ? data.length : (data?.total ?? data?.items?.length ?? 0);
    },

    // ---------- sequences: extras ----------
    async getSequenceChannels(id: string): Promise<{ channel_type?: string; channel_value?: string; channel_id?: number }[]> {
      const data = await get<{ items?: Record<string, unknown>[] } | Record<string, unknown>[]>(
        `/sequences/${encodeURIComponent(id)}/channels`,
      );
      return (Array.isArray(data) ? data : (data?.items ?? [])) as { channel_type?: string; channel_value?: string }[];
    },

    // ---------- mailboxes ----------
    listMailboxes: () => get<Mailbox[]>("/mailboxes"),

    // ---------- follow-up sequences (writes guarded by write()) ----------
    /** Create a DRAFT sequence. Nothing sends: no channel is attached and it is never run here. */
    createSequence: (body: SequenceCreateBody, idempotencyKey?: string) =>
      client.write<{ id: string; name?: string; status?: string }>("POST", "/sequences", body, idempotencyKey),
    /** Change one step of a (draft) sequence. */
    updateSequenceStep: (sequenceId: string, stepId: string, patch: Partial<Pick<SequenceStepConfig, "step_type" | "input_type" | "time_interval" | "step_data">>) =>
      client.write("PATCH", `/sequences/${encodeURIComponent(sequenceId)}/steps/${encodeURIComponent(stepId)}`, patch),
    /** Append steps to a (draft) sequence. */
    addSequenceSteps: (sequenceId: string, steps: SequenceStepConfig[]) => client.write("POST", `/sequences/${encodeURIComponent(sequenceId)}/steps`, { steps }),
    /** Price graph8's AI drafting one email. Free (a POST, but spends nothing and saves nothing). */
    estimateEmailDraft: async (body: EmailDraftBody) =>
      (await call<Envelope<EmailDraftEstimate>>("/sequencer/content/email/estimate", { method: "POST", body }, true)).data,
    /** graph8's AI drafts one contact's email now. SPENDS CREDITS; nothing is saved or sent. Guarded like a write. */
    generateEmailDraft: async (body: EmailDraftBody) => extractEmailDraft(await client.write<unknown>("POST", "/sequencer/content/email/generate", body)),

    // ---------- Studio Global documents ----------
    async getGlobalDoc(id: string): Promise<StudioDoc> {
      return toStudioDoc((await get<Record<string, unknown>>(`/global-context/documents/${encodeURIComponent(id)}`)) ?? {});
    },
    /** Save a company-wide Studio document. graph8 records a version per save, but a document's FIRST save becomes version 1 itself (observed 27 Sep). */
    updateGlobalDoc: (id: string, content: string) =>
      client.write<Record<string, unknown>>("PATCH", `/global-context/documents/${encodeURIComponent(id)}`, { content }),

    // ---------- credits ----------
    /** Credit balance (read-only). Accepts the enveloped and the bare response shape. */
    async getUsage(): Promise<CreditBalance> {
      const res = await call<Envelope<CreditBalance> & CreditBalance>("/usage");
      return res?.data ?? res;
    },
  };
  return client;
}

export type G8Client = ReturnType<typeof createG8Client>;

let defaultClient: G8Client | undefined;

/** The client configured from .env.local. */
export function g8(): G8Client {
  if (!defaultClient) {
    const env = getEnv();
    const writeOrgIds = [...SANDBOX_ORG_IDS, ...(env.G8_WRITE_ORG_ID ? [env.G8_WRITE_ORG_ID] : [])];
    defaultClient = createG8Client({ base: env.G8_API_BASE, apiKey: env.G8_API_KEY, writeOrgIds });
  }
  return defaultClient;
}

// ---------- normalisers ----------

function str(v: unknown): string | undefined {
  return typeof v === "string" && v.length > 0 ? v : undefined;
}

/**
 * Subject + body from POST /sequencer/content/email/generate. The spec only says "returns the subject
 * and body", so accept them at the top level or under a nested `email` / `draft` / `content` object.
 */
export function extractEmailDraft(raw: unknown): { subject: string; body: string } {
  const o = (raw ?? {}) as Record<string, unknown>;
  for (const c of [o, o.email, o.draft, o.content, o.result]) {
    const x = (c ?? {}) as Record<string, unknown>;
    const subject = str(x.subject);
    const body = str(x.body) ?? str(x.html) ?? str(x.text);
    if (subject || body) return { subject: subject ?? "", body: body ?? "" };
  }
  throw new Error(`graph8 returned no email draft (keys: ${Object.keys(o).join(", ") || "none"})`);
}

function num(v: unknown): number | undefined {
  const n = typeof v === "string" ? Number(v) : v;
  return typeof n === "number" && Number.isFinite(n) ? n : undefined;
}

function tagsOf(raw: unknown): { id: string; name: string }[] {
  return (Array.isArray(raw) ? raw : [])
    .map((t) => t as Record<string, unknown>)
    .filter((t) => t && t.id != null)
    .map((t) => ({ id: String(t.id), name: String(t.name ?? "") }));
}

/** Item from POST /inbox/emails/search: messages live at messages.messages[], contact carries an id. */
export function fromSearchItem(raw: Record<string, unknown>): Thread {
  const msgs = ((raw.messages as { messages?: unknown[] })?.messages ?? []) as Record<string, unknown>[];
  const c = (raw.contact ?? {}) as Record<string, unknown>;
  const name = [str(c.first_name), str(c.last_name)].filter(Boolean).join(" ") || str(c.name);
  return {
    id: String(raw.id),
    subject: str(raw.subject) ?? null,
    sequenceId: str(raw.campaign_id) ?? null,
    sequenceName: str(raw.campaign_name) ?? null,
    mailbox: str(raw.mailbox) ?? null,
    contact: { id: num(c.id), email: str(c.email)?.toLowerCase(), name, company: str(c.company_name) ?? str(c.company) },
    messages: msgs.map((m) => ({
      messageId: str(m.message_id) ?? null,
      from: (Array.isArray(m.from_email) ? str(m.from_email[0]) : str(m.from_email)) ?? null,
      to: (Array.isArray(m.to) ? m.to : []).map(String),
      content: str(m.content) ?? str(m.html_content) ?? "",
      responder: str(m.responder) ?? null,
      date: str(m.date) ?? null,
      isDraft: m.draft === true,
    })),
    tags: tagsOf(raw.tags),
    summary: str(raw.summary) ?? null,
    source: "emails.search",
  };
}

/** Item from GET /inbox or GET /inbox/{id} (documented InboxThreadResponse). */
export function fromInboxItem(raw: Record<string, unknown>, sequenceId: string | null): Thread {
  const msgs = (Array.isArray(raw.messages) ? raw.messages : []) as Record<string, unknown>[];
  const c = (raw.contact ?? {}) as Record<string, unknown>;
  return {
    id: String(raw.id),
    subject: str(raw.subject) ?? null,
    sequenceId,
    sequenceName: null,
    mailbox: null,
    contact: { id: num(c.id), email: str(c.email)?.toLowerCase(), name: str(c.name), company: str(c.company) },
    messages: msgs.map((m) => ({
      messageId: str(m.message_id) ?? null,
      from: str(m.from_address) ?? null,
      to: (Array.isArray(m.to_addresses) ? m.to_addresses : []).map(String),
      content: str(m.content) ?? "",
      responder: str(m.responder) ?? null,
      date: str(m.date) ?? null,
      isDraft: m.is_draft === true,
    })),
    tags: tagsOf(raw.tags),
    summary: null,
    source: "inbox",
  };
}

export function toStudioDoc(raw: Record<string, unknown>): StudioDoc {
  const meta = (raw.meta_data ?? {}) as Record<string, unknown>;
  return {
    id: String(raw.id ?? ""),
    displayName: str(raw.display_name) ?? str(raw.name) ?? str(raw.file_type) ?? "Untitled",
    fileType: str(raw.file_type),
    category: str(raw.category),
    content: str(raw.content) ?? str(meta.content) ?? "",
    // current_version counts saves; version stayed 1 across saves (observed 27 Sep)
    ...(typeof raw.current_version === "number" ? { version: raw.current_version } : typeof raw.version === "number" ? { version: raw.version } : {}),
    ...(str(raw.updated_at) ? { updatedAt: str(raw.updated_at) } : {}),
  };
}

/** /workflows/inbox-tags is untyped in the spec; accept an array or {tags|items|results: [...]}. */
export function normaliseTagList(data: unknown): InboxTag[] {
  const obj = (data ?? {}) as Record<string, unknown>;
  const arr = Array.isArray(data)
    ? data
    : ((["tags", "items", "results"].map((k) => obj[k]).find(Array.isArray) as unknown[] | undefined) ?? []);
  return arr
    .map((t) => t as Record<string, unknown>)
    .filter((t) => t && (t.id != null || t.tag_id != null))
    .map((t) => ({ ...t, id: String(t.id ?? t.tag_id), name: String(t.name ?? t.tag_name ?? "") }));
}
