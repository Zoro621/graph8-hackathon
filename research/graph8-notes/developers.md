# graph8 Developer Platform — Knowledge Base (developers/* docs)

Source: docs.graph8.com/developers/* (61 pages read; MCP reference/tools/examples/faq and *-setup pages covered elsewhere). Cross-referenced `api_by_tag.txt` (full endpoint inventory) and, for sandbox only, `developers__mcp-reference__api-coverage.md`. Anything marked **[CONFLICT]** is a place where docs disagree with each other — verify live before relying on it. Anything marked **[not in dev docs]** comes from api_by_tag.txt only (endpoint exists, but no prose page).

---

## 0. TL;DR for the hackathon

- **Base URL:** `https://be.graph8.com/api/v1` (Swagger: `be.graph8.com/api/v1/docs`; LLM index: `https://docs.graph8.com/llms.txt`). Auth: `Authorization: Bearer <api_key>` (opaque key, JWTs rejected). The org comes from the key; you never send org_id.
- **Four surfaces, same backend:** REST (`/api/v1/*`, "300+ endpoints" per getting-started; "~150" per API FAQ; api_by_tag lists far more), JS SDK `@graph8/sdk`, CLI `g8` (`pip install g8-mcp-server`), MCP server `https://be.graph8.com/mcp/` (OAuth).
- **Two data pools:** *your data* (CRM: `/contacts`, `/companies`, `/lists` — free CRUD) vs *open data index* (700M+ contacts / 100M+ companies: `/search/*`, `/enrichment/lookup/*` — free on PAYG/Platform within rate cap per pricing page). Flow: DISCOVER (search/lookup) → SAVE (`/search/.../save` creates a list) → MANAGE → ENRICH (waterfall, costs credits).
- **Rate limit:** 50 req/s + 1,000 req/min per org, all plans. 429 + `Retry-After`.
- **Credits cost money only for:** 3rd-party waterfall enrichment, AI/LLM generation, sends (1 cr/step), voice (20 cr/min), meeting bookings (20 cr), external email verifiers, intent processing, audience-sync pushes. Free: PAYG signup 1,000 credits ($0.05/credit); Platform $499/mo w/ 75k credits.
- **Sandbox exists but is thinly documented:** test keys `g8_test_…`; `/sandbox/*` endpoints (status, simulated outbox, failure injection, fixture seed/reset/snapshot/restore) — test-mode keys only. No documented way to inject *inbound replies/meetings*.
- **Outcome reads for a flywheel:** sequence analytics/stats/reports, campaign metrics, `/inbox` threads (filter by `sequence_id`), webhooks (`engagement.email_replied` with `is_positive`, `meeting.booked`…), `GET /events` poll, `/inbox/meetings` (transcripts, key_topics, action_items), dialer transcripts/dispositions.

---

## 1. Getting started

### 1.1 Plans (from Getting Started + Pricing)
| | Free trial | PAYG | Platform |
|---|---|---|---|
| Price | $0 | $0.05/credit | $499/month |
| Free credits on signup | "see below" | 1,000 (no expiry, no card) | 2,500 trial credits (no card) |
| Included AI credits/mo | – | pay per credit | 75,000 (~$3,750 PAYG-equivalent); overage $0.00666/credit |
| graph8-owned data (contacts CRM, B2B index search/lookup, intent, visitors) | **Metered (1 cr/record)** | Free (within 50 rps) | Free (within 50 rps) |
| Auto-CRM-capture | Off | On (default) | On (default) |
| Rate limit | 50 rps | 50 rps | 50 rps |
| Work email required | Yes (gmail/yahoo/outlook blocked) | Yes | Yes |

"Try the developer tier free - 1,000 credits, no card required." Every feature available on PAYG (no feature walls). Platform upgrade is instant; downgrade to PAYG at end of billing cycle. Data stays on downgrade.

### 1.2 Which integration path
| Building | Use | Why |
|---|---|---|
| Browser app (React/Next/Vue) | JS SDK (write key) | Typed, SSR-safe, React hooks, widgets |
| Server script/backend | REST API or CLI (API key) | |
| AI-powered workflows | MCP Server (OAuth) | "43 tools" (getting-started); api-mcp-coverage says registry now 599 tools, 564/564 API ops covered, server 0.64.0 |
| Quick prototype | CLI | JSON output |

### 1.3 API surfaces
| Surface | Mount | Auth | Use |
|---|---|---|---|
| Developer API | `https://be.graph8.com/api/v1/*` | Bearer API key | Everything in docs; SDK/CLI/MCP proxy it |
| Internal Studio | `/v1/*`, `/campaign-builder/*` | PropelAuth session cookie | First-party UI only — do not integrate |
| Public (write-key) | `/api/v1/public/*` | `X-Write-Key` (browser-safe) + Origin allow-list | tracking, public-form enrich, copilot chat |
| Intent-search | `/intent-search/*` (no /api/v1 prefix) | Bearer | "the one outlier" |

Response envelope: `{ "data": ..., "pagination": {page, limit, total, has_next, next_cursor} }`. Exceptions: `POST /intent/pages/visitor-counts` returns `{counts}` directly; `POST /intent/keywords/{id}/filters` returns `{status, keyword_id}`; workflows list returns `{actions, total_count}`; `/companies/columns` returns bare array.

---

## 2. Authentication & keys

### 2.1 Key types
| Method | For | Where |
|---|---|---|
| API key | REST, CLI, SDK server-side | Settings > MCP & API > API tab (org, admin) or Profile > Developer (personal) |
| Write key | SDK client-side (tracking, visitor ID, forms, widgets, copilot, public signals) — browser-safe | Settings > MCP & API > tracking snippet (also `GET /snippet` returns `write_key`) |
| OAuth | MCP server / `g8 login` | Paste URL / browser |

- API key properties: org-scoped (all org data), opaque token (not JWT), optional expiry 1–365 days, rotate via delete+create or Rotate button, shown **once**.
- Personal key (Profile > Developer) = "your user inside the active org"; org key (Settings > API) = whole org. A personal key is bound to the org active when issued.
- Error cases: 401 missing header (`{"detail": "Missing Authorization header. Use: Authorization: Bearer <api_key>"}`), 401 JWT given, 401 key not tied to org.

### 2.2 Live vs test keys (Stripe-style)
- Prefix `g8_live_…` vs `g8_test_…`; mode stamped at creation and authoritative (editing prefix changes nothing). Legacy unprefixed keys = live. Prefix is stripped automatically before validation.
- Create: `POST /v1/api-keys` (note: **`/v1/`** path on be.graph8.com in api-keys/key-scopes pages; auth page shows `POST https://be.graph8.com/api/v1/api-keys`) body `{"name":"CI test key","mode":"test"}` → `{ "api_key_id", "api_key_token": "g8_test_...", "name", "mode" }`. **[CONFLICT]** agency-keys page shows response `{data:{id,name,is_agency,token:"sk_live_..."}}` and auth page shows `{token, name, is_agency}`.
- List: `GET /v1/api-keys` → `{keys:[{api_key_id,name,mode,is_agency,created_at,last_used_at}], total}` (tokens never returned; `last_used_at` ~per-minute granularity).
- **Caveat (api-keys page):** "Test keys are tagged test-mode today… Full sandbox data isolation — a test key only sees sandbox data — ships with the dedicated sandbox environment. Until then, treat a test key as operating against real data."

### 2.3 Restricted keys (scopes)
- Pass `scopes` to `POST /v1/api-keys`, e.g. `{"name":"read-only usage","scopes":["usage:read","contacts:read"]}`. Scope grammar: `*`, `contacts:*`, `contacts:read`. No scopes = unrestricted (all legacy keys).
- Missing scope → 403 `{ "type": "forbidden", "code": "403", ... }`. **Soak mode:** enforcement currently logs-only unless `ENFORCE_DEVAPI_SCOPES=true`, EXCEPT `campaigns:launch` which is enforced fail-closed on `POST /campaigns/{id}/launch` for restricted keys.
- Scopes mentioned elsewhere: `usage:read` (GET /usage), `tasks:write`, `tasks:run`, `tasks:read`, `contacts:read`, `inbox:read`, `inbox:run` (api_by_tag).

### 2.4 X-Org-Id (guard, not switch)
- Optional. Key only → key's org. Key + matching `X-Org-Id` (case-insensitive) → 200. Mismatch → 403. Use as defensive assertion. (API FAQ claims "two required headers" incl. X-Org-Id but then says it's auto-set; treat as optional.)
- Multiple orgs: mint one key per org. MCP sessions have `g8_current_org/g8_list_orgs/g8_switch_org` — independent of REST keys.

### 2.5 Agency keys & X-Target-Org-Id (added 2026-06-19)
- Mint: `POST /api-keys` with `{"name":"CIENCE agency ops","is_agency":true}`; 400 if org isn't a recognized agency (no linked client orgs / not flagged); 403 if caller lacks API-key admin permission.
- Use: agency key + `X-Target-Org-Id: org_client123` → acts on that client org. No header → agency's own org; target outside set → 403; normal key + header → header ignored.
- Only honored on `/api/v1/*`. Distinct from `X-Org-Id` (which still checks against the agency's own org). Credits charged to the client org. Destructive marketplace ops (e.g. approving SDR invoice → Stripe charge) refused for agency machine keys.
- `GET /agency/me` → `{agency_org_id, agency_org_name, is_agency, client_count, target_header:"X-Target-Org-Id"}`; `GET /agency/clients` → `[{org_id}]`. Both 403 for non-agency keys. SDK: `g8.agency.me()`, `g8.agency.clients()`.

---

## 3. Sandbox (test mode)

Only documented in the MCP api-coverage reference + api_by_tag (no dedicated developer page). All are "Test-mode sandbox only; a live key is rejected by the API." MCP tools wrap them (`g8_sandbox_sandbox_*`, with `confirm=true` required for writes).

| Endpoint | Purpose / inputs |
|---|---|
| `GET /sandbox/status` | "Confirm this is the developer sandbox and which org the key acts as." |
| `GET /sandbox/outbox` | "Every simulated outbound side effect for your org, newest first." Query: `channel` (filter), `limit` 1–200, `offset` ≥0 |
| `GET /sandbox/failure-injection` | List failure rules |
| `PUT /sandbox/failure-injection` | "Make the next simulated sends on a channel fail the way you choose." Body `{channel, failure_mode, remaining?}` — channel: `email, sms, whatsapp, voice, linkedin, crm, ads, calendar, "*"`; failure_mode: `hard_bounce, provider_error, timeout, rate_limited, invalid_recipient`; `remaining`: fail N sends then auto-clear (omit = until cleared) |
| `DELETE /sandbox/failure-injection` | Clear rules; optional `channel` to clear one |
| `POST /sandbox/fixtures/seed` | "Insert the standard sandbox fixture set into your org. Idempotent." |
| `POST /sandbox/fixtures/reset` | Delete all seeded fixture rows and reseed |
| `POST /sandbox/fixtures/snapshot` | Save fixture tables under `name` (1–64 chars `^[A-Za-z0-9_\-]+$`) |
| `POST /sandbox/fixtures/restore` | Restore snapshot `name`. "Only sandbox-fixture rows (`meta.sandbox_fixture = true`) are replaced — any records you created thro[ugh the API are left alone]" |

Gaps: fixture contents undocumented; **no endpoint to simulate inbound replies, positive/negative sentiment, meetings booked, or opens/clicks.** Failure injection covers outbound failures only. Given the api-keys caveat, call `GET /sandbox/status` first to prove you're isolated before any send-like call.

---

## 4. Rate limits, pagination, idempotency, errors, logs

### 4.1 Rate limits
- 50 req/s + 1,000 req/min per org (keyed off API key), all `/api/v1/*` data endpoints, same on every plan, no monthly cap.
- Headers on every response: `X-RateLimit-Limit-Second` (50), `X-RateLimit-Limit-Minute` (1000), `X-RateLimit-Remaining` (left in minute window), `X-RateLimit-Reset` (unix epoch), `Retry-After` (429 only). 429 body `{"detail":"Rate limit exceeded. Please slow down."}`.
- Tip: 1,000 rpm × 200/page ≈ 200k records/min read. CLI docs suggest `xargs -P 3` + `sleep 0.6` for parallel lookups. Batch keyword adds count N units.

### 4.2 Pagination
- Query `page` (default 1), `limit` (default 50, 1–200), `cursor` (opaque, from `next_cursor`, takes precedence over page). Response `pagination: {page, limit, total, has_next, next_cursor}`. Malformed cursor → 400 `{type:"bad_request"}`. Prefer cursor for full walks; check `has_next`/null cursor rather than math. Order is not guaranteed.
- Exceptions: `/search/contacts|companies` max `limit` 100 and `page×limit ≤ 10,000` (use save-to-list for more); `/companies/{id}/contacts` uses `limit`(default 100)/`offset`; `/inbox` uses `page_size` (1–100); `/inbox/meetings` `page_size` (max 100); `/appointments/bookings` `skip/take` (take max 100); `/tasks` `limit` (≤200)/`offset`; OpenSearch uses `search_after` `cursor` array; voice sessions `page_size`.

### 4.3 Idempotency (Stripe pattern)
- Header `Idempotency-Key` (≤255 chars; UUID v4 recommended). First response cached 24h per org+key; retries return it with `Idempotent-Replay: true`. Opt-in; ignored on unsupported endpoints.
- **Supported today: `POST /api/v1/contacts` only** ("rolling out across POST create endpoints"). Also required (UUID) on `POST /tasks/{id}/start`. SDK mutating sequence methods (`add, create, run, pause, resume`) and `contacts.create` accept a trailing idempotency-key arg.
- Concurrency: simultaneous same-key requests may both execute — serialize retries. Different payload with same key → first cached response returned regardless.
- Upserts (`PUT .../assert`) are the other idempotency tool (see §6.4).

### 4.4 Errors **[CONFLICT: three envelope shapes documented]**
- Errors page: `{"detail": "Company not found"}`; validation: `{"detail":[{"loc":["body","work_email"],"msg":"...","type":"value_error.email"}]}`.
- API FAQ / intent / voice / pipelines pages: `{"error":{"code":"validation_error","message":"...","field":"work_email","request_id":"req_abc123"}}`.
- Scopes/pagination: `{"type":"forbidden"|"bad_request","code":"403",...}`. SDK's `G8Error` normalizes to `status,type,code,requestId,detail,retryable`.
- Codes: 200/201/204; 400 bad request (missing fields, empty PATCH "No fields to update", invalid list type, bad cursor); 401 key problems; **402 out of credits (PAYG)**; 403 wrong org/scope; 404; 409 conflict (duplicate / slug collision / transitional sequence state — use assert for dupes); 422 validation; 429; 5xx retry w/ backoff (intent/voice pages suggest 5s → 30s → 120s).
- Common gotchas listed: `list_id is required when creating contacts`; valid list types `contacts, companies, suppressions, deals, leads`.

### 4.5 Request logs & correlation
- Every response carries `X-Request-Id`. `GET /api/v1/logs?limit=50` (1–200) → `[{request_id, method, path, status, timestamp}]`, newest first. Rolling ~100 most recent, ≤7 days, no bodies, best-effort. CLI: `g8 logs --limit 20`.

---

## 5. Webhooks & events

### 5.1 Management
- `GET /webhooks/events` → catalog `[{event, category, description}]` (CLI `g8 webhooks-events`).
- `GET /webhooks?is_active=` list; `POST /webhooks` body `{url (req), events[] (req), name?}` → 201, returns `secret` (`whsec_…`) **once**; **max 10 active webhooks per org**. `GET /webhooks/{id}` (no secret), `PATCH /webhooks/{id}` `{url, events, name, is_active}`. `GET /webhooks/{id}/deliveries?page&limit&status=success|failed|pending` → `{id, event, status, attempts, max_attempts:3, response_code, error_message, created_at, completed_at}`. Subscribe to all with `events: ["*"]`. api_by_tag also has secret rotation (MCP tool `g8_webhook_rotate_webhook_secret`).
- Retries: up to 3 with delays 10s → 60s → 300s; retries keep the original timestamp (never re-signed).

### 5.2 Delivery format & signing
- Envelope: `{ "event": "campaign.launched", "timestamp": "2026-05-25T12:34:56.789000Z", "org_id": "org_xxx123", "data": {...} }`.
- Headers: `Content-Type: application/json`, `X-Studio-Signature: sha256=<hex>`, `X-Studio-Timestamp` (unix secs), `X-Studio-Event`, `X-Studio-Delivery-Id` (unique per attempt — idempotency).
- Signature = HMAC-SHA256(secret, `"{X-Studio-Timestamp}.{raw_body}"`), compare constant-time; reject if |now − timestamp| > 5 min. Verify on raw bytes before parsing.
- **[CONFLICT]** API FAQ says create body includes `"secret":"whsec_xxx"`, header `X-G8-Signature`, HMAC over body, and legacy event names `reply_received, meeting_booked, contact_enriched, contact_created, sequence_completed, campaign_launched, form_submitted, visitor_identified`. SDK `g8.webhooks.on('reply_received', cb)` uses the same legacy names. Webhooks page says `engagement.email_replied` is what "subscribers ask for as reply_received". Build against the Webhooks page (X-Studio-*), and check `GET /webhooks/events` live.
- A `test` event exists: `{ "test": true, "message": "This is a test webhook from Graph8 Studio" }`.

### 5.3 Event catalog (40+; categories)
- **Campaign:** campaign.created/updated/deleted/launched/paused/completed/status_changed
- **Content:** document.generated, document.failed, campaign.content_ready
- **Intelligence:** intelligence.completed/failed
- **Enrichment:** company.enriched, company_intelligence.completed, enrichment.job_completed, enrichment.job_failed
- **Audience:** audience.ready/failed
- **Sequence:** sequence.draft_created, sequence.started, sequence.paused, sequence.completed
- **Engagement:** engagement.email_sent/email_replied/email_bounced/email_skipped/email_clicked, engagement.link_clicked, engagement.call_dispatched, engagement.call_recording_ready, engagement.sms_sent/sms_replied, engagement.whatsapp_sent, engagement.linkedin_connection_sent/message_sent/inmail_sent/reply_received/connection_accepted
- **Meetings:** meeting.booked/cancelled/rescheduled/no_show
- **Voice AI:** voice_ai.call_started, voice_ai.call_completed (duration, disposition, sentiment), voice_ai.voicemail_left
- **Deals:** deal.created/updated/stage_changed/deleted
- **Quotes:** quote.created/updated/sent/resent/resend_failed/link_generated/viewed/accepted/declined/expired/voided/superseded/archived/unarchived/payment_received/payment_failed/subscription_canceled/provisioned
- **Website:** form.submitted, visitor.identified (≤1/visitor/day), intent.signal (≤1/contact/keyword/page/day)
- **Tasks:** task.created/updated/completed/deleted
- **Workflows:** workflow.execution_completed/failed

Key payloads:
- `engagement.email_replied`: `{contact_id, email, reply_subject, sequence_id, campaign_id, replied_at, is_positive}` (fires when AI Inbox detects a reply on an outbound message).
- `meeting.booked/cancelled/rescheduled`: `{contact_id, email, meeting_id, meeting_title, scheduled_at, duration_minutes, sequence_id, campaign_id, booked_at}`.
- `sequence.started/paused/completed`: `{sequence_id, campaign_id, contacts_completed, completed_at}`; `sequence.draft_created`: `{sequence_id, sequence_name, campaign_id, status:"drafted", steps_created, created_at}` (draft sends nothing).
- `campaign.*`: `{id, name, slug, concept_slug, goal, target_persona, status, created_at}`.
- `engagement.email_clicked`: `{eda_event:"sequence_email_clicked", utm_id, contact_id, campaign_id, step_id, channel, sent_at, clicked_at, detected_by}` — first human click; scanner clicks filtered. **Email opens are NOT tracked (no pixel) → no open event.**
- `engagement.call_recording_ready`: no URL; fetch `GET /voice/calls/{call_id}/recording`.
- `form.submitted`: `{eda_event:"form_submitted", form_id, form_group_id, form_kind, url, referrer, submitter_email, fields[], submission_id}`.
- `company.enriched`: `{mashup_company_id, company_ext_id, account_name, domain, fields_updated[], enriched_at}`.
- `audience.ready`: `{audience_id, list_id, platform, status, record_count}`.
- Bridged events (engagement, meetings, deals, quotes, tasks, enrichment jobs, workflow runs, Voice AI, forms, visitors) also carry `eda_event`, `g8_correlation`, `idempotency_key`, and **are readable via `GET /events`** (filters `name` (=eda_event name), `type`, `contact_id`, `since`, `cursor`) — a polling alternative to webhooks. "graph8 uses webhook push + REST poll (no SSE/WebSocket today)."

---

## 6. Usage, credits & per-operation pricing

### 6.1 Usage API
- `GET /usage` (scope `usage:read`) → `{customer_id, credits, held_credits, available_credits, total_earned, total_used}`; 404 = no credit customer record yet.
- `GET /usage/transactions?page&limit|cursor` → `[{id, type (usage|purchase…), amount (neg=spend), service (ai_enrichment, dialer, web_visitor…), quantity, llm_tier (g8_t1/t2/t3), description, created_at}]`. No server-side rollup — group by `service` client-side. CLI `g8 usage`, `g8 usage-transactions`.

### 6.2 Always free (PAYG & Platform, within 50 rps) — per Pricing page
Search contacts/companies + save-to-list; `/enrichment/lookup/person|company`; internal `/enrichment/verify-email`; `/intent/*` reads; `/public/visitors/*`, `/public/signals/company`; all CRM CRUD (`/contacts, /companies, /lists, /deals, /tasks, /notes, /fields, /quotes`); workflow/skill/pipeline/page CRUD (not execution); Studio reads (`/icps, /personas, /global-context/documents, /intelligence-data, /research-reports`); webhooks; voice transcript/grading reads; `/inbox/meetings` reads; calendar widget + slot lookup; landing page create/clone/PATCH/publish.

### 6.3 Always charges credits
| Action | Credits |
|---|---|
| Waterfall `/enrichment/enrich` | 0.5–20 per provider *hit* (typically 1–3); no hit = free; 7-day cache = free; BYOK = free |
| Copilot turn, `/public/copilot/chat`, `g8.copilot.ask` | per LLM tokens (~1 per 1,000 tokens) |
| AI inbox draft `GET /inbox/{id}/draft` | per LLM tokens (example response `credits_charged: 1`) |
| Skill execute type=llm | per LLM tokens ("1 per 1,000 tokens" per CLI); type=api free graph8-side |
| Landing-page chat edit | 1 per 1,000 AI tokens |
| Studio AI generation (brief, brand kit, intelligence), research reports, campaign idea generation, doc regenerate | per LLM tokens (research "heavily") |
| `POST /pipelines/suggest` | ~50–100 per suggestion |
| Voice AI / dialer audio | 20 / minute |
| Meeting booked (`POST /appointments/bookings`) | 20 flat (402 if subscription lapsed) |
| Sequence/campaign step send (`/sequences/{id}/contacts`, `/campaigns/{id}/launch`) | 1 per step **[timing unconfirmed: per send vs at launch]** |
| Newsletter/nurture send | 1 per recipient |
| Bulk internal verify `POST /contacts/verify-emails` | 1 per email |
| External verifier (`?provider=kickbox|zerobounce`) | 1 per verify |
| Intent signal processing (background) | 1 per 10 events (intent page also says "1 credit per signal") |
| Event-stream ingest at scale | 1 per 10 events |
| Audience-sync push | per record where destination meters |

### 6.4 **[CONFLICT] index lookup/search pricing**
- Pricing, Search, Enrichment, FAQ pages: search, save, lookup, internal verify = **free on PAYG and Platform** (within 50 rps).
- REST overview "Choosing the Right Endpoint" table: PAYG search = 1 per record returned; save = 1 per record saved; lookup = 2 per lookup; verify = 1/email; Platform free. SDK page: `g8.enrich.person` "(1 credit)", company "(1 credit)", verifyEmail "(1 credit)". CLI: `lookup-company` "Costs 1 credit"; CLI examples: build-list "credits charged per contact saved". Pricing FAQ: "PAYG meters index endpoints; Platform makes them unlimited".
- Backend note on Pricing page: per-record constants in `developer_api/constants.py` are fallback rates for free-trial/grandfathered orgs; "Plan-aware gating that exempts paid orgs … is being implemented in parallel". **Free trial is definitely metered (1 cr/record).** → Watch `GET /usage/transactions` after a test call.

### 6.5 Auto-CRM-capture
- Every contact/company returned by lookup/search is saved to CRM, tagged `source='api_lookup'`, `created_via='api'`, `api_endpoint`, `last_api_touched_at` (dedup per org, second lookup updates timestamp). Off on free trial.
- Opt out: `?capture=false` (GET) or `"capture": false` in POST body; per key; org-wide `auto_capture_enabled` (Settings → API).
- **"Coming soon … not yet wired into every endpoint. Until rollout is complete, treat lookup and search results as read-only and use /search/contacts/save to persist records explicitly."**
- Implication for Source Scout: pass `capture:false` on exploratory lookups so evaluation probes don't pollute the CRM (if/when capture is live).

---

## 7. REST resource reference

### 7.1 Contacts (your CRM; free)
- `GET /contacts` filters: `page, limit(1-200), email (exact), list_id, name (partial), job_title, seniority_level (exact), company_name, company_id, country (exact), state (exact), city, job_department, industry, include_custom_fields (bool)`. AND logic. Item: `id, first_name, last_name, work_email, direct_phone, mobile_phone, job_title, job_department, seniority_level, linkedin_url, city, state, country, company_id, owner_id, owner_name, custom_fields`.
- `include_custom_fields=true` → `custom_fields` keyed by column slug e.g. `{"udo_lead_score_1712000000":"92"}` (only set values).
- `GET /contacts/{id}` (+ nested `company`, `confidence_score`, `meta_data`, `personal_emails`, `about`, `twitter_url`…).
- `POST /contacts` — **`list_id` required**; fields `first_name, last_name, work_email, personal_emails, direct_phone, mobile_phone, job_title, job_department, seniority_level, linkedin_url, city, state, country, company_domain`. Response 201 `{status:"ok", count:1, validation_errors:[]}` (note: **no id returned**). Supports `Idempotency-Key`.
- `PATCH /contacts/{id}` → `{updated:1}`; 400 if empty. `DELETE /contacts/{id}` soft delete (can't restore via API).
- `PUT /contacts/assert` (upsert; match `work_email` then `linkedin_url`; `list_id` required) → `{action:"created"|"updated", count}`. `PUT /contacts/assert/batch` `{list_id, contacts:[1..100]}` → `{total, created, updated, errors}`.
- Columns: `GET /contacts/columns?list_id=`, `POST /contacts/columns/create {title, data_type:"text", list_id?, created_by?, enrichment?}` (enrichment = waterfall providers list + email_verification; `list_id` required with enrichment).
- Related: `GET/POST /contacts/{id}/notes`, `/contacts/{id}/tasks`, `/contacts/{id}/deals`, `PUT /contacts/{id}/deals/assert {deal_id}`, `/contacts/{id}/quotes`. [not in dev docs] suppressions: `GET /contacts/{id}/suppression`, `POST /contacts/{id}/suppress|unsuppress`, `GET /contacts/suppressions`, bulk add/reinstate; `POST /contacts/verify-emails` (1 cr/email).
- SDK note **[CONFLICT]**: `g8.contacts.create` says "work_email is required; everything else optional … Pass list_id to add to a list" and returns created Contact; SDK examples 4 and 6 create contacts without list_id and use `c.id`. REST says list_id required and returns no id.

### 7.2 Companies (your CRM; free)
- `GET /companies` filters: `domain (exact), industry, name, employee_count_min/max, country, state, city, description (partial — "useful for ICP identification"), revenue_min/max, founded_year_min/max, linkedin_followers_min/max, include_custom_fields`.
- `GET /companies/{id}` (phone, address, zip, industry_group, crunchbase_url, contact_count…); `GET /companies/{id}/contacts?limit(≤200,def 100)&offset`; `PATCH /companies/{id}` (name, domain, website, phone, address, city, state, country, zip, industry, employee_count, linkedin_url); `DELETE` soft (contacts remain).
- Companies are normally auto-created from contacts; **create via `PUT /companies/assert`** (match `domain` then `linkedin_url`; `list_id` required; fields `name, industry, employee_count, annual_revenue, city, state, country, website, description`) → `{action, count}`. `PUT /companies/assert/batch` `{list_id, companies:[≤100]}`.
- Columns: `GET /companies/columns?list_id=`; `POST /companies/columns/create {list_id, title, name (slug, unique), data_type, enrichment:{field_to_enrich:"company.domain"}}`.
- `GET /companies/{id}/deals`, `/companies/{id}/quotes`; [not in dev docs] `GET /companies/{id}/events`.

### 7.3 Lists
- `GET /lists` → `{id, title, type, source, status, total, is_dynamic, tags[], created_at, created_by, updated_at}`.
- `POST /lists {title, type: contacts|companies|suppressions|deals|leads}` → 201 `{id, title, type, status:"completed", total:0}`.
- `DELETE /lists/{id}` soft (contacts remain). `GET /lists/{id}/contacts`. `POST /lists/{id}/contacts {contact_ids}` → `{added}`; `DELETE /lists/{id}/contacts {contact_ids}` → `{removed}`. Move = add then remove.
- `/search/*/save` creates a **new** list each time (can't save into existing list via that endpoint).
- No documented way to set list `tags` or rename a list in dev docs.

### 7.4 Search (open data index)
- `POST /search/contacts` / `POST /search/companies`: body `{filters:[{field, operator, value}] (≥1, AND), page (≤100), limit (def 25, max 100)}`; `page×limit ≤ 10,000`.
- Operators: `any_of` (exact, any), `contains` (fuzzy/substring), `all_of`, `none_of`, `is_empty`, `is_not_empty`, `between` (numeric inclusive), `exists`. Values always arrays.
- Contact fields (~28): first_name, last_name, work_email, personal_emails, direct_phone, mobile_phone, job_title, job_department, seniority_level (e.g. "VP","Director","Manager"; results show "C-Suite"), role, linkedin_url, gender, skills, education_degree, education_field, education_university_name, city, state, country, confidence_score, company_name, company_domain, company_industry, company_employee_count, company_country, company_state, company_city, company_revenue, company_founded_year.
- Company fields (~15): name, domain, website, description, industry, industry_group, employee_count, revenue, founded_year, country, state, city, phone, linkedin_url, linkedin_followers.
- Search results have **no graph8 ids** (open-index rows: names, emails, phones, linkedin, company_* fields, `confidence_score` 0–100). Country values are full names in examples ("United States").
- `POST /search/contacts/save` / `/search/companies/save`: `{filters, list_title (req), max_results (def 1,000, max 10,000)}` → **202** `{list_id, list_title, estimated_total, status:"processing"}` — async; then `GET /contacts?list_id=`.
- Org deliverability protection policy auto-applies to open-data search and save (Settings → Compliance → Deliverability) — may exclude higher spam-risk account categories; can't override via API.

### 7.5 Enrichment
- **Lookup (index, free):** `POST /enrichment/lookup/person` — one of `email`, `linkedin_url`, or `first_name+last_name+company_domain` → `{found, confidence, data:{first_name, last_name, job_title, company, linkedin_url, work_email}}`. `POST /enrichment/lookup/company` — `domain` or `name` → `{found, confidence, data:{name, domain, industry, employee_count, annual_revenue}}`. LinkedIn-keyed endpoints (`/linkedin/person|company`) "coming soon".
- **Waterfall (credits):** `POST /enrichment/enrich {contact_ids (req), list_id (req), fields_config?}` → 202 `{job_id, status:"queued"}`. Default `fields_config = {"work_email":["prospeo","dropcontact"]}`; e.g. `{"direct_phone":["cognism","lusha"]}`.
- Poll `GET /enrichment/jobs/{job_id}?include_provider_errors=true` → status queued|running|completed|failed|cancelled; `successful_enrichments, failed_enrichments, total_credits_used` only on terminal. **`completed` ≠ enriched**: 0 successes + 0 credits usually = missing provider credential (`provider_errors: [{record_id, provider, error:"hunter API key is not configured"}]`).
- Verify: `POST /enrichment/verify-email {email}` → `{email, status: valid|invalid|catch-all|unknown, sub_status, is_valid}`.
- Waterfall configs (list-scoped): `GET /enrichment/waterfall/configs?list_id=` (providers_detail, missing_credentials); `POST /enrichment/waterfall/configs` idempotent by (list_id,name): styles bare (`list_id` only → graph8 lookup, 0 credits), `providers:[...]`, or `steps:[{provider, action, input_mapping, output_field, order, is_system_provider, config}]`; `field_to_enrich` (default work_email), `skip_existing_values` (default true), `email_verification {enabled, provider: zerobounce|hunter|icypeas|leadmagic, use_system_credentials, accept_catchall, valid_statuses}`, `credential_mode auto|system|byok`. Allowed providers: graph8, hunter, prospeo, dropcontact, icypeas, leadmagic, emaillistverify, apollo, lusha, rocketreach (lusha/rocketreach unfunded → BYOK only). System keys held for graph8, apollo, hunter, builtwith, dropcontact, prospeo, icypeas, zerobounce, leadmagic, emaillistverify.
- Run: `POST /enrichment/waterfall/enrich {column_id, list_id, record_ids, skip_existing_values?}` → 202 with `warnings` (skipped BYOK steps); 422 `waterfall_config_missing`.
- `GET /enrichment/providers` → per provider `system_funded, byok_configured, default_credential_source, credits_per_row{action:cost}, actions`.
- AI enrichment: `GET /enrichment/ai/configs?list_id=` → `{group_id, name, usecase ("web-research"), …}`; `POST /enrichment/ai/enrich {group_id, list_id, record_ids, max_records?, skip_existing_values?}` — **synchronous**. (Creating AI configs isn't documented here.)
- Credit matrix per hit: Apollo email 1, phone 2+2, LinkedIn 1, title 1; Hunter email 1, domain 1, verify 2; Prospeo email 1, phone 2; DropContact 1/2/2; Lusha 1/2/2; Icypeas 1, phone 1, domain 0.5, LinkedIn 1, company 1; RocketReach 2/2/2; LeadMagic email 0.5, mobile 3, LinkedIn 3, company 2, funding 2.5; Clearbit 2; BuiltWith 2/action; graph8 internal 2/lookup (free w/ org key). Verifiers: LeadMagic 0.5, EmailListVerify 1, ZeroBounce 1 (find_email 20), Icypeas 1, Hunter 2. Apollo `reveal_phone_numbers` +3–15, `reveal_personal_emails` +1–7.
- Default orders: Email Apollo→Hunter→Prospeo→DropContact→Lusha→Icypeas→RocketReach→LeadMagic→(verifier). Direct phone Apollo→Prospeo→DropContact→Lusha. Mobile Apollo→DropContact→Lusha→LeadMagic. Company domain Clearbit→Apollo→Hunter. Industry/size Clearbit.
- Credit hold: job start holds `total_records × max_per_record × 1.25`; charged every 100 records; unused released. Example: 1,000 contacts, 70% find, 1.2 avg → ~840 credits.

### 7.6 Fields (custom columns)
- `GET /fields?list_id=` (contacts), `GET /fields/companies?list_id=`.
- `POST /fields {title, data_type (def text), list_id?, entity: contacts|companies, enrichment?}` → `{id, name (slug), ...}`. `POST /fields/batch {entity, list_id, fields:[1..100 {title, data_type?, enrichment?}]}` — atomic column creation; slugs like `udo_persona_1700000000`.
- `PATCH /fields/{column_id}/values {record_id, value|null, entity}` (one record per call); `GET /fields/{column_id}/values?record_id&entity`. For bulk reads use `include_custom_fields=true` on contacts/companies list.
- `enrichment.column_id` returned = column slug; pass to waterfall/enrich.

### 7.7 Deals
- `GET /deals/pipelines` (stages with probability, required_elements, channel_scripts). `GET /deals?page&limit&stage_id&pipeline_id&search` (items include `contact_count`, `primary_contact`; `contacts` null on list). `POST /deals {name (req), company_id, description, amount, currency (USD), stage_id, pipeline_id, close_date, owner_id, contact_ids[]}`. `GET /deals/{id}` full contacts w/ roles. `PATCH /deals/{id}` incl. `add_contact_ids, remove_contact_ids, contact_roles {"<id>":"champion"}` (roles: champion, decision_maker, influencer, blocker, coach, end_user; order remove→add→roles, all-or-nothing). `PUT /deals/{id}/contacts/{contact_id} {role|null}`. `DELETE /deals/{id}`. `PUT /deals/assert` (match name + company_id) → `{action, deal_id}`.

### 7.8 Notes & Tasks
- Notes: `GET/POST /contacts/{id}/notes {content}`; `PATCH /notes/{id} {content}`; `DELETE /notes/{id}` → 204.
- Tasks: `GET /contacts/{id}/tasks?status=open|completed`; `GET /tasks?status&priority(0 none,1 urgent,2 high,3 normal,4 low)&assignee_id&search&entity_type&entity_id&limit(≤200)&offset`; `POST /contacts/{id}/tasks {title, description, due_date, assignee_id, priority, parent_task_id, subtask_sort_order}`; `POST /tasks` with `records:[{entity_type: contact|company|deal|team_member|lead|application, entity_id}]`; `GET/PATCH /tasks/{id}` (omit `records` to keep associations). Agent execution: `PUT /tasks/{id}/assignment {agent_id|null, expected_updated_at}` (no start), `POST /tasks/{id}/start` (scope `tasks:run` + UUID `Idempotency-Key`; 503 → retry same key), `GET /tasks/{id}/execution` (last 50 runs). Restricted keys: contact-linked task needs `tasks:write` + `contacts:read`.

### 7.9 Sequences (sequencer)
Basics (`/sequences`):
- `GET /sequences?page&limit&status (drafted|live|paused|completed)&sequence_kind (cold_outbound|nurture)` → `{id, name, status, user_email, step_count, contact_count, sequence_kind, associated_list_id, …}`.
- `GET /sequences/{id}` → flags `finish_on_reply, send_in_same_thread, wait_for_new_contacts, schedule_id, appointment_id, textual_agent_name, voice_agent_name, pinned_mailbox_id, paused_at, resumed_at`.
- `POST /sequences/{id}/run` drafted→live → `{sequence_id, status:"live", contacts_affected}`; `POST /pause`, `POST /resume`.
- `GET /sequences/{id}/contacts?state=` → `{id, contact_id, state (e.g. waiting/active), current_step_order}`.
- `POST /sequences/{id}/contacts {contact_ids, list_id}` (both required) → 201 `{status:"contacts_added", contacts_affected}` — **triggers real outreach on live sequences; 1 cr/step**.

Lifecycle (authoring):
- `POST /sequences` (creates `drafted`) body: `name (req), user_email (req), description, finish_on_reply (def true), send_in_same_thread (def false), wait_for_new_contacts, associated_list_id, campaign_id (Studio campaign UUID), sequence_kind (def cold_outbound; immutable), pinned_mailbox_id (req for nurture; immutable), steps[], channels[]`.
  - Step: `step_order (1-indexed, req), step_type (req: EMAIL|PHONE|SMS|WHATSAPP|HEYREACH|MANUAL_DIALER; alias linkedin→HEYREACH; UNIPILE explicit), input_type (ON_DEMAND def | MANUAL_TEMPLATE (aliases template/manual) | AI_GENERATED_TEMPLATE (ai/ai_template)), time_interval (seconds after previous; def 0), step_data`.
  - step_data EMAIL `{subject, body ({{merge_tokens}}), instructions (for AI template), email_type plain|html}`; LinkedIn `linkedin_action_type` REQUIRED (CONNECTION_REQUEST: linkedin_connection_message/_fallback/_withdraw_days(25); MESSAGE: linkedin_message_text; INMAIL: linkedin_inmail_subject/_body; FOLLOW; VIEW_PROFILE; LIKE_POST: linkedin_like_reaction_type 0-5, linkedin_like_react_before_days 3); AI LinkedIn: `input_type AI_GENERATED_TEMPLATE` + `linkedin_input_mode:"instructions"`, `linkedin_instructions`; PHONE/MANUAL_DIALER `{dial_dnc:false, phone_options:["mobile","direct"]}`; SMS/WHATSAPP `{message_body, media_urls, whatsapp_template_sid, whatsapp_template_variables}`. Unknown keys silently ignored.
  - Channel: `{channel_id (mailbox/phone resource id), channel_value (address/number), channel_type SMTP|GMAIL|INBOXKIT|PHONE|LINKEDIN|SMS|WHATSAPP, channel_data?}`.
  - Nurture: `sequence_kind:"nurture"` + `pinned_mailbox_id`, all email channels same mailbox, 500 emails/day/mailbox, gated by `ENABLE_NURTURE` flag; 422 on mismatch.
- `GET /sequences/{id}/preview` (steps + channels, no enrollment).
- `PATCH /sequences/{id}` (name, description, is_shared, finish_on_reply, send_in_same_thread, wait_for_new_contacts, schedule_id, appointment_id, textual_agent_name, voice_agent_name). 409 while scheduling/pausing/resuming/terminating.
- `PATCH /sequences/{id}/steps/{step_id}` — **`step_data` replaced wholesale** (resend every key or you break e.g. LinkedIn action type).
- `GET /sequences/{id}/analytics` → `{overview:{sent, opened, replied}, performance:{open_rate, reply_rate}, engagement:{by_day}, timeline, contact_distribution:{active, completed, stopped}, step_breakdown:[{step_id, sent, opened}], step_creation_methods, sender_distribution}` (schema `SequenceAnalyticsResponse`). Note "opened" appears even though webhooks page says opens aren't tracked.
- `DELETE /sequences/{id}` archive (400 already archived, 409 bad state).
- [not in dev docs] `GET /sequences/{id}/stats` (per-step delivery/engagement + skip_reason_breakdown), `GET /sequences/{id}/reports` (overview, funnel, engagement, 30-day timeline), `GET /sequencer/stats`, `POST /sequences/{id}/duplicate` (copy is drafted, caller-owned, no channels), `POST /sequences/{id}/steps` (add steps), `DELETE /sequences/{id}/steps/{step_id}`, `GET|POST|DELETE /sequences/{id}/channels`, `PUT|DELETE /sequences/{id}/campaign` (link Studio campaign), `POST /sequences/{id}/terminate|archive|sync|status`, per-contact pause/resume, `GET /sequences/{id}/contact-ids`, `/sequencer/channels/mailboxes|phone_numbers|sms_numbers|linkedin_accounts`, `/sequencer/content/email/generate|estimate` (AI draft, credits), `/sequencer/templates/*`, `/nurtures` CRUD+launch, `POST /schedules`.

### 7.10 Launch helpers (0.9.7)
- `GET /schedules?include_archived&search` → send-window schedules `{id, name, timezone, windows:[{day,start,end}]}` → pass as `schedule_id`.
- `GET /event-types?include_hidden&scheduling_type=managed|round_robin|collective` → Cal.com booking links `{id (int), title, slug, length, …}` → `appointment_id` (enables booking-link rewrite during send).
- `GET /voice/dialer/agents` → unified agent/twin picker; `agent_name` → `textual_agent_name` / `voice_agent_name`.
- `GET /mailboxes?connection_status=active` → `sender_mailbox_ids`.

### 7.11 GTM Campaigns (AI Studio campaigns) — `/campaigns`
Object = brief + sequence (ordered step refs) + step catalog + generated documents (brief, sequence doc, ad copy, landing page copy… "total_documents": 15).
- `GET /campaigns?page&limit` (non-archived) → `{id, name, slug, status, category, goal, target_persona, created_at}`.
- `POST /campaigns` `{name (req, ≤255), category (def "Outbound", ≤100), brief, core_concept, primary_hook, target_persona (≤200), goal (≤255), audience_list_id (string), target_channels (def ["email"]), secondary_hooks[], auto_generate_documents (def false)}`. With auto-generate → `status:"copy_in_progress"`, `generation_status:"in_progress"` (Celery doc generation, **spends credits**); else `status:"draft"`, `generation_status:"skipped"`; `failed_to_dispatch` possible. "The MCP tool always sets this true; the launcher requires it."
- `GET /campaigns/ideas?favorited&limit` → ideas `{rank, campaign_name, campaign_category, campaign_focus, core_concept, why_this_works, primary_hook, secondary_hooks, target_channels, required_assets, execution_complexity, expected_impact, proof_points, framework_inspiration, source, favorited, converted_to_campaign, converted_campaign_id}`.
- `GET /campaigns/{id}` (+ completed document thumbnails), `PATCH /campaigns/{id}` (name, brief, core_concept, primary_hook, target_persona, category, goal).
- Documents: `GET /campaigns/{id}/documents` (metadata: file_type, folder_path, status, version), `GET .../documents/{doc_id}` (full `content`), `POST .../documents {file_type, display_name, content, folder_path, status draft|completed, structured_data}`, `PUT .../documents/{doc_id} {content, status, structured_data}` (bumps version), `DELETE` (hard).
- Sequence: `GET /campaigns/{id}/sequence` → `{sequence:{steps:[{step_id, day, condition, stop_on_reply}]}, step_catalog:{steps:{step_1:{name, channel, mode, ...}}}, sequence_doc_id, catalog_doc_id}`; `PUT /campaigns/{id}/sequence {steps}` (step_ids must exist); `POST /campaigns/{id}/sequence/steps {name, channel, mode, day (req), platform, angle_id (def angle_1), cta_type (def soft_ask), personalization_level (def medium), constraints, condition, stop_on_reply}` — channel→mode: email→email; phone→call|voicemail; sms→sms; social→connect_note|dm|comment|reply; voice_ai→call. `PUT .../steps/{step_id}` (+ `do_not_send_rules[]`; day/condition/stop_on_reply edit the sequence doc, rest edits catalog); `DELETE .../steps/{step_id}`.
- `GET /campaigns/{id}/ad-images`, `POST .../ad-images/{image_id}/hide`.
- `GET /campaigns/{id}/metrics?days=30 (1–365)` — engagement metrics (response shape not documented). SDK `g8.campaigns.stats(id)` → `{sent, opened, replied, meetings}`.
- `GET /campaigns/{id}/full` (campaign + audience + docs + sequence); `PATCH /campaigns/{id}/full` single-transaction deep update: fields, `audience_list_id`/`detach_audience`, `documents[]` (with `id` = update, without = create needing file_type+display_name), `sequence_steps[]` (full reorder), `linked_sequence_ids[]`, `unlink_sequence_ids[]`.
- `PUT /campaigns/{id}/audience {list_id | null}`.
- `POST /campaigns/{id}/launch` — **real outreach, irreversible once sending**; restricted keys need `campaigns:launch`. Body optional: `sender_mailbox_ids[]` (active, non-archived, else 400), `textual_agent_name`, `voice_agent_name`, `schedule_id`, `appointment_id`; `validate`/`disable_auto_pick` deprecated (`validate=false` or `disable_auto_pick=true` → 400). Auto-picks first active email mailbox if none given. Readiness mandatory: non-empty audience, completed copy, ≥1 complete step, required channels. **One-step API launch supports email execution only**; for social/phone/SMS create Sequencer draft and configure channels. Response `{status:"live"|"scheduling", campaign_id, sequence_id, sequence_name, steps_created, link_id, warnings, channels_attached[{mailbox_id,email,channel_type,auto_picked}], agent_assigned, schedule_id, appointment_id, execution:{status, contacts_total, orchestrator_version:"v2-sync"}, message}`. 502 with `detail.status` = `draft_created_activation_failed` or `activation_state_uncertain` → don't retry blindly.
- [not in dev docs] `/campaigns/generation-options`, `/campaigns/audience-profile/preview` (FREE, profiles a list's titles/seniority/industries), `/campaigns/suggest` (rank 15 concepts), `/campaigns/recommend-personas` (credits), `/campaigns/generate-ideas(-async)` (credits), `POST /campaigns/ideas/manual` (FREE), `PATCH/DELETE /campaigns/ideas/{id}`, `POST /campaigns/ideas/{id}/archive` ("future idea generation reads them — and the `reason` — to steer away"), `GET /campaigns/{id}/dashboard` (GET that can spend credit on cache miss), `/campaigns/{id}/status`, `/files`, `POST .../documents/{doc_id}/regenerate` (credits), `POST .../sequence/steps/{step_id}/generate` (credits), audience-pipeline status/suggested-filters/accept-filters/trigger (credits), `DELETE /campaigns/{id}` (soft), campaign↔workflow links.
- Repo-scoped variant: `/repos/{repo_id}/campaigns` (list/get/get doc/create/PATCH/launch → `status:"scheduling"`, `execution.polling_url:"/sequencer/sequences/jobs/{job}/status"`).

### 7.12 GTM Context (Studio data)
- `GET /global-context/documents?category&include_content(def true)&limit` — 44 docs/org: 21 context (brand brief, value props, personas, ICPs, messaging house…), 16 intelligence (website scrape, competitors, keywords), 6 research reports, 1 campaign intelligence brief. Sorted priority desc.
- `PATCH /global-context/documents/{doc_id} {content?, status?}` — saves DocumentVersion (same history as UI).
- `GET /personas?status&limit` → `{title, priority, confidence, confidence_score, why_target, key_signals[], expected_receptivity, campaign_approach, recommended_goal, status, pinned, source}`.
- `GET /icps?status&limit` → `{name, description, firmographics:{employee_min, employee_max, country[]}, tech_stack:{required[]}, buying_signals[], fit_score, opportunity_score, readiness_score, total_score, status, pinned, priority}`. (No create/update ICP endpoint documented.)
- `GET /mailboxes?limit(≤500)&include_archived&connection_status`, `GET /mailboxes/{id}/warmup` (live provider fetch).
- `GET /intelligence-data?data_type (website_scrape, company_enrichment, competitor_discovery, company_keywords, product_inventory, organic_keywords, paid_keywords…)&include_content` — read-only.
- `GET /research-reports?report_type (buyer_psychology, competitive_teardown, gtm_channel, industry_analyst, review_sentiment, voice_of_customer)&include_content`; `PATCH /research-reports/{id} {markdown_content?, status?}` → content edit re-indexes into RAG (completed/approved can only toggle between those two).
- `GET /activities?activity_type&contact_id&company_id&deal_id&limit` → `{activity_type, activity_subtype, subject, description, outcome, next_steps, source, …}`.
- KB: `POST /kb/search {query, limit 1–50}` → chunks `{doc_path, section, title, content(≤500 chars), score}`; `GET /kb`.
- [not in dev docs] `/intelligence/analyze` (research a website; billable), `/research-reports/generate(-all)` (heavy credits), `/research-reports/{id}/approve` (indexes into KB), `/global-context/generate/{doc_type}` (billable).

### 7.13 Inbox (unified email/SMS/LinkedIn)
- `GET /inbox?channel (email|sms|linkedin)&sequence_id&status&assignee&tag&exclude_tag_ids&page&page_size(1–100)` → threads `{id, channel, subject, contact:{email,name,company}, messages:[{message_id, from_address, to_addresses, content, responder: USER|AI|OTHER, date, is_draft}], status: open|responded|ai_responded, tags:[{id,name}], assignees, created_at, updated_at}`. `responder=OTHER` = the contact's reply. Sentinel system tags (Warmup, Bounced, Archived, Deleted) UUIDs `00000000-0000-0000-0000-00000000000N`.
- `GET /inbox/{reply_id}?channel=`; `POST /inbox/{id}/assign {assignee_email}`; `POST /inbox/{id}/tag {tag_ids}` (tags must exist); `GET /inbox/{id}/draft?channel=` AI draft (credits; 402) → `{content, plain_content, credits_charged}`; `POST /inbox/{id}/send {body, channel, subject (email), to (email/SMS), from_address (LinkedIn = numeric account id)}` → real send.
- [not in dev docs] `GET /workflows/inbox-tags` (resolve "interested", "out of office", "referred me to a colleague" → tag ids), `POST /inbox/tags` (`ai_can_apply`), `GET /inbox/workspaces/sequence-channels/{sequence_id}` ("what went out, and what came back"), `GET /inbox/emails/by-sequence/{sequence_id}`, `POST /inbox/emails/{id}/link-sequence` (attributes AND stops the sequence), `POST /inbox/drafts/generate` (credits), LinkedIn conversation detail incl. AI analysis, mailbox sync controls, `POST /inbox/call-results/search`.

### 7.14 Meetings (`/inbox/meetings`)
- `GET /inbox/meetings?participant_email (repeatable, OR)&scope my|all&timeframe all|upcoming|past&has_transcript&internal_mode include_internal|exclude_internal&search (title/transcript full-text)&page&page_size(≤100)` → `{id, subject, organizer_email, user_email, start_time, end_time, meeting_url, attendees[{email,name,response_status,organizer}], transcript_status (linked|none|processing), transcript_id, transcript_source (fathom), transcript_summary, transcript_redacted, audience_type (prospect), is_internal_only, meeting_sensitivity, matched_account, tags, assignees, preview}`.
- `GET /inbox/meetings/{id}` adds `transcript_text, key_topics[], action_items[], meeting_tasks[], campaign_mentions[], custom_fields, participant_links[], owner_team_member, organizer_team_member`.
- SDK **[CONFLICT on filters]** `g8.meetings.list({status, date_from, date_to, attendee_id, event_type, contact_id, page, limit})`; `g8.meetings.get(id)` → `{…, recording_url, transcript:[...], analysis:{sentiment, summary, next_steps, objections, talk_listen_ratio}}`; transcript ready 1–5 min after meeting ends. CLI `g8 list-meetings --status scheduled|completed|cancelled|no_show`.

### 7.15 Appointments (Cal.com-style scheduling) — `/appointments/*`
- API key is never admin; sees only caller's own/hosted data. OAuth connects (Google/O365 calendars, Zoom/Teams) web-only.
- Event types: `GET/POST/PATCH/DELETE /appointments/event-types[/{id}]` (title, slug unique→409, length, scheduling_type round_robin|collective|null, schedule_id, time_zone, hidden, requires_confirmation, minimum_booking_notice 120, buffers, slot_interval, seats, period_type unlimited|rolling|range, locations, booking_fields, initial_hosts, …), `POST .../{id}/duplicate`.
- Bookings: `GET /appointments/bookings?status accepted|pending|cancelled|rejected&event_type_id&after_start&before_end&attendee_email&sort_by&sort_order&skip&take(≤100)` → items include `sequence_id, sequence_name`, attendees with `no_show`. `GET .../bookings/{uid}`. **`POST /appointments/bookings {event_type_id, start_time (UTC ISO), attendees:[{name,email,time_zone}], location, responses, guests, metadata, slot_uid}` → ~20 credits, 409 slot conflict, 402 lapsed.** Cancel, reschedule (free), `GET .../bookings/insights?date_from&date_to&event_type_ids` → `{total_bookings, accepted, cancelled, no_show_rate}`, confirm/reject, mark-absent, change location, request-reschedule, add guests, internal notes, `PATCH .../bookings/{uid}/sequence {sequence_id|null}`.
- Availability schedules (`/appointments/schedules`, distinct from sequencer `/schedules`), out-of-office, routing forms (+responses), appointment workflows (reminder triggers new_booking|before_event|after_event|booking_cancelled|booking_rescheduled; steps EMAIL_HOST/EMAIL_ATTENDEE/SMS_ATTENDEE/WHATSAPP_…), calendars (list, selected conflict-check calendars, destination calendar), conferencing providers (google_meet, roam, whereby, jitsi via API; zoom/teams OAuth only).

### 7.16 Workflows (automation graphs) — voice-proxy surface
- `GET /workflows/node-types/schema?detail=slim|full&node_type=`; `GET /workflows?enabled&category&is_template` → `{actions:[{id, name, description, category, object_type, is_template, config}], total_count}`; `GET /workflows/{action_id}`; `GET /workflows/{id}/trigger-status` → `{has_trigger, trigger_type:"event_stream", last_cursor}`.
- `POST /workflows {name, description, category, object_type, config:{nodes:[{node_id, node_type, name, config, position}], edges:[{source,target}], start_node_id, metadata, settings:{stop_on_failure}}}` — "The proxy normalizes camelCase, ReactFlow, and hybrid graph shapes to canonical snake_case". `PUT /workflows/{id}` (config replaces whole graph). `POST /workflows/validate {config}` → `{errors, warnings, missing_references}`.
- `POST /workflows/{id}/execute {input_data, triggered_by}` → `{execution_id}` (**real outreach if nodes enroll/dial/Slack/email**). `GET /workflows/executions/{id}` → `{status, output_data, tokens_used, cost_credits}`; pause `{reason, message}`, resume `{from_step, skip_failed}`, stop `{reason, save_partial_results (def true), message}` (terminal). `POST /workflows/{id}/trigger-reset` (cursor → now).
- Resolvers: roam users/groups, slack users/channels, `/workflows/mcp-servers`, `/workflows/dispositions` (17: booked, callback, not_interested, dnc, not_icp, has_solution, gate_keeper, wrong_number, left_org, voicemail, hangup, no_voice, dial_tree, answering_machine, not_answered, sdr_hangup, failed), `/workflows/forms/{form_id}/fields`.
- **[CONFLICT]** SDK/CLI examples use `nodes:[{id, type, config}]`, `connections:[{from_node_id, to_node_id, condition}]`, node types `form_trigger, agent, skill, branch, slack_message, sequence_enroll, delay`, `is_active` toggle; REST uses `node_id/node_type/edges/source/target/start_node_id` and filter `enabled`. Use `node-types/schema` + `validate`.

### 7.17 Skills (LLM + API building blocks)
- `GET /skills?runtime_type llm|api&enabled&category&object_type&include_system`; `GET /skills/{id}`; `GET /skills/{id}/variables`; `GET /skills/models` (e.g. gpt-4o, claude-sonnet-4-5; 9 total); `GET /skills/templates?category`.
- `POST /skills {name, description, runtime_type (llm|api), object_type, category, requires_approval, approval_type, knowledge_scope, llm_config:{model, prompt_template, temperature} | api_config:{endpoint, method, headers, query_params, body_template}}`. `PUT /skills/{id}` (runtime_type immutable). `POST /skills/validate` (`{template}` or full def). `POST /skills/from-template {template_id, name, overrides}`; `POST /skills/from-node {workflow_id, node_id, name}` (action nodes only).
- `POST /skills/{id}/execute {input_data, triggered_by, trigger_type:"manual"}` — test/preview; LLM = credits.
- **Gotcha:** REST interpolates **single-brace `{variable}`**; `{{...}}` is ignored. SDK examples (`createLLM({title, prompt, model, input_schema})`) use `{{contact}}` — likely won't interpolate over REST semantics; verify with `/skills/validate`.

### 7.18 Intent & Signals
- `/intent/*` (server, API key): `GET /intent/stats` (`{doc_count, size_bytes}`); `POST /intent/pages-by-domain {domain, limit(≤500), offset}` → pages `{url, title, summary, commercial_score, page_type, audience}`; `POST /intent/pages/search {query ("site:cognism.com pricing"), limit, offset, semantic_ratio (0 text…1 semantic), filters, sort, include_visitors}`; `POST /intent/pages/visitors {url (no scheme), limit, offset, mode quick(~500ms)|full(~2-3s)}` (raw visitor objects: HEM, profile fields, source tier); `POST /intent/pages/contacts {urls[1..200], ...}` (deduped contacts); `POST /intent/pages/visitor-counts {urls[≤15,000]}` → `{counts}`.
- Keywords: `POST /intent/keywords/list {keyword_contains, page, limit}`; `POST /intent/keywords/add {keywords[1..50], signal_type intent|jobs|job_changes}` (idempotent); `POST /intent/keywords/create-from-domain {domain, page_limit ≤500, contact_limit ≤500}` → `{keyword_id, pages_seeded, contacts_seeded, companies_seeded, off_domain_rejected}`; `POST /intent/keywords/{id}/urls|contacts|companies {page, limit, conditions:[{field, operator, value}]}`; `POST /intent/keywords/{id}/filters {search_filters:{audience, exclude_page_types, min_commercial_intent_level, max_urls_per_domain, llm_triage, exclude_domains}}`.
- Public (write key): `GET /public/signals/company?domain=` → `{domain, score, intent high|medium|low, signals[pricing_page, demo_page, case_study, multiple_visitors, deep_exploration, high_activity], last_seen}` (30-day window).
- Reads free; keyword create/delete free.

### 7.19 OpenSearch & ClickHouse (raw index access — very relevant to coverage scoring)
- **RAW UPPERCASE field names** (COMPANY_DOMAIN, COMPANY_INDUSTRY, COMPANY_NAICS, COMPANY_COUNTRY, COMPANY_ID, CONTACT_ID, COMPANY_STATE, COMPANY_EMPLOYEE_COUNT, COMPANY_REVENUE …). Typo → 0 hits silently.
- `mashup_contacts` and `mashup_companies` are the same contact-grained index → counts are contact rows; unique companies need `uniqExact` on COMPANY_ID. COMPANY_COUNTRY free-text ("US" and "United States"); NAICS multi-valued ("3311","3311.00000"); employee count/revenue are band strings.
- `POST /opensearch/search {index: mashup_contacts|mashup_companies|hem2contact|ip2company, filters:{FIELD: scalar (term) | list (terms OR)}, fields[], sort[{F:"asc"}], limit 1–200, cursor (search_after), track_total_hits (≤1,000,000)}` → `{total (capped 10k by default), hits:[{id, score, source, sort}], cursor, took_ms}`. Requires active subscription.
- `POST /opensearch/count {index, filters}` → exact count (TAM sizing; not capped).
- `POST /opensearch/aggregate {index, filters, group_by[1..3], agg:[{function count|uniqExact|sum|avg|min|max, field, alias}], having {alias:{gte:..}}, sort, limit ≤1000}` → `{groups:[{key, agg}], total_groups}` (approximate).
- `POST /opensearch/resolve {kind: hem_to_contact|ip_to_company, ids[1..500]}` → every input keyed, null on miss; **no subscription needed**.
- `POST /clickhouse/mashup {mode by_upid|by_hem|by_domain, values[1..100], profile b2b|b2c|joined, limit ≤1000}` → `{records, matched, requested}` (tables: fivexfive_b2b 251M rows, fivexfive_b2c 424M, upid_hem 1.95B, default.mashup_new). Requires subscription; by_domain rejected for b2c.
- `POST /clickhouse/org-analytics {dataset people_visitors|company_visitors|5x5_visitors|intent_resolved, since, until, filters, aggregation raw|daily_counts|top_n, limit}` — 90-day cap.

### 7.20 Audience syncs, CRM syncs, data pipeline
- Audience syncs: `GET/POST /audience-syncs {audience_id (list id), platform meta|linkedin|google|x, platform_audience_name, mode mirror|append_only, refresh_cadence_hours 0–720 (def 24), platform_config {ad_account_id}, suppression_list_ids}` (409 duplicate audience+platform); `GET/PATCH/DELETE /audience-syncs/{id}`; `POST .../trigger` (members added/removed); `GET .../runs?limit`, `GET .../errors`. SDK `g8.audiences.*`; CLI `g8 sync-audience-*`.
- CRM syncs (Nango; connect in Settings → Integrations first, else 404): `GET /crm-syncs`; `POST /crm-syncs/{hubspot|salesforce|pipedrive|zoho|sugarcrm}/contacts/push|companies/push {records[] in CRM-native fields, provider_fields?}` (per-record errors); `POST .../lists/push {records:[{list_id, add_contact_ids, remove_contact_ids}]}`; `GET .../fields?entity_type=`; `GET .../status`. Detailed field maps/upsert keys per provider (HubSpot email/domain; Salesforce Email/Website, LastName required → "-").
- Data pipeline (CDP): `g8.track/identify/page` → Streams (browser write key, server key, allowed domains) → Functions (JS `transform(event, ctx)`; return event / "drop" / array; ctx.fetch, ctx.store, ctx.log, ctx.geo, ctx.ua, ctx.getWarehouse…) → graph8 CDP + optional Destinations (BigQuery, Snowflake, ClickHouse, Redshift, Postgres, MySQL, S3, GA4, Amplitude, Mixpanel, FB CAPI, HubSpot, Webhook, JS tag). Replay supported. **Live Events** (Connections > Live Events) = real-time debugger for page/track/identify events, function output, destination status (dashboard UI, not an API).
- Public endpoints (write key, `X-Write-Key` + Origin): `POST /public/enrich/lookup {email}` → `{found, known_fields{name, company, phone, title, website}, missing_fields}`; `GET /public/visitors/company` (IP→company), `GET /public/visitors/score` (0–100, 7 days), `GET /public/signals/company?domain=`, `POST /public/copilot/chat {message, session_id, context}` (RAG over org KB; graceful fallback string on failure).
- Snippet: `GET /snippet` (org first stream: write_key, tracking_host `https://t.graph8.com`, react_snippet, script_tag, config), `GET /snippet/form` (embeddable lead form HTML).

### 7.21 Other surfaces (brief)
- **Voice & Dialer** (`/voice/dialer/*`): sessions list/create (created PAUSED; `{name, from_phone E.164, list_id, agent_id, entity_type agent|twin, studio_campaign_id, skip_voicemails}`), `PATCH .../sessions/{id}/status {ACTIVE|PAUSED|COMPLETED}`, **`POST .../sessions/{id}/resume {max_contacts 1–4}` places real calls (20 cr/min)**, stats (DAILY|TOTAL: dials, connections, dispositions, talk time), numbers, missed-callbacks, `GET .../calls?contact_id|user_email|parallel_session_id`, `GET .../calls/{room}/transcript` (transcript, summary, disposition, recording_url), `.../grading`, agents.
- **Quotes**: `/quotes` CRUD (create requires `title, contract_start_date, line_items[{product_name, unit_amount cents}]`, signer_contact_id|signer_email), duplicate, edit-as-draft, `POST /quotes/{id}/send` (real email), `/quotable-products`, `/quote-settings`.
- **Stage Checklist Pipelines** (`/pipelines`): CRUD, stages (required_elements from evidence library, channel_scripts call/email/linkedin), reorder, `POST /pipelines/suggest` (credits) + `/from-suggestion`. **[CONFLICT]** evidence library keys differ between pages (cli-pipelines: pain_identified, impact_quantified, stakeholder_mapped, decision_process_known, timeline_known, commercial_posture_known, next_step_scheduled, risk_or_blocker_logged; pipelines page: budget_confirmed, timeline_known, decision_maker_identified, pain_point_validated, competitor_landscape, success_criteria_agreed, legal_review_started, commercial_terms_aligned).
- **Landing pages** (`/pages`): create from template (`demo|lead_magnet|product_launch|event|free_trial`) / clone homepage / clone any URL (Firecrawl, 30–90 s), PATCH html/design_tokens, chat edit (credits), versions, `POST /pages/{id}/publish` → `https://g8-lp-{org_sha256[:8]}.pages.dev/{slug}`.
- **Repos & Spine**: `/repos` connect, scan upload, install patch preview/apply/rollback, streams, snippet, per-repo KB search.
- **Imports** [not in dev docs]: `POST /imports` (CSV/Excel upload → id + row count), `POST /imports/{id}/preview` (mapping, writes nothing), `POST /imports/{id}/contacts` (writes real records into a list).
- **Scraping** [not in dev docs]: `GET /scrape/adapters`, `POST /scrape/requests` ("fetches pages from a third party and can cost credits depending on the adapter"), `GET /scrape/jobs/{id}`, confirm/reject, `GET /scrape/jobs/{id}/export.csv` (results live 7 days); `/settings/scrape-config` + full-site crawl.
- **Duplicates** [not in dev docs]: `/duplicates` suggestions, bulk-merge (≤50 pairs), undo within 30 days.

---

## 8. JavaScript SDK — `@graph8/sdk`

### 8.1 Install / init / config
```bash
npm install @graph8/sdk   # or pnpm add / yarn add
```
```ts
import { g8 } from '@graph8/sdk';
g8.init({ writeKey: 'YOUR_WRITE_KEY' });                 // browser
g8.init({ apiKey: process.env.G8_API_KEY! });            // server
g8.init({ writeKey: 'pk_xxx', apiKey: 'sk_xxx' });       // both
```
Config: `writeKey`, `apiKey`, `host` (default `https://t.graph8.com`), `apiUrl` (default `https://be.graph8.com`), `debug`, `privacy.{dontSend, dontStoreUserIds, ipPolicy: keep|stripLastOctet|remove}`. ~12 KB gzipped, tree-shakable; works in Node, Edge (fetch); tracking/widget methods no-op on server (SSR-safe). Calling a server module without apiKey throws "g8.<module> requires an API key". Never ship apiKey to browser. Free & open-source; package name has always been `@graph8/sdk` (no `@graph8/js`). Reference app: `examples/ai-sdr/` (~160 lines: search → idempotent import → list → enrich → sequence; `DRY_RUN=1` read-only mode).

### 8.2 Reliability core
- `G8Error` (thrown by all API-key resource clients: contacts, companies, lists, deals, notes, tasks, audiences, search, agency, marketplace, snippet, meetings, integrations, pages, enrich, fields, campaigns, inbox, quotes, intent, studio, pipelines, skills, workflows, voice, sequences, analytics). Fields: `status` (0 = network), `type`, `code`, `requestId`, `detail`, `retryable`. Widget clients (visitors, copilot, calendar, signals, forms) remain raw fetch.
- Auto-retry: 429/5xx/network, exp backoff + jitter, honors Retry-After; default 2 retries (3 attempts), 200 ms base; 4xx never retried.
- Idempotency: trailing key arg, e.g. `g8.contacts.create({...}, key)`; `g8.sequences.run(id, 'run-seq-2026-06-30')`.
- Auto-pagination: `import { paginate, request } from '@graph8/sdk'; for await (const tx of paginate((cursor) => request('https://be.graph8.com', '/api/v1/usage/transactions', apiKey, { query: { limit: 200, cursor } }))) {...}` — `request(base, path, apiKey, {query})` is the generic low-level caller for any endpoint.
- **`g8.api` generated client:** not mentioned anywhere in the developers docs. The documented escape hatch for un-wrapped endpoints is the exported `request()` helper (or raw fetch, as SDK example 2 does for sequence analytics).

### 8.3 Module & method reference
| Module | Methods (signature → returns) |
|---|---|
| tracking | `g8.track(event, props)`, `g8.identify(id/email, traits)`, `g8.page()`, `g8.reset()` |
| `visitors` (write key) | `identify()` → `{company_name, company_domain, industry, employee_count, city, country, confidence}`; `score()` → `{engagement, intent, signals}`; `onIntent('high', cb)` → stop fn |
| `copilot` | `open({greeting, position, theme})`, `ask(msg)` (credits), `registerAction(name, fn)`, `on('tool_used', cb)`, `close()` |
| `chat` | `open(opts)`, `send(msg)`, `on('message'|'human_transfer', cb)`, `configure(opts)`, `close()` |
| `calendar` | `show({username, eventType, prefill})`, `embed(selector, opts)`, `slots(username, eventType, {start,end})`, `book({event_type_id, slot, attendee})` (20 cr), `on('booked', cb)` |
| `forms` | `lookup(email)` → `{found, known_fields, missing_fields}` |
| `signals` | `company(domain)` → `{domain, score, intent, signals}`; `stream(domains, cb)` (polls 30 s) → stop fn |
| `enrich` (apiKey) | `person({email|linkedin_url|…})`, `company({domain})`, `verifyEmail(email)` → `{email, valid, deliverable, catch_all}`, `search(filters, page, limit)` (open-index contact search); FAQ also mentions `g8.enrich.run` (waterfall) |
| `search` | `contacts({filters, page, limit})`, `companies({filters})`, `saveContacts({list_title, filters, max_results})` → `{list_id, list_title, estimated_total, status}`, `saveCompanies(params)` |
| `agency` | `me()`, `clients()` |
| `marketplace` | `profile()`, `offers()`, `acceptOffer(id)`, `rejectOffer(id)`, `hirings()` (personal key) |
| `snippet` | `get()` → `{write_key, tracking_host, domains, react_snippet, script_tag, config}` |
| `sequences` | `list()`, `add({sequenceId, contactIds, listId})`, `create`, `run(id, idemKey?)`, `pause`, `resume` |
| `campaigns` | `list()`, `create({name, category, target_persona})`, `launch(id)` (real sends), `stats(id)` → `{sent, opened, replied, meetings}` |
| `contacts` | `list({company_name, seniority_level, email, name, job_title, country, list_id, page, limit})` → `{data, total}`, `get(id)`, `create(contact, idemKey?)`, `update(id, fields)` → `{updated}`, `delete(id)` |
| `companies` | `list({domain, industry, name, country, page, limit})`, `get(id)`, `contacts(id, limit?, offset?)`, `update(id, fields)`, `delete(id)` |
| `lists` | `list(page?, limit?)`, `create(title, type?)`, `delete(id)`, `contacts(id, page?, limit?)`, `addContacts(id, contactIds)`, `removeContacts(id, contactIds)` |
| `deals` | `pipelines()`, `list({stage_id, pipeline_id, search, page, limit})`, `get`, `create`, `update`, `delete`, `forContact(id)`, `forCompany(id)` |
| `tasks` | `list({status, priority, assignee_id, search, limit, offset})`, `listForContact(id, status?)`, `create(contactId, task)`, `update`, `delete` |
| `notes` | `list(contactId)`, `create(contactId, content)`, `update(noteId, content)`, `delete(noteId)` |
| `fields` | `listContactFields(listId?)`, `listCompanyFields(listId?)`, `create({title, entity, data_type, list_id?})`, `setValue(columnId, recordId, value, entity?)`, `delete(columnId, {entity})` |
| `quotes` | `list`, `get`, `create`, `update`, `delete`, `duplicate`, `editAsDraft`, `send(id, {recipient_email, send_signing_link})`, `products()`, `settings()`, `forContact`, `forCompany` |
| `pipelines` (stage checklist) | `list`, `get`, `evidenceLibrary`, `create({name, target, blank?})`, `update`, `delete`, `createStage`, `updateStage`, `deleteStage`, `reorderStages`, `suggest()`, `fromSuggestion(id, overrides?)` |
| `workflows` | `list({is_active})`, `get`, `delete`, `create({name, description, config})`, `update(id, fields)`, `validate({config, trigger_config?})` → `{valid, errors}`, `execute(id, payload)`, `getExecution`, `pauseExecution`, `resumeExecution`, `stopExecution`, `getTriggerStatus`, `resetTrigger`, `nodeTypes({type?})`, `listSlackChannels`, `listRoamGroups`, `listMcpServers`, `listDispositions`, `listFormFields(formId)` |
| `skills` | `list({type})`, `get`, `getVariables`, `listModels`, `listTemplates`, `createLLM({title, description, prompt, model, input_schema})`, `createAPI({title, method, url, headers, input_schema})`, `createFromTemplate({title, template_id})`, `createFromNode({title, node_id})`, `updateLLM(id, {...})`, `delete`, `validate(def)`, `execute(id, input)` → `{output, latency_ms, tokens, error}` |
| `intent` | `stats()`, `listKeywords({search})`, `createFromDomain(domain)`, `deleteKeyword(id)`, `keywordCompanies(id, {limit})`, `keywordContacts(id)`, `keywordUrls(id)`, `pagesByDomain(domain)`, `searchPages(q)`, `pageVisitors(url)`, `pageContacts(url)`, `pageVisitorCounts(urls)`, `urlCompanies(url, {date_from, limit})` |
| `studio` | `globalContext({category})`, `icps({status})`, `personas()`, `intelligenceData({source_type})`, `researchReports({category})` |
| `meetings` | `list({status, date_from, date_to, attendee_id, event_type, contact_id, page, limit})`, `get(id)` (transcript + analysis incl. objections) |
| `integrations` | `list()`, `connect(provider, config)`, `sync(provider, {direction: inbound|outbound|bidirectional})` |
| `audiences` | `list`, `create({audience_id, platform, mode, refresh_cadence_hours, platform_config})`, `get`, `update`, `delete`, `trigger`, `runs`, `errors` |
| `analytics` | `overview({period:'30d'})` → `{visitors, contacts_created, emails_sent, replies, meetings_booked}` |
| `voice` | legacy `start({agent, contactId})`, `analysis(sessionId)` → `{sentiment, summary, next_steps, objections, transcript}`; `voice.dialer.listSessions`, `createSession`, `updateSessionStatus`, `resumeSession(id, n)` (real calls), `listCalls`, `listCallsForContact`, `listCallsForSdr`, `callTranscript(room)`, `callGrading(room)`, `stats`, `numbers`, `agents`, `missedCallbacks(n)` |
| `pages` | `clone(url)`, `create({template, title})`, `publish(id)` → `{url}`, `list({status})`, `chat` (credits) |
| `inbox` | `draft` (credits) — others implied by parity |
| `webhooks` | `on(event, cb)`, `stop()` — legacy event names |

### 8.4 React
```tsx
import { G8Provider, useG8 } from '@graph8/sdk/react';
<G8Provider writeKey="YOUR_WRITE_KEY">{children}</G8Provider>
const { track, identify, page, reset, visitors, copilot, chat, calendar, forms, signals, g8 } = useG8();
```

---

## 9. CLI — `g8`

- Install `pip install g8-mcp-server` (Python 3.10+; same package ships MCP server). Upgrade `pip install --upgrade g8-mcp-server`. No-install: `uvx --from g8-mcp-server g8 whoami`. Fallback: `python -m g8_mcp_server.cli whoami`.
- Auth: `g8 login` (OAuth → `~/.g8/credentials.json`), `g8 login --api-key`, or `G8_API_KEY` env (wins). `g8 logout`, `g8 whoami` (auth source, masked key, API URL, email).
- Output: JSON on stdout, errors on stderr w/ non-zero exit; "141 commands". Pipe to jq.
- Command groups:
  - Dev: `snippet --framework html|react|nextjs|vue|wordpress|webflow|shopify [--list --repo-id --format json]`, `form --framework --variant embedded|popup [--stages JSON]`, `logs [--limit]`, `usage`, `usage-transactions`, `webhooks`, `webhooks-events`.
  - CRM: `search-contacts [--email --name --job-title --seniority --company --country --list-id --page --limit]` (your CRM), `search-companies [--domain --industry --name]`, `create-contact --email [--first-name --last-name --job-title --company-domain --list-id]`, `create-list --title [--type companies]`, `add-to-list --list-id --contact-ids a,b`.
  - Prospecting (open index): `lookup-person --email|--linkedin|--first-name --last-name --company-domain`, `lookup-company --domain|--name`, `find-contacts --filters JSON [--page --limit]`, `find-companies --filters JSON`, `build-list --filters JSON --title --max-results (def 100)`.
  - `enrich --contact-ids --list-id` (credits).
  - Sequences: `sequences`, `add-to-sequence --sequence-id --contact-ids --list-id` (real sends), `create-sequence --name [--description --steps --channels --campaign-id]`, `sequence-preview`, `update-sequence`, `pause-sequence`, `resume-sequence`, `sequence-analytics`, `delete-sequence`.
  - Inbox: `inbox-list [--channel --sequence-id --status --assignee --tag --page --limit]`, `inbox-get --reply-id --channel`, `inbox-assign`, `inbox-tag --tag-ids`, `inbox-draft` (credits), `inbox-send --reply-id --channel --body` (real).
  - Deals, tasks, notes, fields, quotes, stage pipelines, workflows (`workflow-create/-update/-validate/-execute --trigger-payload/-get-execution/…`), skills (`skill-create-llm/-api/-execute …`), voice extras, intent (`intent-url-companies --url --date-from`, …), studio (`studio-icps`, `studio-personas`, `studio-global-context`, …), meetings (`list-meetings`, `get-meeting`), audience & CRM sync (`sync-audience-*`, `sync-crm-push --provider --type --records`), campaigns (`campaigns`, `campaign <id>`).
- Not in CLI: browser widgets, React adapter, `g8_tool_search`. Landing pages: no CLI command (use REST).

---

## 10. Quick-reference cookbook (verbatim-ish from docs)

### 10.1 Search → save list → read (REST)
```bash
export API_KEY="YOUR_API_KEY"
curl -X POST "https://be.graph8.com/api/v1/search/contacts" -H "Authorization: Bearer $API_KEY" -H "Content-Type: application/json" -d '{
  "filters": [
    {"field": "job_title", "operator": "any_of", "value": ["CTO", "VP Engineering"]},
    {"field": "company_employee_count", "operator": "between", "value": [50, 500]}
  ], "limit": 5 }'
curl -X POST "https://be.graph8.com/api/v1/search/contacts/save" -H "Authorization: Bearer $API_KEY" -H "Content-Type: application/json" -d '{
  "filters": [ ...same... ], "list_title": "Tech CTOs" }'      # 202 {list_id, estimated_total, status:"processing"}
curl "https://be.graph8.com/api/v1/contacts?list_id=42&limit=10" -H "Authorization: Bearer $API_KEY"
```

### 10.2 Enrich (waterfall) → poll
```bash
curl -X POST ".../enrichment/enrich" -d '{"contact_ids":[101,102,103],"list_id":5,"fields_config":{"work_email":["prospeo","dropcontact"]}}'
curl ".../enrichment/jobs/abc-123-def?include_provider_errors=true"   # check successful_enrichments, not just status
```

### 10.3 Sequence: create draft → enroll → run → analytics
```bash
curl -X POST ".../sequences" -d '{
  "name": "Q2 Outbound", "user_email": "rep@yourco.com", "associated_list_id": 5,
  "steps": [{"step_order":1,"step_type":"EMAIL","input_type":"MANUAL_TEMPLATE","time_interval":0,
             "step_data":{"subject":"Quick intro","body":"Hi {{first_name}}..."}}],
  "channels": [{"channel_id":12,"channel_value":"rep@yourco.com","channel_type":"SMTP"}] }'
curl -X POST ".../sequences/seq_abc/contacts" -d '{"contact_ids":[101,102],"list_id":5}'
curl -X POST ".../sequences/seq_abc/run"
curl ".../sequences/seq_abc/analytics"
```

### 10.4 SDK: AI-SDR loop (from SDK examples)
```ts
g8.init({ apiKey: process.env.G8_API_KEY! });
const leads = await g8.enrich.search([
  { field: 'seniority_level', operator: 'any_of', value: ['VP'] },
  { field: 'job_title', operator: 'contains', value: ['Engineering'] },
  { field: 'company_industry', operator: 'contains', value: ['SaaS'] },
  { field: 'company_employee_count', operator: 'between', value: [50, 500] },
], 1, 50);
const list = await g8.lists.create('Q3 VP Engineering — SaaS SMB', 'contacts');
for (const lead of leads.data) await g8.contacts.create({ work_email: lead.work_email!, first_name: lead.first_name!,
  last_name: lead.last_name!, job_title: lead.job_title!, company_domain: lead.company_domain!, list_id: list.id });
const seqs = await g8.sequences.list();
await g8.sequences.add({ sequenceId: seqs[0].id, contactIds: [5028106, 5028105], listId: 637 }); // REAL sends
```

### 10.5 Assert companies (upsert, ≤100/batch)
```bash
curl -X PUT ".../companies/assert" -d '{"list_id":12345,"domain":"acme.com","name":"Acme Inc","industry":"Technology","employee_count":100,"annual_revenue":"5000000","country":"US","website":"https://acme.com","description":"Enterprise software provider"}'
# -> {"data":{"action":"created","count":1}}
curl -X PUT ".../companies/assert/batch" -d '{"list_id":12345,"companies":[{"domain":"a.com","name":"A"},{"linkedin_url":"https://linkedin.com/company/b"}]}'
curl -X PUT ".../contacts/assert/batch" -d '{"list_id":12345,"contacts":[{"work_email":"alice@acme.com","first_name":"Alice","company_domain":"acme.com"},{"linkedin_url":"https://linkedin.com/in/bobdoe"}]}'
# -> {"data":{"total":2,"created":2,"updated":0,"errors":[]}}
```

### 10.6 Find people at known accounts
```bash
g8 find-contacts --filters '[{"field":"company_domain","operator":"any_of","value":["acme.com"]},{"field":"seniority_level","operator":"any_of","value":["C-Suite","VP","Director"]}]' --limit 5
# REST equivalent: POST /search/contacts with the same filters; persist with /search/contacts/save (new list) or PUT /contacts/assert/batch
```
Intent-driven variant (SDK ex. 6): `g8.intent.urlCompanies('https://competitor.com/pricing', {date_from, limit:50})` → for each `acct.domain`: `g8.enrich.search([{company_domain any_of [domain]}, {seniority_level any_of [...]}], 1, 5)` → `g8.contacts.create(...)` → `g8.sequences.add(...)`.

### 10.7 Webhook subscribe + verify
```bash
curl -X POST ".../webhooks" -d '{"url":"https://example.com/webhooks/graph8","events":["engagement.email_replied","meeting.booked","sequence.completed"],"name":"Flywheel"}'
# store data.secret (whsec_...) — shown once
```
```ts
import crypto from 'crypto';
function verify(rawBody: string, timestamp: string, signature: string, secret: string) {
  const expected = 'sha256=' + crypto.createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature)); // + reject if |now-ts| > 300s
}
```

### 10.8 Coverage check at scale (OpenSearch)
```bash
curl -X POST ".../opensearch/search" -d '{"index":"mashup_contacts","filters":{"COMPANY_DOMAIN":["acme.com","foo.io"]},"fields":["COMPANY_DOMAIN","CONTACT_ID"],"limit":200}'
curl -X POST ".../opensearch/aggregate" -d '{"index":"mashup_companies","filters":{"COMPANY_DOMAIN":["acme.com","foo.io"]},"group_by":["COMPANY_DOMAIN"],"agg":[{"function":"count"}],"limit":1000}'
```

---

## 11. Gotchas & contradictions checklist

1. **Base host drift:** almost everything uses `https://be.graph8.com/api/v1`; the Assert page examples use `https://api.graph8.com/api/v1`; key-minting examples use `https://be.graph8.com/v1/api-keys` (no `/api`). Use be.graph8.com/api/v1 unless an endpoint 404s.
2. **POST /contacts** needs `list_id` and returns no contact id (`{status, count, validation_errors}`); to get ids afterwards, `GET /contacts?email=` or use `PUT /contacts/assert` + lookup. SDK claims create returns a Contact with `id`.
3. **Search results carry no graph8 ids** — you must save (async list) or assert to get CRM ids before enrolling in sequences / enriching (enrich + sequence both need `contact_ids` + `list_id`).
4. `/search/*/save` is async (202, `status:"processing"`) and always creates a **new** list; poll `GET /lists` / `GET /contacts?list_id=` until populated.
5. Search pagination capped at 10,000 rows (page x limit), `limit` <= 100.
6. `completed` enrichment job != success — check `successful_enrichments`; BYOK steps silently skipped.
7. `PATCH /sequences/{id}/steps/{step_id}`: step_data replaced wholesale. `sequence_kind`/`pinned_mailbox_id` immutable. 409 on transitional states.
8. Campaign launch API = **email only**, needs audience + completed copy + >=1 complete step + active mailbox; `campaigns:launch` scope for restricted keys; 502 uncertain states — do not retry.
9. Skills: `{var}` single-brace only over REST; SDK examples use `{{var}}`.
10. Workflow graph shape differs between REST (node_id/node_type/edges) and SDK/CLI (id/type/connections). Validate first.
11. Error envelope differs by page (`detail` vs `error{}` vs `type/code`) — handle all three.
12. Webhook signing header/names differ between Webhooks page (`X-Studio-Signature`, dotted names) and FAQ/SDK (`X-G8-Signature`, `reply_received`). Max 10 active webhooks.
13. Opens are not tracked (no pixel) but analytics/stats payloads include `opened` — do not build on open rate.
14. Idempotency-Key only on `POST /contacts` so far.
15. Lookup/search pricing on PAYG is contradictory (free vs 1-2 cr/record) and free trial is metered — check `/usage/transactions`.
16. Auto-capture not fully rolled out; pass `capture:false` for probes anyway.
17. Test keys: "treat a test key as operating against real data" until the dedicated sandbox ships — yet `/sandbox/*` endpoints exist for test keys. Call `GET /sandbox/status` first.
18. MCP "What you can ask" page says MCP is read-only for campaigns/deals ("Creating new records requires using the graph8 Studio UI or API directly") — outdated vs api-mcp-coverage (564/564 ops covered).
19. Two different "schedules": sequencer send windows `GET /schedules` (UUID) vs appointment availability `/appointments/schedules` (int). Two different "pipelines": deal pipelines `/deals/pipelines` vs stage-checklist `/pipelines` (the CLI-pipelines page and the Stage-Checklist page both document `/pipelines`, with different evidence keys).
20. `/fields/{column_id}/values` writes one record per call — at 50 rps fine for hundreds, slow for 10k+ (use CSV import where possible).

---

## 12. Hackathon relevance

### 12.1 Source Scout — discover/evaluate new external B2B data sources, score vs graph8, acquire with provenance, find people, sandbox sequence

**Step A — Pull candidate records from the external source** (normally outside graph8: your own scraper/API). graph8-side helpers if you want graph8 to fetch:
- [not in dev docs] `GET /scrape/adapters` -> `POST /scrape/requests` -> `GET /scrape/jobs/{id}` -> `POST /scrape/jobs/{id}/confirm|reject`, `GET /scrape/jobs/{id}/export.csv` (results kept 7 days; some adapters cost credits).
- `POST /pages` with `clone_source:"url"` (Firecrawl; 30-90 s) — page HTML, not structured records.
- `POST /intent/keywords/create-from-domain {domain, page_limit<=500, contact_limit<=500}` -> seeds pages + resolved contacts/companies for a domain; then `POST /intent/keywords/{id}/companies|contacts`.
- `POST /intent/pages-by-domain`, `POST /intent/pages/search` for page-level discovery on a source site.

**Step B — Score coverage/overlap vs graph8 (core of "evaluate the source")**

| Question | Endpoint / SDK | Notes |
|---|---|---|
| Is this company in graph8's index? (per record) | `POST /enrichment/lookup/company {domain or name}` / `g8.enrich.company({domain})` / `g8 lookup-company` | `found`, `confidence`; free on paid plans (disputed on PAYG); add `capture:false` |
| Is this person in the index? | `POST /enrichment/lookup/person {email or linkedin_url or first+last+company_domain}` / `g8.enrich.person` | returns work_email, title, linkedin -> field-level fill-rate comparison |
| Bulk domain coverage | `POST /opensearch/search {index:"mashup_contacts", filters:{"COMPANY_DOMAIN":[...]}, fields:[...], limit:200, cursor}`; `POST /opensearch/aggregate` (group_by COMPANY_DOMAIN, count / uniqExact); `POST /opensearch/count` | RAW UPPERCASE fields; requires active subscription; contact-grained index |
| Bulk by domain with full rows | `POST /clickhouse/mashup {mode:"by_domain", values[<=100], profile:"b2b"}` | subscription required; `matched/requested` = ready-made coverage ratio |
| Hashed emails / IPs | `POST /opensearch/resolve {kind:"hem_to_contact" or "ip_to_company", ids[<=500]}` | every input returned, null = miss; no subscription needed |
| Filter-based overlap (does graph8 already have this segment?) | `POST /search/companies` / `/search/contacts` with `domain`/`company_domain` `any_of` [...] or segment filters; read `pagination.total` | page x limit <= 10k |
| TAM sizing per segment | `POST /opensearch/count` / `aggregate` (e.g. NAICS x state x employee band) | compare external-source row counts vs graph8 counts per cell |
| Already in *our CRM*? (net-new vs workspace) | `GET /companies?domain=` (exact), `GET /contacts?email=` (exact) | free |
| ICP fit | `GET /icps` (firmographics employee_min/max, country[], tech_stack.required[], buying_signals[], fit/opportunity/readiness scores), `GET /personas` (key_signals, why_target), `g8.studio.icps()`; [not in dev docs] `POST /campaigns/audience-profile/preview` (FREE: profiles a list's titles/seniority/industries) | scoring logic is yours (no fit-score endpoint); an LLM skill (`POST /skills` + `/skills/{id}/execute`, credits) could do it in-platform |
| Intent / heat | `GET /public/signals/company?domain=` (write key) or `g8.signals.company`; `/intent/*` | free reads |
| Email quality of the source | `POST /enrichment/verify-email` (internal free; external provider 1 cr); bulk `POST /contacts/verify-emails` (1 cr/email) | |

Suggested metrics: coverage % (found / total), field fill-rate delta (source has email/phone/title graph8 lacks), net-new % (not in index AND not in CRM), ICP-fit % (matches `/icps` firmographics), freshness (title/company mismatch vs lookup).

**Step C — Acquire into lists with provenance**
1. `POST /lists {title:"Scout: <source> <date>", type:"companies"}` (plus a `contacts` list).
2. Provenance columns: `POST /fields/batch {entity:"companies", list_id, fields:[{title:"source_name"},{title:"source_url"},{title:"source_record_id"},{title:"scout_score"},{title:"scouted_at"}]}` (and same for contacts). Slugs come back like `udo_source_name_<ts>`.
3. Upsert: `PUT /companies/assert/batch {list_id, companies:[<=100]}` (match domain then linkedin_url); `PUT /contacts/assert/batch {list_id, contacts:[<=100]}` (match work_email then linkedin_url). Responses are counts only, no ids -> re-read with `GET /companies?domain=` / `GET /contacts?list_id=`.
4. Write provenance values: `PATCH /fields/{column_id}/values {record_id, value, entity}` per record (1 call each — throttle <= 50 rps). Alternatives: `POST /contacts/{id}/notes`; CSV `POST /imports` -> `/imports/{id}/preview` -> `/imports/{id}/contacts` [not in dev docs; mapping details unknown]. Read back in bulk via `GET /contacts|companies?list_id=&include_custom_fields=true`.
5. `/search/*/save` cannot carry provenance or target an existing list. Auto-capture tags `source='api_lookup'` (if live) — another reason to use `capture:false` during evaluation.
6. Dedupe: [not in dev docs] `GET /duplicates`, `POST /duplicates/bulk-merge`.

**Step D — Find people at acquired accounts**
- `POST /search/contacts` with `company_domain any_of [domains]` + `seniority_level any_of ["C-Suite","VP","Director"]` / `job_title contains [...]` (<=100/page); CLI `g8 find-contacts`; SDK `g8.search.contacts` or `g8.enrich.search(filters, page, limit)`.
- Persist: `POST /search/contacts/save {filters, list_title, max_results}` (new list, async) or `PUT /contacts/assert/batch` into the scout list (keeps provenance).
- Fill gaps: `POST /enrichment/waterfall/configs {list_id, providers:[...]}` + `POST /enrichment/waterfall/enrich`, or `POST /enrichment/enrich {contact_ids, list_id}` (credits; poll job).
- Already-in-CRM people: `GET /companies/{id}/contacts`.

**Step E — Sandbox sequence (prove the acquired list is outreach-ready)**
1. Mint test key: `POST /v1/api-keys {"name":"scout-sandbox","mode":"test"}` -> `g8_test_...`.
2. `GET /sandbox/status` (confirm isolation + org); optionally `POST /sandbox/fixtures/seed`, `POST /sandbox/fixtures/snapshot {name:"pre-demo"}`.
3. `GET /mailboxes` (need a `channel_id`), `POST /sequences {name, user_email, associated_list_id, steps, channels}` (drafted), `GET /sequences/{id}/preview`.
4. `POST /sequences/{id}/contacts {contact_ids, list_id}` -> `POST /sequences/{id}/run`.
5. `GET /sandbox/outbox?channel=email` to show simulated sends; `PUT /sandbox/failure-injection {channel:"email", failure_mode:"hard_bounce", remaining:3}` to demo bounce handling; `DELETE /sandbox/failure-injection`; `POST /sandbox/fixtures/restore {name}` to reset.
6. Observe: `GET /sequences/{id}/contacts`, `/analytics`, webhooks `engagement.email_sent` / `engagement.email_bounced`.

**Source Scout blockers / risks**
- **Test-key isolation caveat:** api-keys page says full sandbox isolation "ships with the dedicated sandbox environment. Until then, treat a test key as operating against real data." Verify with `/sandbox/status` before `run`; never enroll real prospects with a key you have not proven is sandboxed.
- Sandbox fixture contents undocumented; unknown whether a sandbox sequence still needs a real connected mailbox (`channels[].channel_id`), and whether search/lookup/opensearch return real data under test keys.
- No bulk lookup endpoint in the documented dev API (lookups one at a time; 50 rps / 1,000 rpm -> ~1,000 lookups/min). Bulk alternatives (OpenSearch/ClickHouse) require an **active subscription** (trial may be refused) and RAW field names.
- Search caps: 100/page, 10k deep, save max 10k; org deliverability policy silently filters some records.
- No endpoint to create/update ICPs or compute a fit score — scoring is client-side (or LLM skill, credits).
- Provenance writes are per-record (`/fields/{id}/values`); assert responses do not return ids.
- Scraping: graph8 scrape adapters may cost credits, results expire after 7 days; clone/crawl are async/slow (30-90 s+). External-source ToS/robots are your responsibility.
- Pricing ambiguity for lookups/search on PAYG/free trial -> budget via `/usage/transactions`.

### 12.2 Flywheel — read campaign/sequence outcomes (replies, objections, meetings) and write an improved campaign V2

**Read side (outcomes)**

| Signal | Endpoint / SDK / event |
|---|---|
| Campaign -> sequence mapping | `GET /campaigns/{id}` / `GET /campaigns/{id}/full` (linked sequences, docs, audience); launch response `sequence_id`; sequences created with `campaign_id` |
| Aggregate performance | `GET /sequences/{id}/analytics` (overview sent/replied, `step_breakdown`, contact_distribution); [not in dev docs] `GET /sequences/{id}/stats`, `/reports`, `GET /sequencer/stats`; `GET /campaigns/{id}/metrics?days=30`; `g8.campaigns.stats(id)` -> `{sent, opened, replied, meetings}`; `g8.analytics.overview({period:'30d'})`; CLI `g8 sequence-analytics` |
| Per-contact state | `GET /sequences/{id}/contacts?state=` (current_step_order) |
| Reply text | `GET /inbox?sequence_id=<id>&channel=email` -> threads with `messages[].content`, `responder` (OTHER = prospect), `status`, `tags`; `GET /inbox/{reply_id}?channel=`; [not in dev docs] `GET /inbox/emails/by-sequence/{sequence_id}`, `GET /inbox/workspaces/sequence-channels/{sequence_id}`; CLI `g8 inbox-list --sequence-id` |
| Reply sentiment / category | webhook `engagement.email_replied` (`is_positive`, `sequence_id`, `campaign_id`, `reply_subject`); `engagement.sms_replied`, `engagement.linkedin_reply_received`; AI Inbox tags ("interested", "out of office", "referred me to a colleague") via [not in dev docs] `GET /workflows/inbox-tags` |
| Objections | No email-reply objection endpoint. Sources: `GET /inbox/meetings/{id}` (`transcript_text`, `key_topics`, `action_items`, `campaign_mentions`); SDK `g8.meetings.get(id).analysis.objections`; `g8.voice.analysis(id)` (objections); dialer `GET /voice/dialer/calls/{room}/transcript` + `disposition` (not_interested, has_solution, not_icp, gate_keeper...) and `/grading`. For email replies classify yourself or via LLM skill (`POST /skills` runtime llm + `/skills/{id}/execute`, credits) |
| Meetings | webhooks `meeting.booked/cancelled/rescheduled/no_show` (carry `sequence_id`, `campaign_id`); `GET /appointments/bookings?after_start=...` (items carry `sequence_id`, `sequence_name`, attendee `no_show`); `GET /appointments/bookings/insights`; `GET /inbox/meetings?participant_email=...&has_transcript=true` |
| Clicks | `engagement.email_clicked` / `engagement.link_clicked` (first human click, per step_id) |
| Bounces/skips | `engagement.email_bounced`, `engagement.email_skipped`, stats `skip_reason_breakdown` |
| Poll instead of webhooks | `GET /events?name=<eda_event>&type&contact_id&since&cursor` (bridged engagement/meeting events) |
| CRM activity | `GET /activities?contact_id=|deal_id=` (outcome, next_steps); `deal.stage_changed` |

**Write side (campaign V2)**
1. Read V1: `GET /campaigns/{id}/full` + `GET /campaigns/{id}/sequence` + `GET /campaigns/{id}/documents/{doc_id}` (brief, sequence copy).
2. Create V2 shell: `POST /campaigns {name:"<V1> - V2", category, brief, core_concept, primary_hook, secondary_hooks, target_persona, goal, audience_list_id, target_channels, auto_generate_documents:false}` (false = no credit spend; true = Studio regenerates ~15 docs, spends credits, status `copy_in_progress`).
3. Write improved content in one transaction: `PATCH /campaigns/{v2}/full {brief, primary_hook, documents:[{file_type:"campaign_brief", display_name, content, status:"completed"}, ...], sequence_steps:[{step_id, day, condition:"no_reply", stop_on_reply:true}]}`; add/edit steps `POST /campaigns/{v2}/sequence/steps {name, channel:"email", mode:"email", day, angle_id, cta_type, personalization_level, constraints}` / `PUT .../steps/{step_id} {do_not_send_rules:[...]}`. AI regeneration (credits) [not in dev docs]: `POST /campaigns/{id}/documents/{doc_id}/regenerate`, `POST /campaigns/{id}/sequence/steps/{step_id}/generate`.
4. Or at sequencer level: [not in dev docs] `POST /sequences/{v1}/duplicate` (drafted, no channels) -> `PATCH /sequences/{new}/steps/{step_id} {step_data:{...complete...}}` -> `PATCH /sequences/{new}` (schedule_id, appointment_id, agents) -> [not in dev docs] `POST /sequences/{id}/channels`, `PUT /sequences/{id}/campaign {campaign_id}`; or `POST /sequences` fresh with `campaign_id` + steps + channels.
5. Feed learnings back to the generation brain: `PATCH /global-context/documents/{doc_id}` (e.g. messaging house / objection handling), `PATCH /research-reports/{id} {markdown_content}` (re-indexes RAG), [not in dev docs] `POST /campaigns/ideas/manual` (FREE) and `POST /campaigns/ideas/{id}/archive` with a `reason` ("future idea generation reads them ... to steer away"). Check retrieval with `POST /kb/search`.
6. Ship: keep V2 as draft for the demo, or `POST /campaigns/{v2}/launch` (real email outreach; `campaigns:launch` scope; email-only) / `POST /sequences/{id}/run` under a sandbox key. Observe `campaign.launched`, `sequence.started`.
7. Close the loop automatically: workflow with event-stream trigger (`POST /workflows`, `POST /workflows/{id}/execute`, webhook `workflow.execution_completed`) or an external cron polling `/events`.

**Flywheel blockers / risks**
- **No way to inject inbound replies, sentiment, objections, meetings, or clicks in the sandbox** — `/sandbox/outbox` only records simulated *outbound* sends and failure injection only covers outbound failure modes (hard_bounce, provider_error, timeout, rate_limited, invalid_recipient). Replies are detected by AI Inbox on real synced mailboxes. -> For the demo, seed synthetic outcome data yourself (local JSON / notes / custom fields) or read historical campaigns in a real org (read-only analysis is safe).
- Meetings/bookings in sandbox: `POST /appointments/bookings` costs ~20 credits, needs an active subscription; calendar OAuth is web-only.
- Open tracking absent (no pixel) though payloads show `opened`; `is_positive` is the only built-in email-reply sentiment; email objection extraction is on you/LLM (credits).
- `GET /campaigns/{id}/metrics` response schema undocumented; analytics schema only in Swagger (`SequenceAnalyticsResponse`).
- Campaign creation with `auto_generate_documents:true` spends credits and is async; launch requires completed copy + audience + active mailbox; API launch is email-only.
- `step_data` PATCH is replace-not-merge; sequence_kind immutable; 409 during transitions.
- Sequencer credit timing (per send vs at launch) unconfirmed; budget 1 cr/step.
- Webhooks need a public HTTPS endpoint (max 10 per org); for a laptop demo prefer polling `GET /events` / `GET /inbox`.
