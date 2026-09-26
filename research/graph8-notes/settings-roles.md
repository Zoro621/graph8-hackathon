# graph8 knowledge base: Settings and Roles

Source: docs.graph8.com `/settings/*` (24 pages) and `/roles/*` (22 pages: an index plus 21 role field guides). Everything below comes from those pages. Where a doc is vague, these notes say so and fill nothing in.

Conventions: `app.graph8.com` is the app host. REST/MCP host is `be.graph8.com`. The event-tracking host is `events.flow.graph8.com`. The role guides were "Generated 2026-05-20 against app.graph8.com" from a **showcase tenant** ("public-company data only"). Their numbers, bugs and empty states describe that tenant as of 2026-05-20/21. The guides say they are built from `graph8-{role}-start-here.pages.dev` scratchpads by a "role-doc-from-scratchpad" skill.

---

## PART A: SETTINGS

### A0. How Settings is reached (routing facts)
- You open Settings from the profile menu (top-right avatar). The whole tree lives at **`/studio/settings?tab=...`**. Most settings are sub-tabs, not routes: `/settings/tracking`, `/settings/fields`, `/settings/attribution` and `/developer` all 404.
- Sidebar groups named in the docs: **Organization** (Company, Users, Roles, Billing), **Channels** (Mailboxes, Purchase Domain/Mailboxes, Preferences), **Developers** (Integrations, and API is presumably here too), **Revenue** (Pipelines etc.).
- GTM-engineer guide: "Settings tree, 14 sub-tabs" (Company, Users, Teams, Roles, Domains, Mailboxes, Phone Numbers, SSO, API/MCP, Compliance, Scraping, Integrations, Billing, Revenue, Tasks, Docs, Enrichment). The RevOps guide has a heading "The 18 Studio Settings sub-tabs" with no list under it.
- **Deep-link reliability, observed (RevOps guide):** `?tab=` works for `revenue`, `integrations`, `domains`, `scraping`. It silently falls back to the last tab for `api`, `api-keys`, `mailboxes`, `roles`, `compliance`, `billing`, `tasks`, `docs`, `enrichment`, `phone-numbers`, `sso`, `purchase-domain`. This conflicts with other docs: the Mailboxes doc says `?tab=mailboxes` opens directly, the Users doc cites `?tab=users`, and the GTM Engineer guide cites `?tab=api`. Treat `/studio/settings` plus a sidebar click as the reliable path.
- **Access gate:** the "Access Admin" capability is the master switch for all of Settings (see A17).

### A1. Company Settings (Settings → Company Settings)
- Fields: Company name, Domain (primary website; used for website-visitor identification, inbound-email matching and brand detection), Timezone (org default for sends, analytics and booking; users can override), Industry (used for benchmarks and AI context), Logo.
- Org-wide. **Admins only.** Changes take effect immediately.

### A2. Users (Settings → Organization → Users; `/studio/settings?tab=users`)
- The header reads "Team Members". Columns: User, Status (Active/Invited), Role, Last Login, Joined, plus inline-editable Extension, Phone Number, Department and Availability. These feed the dialer and team routing.
- **Invites go one at a time** (email + role). An existing graph8 account is added immediately; anyone else gets an email invitation. Pending invites can be revoked.
- A role change is immediate. Removing a user cannot be undone.
- Seat count depends on the plan (see Billing).
- The Onboarding guide mentions a separate "Domains" settings area with an **auth domain allow-list, auto-join and a Default Role** for new joiners. This is distinct from sending domains. It recommends Default Role = SDR (least privilege). The showcase org had 33 users.

### A3. Roles & permissions (Settings → Roles)
**Built-in roles:** Admin (full, locked); CRO (reads all records and all conversations/transcripts, limited write); Sales Manager (full read/write across all records); SDR Manager (team-scoped read/write on contacts, campaigns, tasks, mailboxes and phone numbers; can assign leads); AE (own contacts, companies and deals including close-won/lost; broad list visibility); SDR (own contacts and lists; hands deals to an AE); **Commission SDR** (marketplace SDR, strict row-level isolation, no settings); CSM (renewals and expansion on customer-revenue pipelines); Campaign Manager (campaigns, forms, inbound, attribution); Support Agent (own scope on contacts they touch, team scope on the support inbox, no deals); Finance (revenue read-only plus billing, credits and invoicing); View Only (read-only team records). **Admin and the marketplace "Service Provider" role are locked** and cannot be edited. A "GTM Engineer" role is also mentioned: it has Access Admin on by default.

**Object scopes.** Each object has separate View and Edit scopes, plus Delete, Assign and Manage toggles. Delete, Assign and Manage are flagged "Critical".
- Scope values: Off / Own / Team / All / Manage. Manage = All plus unowned records.
- Objects: Contacts · Companies · Deals · Campaigns · Lists · Sequences · Tasks · Meetings · Mailboxes · Phone Numbers · Inbox Workspaces · **AI Agents**.

**Capability toggles:**
- Workflows: View / Run / Manage
- Billing: View Credits / Purchase Credits / Manage Billing
- Settings: Access Admin / View / Edit
- Users: View / Edit Own / Edit All / Invite / Manage
- Roles: Manage Roles
- Teams: View / Manage
- **Access Admin is on by default only for Admin, GTM Engineer and Finance.**

**Rules:**
- Custom roles can be created, edited (applies immediately), duplicated, or deleted (users must be reassigned first).
- One role per user. A role change needs no logout.
- **Anti-escalation:** a non-admin can only grant permissions they already hold. Org Owners and Admins are exempt.
- Enforcement is "rolling out object-by-object", so lists may look narrower than before.

### A4. Deals / Pipelines (Settings → Deals; RevOps: Settings → Revenue → Pipelines)
- Each stage has Name, Type (Open/Won/Lost), Probability % (used in forecasting) and Color. Stages can be added, edited (existing deals update), reordered by drag, and deleted. **Delete requires reassigning the stage's deals.**
- **Multiple pipelines** are supported (e.g. New Business, Renewals, Partnerships) with no hard limit and one default. Moving a deal to another pipeline places it at that pipeline's first stage. Renaming keeps historical report data.
- The AE guide contradicts this: it says multi-pipeline is "in-progress" ("once multi-pipeline ships").
- Showcase default "Sales Pipeline" has 10 stages: New Meeting 10%, Discovery Held 20%, Solution Fit 40%, Proposal Sent 60%, Verbal Commit 80%, Closed Won 100%, Closed Lost 0%, and Long Term Nurture / Weak Responsiveness / Engaged with no probability. The kanban shows 6 columns.
- Revenue sibling sub-tabs: Buying Committees · Lifecycle · Stage Docs · Lead Qualification · Products · Quotes · Form Settings · Leaderboard. Per-stage checklists, lifecycle hooks and revenue rules are edited from Pipelines.

### A5. Docs settings (Settings → Docs)
- Five tabs:
  - Contacts: Defaults and Library Folder Tree.
  - Companies: Customers Defaults, Prospects Defaults and Library Folder Tree.
  - Campaigns: Defaults and Library Folder Tree.
  - Global: Defaults and Library Folder Tree.
  - Meetings: Meeting Grounding, plus extraction scopes Shared / Customer Calls / Prospect Calls / Internal.
- Checking a doc adds it to the org's default AI-generated doc set for that scope. Changes auto-save, required docs cannot be unchecked, and an **estimated generation time** is shown inline. Prospect companies use Prospects Defaults.
- Default company Library folders: Transcripts, Call Recordings, Contracts and SOW, Objectives and Plan, Weekly Client Summaries, Handoff and Next Steps, Reporting and QBR, Client Materials, Security Questionnaires. Folder templates are exposed through the **org settings API** for companies, contacts, campaigns and global.
- **Meeting Grounding** settings: Canonical Company Name, Internal Domains, Brand/Alias Resolution, Participant Interpretation Rules.
- **Per-scope extraction controls:** Always Extract, Listen For, Custom Fields, Vocabulary/Terms.
- **Priority tab:** uploaded docs default to **High**, AI-generated docs to **Medium**. Levels are High, Medium and Low. The copilot prefers higher-priority docs when sources conflict. Changes apply to new docs only, and individual docs can be overridden in the library.

### A6. Sending Domains (Settings → Domains)
- Add a domain (a subdomain like `outreach.yourcompany.com` is recommended), set SPF (TXT), DKIM (CNAME/TXT, selector from graph8) and DMARC (TXT at `_dmarc`), then Verify. Statuses: Verified / Pending (up to 48h propagation) / Failed.
- **Health:** Reputation Score, Bounce Rate, Spam Complaints, Warmup Status. **Placement tests** report inbox vs spam vs promotions per provider.
- **Multi-domain guidance** by emails per day:
  - 0–200: 1 domain
  - 200–1k: 2–3
  - 1k–5k: 4–8
  - 5k+: 10+ rotated
- Naming patterns: subdomain, hyphenated, TLD variation, product-themed. **Never send from the primary domain.** Warmup is per domain and takes 2–3 weeks.
- **Rotation** (Settings → Domains → Rotation):
  - Modes: Round-robin, Volume-weighted, Campaign-pinned, Persona-pinned.
  - Daily caps per domain (e.g. 500/day).
  - Individual sequences can override the pool and pin a domain.
- **Retire** a domain when placement is below 50% for 2+ weeks: pause, remove from the pool, rest 30+ days, then re-warm or retire.
- **Health alert thresholds:**
  - Reputation drops 15+ points in 7 days.
  - Bounce above 5% in a day.
  - Complaints above 0.1% (Gmail's limit is 0.3%).
  - Placement below 80%.
  - Listed on Spamhaus, SORBS or SpamCop.
  - SPF, DKIM or DMARC record removed.
- Alert delivery (email, Slack, webhook) is set at **Settings → Alerts**.
- The page includes a DNS troubleshooting matrix (SPF/DKIM/DMARC) and provider quirks: Cloudflare proxy must be "DNS only", GoDaddy wildcards, Squarespace migration, Namecheap forwarding.
- Mailbox reputation does not transfer between domains. You cannot send from a domain you don't own.

### A7. Purchase Domain & Mailboxes (Settings → Channels → Purchase Domain/Mailboxes)
- Search domains by keyword and see availability, TLDs (.com .io .co .net .org, some regional) and yearly price. Buy single, buy in bulk ("Purchase All"), or **Upload CSV** of domains (one per row) to check availability and pricing.
- **Auto-configuration:** SPF, DKIM and DMARC are set automatically, verification is instant, and warmup enrollment is automatic.
- Mailboxes: Add Mailbox (name plus display name) or Bulk Add. Each has a sending cap, warmup and signature.
- **Warmup settings validation:**
  - Daily warmup volume: at least 1.
  - Ramp-up: at least 5. Lower values are raised to 5.
  - Reply rate: 20–100%, default 30%, clamped to that range.
  - Values are adjusted, never rejected. Settings sync to **SmartLead**.
- Domains are priced in credits by TLD (Billing → Domain Pricing tab). Transfer-out requires support. Mailboxes per domain are plan-limited.

### A8. Mailboxes (Settings → Channels → Mailboxes; `/studio/settings?tab=mailboxes`)
- Tabs: All / Team Mailboxes / Archived. Columns: email, provider, signature status, daily limit, auto-respond, warmup progress, status, with customizable columns. Users manage personal mailboxes in **Profile → Apps**.
- Connect via **Gmail OAuth** or **SMTP/IMAP** (host, port, user, password, with a connection test).
- Per-mailbox settings: daily and hourly limits, HTML signature, Reply-To.
- Health metrics: bounce rate, reputation, warmup progress, last sync. Alerts fire on bounce, reputation, sync failure and warmup issues.
- **Sharing:** assign mailboxes to workspaces. The owner has full control. Shared users can send but cannot change settings.
- **Bulk Update** covers profile pictures and signatures.
- **Hard cold-sequence cap:** 15 emails/day per fully-warmed mailbox. There is **no limit on mailboxes per sequence**; sends rotate across them (4 mailboxes = 60/day).

### A9. Email Warmup
- Purchased mailboxes auto-enroll: a background worker picks them up within 5–10 minutes of activation. Manual controls exist **only** for purchased mailboxes, under Purchase Domain/Mailboxes → domain → Mailboxes → mailbox → Warmup tab (Settings, Refresh). Self-connected mailboxes get automatic warmup only.
- Recommended settings: daily limit starts at 5 and ramps to 40+; ramp over 2–3 weeks; reply rate 30–40%.
- **Cold-sequence ramp by mailbox age** (anchored to when the mailbox was created in graph8; nurture campaigns are exempt; enabled by default and adjustable per org):

  | Mailbox age | Cold sequence emails per day |
  |---|---|
  | Weeks 1–2 | 0 |
  | Week 3 | 5 |
  | Week 4 | 10 |
  | Week 5 onward | 15 |

- **Providers:** Instantly (default) and SmartLead (used with purchased domains). The provider is chosen at the domain level when the domain is purchased.
- 7-day metrics: sent, landed in inbox, saved from spam, replied. Healthy means reply rate above 25% and inbox placement above 90%.
- **Placement testing:**
  - Run from Purchase Domain/Mailboxes → domain → Placement tab.
  - Results arrive in 5–15 minutes, covering Gmail, Outlook, Yahoo and iCloud.
  - Can be scheduled daily, weekly or bi-weekly with an alert threshold. Scheduled tests use the monthly quota.
  - Score benchmarks: ≥95% excellent, 85–94% healthy, 70–84% warning (cut volume 30–50%), 50–69% pause, below 50% critical.
- **Cost:** a placement test is 20 credits.

### A10. Schedule & Availability
- Working hours per day, day toggles, breaks, personal timezone (overrides the org default) and buffer time.
- These settings drive booking slots and **sequence send windows** (email, call and LinkedIn steps). Connected Google or Outlook calendars block busy time.

### A11. Phone Numbers (Settings → Phone Numbers)
- Buy numbers by country, choosing Local or Toll-Free and searching by area code. Some countries need address verification.
- Assign numbers to SDRs or unassign them. Set Caller ID display name (carrier-dependent).
- SMS toggle. **US SMS requires A2P registration** (brand, campaign, carrier approval). Daily and monthly SMS caps depend on plan and carrier; over-limit messages are queued.
- Porting takes 7–14 business days. Released numbers cannot be recovered. Supported regions include the US, Canada and the UK.

### A12. SSO (Enterprise only)
- SAML 2.0 with Okta, Azure AD/Entra, OneLogin, Google Workspace or any SAML IdP.
- Setup: copy the ACS URL, SP Entity ID and Login URL; map attributes (email required, plus firstName and lastName); then upload IdP metadata or enter the SSO URL, Entity ID and X.509 certificate. Test, then Enable.
- Enforcement: **Optional** or **Required**. Admins keep an email/password fallback.
- One IdP per org. Auto-provisioning on first login defaults the role to "Member". IdP 2FA applies and graph8's built-in 2FA is bypassed.

### A13. API, MCP & CLI (Settings → API; `/studio/settings?tab=api`)
- **Two credential types:**
  - Personal API key (Profile → Developer): for individual MCP and CLI use.
  - Org API key (Settings → API): for shared integrations, backend jobs and admin automation.
- **Create a key:** name it, pick scopes (Contacts, Companies, Lists, Pipeline, Sequences, Analytics (read), or Full Access), then Generate. **The key is shown once.** The list shows Name, Scopes, Created and Last Used. The GTM guide shows keys redacted (`d325…8e33`) and says 10 keys are provisioned on the showcase tenant. The SE guide mentions "per-user keys with revocation + expiry".
- **Rotate:** create a new key, switch over, verify, then revoke the old one. Revocation is immediate and there is no key recovery.
- **Rate limits:**

  | Plan | Requests/min | Requests/day |
  |---|---|---|
  | Starter | 60 | 10k |
  | Pro | 120 | 50k |
  | Enterprise | 300 | unlimited |

  Over the limit, the API returns 429 with a Retry-After header. These plan names don't match Billing's (Pay-as-you-go/Team/Platform).
- **Auth:** `Authorization: Bearer <key>` over HTTPS. Example: `GET https://be.graph8.com/v1/contacts`.
- **Webhooks** (Settings → API → Webhooks):
  - HTTPS endpoints only.
  - Events: `contact.created`, `contact.updated`, `deal.stage_changed`, `deal.won`, `deal.lost`, `sequence.completed`, `meeting.booked`.
  - Retries: 3 attempts at 1 min, 5 min and 30 min, then the webhook pauses and you are notified.
  - Requests are signed; verify them with the signing secret.
- **MCP server:**
  - Remote endpoint: `https://be.graph8.com/mcp/` (Streamable HTTP, **OAuth, no API key**) for Cursor, Claude Code and Windsurf. The SE guide adds Claude Desktop and Claude.ai via a custom connector.
  - Local stdio: `pip install g8-mcp-server`, run with `uvx g8-mcp-server`, env `G8_API_KEY` and `G8_MCP_MODE=dev|gtm`.
  - **Modes:**
    - Developer: repo-centric; every tool needs `repo_id`.
    - GTM: campaigns, copy, KB, enrichment and outreach; no repo needed.
  - Every tool is annotated read-only, write or destructive, and clients prompt before write or destructive calls.
  - **Shared tools:**
    - Contacts/companies: `g8_search_contacts`, `g8_get_contact`, `g8_search_companies`, `g8_get_company`, `g8_lookup_person`, `g8_lookup_company`, `g8_enrich_contacts`, `g8_verify_email`
    - Sequences: `g8_create_sequence`, `g8_get_sequence_preview`, `g8_update_sequence`, `g8_update_sequence_step`, `g8_pause_sequence`, `g8_resume_sequence`, `g8_get_sequence_analytics`, `g8_delete_sequence` (soft)
    - Inbox: `g8_list_inbox`, `g8_get_reply`, `g8_assign_reply`, `g8_tag_reply`, `g8_get_reply_draft` (charges credits), `g8_send_reply`
    - Audience sync: `g8_list_audience_syncs`, `g8_create_audience_sync`, `g8_get_audience_sync`, `g8_update_audience_sync`, `g8_delete_audience_sync`, `g8_trigger_audience_sync`, `g8_get_audience_sync_runs`, `g8_get_audience_sync_errors`
    - CRM: `g8_list_crm_syncs`, `g8_push_to_crm_contact`, `g8_push_to_crm_company`, `g8_push_to_crm_list`, `g8_get_crm_fields`, `g8_get_crm_status`
    - Fields: `g8_list_fields`, `g8_create_field`, `g8_set_field_value`
    - Voice: `g8_voice_list_dialer_sessions`, `g8_voice_get_dialer_stats`, `g8_voice_list_agents`, `g8_voice_create_dialer_session`, `g8_voice_pause_session`, `g8_voice_resume_session`, `g8_voice_stop_session`
  - **Developer tools:** `g8_connect_repo`, `g8_scan_repo`, `g8_get_scan_results`, `g8_status`, `g8_doctor`, `g8_install_spine`, `g8_apply_install`, `g8_list_campaigns`, `g8_get_campaign`, `g8_search_kb`, `g8_list_kb_documents`.
  - **GTM tools:** `g8_list_campaigns`, `g8_get_campaign`, `g8_get_campaign_document` (briefs, copy), `g8_create_campaign`, `g8_update_campaign`, `g8_launch_campaign`, `g8_search_kb`, `g8_list_kb_documents`.
  - **Role guides (GTM Engineer, SE) add:**
    - 80+ tools, the same ones the in-app Copilot uses.
    - Only about 30 appear in the default `tools/list`. Load the rest with `g8_tool_search(query=...)`, using categories "workflow", "dialer", "intent", "skill", "field", "form", "snippet" and "playbook".
    - `g8_find_contacts` is cited as an example tool.
    - The guides mention tools for creating lists, querying deals and generating quotes.
    - The playbook and skill tools exist on the API but **have no UI route**.
- **CLI:** same package. Examples:
  - `g8 status/scan/doctor --repo-id`
  - `g8 create-sequence --name --steps '[...]'`, `g8 pause-sequence`, `g8 sequence-analytics`
  - `g8 inbox-list --channel email --limit 20`, `g8 inbox-draft`, `g8 inbox-send`
  - `g8 sync-audience-list`, `g8 sync-audience-trigger --config-id`
  - `g8 sync-crm-push --provider hubspot --records`
  - The key goes in env `G8_API_KEY`.

### A14. Compliance (Settings → Compliance)
- **Global suppression list** (email only):
  - Addresses are added automatically on unsubscribe, spam complaint, manual add, and **hard bounce, but only if the org opts in**. The opt-in toggle is in the Suppression policy section of Settings → Channels → Preferences and is off by default. Soft bounces never qualify. A sequencer hard bounce always stops that contact's sequence regardless.
  - Filter by reason (opt-out, bounce, complaint, manual). Add, remove, import CSV, export.
  - Removing an opted-out address needs documented consent.
- **DNC (Do Not Contact)** blocks all channels: email, phone, SMS and LinkedIn.
  - Contacts are added when a call disposition is "DNC", manually, or on request.
  - **DNC by domain** (Compliance → DNC → Add Domain) blocks an entire company.
- **Unsubscribe:** one-click unsubscribe is automatic (meets Gmail and Yahoo bulk-sender rules). Link text and landing page are customizable. An unsubscribe triggers suppression, removal from all active sequences, a send block, and an audit log entry.
- **CAN-SPAM:** physical address, ad identification, unsubscribe link, opt-outs honored within 10 business days.
- **GDPR:** legitimate interest for B2B, erasure (deleting a contact plus activity is logged), portability, record of processing.
- **Audit Log** (Compliance → Audit Log) records suppression adds and removes, unsubscribes, DNC adds, setting changes, and who made each change and when.

### A15. Scraping (Settings → Scraping; `/studio/settings?tab=scraping`, one of the working deep links)
- **Global settings:** Enable/Disable scraping for the org, Concurrency (simultaneous requests), Delay (between requests to the same domain).
- **Skip rules:** Exact URL, URL Pattern (e.g. `/blog/*`) or whole Domain. Rules can be toggled on and off, edited or deleted. Suggested skips: login/auth, ToS/legal, internal tools, social profiles, sensitive pages.
- **Allowed domains ("Whitelist Mode"):** when on, only listed domains are scraped. When off, all domains are scraped except those matching skip rules.
- **Rate limits:** requests/second per domain, concurrent connections, retry attempts.
- **robots.txt is respected by default.** Disallowed pages are not scraped.
- **Data handling:**
  - Company fields: description, industry, technologies, employee count.
  - Contact fields: job title, social profiles, bio.
  - Scraped data is deduplicated against existing records and fills empty fields only unless overwrite mode is enabled.
  - **All scraped data is logged for audit.**
- **Failures and scheduling:** a failed scrape is retried per settings, then logged as failed and skipped until the next run. Scraping runs on demand (new company, enrichment). Recurring schedules can be set for batch jobs. Only external (prospect) sites are scraped.
- **Tip:** start with conservative rate limits.
- **Role guides add:**
  - Onboarding uses this tab to "confirm customer website crawled" and "set max crawl depth". This crawl feeds the brand DNA (Website Scrape doc).
  - RevOps: "run a fresh scrape if last crawl > 30 days".

### A16. Integrations (Settings → Developers → Integrations; `/studio/settings?tab=integrations`)
- **CRMs:**
  - HubSpot, Salesforce, Pipedrive (admin account), Zoho CRM: OAuth.
  - **SugarCRM:** instance URL plus username and password, not OAuth. Disconnecting clears the credentials.
  - Several CRMs can be connected at once; watch for duplicates.
- **What syncs:**
  - All CRMs: Contacts, Companies, Leads, Deals and Activities.
  - Appointments: Pipedrive, Zoho and Sugar only.
  - Lists: HubSpot, Salesforce and Pipedrive (as labels).
- **Communication:** Slack notifications for new leads, deal stage changes, sequence completions, bookings and team alerts.
- **Enrichment:** waterfall across multiple providers, configured automatically. It runs when contacts are added or updated.
- **Calendars:** Google Calendar (one-way or two-way) and Outlook (Microsoft 365).
- **Meetings:** **Roam** syncs transcripts and recordings into the inbox. Connections made before March 2026 need a reconnect.
- **Custom:** webhooks, Zapier and Make.
- **Status and sync:** each integration shows Connected, Disconnected or Error, and can be re-authorized or disconnected (already-synced data stays). Sync status shows last sync, record count and errors.
- **Sync frequency:** usually 15 minutes to 1 hour. **Real-time sync is Enterprise only.** Field mapping is per CRM.
- **Settings modal:** each integration has **Push / Pull / Fields / Appointments** sub-tabs with Auto Sync, Activity Sync and per-record-type controls (Contact/Lead/Company/Deal).
  - The Fields tab maps graph8 field to CRM field with **Auto Fill** (fill empty only) or **Overwrite** per row.
  - Per the role guides, this is **the only custom-field surface in the UI**; there is no `/fields` route.
- **Showcase tenant:** HubSpot connected (May 18, 2026) and **Stripe connected (Payment category)**. The role guides list Stripe as the fifth connector.
- **Scripting gotcha:** integration modals use Radix tabs, which need a full pointer event sequence. A plain `.click()` doesn't switch tabs.
- **Mapping changes aren't retroactive.** Existing records keep the old mapping until a sync runs.

### A17. Pipedrive specifics
- **Labels act as lists.** Pipedrive filters are dynamic and can't be synced.
- **Pull:**
  - Choose a tag and a target graph8 list, or Pull All.
  - "Create new records as": Contacts, Leads, Companies or Deals.
  - Auto Sync runs every **30 minutes**. "Enrich from graph8" matches on work email or LinkedIn (company on domain). Activity Sync is available.
- **Push:**
  - Choose a list, then an Existing tag, Create New or None.
  - Auto Sync every 30 minutes, plus Activity Sync.
  - graph8 automatically creates custom fields (Job title, LinkedIn, Department, Seniority, Mobile, Website, Industry, Annual revenue, Employee count) and reuses same-named ones.
- **Card controls:** Settings, Refresh, Disconnect, and **Migrate to graph8** (one-time full-migration wizard).
- **Limits:** there's no batch API, so records sync one at a time. A tag pull scans the whole database.
- Booked meetings become Pipedrive "meeting" activities. graph8 only adds or removes its own tag on a record.

### A18. Salesforce integration user permissions
- graph8 acts as the connecting user, so a field that user can't see **silently doesn't sync**. The settings banner lists inaccessible fields and the Fields tab greys them out. **Re-check** re-reads permissions without reconnecting.
- **Objects:** Lead, Contact and Account need Read/Create/Edit. Campaign needs Read. Campaign Member needs Read/Create/Edit. User needs Read. Task and Event need Read/Create/Edit (only with activity sync). "View and Edit Converted Leads" is needed to keep updating converted leads.
- **Fields:** the doc gives full lists for Lead, Contact and Account. `HasOptedOutOfEmail` and `DoNotCall` feed **opt-out suppressions**: SF opt-outs become graph8 suppressions when "Suppress from opt-outs" is on in the Lead pull. The Lead push can add leads to a chosen SF Campaign.
- A downloadable permission set is "coming soon".

### A19. Audience Sync (Settings → Integrations → Ad Platforms)
- Platforms: Meta (custom audiences), LinkedIn (matched), Google Ads (customer match), X (tailored). Connected with **OAuth through Nango**.
- **Sync flow:** open a list in Data, choose "Sync to Ads", pick the platform and the audience (existing or new), then Sync. The initial push is immediate; after that, adds and removes sync **every 60 seconds**.
- **Use cases:** retargeting, ABM, customer exclusion, lookalikes.
- **Match rates:** enrich work emails first. Personal emails match poorly on LinkedIn and Google.

### A20. Billing (Settings → Organization → Billing)
- **Header:** account status (Active/Trialing), dates, and a credit balance split into **Available / Used / Held** (Held = reserved for running jobs).
- **Tabs:**
  - Upgrade & Topup
  - Services (add-ons)
  - Transactions (with CSV export)
  - Service Charges (live per-service credit rates)
  - LLM Charges (per model tier, per input and output token)
  - Domain Pricing
- "Invoices & More" opens the billing portal for invoices, payment method, billing info and cancellation.
- **Plans:**
  - **Free trial (Pay-as-you-go):** 2,500 one-time credits, full feature access, work email required, no card. The service **pauses** at trial end until a card is added or the org upgrades. **No top-ups during the trial.** On upgrade, unused free credits are cleared.
  - **Team, $99/mo:** 10,000 credits/month pooled across the team. Contacts free (fair use 50k/month). Overage **$0.01/credit**.
  - **Platform, $499/mo:** 75,000 credits/month, unlimited contact data, priority support, overage at pay-as-you-go rates.
  - Downgrades go through support. Upgrades are immediate.
  - After cancellation the account stays active to the end of the period, and data is kept for 30 days. Refunds are case by case within 30 days.
- **Credit examples:**

  | Action | Credits |
  |---|---|
  | Enrich company profile | 1 |
  | Intent signal | 1 |
  | Agent Inbox / textual AI | 1 per 1k tokens |
  | Voice AI | 20 per minute |
  | Meeting scheduled | 20 |
  | Inbox placement test | 20 |
  | Web visitor resolution | 20 |

- Credits are consumed by enrichment (waterfall), AI (composition, transcription, voice) and premium actions (domains, placement tests).
- **Admin view (Finance/RevOps guides):**
  - `/admin` has 5 tabs: Customers (715 records with Stripe `cus_`/`sub_` IDs, credits, usage, status), **Services (37 items priced in credits)**, LLM Charges, Domain Pricing, Custom JS.
  - **LLM tiers, credits per input/output token:**

    | Tier | Input | Output |
    |---|---|---|
    | G1 | 0.002 | 0.0097 |
    | G2 | 0.0039 | 0.0195 |
    | G3 | 0.0065 | 0.0325 |
    | G4 | 0.045 | 0.18 |

### A21. Bug Reports (Settings → Bug Reports)
- In-app report with Title, Description, Steps, Severity (Critical/High/Medium/Low) and Screenshots. The page URL is captured automatically.
- Statuses: Open, In Progress, Resolved, Closed. The report has a comment thread with the graph8 team.

### A22. Custom JS approval (/admin?tab=custom-js)
- An approval queue for JS injected into customer sites, with tabs Pending / Approved / Rejected / Revoked and a full audit trail. The showcase had 5 pending requests.

---

## PART B: ROLE FIELD GUIDES ("graph8 for <role>")

The index says each guide is "grounded in shipped product. No PRD-only or in-progress features." Role groups:
- **Sales:** AE, SDR, SE, Sales Mgr, SDR Mgr, VP Sales, CRO, Account Manager
- **Marketing:** Demand Gen, Campaign Mgr, PMM, Content, MOps
- **Ops and Customer:** RevOps, CSM, Onboarding, Trial, Finance
- **Builders and Leadership:** GTM Engineer, AI Agent Operator, Recruiter, Founder

**Global facts that recur across guides:**
- **Copilot:** sparkle icon top-right or **Cmd+Shift+K**. `/copilot` returns 404. The SDR Manager guide also mentions an "Ask Gemini" button. **Cmd-K** searches the CRM.
- **Bridge:** DM the copilot over WhatsApp, Slack, iMessage or Roam. Set it up at `/profile?tab=apps`.
- **Top nav buckets:**
  - Studio: `?mode=global|content|campaign(s)|team`
  - Signals: Visitors (Contacts/Companies/Chat/Campaigns), Intent (`/keywords`), Forms, Hiring
  - Engage: Sequencer, Nurture, Inbox, Dialer, Web Chat, Appointments, Newsletter
  - Revenue: Suspects, Leads, Trial, Customers, Churned, Quotes, Products, Deals, Leaderboard, My Desk
  - Agents
  - Data: Search, Contacts, Companies, Lists, Suppressions, Workbench, Data Pipelines
- **Attribution empty:** `/analytics/attribution` shows "No sender data yet" on the showcase tenant because there are no `cb_outbound_sends` rows. Use `/analytics/conversions` instead.
- **In progress or PRD-only (AE guide, "don't pitch"):** "Multi-pipeline, stage-checklist v2 programmatic gates, QuickBooks / Xero / Chargebee billing, and **the playbook editor / flywheel**."

### B1. Account Executive (six things)
1. **Pipeline and Deal Intelligence.**
   - `/deals/pipeline` columns: Deal, Company, Docs (e.g. 6/16), Stage, Value, Owner, Close Date, Last Activity. Sub-nav: My Desk / Companies / Contacts / Deals.
   - `/deals/{id}` left rail: **Strategy** (Deal Risks, Next Steps, Close Plan) and **Analysis** (ROI, Competitive), with an "Intelligence 5/5" badge.
   - Center tabs: Overview, Data, Activity, Memory, Notes, Tasks, Quotes, Contacts, Signals.
   - Right panel: Value, Stage, Pipeline, Close Date, Next Step, Closed Won Reason.
   - "Suggest next step" button and a Stage Readiness % gauge.
   - The guide calls this the strongest shipped surface.
2. **My Desk** (`/deals/my-desk`).
   - AI decision cards from **14 signal generators**, fed by Redis streams and per-org pollers.
   - **Autonomy lanes:** autopilot (fires automatically, with a 30-minute undo), approve (one-click sign-off), or off.
   - Four generators shipped 2026-05-21 (PR #7621): No reply (5+ days, with one-click sequence pause), Intent signal, Champion change, Enrichment win.
   - The older ten: meeting prep, post-meeting follow-up, at-risk/stalled deal, new lead, re-engagement, overdue task, stage suggestion, competitive alert, **playbook deviation**, coaching insight.
   - Each card carries `context_data` (deal_value, days_since_outbound, matched_fields). **Dismissals feed back** and per-org emission rates self-tune.
   - A screenshot is still pending because cards hadn't emitted yet.
3. **Customers with MRR** (`/deals/l/customers`): a Stripe overlay (CBAccount on MashupCompany). Columns: Status, MRR, Plan, Subscription, Customer Since, Owner, Stakeholders, Deals, Deal Value.
4. **Quotes** (`/deals/quotes`).
   - Filters: Draft, Sent, Viewed, Accepted, Expired, Declined, Voided.
   - Flow: quote, eSign, then **Stripe customer, subscription, invoice and payment link provisioned automatically on signing**.
   - Detail view: lifecycle timeline, line items (example: 10,000 Credits for $500, Net 30), tabs Overview/Activity/Email, and a Duplicate button.
5. **Inbox and Copilot.**
   - `/inbox/email` has Focused and Other tabs, sentiment chips (Interested, Out of Office, Not Interested, Not Now, Draft) and **sequence-attribution headers** (e.g. `GROWTHDEMANDGEN_SAAS...`).
   - Copilot returns structured tables. Example answer: "8 open deals, $19,488".
6. **Visitors.**
   - `/visitors?tab=companies` shows a Page Path column. `/visitors/companies/{id}` shows a per-company timeline; **its header shows "Company {id}" instead of the name** (cosmetic bug).
   - `/analytics/acquisition` covers channels including AI/LLM.

### B2. SDR
1. **Contacts and lists.**
   - `/contacts`: about 2.31M contacts. Columns include Intent Keywords, Visits, Source and Owner.
   - `/lists`: 264 lists. Columns: Type, Status, Dynamic, Source, Total, Tags. Dynamic lists auto-refresh.
2. **Sequences and dialer.**
   - `/sequencer` has Personal and Team tabs. Step cards show Progress %, contacts, schedule and replies.
   - `/dialer` has session history and parallel dial.
3. **Inbox triage by sentiment.**
4. **Visitors, `/keywords` and `/signals/jobs`.**
   - Hiring Signals **is not** champion job-change tracking. The SDR guide says champion tracking is "still on the roadmap", but the Recruiter guide shows `/signals/job-changes` live. The two guides conflict.
5. **Copilot, `/enrichment/staging` and `/analytics/acquisition`.**
   - `/enrichment/staging` is the Data Workbench with 30 workbenches: import, enrich, export.

Caveats: 0 intent keywords are configured. Judge sequences per step.

### B3. Sales Engineer (five demo arcs)
1. Deal Intelligence.
2. CRM Integrations and Fields (Auto Fill vs Overwrite).
3. Connections/Functions/snippet: `<script async src="https://events.flow.graph8.com/p.js" data-write-key="...">`. Functions have the signature `export default async function(event, {log})`.
4. API, MCP and CLI (remote OAuth, or local stdio).
5. Ads wizard, Copilot capability map and acquisition analytics.

The guide also has a persona-to-start-URL table.

Caveats: copilot answers can overflow the viewport; many SPA tabs don't deep-link; ad platforms ship unconnected; attribution and keywords are empty; some screenshots include a "Claude started debugging" banner.

### B4. Sales Manager
1. **Kanban** with $total and $weighted per stage. This is the only forecast surrogate.
2. **Deal Intelligence** as 1:1 coaching agenda.
3. **`/reports`**, grouped in 7 categories: Activity & Top-line; Reply & Engagement; Deliverability & Health; Calling & SDR Performance (Leaderboard, Grade Trends, Daily Heatmap, Disposition Mix, Talk Time Quality); Pipeline & Inbound; Sequences & Lists; Cross-Account Drift (Account Health Comparison, Idle/Stalled, Meeting Pipeline).
4. **Copilot hygiene queries.** Example: stalled deals over 14 days, with missing close dates flagged.
5. **Customers, trials and churned lists.**

**Gaps:**
- No `/deals/forecast`.
- No AE leaderboard: `/leaderboard`, `/deals/leaderboard` and `/studio/leaderboard` 404, or resolve to "Deal not found".
- No team-wide My Desk.
- No team activity feed.
- No stage-history audit.
- Customer Owner is empty on all 41 accounts.
- No coaching-notes surface.

### B5. SDR Manager
1. `/reports`: 13 sub-reports. Activity Trend, Reply Health, LinkedIn Health, Bounce Health, **Mailbox Health Board**, Connect Rate, SDR Leaderboard, SDR Grade Trends, SDR Daily Heatmap, Disposition Mix, Talk Time Quality, Meeting Pipeline, Inbound Activity.
2. Team Sequencer: 29 sequences with Live, Draft and Completed statuses.
3. `/dialer`: tabs Dialer, Call Logs, Review, Performance. 39 sessions, parallel sessions such as `parallel_session_Ari_...`.
4. Inbox with Not-Interested coaching.
5. `/signals/jobs`: 0 queries configured; "+ Add Query" with industry, role keyword, geo and recency.

**Gaps:**
- This guide says sub-reports can't be deep-linked, but the VP guide says `?report=aN` works.
- `/sequencer?tab=team` is ignored.
- No "not calling" alert.
- No per-SDR scorecard.

### B6. VP Sales
1. Kanban.
2. **Deep-linkable reports:**

   | Report | Path |
   |---|---|
   | Connect Rate | `/reports?report=a4` |
   | Meeting Pipeline | `a5` (73 booked, 3 cancelled; **Held rate not tracked**) |
   | SDR Leaderboard | `a8` |
   | SDR Grade Trends | `a9` |
   | SDR Daily Heatmap | `a10` |
   | Sequence Performance | `a12` |
   | Account Health Comparison | `a14` (25 workspaces, 0.6% average reply) |
   | Idle/Stalled | `a15` |

3. `/reports` Activity Trend (7-day: 40.4K emails, 9.2K dials, 235 replies, 0.6% reply rate, 72 meetings).
4. Customers, trials and `/analytics/acquisition`.
5. Copilot. Its history doubles as a query-template library.

Gaps: no commit/best-case categorization; Customer Owner is empty.

### B7. CRO
1. `/analytics`, `/analytics/marketing`, `/analytics/acquisition`.
   - **Outbound Bridge Funnel:** about 80K visitors, 481 identified (0.8%), then **0 outbound, 0 replied, 0 meetings**. No marketing-to-sales routing rule exists.
2. Kanban. New Meeting holds $402K weighted; Verbal Commit is empty.
3. Customers, trials and churned. Top 5 customers are about 40% of MRR.
4. `/reports` and `/analytics/conversions`: 148 conversions (108 form submissions, 40 meetings).
5. **Copilot revenue summary.** It is candid that "MRR isn't tracked natively… inferring from deal data" and flagged one deal as 76% of bookings.

Gaps: MRR not native (the truth is the customers MRR column and `/admin`); no forecast categories; stage probabilities are set at `/studio/settings` → Revenue → Pipelines; `/copilot` 404s.

### B8. Account Manager
1. **Book at `/deals/l/customers`.** The customer Overview right rail shows MRR, ARR, Health, **Expansion Levers**, **Risk Signals** and Role Assignments. Example: $8,800 MRR, Health Critical (score 0), "No meeting on record", "Credits exhausted: 0", SDR/AE/CSM unassigned.
2. **Trials and churned.** `/deals/l/trials` (Active and Expired sub-tabs with countdowns) and `/deals/l/churned` (the **Churn Reason** column is mostly empty).
3. **Renewal and expansion deals** use the same Deal Intelligence. Create the renewal deal 60–90 days out.
4. Renewal quotes and inbox.
5. `/visitors?tab=companies`, `/reports?report=a14` and copilot queries.

Gaps: Owner empty on all 41 customers; Churn Reason empty; no customer filter on `/visitors` or the inbox; Active Deals panel empty without an open deal; copilot has no MRR tool.

### B9. CSM
1. Book, trials, churned. The Revenue dropdown holds Suspects, Leads, Products, Quotes, Deals, Leaderboard and My Desk.
2. **past_due filter:** 7 customers (17%), about $13.5K MRR at risk.
3. **Customer detail.**
   - Tabs: Overview, Data, Notes, Tasks, **Deal Room**, Activity, Contacts, Sites Visited, Jobs, Next Steps.
   - Health: **Critical** when engagement counters are 0 and there's no recent meeting, **Healthy** with normal reply and meeting cadence, **Warning** in between. Refreshes within a day.
4. `/reports` Account Health Comparison and `a15` Idle/Stalled.
5. Visitors, Inbox, Copilot, and `/agents` (Graph8 Support Agent).

Gaps: no is-customer filters; no billing tab; the copilot says "I don't have a tool to query subscription billing data"; the only CSM agent has no phone.

### B10. Finance
1. Lifecycle views. **The `?subscription=past_due` URL param doesn't work; use the filter panel.**
2. Customer detail with health.
3. **Quotes as the bookings ledger.** Every Accepted recurring quote should map to an active subscription; a mismatch means a provisioning failure.
4. **`/admin`:** Customers (715, Stripe IDs), Services, LLM Charges (G1–G4), Domain Pricing, Custom JS.
5. CAC inputs: `/analytics/acquisition` and `/analytics/conversions`. The copilot has no billing access.

**Gaps:**
- No revenue leaderboard. `/deals/leaderboard` shows "Deal not found" and `/leaderboard` 404s.
- Attribution is empty.
- No per-customer COGS join.
- No Billing tab on the customer record.
- **MRR sort header sometimes does nothing.**
- **Plan values are free text** (e.g. "New price for platform", "GTM POD", "Platform").

### B11. Founder / CEO
1. Morning pulse: `/analytics`, then `/deals/pipeline`, then `/deals/l/customers`.
2. Trials (9, with countdowns) and the Bridge Funnel (481 identified, 0 added).
3. `/reports`.
4. `/agents` (8) and `/studio?mode=global` (43/46 docs).
5. Copilot weekly summary (e.g. about 9K emails, 32 replies, 0.56%, 4 Closed Won about $1,997). `/ads` shows **0 campaigns and $0 spend**.

Gaps: Owner empty; 3 docs pending; bookmark rather than browse.

### B12. Marketing / Demand Gen
1. Analytics: 9 tabs (`/analytics/{overview,acquisition,behavior,conversions,attribution,marketing-intelligence,realtime,live-visitors,performance-reports}`). Top page: "B2B Contact Database", 72.8K views, 99.7% bounce.
2. `/analytics/marketing`: Qualified Traffic 471, Pipeline Impact $0, Bridge Funnel 78,470, then 471, then 0.
3. `/ads` 6-step wizard: Platform, Audience, Creative, Budget, Review, Publish. LinkedIn is preselected. Audiences come from `/lists` and creatives from the brand snapshot.
4. Studio: 41 published and 19 draft landing pages; Brand Kit; 45 docs.
5. `/forms` (19), `/keywords` (0), copilot.

Gaps: the LP URL is non-obvious (`/landing-pages`, `/studio/landing-pages`, `/lp` and `/pages` all 404); no `/blog` (blog lives in the g8web/graph8-web repo); attribution, keywords and funnel are empty; ads need OAuth; docs at 43/45.

### B13. Campaign Manager
1. **Campaign Studio** at `/studio?mode=campaign`. 30 campaigns, each with **17 generated docs**:
   - Dashboard, Landing Pages, Campaign Brief, Messaging & Objections, Targeting & Routing, Email Prompt, Emails, Call Script, Voicemail, LinkedIn Copy, Social Prompt, Sequence, Cadence Calendar, **Performance Tracker**, **QA Rubric**, Reply Templates, Snippets.
   - Each campaign has a **Readiness score** (e.g. 82) and progress chips Content, Sequence, Edit Copy, Audience, Launch.
   - The QA Rubric is "what you grade outbound replies against".
2. **Sequencer.** Per-step Progress, Contacts, Sent, Replied, Bounced, Scheduled, Failed. Progress above 100% (676%) means the pool has cycled. A/B testing is manual: clone the sequence, rewrite the weakest step, run 14 days.
3. `/ads` and landing pages.
4. Inbox attribution, `/analytics/conversions` and `/forms` (each with a **Target List** that routes submitters into a sequence).
5. Copilot. "Best reply rate" answer: SalesLeaders_AI&ML at 0.41% (5/1,215).

Gaps: `/campaigns` 404s; `?tab=` and `?ct=` params often don't apply; ads unconnected; progress above 100% is not a bug; attribution empty.

### B14. Product Marketing
1. Studio Global's 14 PMM-critical docs.
2. **Campaign Studio at `/studio?mode=campaigns` (plural).** This guide says singular **redirects to global**, which conflicts with the Campaign Manager and Marketing guides.
3. Brand Kit (Re-extract).
4. Landing pages and assets.
5. Copilot quick actions: "Create campaign" and "Create contact list".

Gaps: **doc detail views aren't deep-linkable**; 2 docs pending; LinkedIn and Newsletter empty; Voice of Customer underused.

### B15. Content Marketer
1. **Studio Global, 45 docs in 4 buckets.**
   - Intelligence (13): Website Scrape, Company Enrichment, Competitor Discovery, Company Keywords, Product Inventory, Organic Keywords, Paid Keywords, Brand News, Brand Sentiment, Audience Questions, Products & Services, and more.
   - Context (21 or 23): Brand Brief, Value Props, Offer Brief, Personas, ICPs, Messaging House, Proof Catalog, Pricing Matrix, Style Guide, Writing Style Guide, Brand Voice, and more.
   - Research (6): Buyer Psychology, Competitive Teardown, GTM Channel, Industry Analyst, Review Sentiment, Voice of Customer.
   - Targeting (3).
   - Columns: Workflow, Category, Document, Status, Health, Updated.
2. **Brand Kit** (`/studio?mode=content`). Overview, Homepage, Design System, Sections; Assets (362), Website (32), LPs (41), LinkedIn (0), Newsletter (0).
3. Landing pages, created three ways: AI prompt, template, or clone.
4. `/forms`, `/analytics/behavior`, `/keywords`.
5. Copilot hero and headline variants.

Doc count is inconsistent across guides: 45 vs 46, and 42, 43 or 45 generated.

### B16. Marketing Operations
1. **Connections:** `/connections/list`, `/functions`, `/streams`, `/destinations` (11 types), `/live-events` (tabs Incoming, API Destinations & Functions Logs, Batches & Data Warehouse Events).
2. Functions. Live examples: "Filter Eda Submission Form Trigger" and "Campaign Visitor Event Filter". Suggested recipes: UTM parse, internal-IP filter, hash email for Meta CAPI, lead score.
3. Snippet. `?tab=setup` isn't recognized.
4. CRMs and form Target Lists (**mostly empty** on the showcase).
5. Keywords, attribution, copilot. **No native web-to-deal attribution.**

### B17. RevOps
1. Pipeline configuration (see A4).
2. **Reconciliation:** `/admin` Customers (715 with Stripe IDs) vs `/deals/l/customers`. Orphaned subscriptions and unbilled customers are the failure modes. `/admin` Services lists 37 services.
3. Integrations and field ownership. graph8 owns enrichment fields (intent_keywords, sentiment, last_visit); the CRM owns lifecycle_stage, deal_stage and owner.
4. `/reports` and analytics.
5. **Systems config:** Domains (auth allow-list), `?tab=scraping`, `/admin?tab=custom-js`.

Gaps: **no duplicate or merge surface** (`/duplicates` and `/merge` 404); most `?tab=` slugs fail; report sub-routes; attribution empty; no `/fields`; no `/copilot` or `/chat`.

### B18. Onboarding / Implementation (30-day playbook)
- **Days 1–3: brand DNA.**
  - Crawl the site (`?tab=scraping`, max crawl depth).
  - Generate the doc buckets in order: Intelligence, then Context, then Research, then Targeting.
  - Review Brand Brief and Brand Voice with the customer.
- **Days 4–7:** snippet, CRM integration and field mapping.
- **Days 7–10:** Domains allow-list, Default Role, invite users, roles.
- **Days 10–20:** clone one of the 30 team sequences (e.g. SalesLeaders_AI&ML at 0.41%), import contacts, build a list in `/lists`, launch by week 2.
- **Days 20–30:** seed `/deals/l/customers`, run a copilot walkthrough, hand off to the CSM.

Gotchas: `?tab=setup`; Radix tabs; brand DNA generation "took several weeks" for graph8's own org; Default Role must match the first user; mapping changes aren't retroactive.

### B19. Trial Specialist
1. `/deals/l/trials`. Columns: Company, Status, Trial Ends, Signup, Source, Referrer, First Touch, Users on.
2. **Trial detail** at `/deals/l/trials/companies/{id}`. Shows Days Left, Activation %, Trial Health, **Activation Pulse (0 of 5 steps)** and **Conversion Blockers** (e.g. "No open backs", "No recorded touches", "No meetings yet"), plus Role Assignments.
3. Expired trials at `/deals/l/trials?status=expired`. Includes Apple, Notion, Slack, Motive and Booking Holdings.
4. Quotes, inbox, customers sorted by Customer Since.
5. Acquisition, conversions, copilot.

Gaps: the copilot has no trial tool; role assignments are empty; Source/Referrer values are sparse; **the 5 activation steps are undocumented**; blockers only see email, not SMS/WhatsApp/Slack.

### B20. AI Agent Operator
1. **Roster at `/agents`: 8 agents (5 Agents and 3 Twins).**
   - Agents: AI Receptionist; SDR "10k free signup" (voice David, has a phone); SDR "Hyperpersonalised" (Michael); SDR/Chat "Graph8 Chat Agent" (Olivia, has a phone, website chat and demo booking); CSM "Graph8 Support Agent".
   - Twins (voice-cloned UUIDs): Ari (SDR), Din (SDR), Nick (AE).
   - Columns: Name, Entity, Role, Status, Phone, Voice, Appointment, Company Knowledge.
2. **Agent detail tabs:** Overview (KPIs: calls, average duration, success rate, collections), **Persona** (mission, personality with **3 sliders**), Identity (voice, phone, calendar), Skills, Collections, Activity.
3. **Skills, workflows and Company Knowledge.** Company Knowledge is a RAG corpus built from the brand DNA docs. **0 skills are attached** across all agents.
4. **Twins** have no Delete button and first-person voicemail scripts.
5. Monitoring through Inbox, `/dialer` and Copilot.

**Bugs and gaps:**
- **The dialer analytics endpoint returns HTTP 422 to Copilot**, so "how are my agents performing" fails.
- Ari's voicemail spells the brand "Graph8"; it should be lowercase "graph8".
- 0 skills attached.
- **No agent-level reply attribution**; replies are tagged by sequence only.
- **The Activity tab says "Nothing here yet"** for every agent.
- Only 2 of 8 agents have phone numbers.

### B21. GTM Engineer
1. Connections pipeline (8 routes, including `/connections/tailor` for personalization and `/connections/syncs`).
2. CRM and Stripe integrations with field mapping.
3. Forms and snippet (a pageview shows up in live-events within about 2 seconds).
4. API keys, webhooks, MCP (80+ tools) and CLI.
5. `/ads`, conversions, acquisition, attribution.

Discovered routes: `/admin` (713 customer orgs), `/marketplace`, the 9 analytics tabs.

**Missing:** "Workflows" has no top-level route and **there is no no-code visual workflow builder**; automation is code-based (`/connections/functions` and `/connections/list`). No custom-fields route. **Playbooks, Skills and Web-chat routes don't exist yet.**

### B22. Recruiter
1. `/signals/jobs` (Hiring Signals are saved queries a **daily resolver** replays against fresh job postings; empty on the showcase) and `/signals/job-changes` (columns Contact, New title, Previous, New employer, Days in prev, Detected). `/job-changes` 404s.
2. `/contacts` (231,124 in this guide) and `/companies` (68,643 with Employees, Industry, Founded).
3. `/lists` (271) and `/sequencer`.
4. **`/marketplace`:** SDR hiring marketplace with 20 providers in 5 countries, $1.5–4.5K/month base plus $50–600 per meeting. Tabs: Browse, My Talent, Meetings, Messages, Contracts, Statements.
5. Inbox, `/enrichment/staging` (34 workbenches), copilot.

Gaps: no ATS; candidate replies aren't separated in the inbox (prefix sequence names instead).

---

## PART C: APP URL MAP (every app.graph8.com path mentioned)

| Path | What's there / notes |
|---|---|
| `/studio/settings` (`?tab=`) | Settings tree. Working tabs: revenue, integrations, domains, scraping. Also cited: `?tab=users`, `?tab=mailboxes`, `?tab=api` (reliability disputed) |
| `/studio/settings` → Revenue → Pipelines | Stages, probabilities, checklists, plus Buying Committees, Lifecycle, Stage Docs, Lead Qualification, Products, Quotes, Form Settings, Leaderboard |
| `/studio?mode=global` | Brand DNA workbench (45/46 docs, 4 buckets). Doc detail isn't deep-linkable |
| `/studio?mode=content` | Brand Kit: Overview, Homepage, Design System, Sections; Assets, Website, LPs, LinkedIn, Newsletter |
| `/studio?mode=content&ct=landing_page` | Landing pages (41 published, 19 drafts). `ct` param sometimes stripped |
| `/studio?mode=campaign` / `?mode=campaigns` | Campaign Studio (30 campaigns, 17 docs each). Singular vs plural is disputed |
| `/studio?mode=team` | Team Studio (mentioned only) |
| `/deals/pipeline` | Deal list and kanban ($total/$weighted) |
| `/deals/{id}` | Deal detail with Deal Intelligence |
| `/deals/my-desk` | AI decision cards (per user only) |
| `/deals/l/customers` | Paying customers with Stripe MRR overlay; Subscription filter (past_due via UI only) |
| `/deals/l/trials` (`?status=expired`) | Trials with countdowns |
| `/deals/l/trials/companies/{id}` | Trial Health, Activation Pulse, Conversion Blockers |
| `/deals/l/churned` | Churned customers with Churn Reason |
| `/deals/quotes` | Quotes (quote to eSign to Stripe) |
| `/contacts`, `/companies` | Directories (2.31M or 231K contacts; 68.6K companies) |
| `/lists` | Static and dynamic lists (264–271) |
| `/enrichment/staging` | Data Workbench (import, enrich, export) |
| `/sequencer` | Personal / Team / Archived (`?tab=team` ignored) |
| `/dialer` | Sessions, Call Logs, Review, Performance |
| `/inbox/email` | Focused/Other, sentiment chips, sequence attribution |
| `/visitors?tab=companies`, `/visitors/companies/{id}` | Visitor identification (header bug on the company page) |
| `/keywords` | Intent keywords (0 configured) |
| `/signals/jobs`, `/signals/job-changes` | Hiring signals and job changes |
| `/forms` | 19 forms with Target List routing |
| `/analytics` plus `/acquisition`, `/behavior` (`/behavior/pages`), `/conversions`, `/attribution` (empty), `/marketing`, `/realtime`, `/live-visitors` | Analytics (9 tabs) |
| `/reports` (`?report=a4, a5, a8, a9, a10, a12, a14, a15`) | 13 performance reports |
| `/ads` | 6-step ad wizard (Meta/LinkedIn/Google/X) |
| `/agents` | AI agents and Twins |
| `/connections/overview`, `/list`, `/streams`, `/functions`, `/destinations`, `/live-events`, `/tailor`, `/syncs` | Event pipeline |
| `/admin` (`?tab=custom-js`) | Customers (Stripe), Services, LLM Charges, Domain Pricing, Custom JS approvals |
| `/marketplace` | SDR hiring marketplace |
| `/profile?tab=apps` | Bridges (WhatsApp/Slack/Roam/iMessage) and personal mailboxes. Profile → Developer holds the personal API key |

**Known 404s or broken paths:** `/campaigns`, `/copilot`, `/chat`, `/leaderboard`, `/deals/leaderboard` ("Deal not found"), `/studio/leaderboard`, `/deals/forecast`, `/job-changes`, `/landing-pages`, `/studio/landing-pages`, `/lp`, `/pages`, `/blog`, `/fields`, `/properties`, `/duplicates`, `/merge`, `/settings/tracking`, `/settings/fields`, `/settings/attribution`, `/developer`, and a top-level Workflows, Playbooks, Skills or Web-chat route.

**Non-app hosts:** `be.graph8.com/v1/*` (REST), `be.graph8.com/mcp/` (remote MCP), `events.flow.graph8.com/p.js` (tracking snippet).

---

## PART D: HACKATHON RELEVANCE

### D1. Source Scout (find and evaluate new external B2B data sources, then acquire them into lists)
- **Scraping controls to respect or mirror** (Settings → Scraping):
  - Org enable/disable, concurrency, per-domain delay.
  - Requests/sec per domain, concurrent connections, retries.
  - **robots.txt honored by default.**
  - Skip rules (exact URL, pattern, domain; toggleable) and **Whitelist Mode** (only allowed domains are scraped).
  - All scraped data is **audit-logged**, deduped, and fills empty fields only unless overwrite is on.
  - A Scout should work within these rules: propose a source, check robots.txt and ToS, add it to the whitelist, set conservative rates.
  - Suggested skips (login, ToS, social profiles, sensitive pages) are a natural source-evaluation checklist.
- **Compliance gates before any acquired record is used:**
  - Global suppression (email).
  - **DNC, including DNC-by-domain**, across all channels.
  - Salesforce opt-out flags become suppressions.
  - GDPR: legitimate interest for B2B, erasure, portability, record of processing.
  - CAN-SPAM.
  - The Audit Log.
  - A Scout's evaluation score could include a compliance-risk dimension and filter acquired contacts against suppression and DNC before they land in a list.
- **Landing zones:**
  - `/lists` (static or dynamic) and `/enrichment/staging` (import, enrich, export). Validate emails and append phones before sequencing.
  - Waterfall enrichment runs automatically on add/update.
  - `/signals/jobs` saved queries replayed daily. This is an existing "source" pattern to emulate.
  - `/keywords` intent (empty on the showcase, so a gap to fill).
  - Pipedrive label and CRM Pull into lists (with "Enrich from graph8").
- **Programmatic hooks:**
  - MCP/REST: `g8_lookup_company`, `g8_lookup_person`, `g8_enrich_contacts`, `g8_verify_email`, `g8_search_*`, `g8_create_field` / `g8_set_field_value` (for source-provenance columns), `g8_push_to_crm_list`.
  - List-creation tools are referenced ("create lists"); load them with `g8_tool_search`.
  - Org key scopes: Contacts, Companies, Lists.
  - Webhook `contact.created` for downstream triggers.
- **Cost model:**
  - Company enrichment 1 credit, intent signal 1, web visitor resolution 20, LLM tokens by G1–G4 tier.
  - Team plan: 10K credits/month, overage $0.01. Trial: 2,500 credits, no top-ups.
  - "Held" credits cover running jobs, so a Scout should estimate credit cost per source before acquiring.
- **Permissions:** Lists and Contacts object scopes, plus Access Admin for Scraping settings (Admin, GTM Engineer or Finance by default).

### D2. Flywheel (analyze finished campaigns and generate an improved playbook V2 for approval)
- **Explicitly unshipped:** "the playbook editor / flywheel" is listed as in-progress or PRD-only in the AE guide. Playbook and Skill MCP tools exist (`g8_tool_search("playbook")`), but **there is no UI route**. The Flywheel fills a stated product gap.
- **Outcome data sources:**
  - Sequencer per-step stats: Sent, Replied, Bounced, Failed, Progress. `g8_get_sequence_analytics`.
  - Inbox sentiment chips (Interested, Not Interested, OOO, Not Now) with sequence attribution. `g8_list_inbox`, `g8_get_reply`.
  - `/reports` (Reply Health, Bounce Health, Mailbox Health Board, Sequence Performance `a12`, Meeting Pipeline `a5`, where Held rate isn't tracked).
  - `/analytics/conversions` (forms and meetings).
  - Deals and Closed Won Reason; webhooks `sequence.completed`, `deal.won`, `deal.lost`, `meeting.booked`.
  - Copilot comparisons, e.g. "SalesLeaders_AI&ML 0.41%".
  - **Caveat:** `/analytics/attribution` is empty (no `cb_outbound_sends`) and the dialer analytics endpoint returns 422. Rely on sequence analytics and inbox attribution instead.
- **What V2 should rewrite:** the 17 Campaign Studio docs, especially Campaign Brief, Messaging & Objections, Targeting & Routing, Emails, Sequence, Cadence Calendar, Reply Templates and **QA Rubric** (the reply-grading rubric), plus the **Performance Tracker** doc. Read and write them through the GTM MCP tools `g8_get_campaign_document` and `g8_update_campaign` / `g8_create_campaign` / `g8_launch_campaign`. The Readiness score and progress chips are natural V2 quality gates. Today's manual A/B loop (clone, rewrite the weakest step, run 14 days) is the process to automate.
- **Guardrails for V2 (hard platform limits):**
  - 15 cold emails per mailbox per day; age-based warmup ramp.
  - Placement below 80% means pause.
  - Complaints above 0.1% trigger alerts.
  - Domain rotation modes and per-domain caps.
  - Suppression and DNC.
  - Send windows from Schedule & Availability.
- **Where approvals live:**
  - My Desk autonomy lanes: **approve** (one-click sign-off queue) vs **autopilot** (30-minute undo) vs off. There is already a "**playbook deviation**" card generator and dismissals self-tune. This is the natural place to put a "Playbook V2 ready for approval" card.
  - MCP write/destructive annotations prompt users before `launch` or `update`.
  - Custom JS has a separate Pending/Approved/Rejected/Revoked queue in `/admin`, a precedent for an approval-queue UI.
  - The role capability "Workflows: View/Run/Manage" and the Campaigns object scopes gate who can approve or launch.
- **Who consumes V2:**
  - Campaign Manager: Campaign Studio and Sequencer.
  - PMM: Messaging & Objections, Reply Templates.
  - SDR Manager: `/reports`, the team Sequencer, and coaching from Not-Interested replies.
  - SDRs: cloning team sequences.
  - VP Sales and CRO: exec summaries.
  - AI Agent Operator: agent Persona, Skills and voicemail scripts, which could consume V2 messaging.
  - Onboarding: "clone proven team sequence templates" for new customers.
- **Priority input:** V2 docs written back to the library would default to **Medium** (AI-generated) priority, while uploaded or approved docs default to High (Settings → Docs → Priority). Promoting approved V2 docs to High makes the copilot prefer them.
