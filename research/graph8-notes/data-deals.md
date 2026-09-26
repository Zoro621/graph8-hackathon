# graph8 Knowledge Base: Data + Deals modules (+ index, changelog)

Source: plain-text extracts of docs.graph8.com (`index.md`, `changelog.md`, all `data__*.md`, all `deals__*.md`). Everything below is taken from those pages; where the docs are vague or silent, that is stated explicitly. "[Doc gap]" marks places where a hackathon team should verify in the live product or API.

---

## 0. Help Center index (docs.graph8.com/)

Top-level doc sections: **Get Started, Data, Signals, Studio, Engage, Agents, Analytics, Settings**.
- Data = "Search prospects, manage lists, and import or export contacts."
- Signals = website visitors, form submissions, keyword tracking (buying intent).
- Studio = AI campaign ideation (intelligence, personas, content generation).
- Engage = automated outbound sequences (email, phone, LinkedIn).
- Agents = AI capabilities across enrichment, inbox, campaigns, sales.
- Analytics = website analytics, marketing intelligence, acquisition/behavior/conversion.
- Settings = org settings, users, billing, API configuration.

"Find a feature" links: *Work: conversations and agent work*, *Custom objects and attributes*, *Organization knowledge*, **All MCP tools and input schemas** (a full MCP tool catalog exists as a separate doc page; it is not among the files read here). Popular: What is graph8?, Initial Setup, Prospecting, Building Your First Sequence, Signals Overview.

Note: In the app nav, Deals-related pages are referred to both as **Deals → ...** and **Revenue → ...** (Leads and Quotes docs say "Revenue in the top nav"). Treat "Deals" and "Revenue" as the same area; the naming appears to be in transition.

---

# PART A — DATA MODULE

## A1. Prospecting (Data → Search) — docs.graph8.com/data/prospecting/

**What/why:** Search graph8's proprietary database of **200M+ B2B contacts** to build prospect lists.

**Where:** Data → Search, with **People** and **Companies** tabs.

**Flow:**
1. Choose People or Companies tab.
2. Apply filters in the left panel, click **Run Search**.
3. Review results; **Save List** (all results) or select rows → **Save Selected**.
4. Name the list (e.g. "Q1 SaaS VP Marketing - West Coast"); it appears under Data → Lists.

**Filter sections:**
| Section | Filters |
|---|---|
| Contact Search | Persona (Seniority Level, Job Title, Job Department), Social Profiles, Education, Background, Scoring and Confidence, Personal Information |
| Company Search | Company, Industry, Number of Employees, Company Revenue, Year Founded, Company Social Media, Stock Ticker, Stock Exchange |
| Location | Country, state, city, metro (contact or company geography) |
| Intent Topics | Companies showing buying intent on selected topics |
| Intent Search | Free-text intent keyword search |
| Lists | **Include or exclude contacts from your existing lists** (e.g. exclude current customers) |

- **Max results** cap: up to **50,000** records per search.
- Collapsed filter sections show a badge with count of active filters.
- **Saved Filters:** save filter combos; re-running finds new prospects as the DB updates (a manual "re-run" — no auto-schedule documented for saved searches).
- **Per-company caps:** in the save dialog check "Limit number of employees per company" (e.g. max 3); graph8 picks **highest-seniority matches first**.
- **Auto-enrichment on save:** "graph8 enriches prospect data automatically when you save contacts to a list" — emails (verified work), phones (direct/mobile), LinkedIn URLs, company data (size, revenue, industry, tech stack). Credit cost of this auto-enrichment is **not stated** [Doc gap]. Changelog (Apr 2026) mentions "credit-gated PII unlock" and list bulk action "Unlock Selected", implying some fields are locked until paid for.
- Changelog: entity search migrated to index-driven arms (~1.3s → ~3ms), hits show relevance, provenance, exact-match indicator (Jun 13-19).

## A2. Contacts (Data → Contacts) — docs.graph8.com/data/contacts/

**What:** People records, each linked to a company.

**Browse:** grid with column filters and saved views; click row → slide-over; **Open full view** → detail page. **+ / +Add Contact** creates a single record. **Email is the dedup key** — creating a contact with an existing email updates that record. (Changelog Mar 2026: "emailless contacts are supported" and contacts auto-link to companies by domain.)

**Detail page tabs:** Overview (engagement summary, about, dashboard), Activity, Notes, Tasks, Deal Room (deals via contact's company), Meetings, Signals, **Next Steps (AI-suggested next actions)**, Inbox. Sidebar: email, phone, title, department, seniority, company, industry, employee count.

**Activity tab:** type filters (All, Emails, Calls, Meetings, Notes, Tasks); source filters (All, Manual Only, CRM Only); **Create Activity** (note/call/email/meeting/task with subject, description, date); sync icon pulls latest CRM activities on demand.

**Intelligence Documents** (Intelligence Panel, toggle via header icon) — 7 AI docs in folders:
- Outreach: Outreach Personalization, Conversation Prep
- Intelligence: Stakeholder Intel Brief, Career & Trigger Timeline, Relationship Map
- Strategy: Persona-Mapped Value Prop
- Engagement: Engagement History Digest
"Generate" on root creates all 7; or generate individually. Runs in background. Built from **Global Context** + contact data (enrichment fields, engagement history). Credit cost not stated.

**Running Actions:** ⚡ icon opens searchable list of the org's **AI actions**; contact data auto-injected as context. Result dialog shows output, execution time, token usage; **Save to Intelligence** persists result to the panel. Tip: generate intelligence docs first — actions referencing them produce better results.

## A3. Companies (Data → Companies) — docs.graph8.com/data/companies/

**What:** Account-level records; every contact links to one.

**Field categories:** Firmographic (industry, employee count, revenue, founding year, location); Technographic (tech stack, tools, platforms); Signals (website visits, intent keywords, engagement score); Relationships (contacts, deals, lists).

**Create single company:** doc text is copy-pasted/buggy — says "Go to Data → Contacts, click +Add Company". Likely Data → Companies [Doc gap/doc bug].

**Detail page (account-first):** Overview panel, Contacts, Deals, Signals, **Intelligence panel** (AI insights + enrichment). **Activities** tab: CRM activities, engagement events across contacts, calendar events; on-demand CRM sync.

**Enrichment:** waterfall enrichment for firmographic/technographic gaps. Related: "Studio Companies" (run AI intelligence on target companies).

Changelog: company logos in grids (Jun 20-26); ABM workspace with companies-first detail panel, multi-committee library, keyword-level assignment (Apr 11-17).

## A4. Managing Lists (Data → Lists) — docs.graph8.com/data/managing-lists/

**What:** Lists are the core container: every saved search, CSV upload, audience lives as a list.

**List index columns:** Name, **Type** (Contacts or Companies), **Status** (processing state e.g. Completed), **Dynamic List** flag, **Source** (graph8, Visitor, an import, etc.), Total Records, Tags, Date Created.

**Creating (+ Create List):** choose Contacts or Companies, name it, then:
- **Create & add contacts** → empty list; add via Add Contact, Search, or CSV.
- **Import CSV instead** (only available after naming) → 4-step wizard: Upload (.csv, .xlsx, .xlsm) → Preview File → Map Columns → Preview Result.
- **From Search** → Data → Search, save results.

**Inside a list:** toolbar has **List / Enrichment views**, Filter, Views (saved filter views), Download, Add Contact, ⋮ bulk-actions menu. Filters: text search, column filters (e.g. title contains "VP", company size > 200), sort, saved views. Filters are additive (AND).

**Bulk actions (⋮):** Merge Lists, Clone List, **Verify Emails**, **Unlock Selected** (reveal locked contact info — implies credit cost), **Add to Suppressions**, Delete. "Select all N contacts in this list" banner lets actions hit the entire filtered set.

**Export:** Download button exports visible columns (incl. custom enrichment/AI columns) as CSV; hide columns to control output.

**List types:** Contact lists, Company lists, **Dynamic lists** (auto-updating from saved filter). Suppression is **no longer** a list type.

**List picker:** infinite scroll + type-to-search (no hard cap for orgs with hundreds of lists). Deleting a list removes it from all dropdowns (routing, sequencing, filtering).

Changelog additions:
- **Master Lists** (Jun 13-19, Major): union-of-lists rollups with mirror sync; "include-all" mode auto-pulls every list in workspace.
- **Revenue lifecycle lists** (Apr 11-17): each lifecycle stage auto-maintains a contact list and company list (trial, customer, churn cohorts).
- **List Performance tab** (Feb 2026): engagement rates, delivery rates, activity trends per list; CSV export includes call metrics.
- **Bulk add to suppressions** from lists with confirm modal (Jun 20-26).
- Global `enrichment_data` column in list grids with confidence scores as colored tiers (Mar 22-28).

## A5. Suppressions (Data → Suppressions) — docs.graph8.com/data/suppressions/

**What:** Contacts excluded from outreach across sequences, dialer, LinkedIn (competitors, customers, opt-outs).

**How:** From a contact list, select → ⋮ → **Add to Suppressions** → pick channel scope: **All channels / Email / Phone (dialer/SMS) / LinkedIn** → confirm.
- **Uploading a suppression CSV directly is no longer supported** — import to a list first, then suppress.

**Suppressions page columns:** Contact, Company, Email/Phone, Channel, Category, Source/Origin, **Reinstate**.
- **Channel-specific opt-outs toggle:** Off = account-wide; On = per-channel. Managed under Settings → Channels → Preferences.
- Related: global suppression list and **DNC list** under Settings → Compliance; unsubscribes, hard bounces (when enabled), spam complaints feed them automatically.

Changelog: **Central suppression engine** (May 30-Jun 5) — single source of truth across sequencer, newsletter, audiences; sequencer enforces suppression at execution time; "Contact Suppress Control". Opt-in global suppression on hard bounce (Jun 6-12).

## A6. Import & Export — docs.graph8.com/data/import-export/

**CSV import:** Data → Lists → **Import** → drag .csv/.xlsx → map columns (auto-detects) → choose destination list (new/existing) → **Start Import** (background, notification on completion).
- Requirements: header row; **Email column required** (dedup key); **max 50 MB**; .csv/.xlsx. (Managing Lists page also lists .xlsm.) Contradiction: import doc says email required, but changelog says emailless contacts supported via Add Record. [Doc inconsistency]
- Dedup: existing contact with same email is **updated**, not duplicated. Contacts without email can't be deduplicated.
- Auto header mapping: Email/Email Address/E-mail; First Name/FirstName/Given Name; Last Name/LastName/Surname; Company/Company Name/Organization; Title/Job Title/Position; Phone/Phone Number/Direct; LinkedIn/LinkedIn URL.

**CRM sync:** Settings → Integrations → Salesforce/HubSpot/Pipedrive/Zoho → authorize → choose objects/fields → direction (one-way or bidirectional). Scheduled; changes may take **up to 15 minutes**.

**Export:** open list → optional filters → Export → choose columns → Download (CSV). Includes contact fields, company fields, custom fields, list metadata (date added, source).

Changelog: **Streaming CSV import** (Apr 11-17) — 100k-row files with real-time progress; **CSV import and CRM pulls enrich from the graph8 data index first, at zero extra credit cost** (Apr 11-17); CSV-uploaded contacts auto-link to companies (Mar 15-21); CRM contact pulls create linked Company (Jun 13-19); SugarCRM also supported (Mar 2026); Pipedrive full parity incl. Tags-driven segments (Jun 20-26).

## A7. Staging Workbench (Data → Workbench) — docs.graph8.com/data/staging-workbench/

**What/why:** An **isolated staging workspace** to prepare raw/messy data **before** it enters lists. Distinct from list enrichment (which fills gaps on already-listed contacts). "Nothing touches your main lists until you explicitly export."

**Flow:**
1. Data → Workbench → **Create Workbench**, choose entity type (contact or company).
2. Import: **CSV Upload** (map on import), **Paste Data** (auto-detects delimiters), **CRM Import** (Salesforce, HubSpot, Pipedrive, Zoho), **Search Import** (from graph8 prospecting DB), **Webhook / JSON** (raw JSON column receives payloads; **column discovery** extracts nested fields automatically), **Manual Entry**.
3. graph8 guides a staged UX: import options → "helps you extract and structure fields" → full grid + enrichment tools.
4. Add columns: waterfall, AI, formula (same as Enrichment & Formulas).
5. **Map & Export** wizard: map fields (auto-suggested) → choose destination (new/existing list) → optionally configure waterfall enrichment (email, phone, company) to run after export.

**When to use:** raw CSV cleanup, enrich CRM pulls before list creation, webhook/API JSON extraction, combine/score/transform multi-source data, preview enrichment before committing.

Changelog-derived capabilities not in the page itself:
- **Scraper bot** agent in the workbench "extracts structured data from web pages and feeds it directly into your enrichment pipeline" (Mar 22-28).
- **Find People inside the workbench**, copilot-driven staging, **LinkedIn lookup**, **email-attached PDF ingest**, scraper-bot enrichment (Mar 29-Apr 4).
- Workbench tables in **AG Grid** with JSON cell viewer, one-click export to a saved list (Apr 5-11).
- Staging export mapping wizard: **unmapped columns preserved as custom fields automatically** (Mar 15-21).
- Staging/workbench tools are registered in the unified **copilot** (Mar 29-Apr 4).
- Workflow nodes: **Workbench Lookup** (Mar 29-Apr 4), **Pull Workbench Rows** for bulk reads; FieldPicker exposes dynamic workbench columns (Jun 20-26).
- Oddity: several changelog "Open" links for workbench point to Studio or Enrichment — the workbench may be surfaced in Studio as well [verify].
- [Doc gap] Scraper bot configuration (URL input, pagination, what page types it handles, limits, credit cost) is **not documented** anywhere in these pages. Webhook endpoint URL format/auth also not documented.

## A8. Workbench Pipelines — docs.graph8.com/data/staging-pipelines/

**What:** Chain enrichment steps into automated workflows per **workbench table** that run whenever new data arrives.

**Where:** open a workbench table → **Pipeline** tab → New Pipeline or template.

**Start events:**
| Start | Trigger | Use case |
|---|---|---|
| Email PDF | PDF received via email ingest | resumes, invoices, inbound docs |
| Webhook | Data arrives on table's webhook endpoint | external tools/APIs |
| **Scraper Bot** | scraper bot delivers results | web-scraped company/contact data |
| Import | rows added via CSV, paste, CRM import, or search | enrich new batches |
For Email PDF and Webhook you can configure expected source types and fields.

**Step types (run sequentially):**
- **AI Group** — AI extraction using a saved AI column group (or create inline).
- **Waterfall** — run waterfall on a waterfall-configured column.
- **Formula** — G8X expression engine.
- **Branch** — field/operator/value → "if true" / "else" paths. Operators: Equals, Not equals, Contains, Greater than, Less than, Is empty, Is not empty. **Only ONE branch per pipeline; no nesting.**
- **Export to List** — send row to a contact or company list with field mapping.

**Templates:** Email PDF Extraction (AI extract → formula scoring → export); Webhook Routing (AI classify → branch → export); Import Classification (AI analysis → formula tagging → export); SDR Candidate Grading (resume extraction → location detection → scoring → tier mapping → narrative → export).

**G8X formula language** (safe, deterministic, sandboxed; row fields via dot notation; no external data/API access):
- String: UPPER, LOWER, TRIM, CONCAT, SPLIT, JOIN, REPLACE, SUBSTRING, LEFT, RIGHT
- Math: ADD, SUB, MUL, DIV, MOD, MIN, MAX, FLOOR, CEIL, ROUND, ABS
- Logic: IF, AND, OR, NOT, EQ, GT, GTE, LT, LTE
- Type: TO_NUMBER, TO_STRING, IS_EMPTY, COALESCE, DEFAULT
- JSON: GET, KEYS, VALUES, LENGTH, INCLUDES, FIND
- Examples: `IF(INCLUDES(LOWER(title), "vp"), 90, IF(INCLUDES(LOWER(title), "director"), 70, 50))`; `CONCAT(TRIM(first_name), " ", TRIM(last_name))`.
- Note: **Two formula systems exist** — list Formula columns use **JavaScript** expressions with UPPER_SNAKE placeholders (e.g. `COMPANY_EMPLOYEE_COUNT`); pipeline Formula steps use **G8X** with dot-notation field names.

**Async processing:** steps enqueued to background workers; no timeouts; retry with exponential backoff; real-time grid progress; AI & waterfall steps distributed across workers; formula steps run immediately.

**Gaps:** no documented dedupe step, no "find people" step, no scheduled start event (only event-driven), no per-step credit estimates shown. Single-branch limit is a real constraint.

## A9. Enrichment & Formulas — docs.graph8.com/data/enrichment/

**Where:** within a list, click **+** column header to add an enrichment column. Results stream live via **server-sent events**; you can stop a job early.

**Types & credits:**
| Type | Does | Credits |
|---|---|---|
| Waterfall | provider sequence until value found | fixed per provider per record (varies) |
| AI Enrichment — Web Research | LLM web research | **7 per record** |
| AI — Content Generation | personalized copy | **1 per record** |
| AI — Create/Modify Content | transform field values | 1 per record |
| Formula | JS expression | **Free** |
| Find People | contacts at companies in list | "credits per search" (amount unspecified) |

**Waterfall:** + → Waterfall → choose target (work email, phone, company data...) → select & drag-order providers → Run. Stops at first provider returning a value. Click enriched cell to see which provider returned it. Saving a new config **replaces** the chain (no duplicate columns).
- Providers (15+): Email & Phone — Apollo, Hunter, Prospeo, RocketReach, LeadMagic, Lusha, IcyPeas; Company — Clearbit, BuiltWith; Verification — ZeroBounce, DropContact, EmailListVerify. (CDP page also lists these; CDP omits IcyPeas/EmailListVerify.)
- Options: Reveal phone numbers (extra credits), Reveal personal emails, Email verification post-step.
- Run: validates credits → queues in batches → live streaming.
- Changelog: **Email Validation is now a dedicated email-verification waterfall column** (provider order, persisted verdicts, re-verify existing emails) (Jun 20-26). "Credential-aware waterfall defaults", global rate limiter, byte-aware chunking, **audience-membership dedup** (Jun 13-19). Enrichment pulls graph8 data index before external providers (Apr 2026).

**AI Enrichment:** + → AI Enrichment → prompt with **@ field variables** (rendered as pills) → define **output columns (one prompt can fill multiple columns)** → Run. Each AI column independent; layering allowed. Results panel: full response, **sources/citations** (web research), reasoning, token usage. Example prompts: research COMPANY_NAME (COMPANY_DOMAIN) one-sentence summary; personalized opener; recent 30-day news. Changelog: Web research v3 = planner-as-brain, skill-driven, JSON search results, **fixed per-run credit costs** (Mar 29-Apr 4).

**Formula columns:** JavaScript expressions with field placeholders; output text/number/boolean; free, instant.
- Contact templates: Lead Score (0–10 from size, industry, title), Seniority Level (Executive/Senior/Mid/Junior), Contact Quality Score (0–100 completeness), Email Validation (Personal/Professional/Missing), Full Name Formatter.
- Company templates: Company Size Category (Startup/Small/Medium/Large/Enterprise), Revenue Category (Early Stage/Growth/Scale/Enterprise), Industry Tech Score (0–10), Growth Stage Analyzer (Seed/Early/Growth).
- **AI-Generated Formulas:** describe in English → AI writes JS → preview on sample rows → save & run.
- Tip: use free formulas to score/flag before running paid enrichment.

**Find People:** list with company data → + → Find People → filters (job title, seniority, department) → choose company column → destination list → Run → review, select, import. Changelog: Find People standalone surface (Feb 7-13) — enter company name/domain + filters, returns enriched contacts; also available inside workbench (Mar 29-Apr 4). Leads doc lists "Find People" as a lead_source.

**List Routing:** filter conditions (title, industry, enrichment results) → destination list → **move or copy** manually or via automation; **AI can suggest routing rules**. Use: route high-quality leads to sales-ready list, split by persona/score.

**Credits:** estimate shown pre-run and balance validated; credits **held** during processing, charged as results arrive, unused holds released. Balance at Settings → Credits & Billing. Changelog: **Unified credit pricing** (Jun 20-26, Major) — single credit pool replaces per-category model; welcome grant; "data services on the house"; Team plan; ~40 previously unbilled AI/LLM calls now metered. Data trial = 10K data credits; PAYG with credit packs (Mar 29-Apr 4). So the per-record numbers above may be outdated [verify].

## A10. Customer Data Platform (CDP) — docs.graph8.com/data/customer-data-platform/

**What:** Foundation layer; all contacts, companies, events, signals are unified, enriched, activated. Per-org isolation.

**Sources:** website tracking (page views, forms, custom events, sessions), CRM imports (HubSpot/Salesforce/Pipedrive), CSV uploads, enrichment providers, sequences (opens, clicks, replies, bounces, call outcomes), form submissions, intent signals (keyword/topic).

**Contact schema:** Personal (name first/middle/last, gender, age from DOB, about); Contact details (work email, personal emails, mobile, direct phone, additional phones); Job (title, department, seniority VP/Director/Manager/IC, job category, start date, **job change flag**); Location (personal + work: city/state/country/zip/address); Social (LinkedIn URL, headline, Facebook, Twitter, connection count); **Confidence score 0–100** + separate **email confidence score**.
- **Record sources:** graph8 (data network), Custom (CSV/manual), HubSpot, Salesforce, Pipedrive.

**Company schema:** Basics (name, description, domain, website, logo); Location; Business (founded year, employee count, revenue range, industry, **NAICS/SIC**); Social (LinkedIn URL/followers, Facebook, Twitter, **Crunchbase**); Stock (exchange, ticker); Scoring (**company fit score**).
- Size categories: Startup <10; Small 10–50; Medium 50–200; Large 200–1,000; Enterprise >1,000.

**Identity resolution (4 layers):** (1) hashed email match vs B2B/B2C network; (2) B2B (business emails, direct phones, company, job history) and B2C (personal emails, demographics: age range, income, homeowner) network; (3) **IP-to-company** fallback; (4) persistent anonymous browser ID — retroactively stitches prior visits on identification. Output: unified profile (contact, company, sessions, forms, email engagement, intent).

**Event tracking:** Page views, Custom events, Form submissions, Identify (traits), Group (account). Context: page, user (email, anon ID, UA, locale), device, geo (country/city/region/lat-long/timezone/ISP), UTM. Stored in analytics engine (fast aggregation, per-org isolated). (Segment-like identify/group semantics.)

**Audiences:** types Contacts, Companies, Suppressions, Deals, Leads. **Static** (fixed) vs **Dynamic** (rules re-evaluated continuously). Sources: prospecting/enrichment, CSV, forms, website visitors, keyword/intent signals, CRM sync. Note: Suppressions as an audience type here conflicts with Managing Lists saying suppression is no longer a list type — CDP page likely older [Doc inconsistency].

**Auto-enrichment:** on audiences; new contacts (form, CRM sync, import) trigger background enrichment; **batched every 30 seconds, up to 500 records per job**.

**Activation:** Sequences (personalize/channel/timing), Dialer, Inbox, Signals (alerts, workflows), Studio (AI campaign generation), Analytics. **Real-time triggers** on contact create/update: start enrichment, add to sequences by criteria, update CRM, audit trail.

## A11. Tasks — docs.graph8.com/data/tasks/

**Where:** task icon in top nav → Tasks page. Scopes: **My tasks, Assigned by me** (verified assignments only), **All tasks**, **Agent tasks** (agent executor + accountable human). Views: **List** (group by executor, status, record, meeting) or **Board** (status columns). Agent tasks has an **Execution activity** view of agent runs.
- Filters: completion (default **Incomplete**), due date (Today, Overdue, Upcoming, No due date, Custom range), task type, priority, person, specific agent; chips; persisted across view switches/reloads. Sort: due date, priority, name, newest, recently updated.
- **Related records:** contacts, companies, deals, leads, **recruiting applications**, team members; multiple per task. Access to a task does not grant access to linked records ("Record unavailable"). **Source links** (meeting, transcript, conversation, page) are separate.
- **Properties:** Title, Assignee, Due date, Priority (none/low/medium/high), Related records, **Status (Open, In progress, Completed)**, Description. Subtasks can have their own related records.
- Creation: from a record (Add Task), from Tasks page (Add task / quick create), from AE Cockpit (approving overdue-task decision).
- **Agent execution:** choose eligible **Work agent** as Assigned executor, keep an Accountable human. Selecting an agent does NOT start work — click **Start**. States: Queued, Running, Waiting for information, Waiting for approval, Blocked, Failed, Cancelled. Execution details private to the starter. Don't duplicate tasks to retry; finish/cancel before reassigning.
- **Approval tasks:** must use Approve/Reject action — completing the task / moving card / bulk status does NOT approve.
- Bulk actions report per-item success/failure.
- MCP: **`g8_create_task`, `g8_update_task`** (with subtask args) — from changelog May 23-29. "Always-on task CRUD suite" in MCP 0.8.0.

## A12. Custom Fields — docs.graph8.com/data/custom-fields/

- Extra columns on contacts/companies; filter, sort, export, enrich like built-ins.
- **Scopes:** Global (all lists) vs List-specific (only that list).
- Create: open list → + in grid header (Add Column) → name → type **Text or Numeric** (only two types documented) → scope → Create.
- Exports use display name, not internal **`udo_*`** name.
- Can be **enrichment targets** (AI formula, waterfall). Tip: global "ICP Score".
- Delete: column header → Delete Column — destroys data on all records, irreversible.
- Changelog: MCP/API "custom-field value reads" and "batch field creation".

## A13. Custom Objects & Attributes — docs.graph8.com/data/custom-objects/

- Admin-only. Data → Custom objects → **Create object**: Singular label, Plural label, **API name** (read-only after creation).
- **Create attribute:** Field label, Attribute API name, Description, Field type (with type-specific config; types not enumerated [Doc gap]), Required, Unique values, Allow multiple values.
- Objects are Active or Archived (Archive/Restore). Set types/uniqueness before importing records.
- Related: API reference. The doc is thin — no info on relationships to contacts/companies, UI for records, or import path [Doc gap].

---

# PART B — DEALS / REVENUE MODULE

## B1. Deals Overview — docs.graph8.com/deals/overview/

- Pipeline command center: leads, prospects, customers, products, with AI coaching.
- **Default stages (this page):** Lead 10%, Qualified 20%, Meeting 40%, Proposal 60%, Negotiation 80%, Closed Won 100%, Closed Lost 0%.
  - **Conflicts with Pipeline Settings page:** Lead 10, Qualified 20, **Discovery 30**, Proposal **50**, Negotiation **70**, Won 100, Lost 0. [Doc inconsistency — verify in app]
- **Views:** Board (drag-drop), List (bulk actions), Forecast (by stage, rep, period).
- Flow: **Signals → Leads → Prospects → Customers** (qualify → work deal → upsell).
- AE Cockpit adds decision queue, meeting prep, at-risk alerts, coaching, autonomy lanes.
- **CRM two-way deal sync:** HubSpot, Salesforce, Pipedrive, Zoho (+ SugarCRM per changelog). Stage changes, contact associations, activity log sync both ways.

## B2. Leads (Revenue → Leads) — docs.graph8.com/deals/leads/

- Early-lifecycle records; full-width **AG Grid**, server-side pagination (millions of rows).
- **Lead statuses (6):** New, Open, In Progress, Contacted, Qualified, Unqualified — tracked in activity timeline.
- **Lifecycle stages:** Subscriber, Lead, MQL, SQL, Opportunity, Customer, Evangelist. Status (short-term work) and lifecycle (long-term journey) are independent axes.
- **Grid columns:** Name, Status, Pipeline, Pipeline Stage, Lifecycle Stage, **Score**, **Source**, **Qualified By** (last signal type that qualified), Type, **Converted**, **Converted Date**, Owner, CRM Source, Email.
- **Bulk actions:** Status, Lifecycle, Owner, **Generate Content** (AI, uses global context), **Batch Generate** (background job), Delete (irreversible).
- **`lead_source` values:** Form submissions, Intent signals, **Sequence replies** (positive replies), Manual, **Find People**, CRM sync, API/webhook.
- **Lead scoring:** automatic; factors: engagement signals, intent data, **profile fit (ICP)**, recency. Exact formula/weights not documented [Doc gap]. Config at **Settings → Lead Qualification**: toggle qualifying signal events (email replies, calls, LinkedIn responses, form fills, web visits, meetings), high-intent **URL page patterns**, thresholds, **backfill** re-evaluation.
- **Convert to Deal:** creates deal in Prospects linked to contact+company; `is_converted`=true, `converted_date` set; lifecycle → Opportunity. Converted leads stay visible (filter converted=true).
- Generate Content: single (email, LinkedIn message, call script) or bulk; **credits per lead**; results in Activity tab.
- CSV export respects filters.

## B3. Prospects (Deals → Prospects) — docs.graph8.com/deals/prospects/

- Companies with active deals.
- **Board card:** deal name + company, value, **days in current stage**, rep, signal indicators. **List:** name, company, stage, value, probability, close date, rep, last activity; bulk update stage/rep/tags; filter by stage, rep, value range, custom fields. **Forecast:** value × stage probability.
- **Deal detail tabs:** Overview, Contacts (buying committee roles), Activity (emails, calls, meetings, stage changes), Signals (aggregated from deal contacts), Notes (@mentions), Documents, **Intelligence** (AI: competitive analysis, ROI analysis, recommended next steps).
- **Deal signals:** signal score (combined), intent activity, email engagement, meeting activity (bookings, cancellations, no-shows).
- **Create Deal fields:** name, company, value, stage, close date, assigned to.
- Moving: drag, edit field, bulk, AE Cockpit AI suggestion. Stage changes logged with timestamp + user.
- Changelog: full audit trail of stage moves, owner changes, amount edits + configurable **Deal Intelligence custom fields** ("Sales Manager Cockpit", May 16-22); Priority column (Mar 2026); inline editable deal sidebar (Apr 2026); workflow nodes **Create Deal / Create Quote** (Jun 13-19); Copilot **AI Pipeline Builder** (stages, gates, SLAs from prompt, May 23-29).

## B4. Customers (Deals → Customers) — docs.graph8.com/deals/customers/

- Closed-won accounts. Filter by close date, deal value, rep, product. Record: company, primary contact, original deal value & close date, active subscriptions/products, last activity, upsell-intent indicators.
- **Post-close signals:** website visits (esp. pricing/new product pages), keyword research, engagement spikes, **usage changes** (source of usage data unclear [Doc gap]; changelog mentions Usage dashboards & usage-based health scores).
- Create upsell deal from customer record (links to account).
- Health buckets: active, at-risk, expansion candidates. Tip: 30+ days silent = churn risk. Health scoring mechanics not specified.

## B5. Deal Contacts & Notes — docs.graph8.com/deals/deal-contacts/

- Deal → Contacts tab → Add Contact → role → Save. **One role per contact per deal:** Champion, Decision Maker, Influencer, Blocker, Coach, End User. Healthy deal = Champion + Decision Maker.
- Role changes logged. Removing unlinks only.
- **Notes** tab with **@mentions** → notifications; edit/delete.
- Changelog: ABM "multi-committee library" (company can belong to multiple buying committees).

## B6. Products & Services — docs.graph8.com/deals/products/

- **Stripe**-backed catalog: Settings → Integrations → Stripe → Connect; products, prices, subscriptions auto-sync.
- Catalog columns: product name, pricing (monthly/annual/one-time tiers), active subscriptions, **MRR contribution**.
- Attach to deals: Products section → Add Product → quantity & custom pricing → **deal value auto-updates**.
- Subscription tracking: renewal dates, MRR per customer, plan changes. Revenue reporting: revenue by product, avg deal size, **win rates by product**.

## B7. Quotes (Revenue → Quotes) — docs.graph8.com/deals/quotes/

- **Statuses:** Draft, Sent, Viewed, Accepted, Declined, Expired (auto on `valid_until`). Automatic transitions.
- **Create fields:** Title, Company, Signer, Deal (optional), Owner, Currency (org default), Valid until; line items; terms; payment terms; notes. Save (draft) or Send.
- **Line items:** Product (Stripe or custom), Description, Quantity, Unit amount (cents internally), Discount %, Billing frequency (monthly/annual/one-time/custom), Line total = qty × unit_amount × (1 − discount_pct). Custom items don't sync to Stripe.
- **Billing starts:** At contract start, After N months, or specific date; must fall within contract; Stripe **730-day** scheduling window limit. Preview/PDF show payment schedule.
- Totals: Subtotal, Discount, Tax (org settings), Total.
- **Contract terms:** payment terms, contract months, start/end dates, accepted payment methods, **marketing rights**. Terms templates at Settings → Quotes → Terms. Terms content, privacy content, internal notes, public notes (rich text/HTML).
- **Quote templates** (Settings → Quotes → Templates) with attached docs (NDA, MSA, Other) included in the signature envelope.
- **Sending:** generates **public token + viewer token**, emails signer link. Signers need no account. Signer page: branding, line items, public terms, payment methods, signature pad.
- **E-signature audit:** signer name, IP, user agent, accepted_at; envelope record; third-party e-sign (DocuSign) envelope ID syncs back. Signed **PDF stored in S3** (`pdf_s3_key`).
- **Activity log:** created, sent, viewed (IP+UA), accepted, declined (optional reason), expired (system), duplicated.
- **Duplicate** a quote → draft copy.
- **Stripe:** line items from catalog; optional Stripe Quote object (`stripe_quote_id`); subscription items create Stripe subscriptions on signing. Setting "Auto-create Stripe Quote".
- **Settings:** default currency, default expiration (e.g. 30 days), default payment terms, default tax, auto Stripe quote, email branding.
- **Permissions:** Admin (all), Member (own quotes), Viewer (read-only).
- **Gotchas:** accepted quotes cannot be deleted; status only flips to Viewed on click; older browsers may fail signature pad.
- Changelog: very active area (Apr → Jun): deal-first creation, billing-contact CC, hand-drawn signature, manual Invoice actions, expiring-soon flags, shareable links, Documents tab bundling attachments into signed PDF; deal values roll up when a quote is accepted; MCP **12-tool quote-to-cash kit**.

## B8. AE Cockpit (Deals → AE Cockpit) — docs.graph8.com/deals/ae-cockpit/

**What:** Daily prioritized **decision queue** of AI-generated cards; per card **Approve / Edit / Skip / Defer**; approved actions execute automatically.

**Decision types (14):** Meeting Prep, Post-Meeting Follow-Up, At-Risk Deal (stalled, engagement drops, competitor mentions), New Lead, Re-engagement, Overdue Task, Deal Stage Suggestion, Competitive Alert, **Playbook Deviation** ("deal is not following the expected sales playbook" — how the playbook is defined is not documented [Doc gap]), **Coaching Insight** (based on "your patterns and performance"), No Reply (outbound email/SMS/LinkedIn thread, **default 7 days**), Intent Signal, Champion Change (owner reassignment), Enrichment Win (direct phone, exec email, headcount, funding landed).

**Signal sources:** **LeadSignals stream** (intent hits, page visits, no-reply), **LeadEvents stream** (meeting reviewed, owner changed, stage moved), **Polled scans every 30 sec** (meeting prep windows, stalled deals, overdue tasks, no-reply). Enrichment wins bridged via dedicated subscriber within seconds.
- Per-signal **org-level kill switch** (Settings → AE Cockpit → Signals); **daily cap default 50 cards per generator per org**.

**Priority score 0–100:** Time urgency (High), Deal value (Medium), Risk level (Medium; e.g. stalled 14+ days), Signal recency (Low), Engagement momentum (Low; e.g. 50% drop). Exact weights not given.

**Statuses:** Pending, Approved, Edited, Skipped, Deferred, **Auto-Executed**, **Undone**. **Undo window 30 minutes.**

**Autonomy lanes per decision type:** Autopilot / Approve / Off (Settings → AE Cockpit). After **8+ consecutive approvals without edits** graph8 suggests promoting to autopilot.

**Pulse sidebar:** active deals (count, value), meetings today, signals, pending decisions, completed today. Auto-refresh every 30 s.

Note: the decision-status data (approved/edited/skipped per type) is effectively a human-feedback dataset. Changelog calls a related surface **"My Desk"** (May 16-22: no-reply, intent spikes, champion changes, enrichment wins) — possibly same system with different name.

## B9. Pipeline Settings — docs.graph8.com/deals/pipeline-settings/

- Settings → Deals → Pipelines. Default 7 stages (Lead 10, Qualified 20, Discovery 30, Proposal 50, Negotiation 70, Won 100, Lost 0).
- Add stage (name, probability 0–100, color); edit; drag reorder; delete (must move deals first; permanent).
- **Multiple pipelines** (e.g. Enterprise, SMB, Partner); one default (⋮ → Set as Default). Pipeline dropdown on Deals → Board.
- Forecast: weighted = value × probability. Tip: set probabilities from historical conversion; review quarterly.
- Related: Roles control who edits.

---

# PART C — CHANGELOG (docs.graph8.com/changelog/)

**Important:** the latest changelog entry is **Jun 20–26, 2026**; today is 2026-09-26, so the public changelog is ~3 months stale (or stopped updating). The "most recent ~60 days" of documented changes = roughly **late April → Jun 26, 2026** (there is a gap: no entries between Apr 17 and May 16). Release cadence is weekly and very high-velocity — many "Major" launches per week, indicating fast-moving, likely fragile surfaces.

### Jun 20–26, 2026
- **Trial Command Center + Activity Replay** (Major): Stripe-anchored trial ranking (signup, expiry, ghost), KPI strips for Active/Expired/Ghost cohorts, session playback of trial visits.
- **Two-sided marketplace job board** (Major): roles with PDF JDs, talent applies, **recruiters export shortlists into Data Lists**.
- **Radar LinkedIn intelligence** (Major): competitor corpus feed, steal-format templates, audience heist matching, warm-account alerts, AEO sentinel; company pages get LinkedIn posts + Jobs feed.
- **Pipedrive CRM** full parity (push/pull contacts, companies, deals, leads; Tags-driven segments; custom fields both ways; persistent Pull tab).
- Personal booking pages; newsletter calendar invites (.ics); newsletter moved under Engage.
- Dialer: unified filter queue, notes in Call Outcome, international search, caller-ID daily limit with auto-rotate.
- Voice recordings on durable object storage.
- Contact avatars & company logos in grids.
- **Email Validation → email-verification waterfall column**.
- **Unified credit pricing** (Major): single credit pool, welcome grant, "data services on the house", Team plan, ~40 AI/LLM calls newly metered (enrichment, copilot, image gen, landing pages, campaign builder).
- **Workflow builder:** Create Dialer Session node, Latest AI Inbox Email node (array-aware contains), **Pull Workbench Rows** node; FieldPicker exposes workbench columns and nested-loop fields.
- Web chat reliability; **bulk Add to Suppressions from lists**.

### Jun 13–19, 2026
- **Radar competitive intelligence in Studio** (Major): track competitor pages, diffs, traffic/market intel, turn moments into content.
- **Performance Reports** anchored calendar (20 reports) + ~30 data-accuracy fixes (SDR heatmaps, sequence status, MRR, won/lost dating, meeting pipeline, cost per meeting, dispositions) — implies earlier report numbers were unreliable.
- **Master Lists** (Major): union-of-lists rollups, mirror sync, include-all mode.
- AI Inbox always-on; per-thread auto-respond pause.
- Grounded newsletter AI (positioning, voice, active campaign; email-safe quality gate).
- **Workflow nodes: Create Deal, Create Quote, Lookup Sequences (remove-from-all-sequences), contact-in-list check** (by work email or contact id).
- Appointments calendar overlay; marketplace contracts; web chat themes.
- **Agency-scoped Developer API keys** with `X-Target-Org-Id` header; **MCP tool calls and API requests stream into analytics warehouse**; MCP trims connect-time context.
- Dialer custom dispositions (Major).
- **Enrichment scale & resilience** (Major): global rate limiter, byte-aware chunking, **audience-membership dedup**, credential-aware waterfall defaults, live event stream.
- **Permissions enforced platform-wide** (Major) incl. Contacts, Companies, Deals, Lists, Sequences, Nurtures, dialer, copilot, **MCP**, agency Manage Orgs; copilot master kill switch.
- **Entity search 400x faster** (~3 ms), relevance/provenance/exact-match indicators.
- CRM sync: contact pulls create linked Company; Salesforce CampaignMember batching; bypass 2000-record offset cap.

### Jun 6–12, 2026
- **Operator agents** (Major): autonomous RevOps agents; 13 live checks (CRM hygiene, deliverability, pipeline quality, inbox assignment, admin sprawl, token expiry), per-org schedule, autonomy ceiling, approval bridge.
- SDR command center in universal inbox (Hot/Awaiting/New lanes, Board funnel, AI Reply, round-robin).
- **Auto-compose workspaces** (Major): AI clusters prospects, picks agent per segment, creates workspaces with channels and sequences attached.
- Studio content calendar + LinkedIn organic publishing (with signal mining/ideation).
- Ads campaign sets and living creative.
- Newsletter Templates Hub.
- **Sales report Wave 2:** per-motion objection picker, **Grading Rubrics tab (3 default rubrics)**, per-stage SLA editor, **multi-path attribution incl. direct deal id**, data-quality diagnostic banner, per-rep Bookings.
- Marketplace contracts/video intros/mobile.
- Sequencer per-step on-demand model, **auto-pause on credit/AI billing failure**, opt-in global suppression on hard bounce, cold-email unsubscribe header.
- AI receptionist auto-provisioned on signup; Intake agent role.
- **Developer API & MCP:** appointments lifecycle, **custom-field value reads**, sequences-nurture exposure, send-meeting-invite node; single appointments naming convention.
- RBAC overhaul; dialer SDR controls; lazy-loading perf; **hiring intent signals search ~330x faster** with Job Details drawer.

### May 30 – Jun 5, 2026
- Instant signup with warm-pool provisioning; day-one onboarding rebuild (LLM narrows ICP filters, person/company snapshots).
- Ads creative studio in Studio Content.
- Newsletter durable send pipeline.
- Workspaces overhaul across inbox channels.
- **Central suppression engine** (single source of truth; execution-time enforcement).
- Sequencer one-click unsubscribe, per-step models, swap attached list on draft sequence.
- **Sales Coach per-motion objections** (27 seeded codes, Objections cohort filter, ICP-docs completeness widget, Excel export).
- **Developer API & MCP parity:** full-text search and **analytics data-access tools**, multi-org switching, **batch field creation**, family-aware tool discovery, acting-org stamping on credit ops; Deals (with contact & owner associations) and Quotes at full parity.
- Multi-bot webchat; bridge approvals (YES/NO via WhatsApp/iMessage/Slack/Roam).
- graph8.com marketing pages incl. /vs/apollo, /platform/data-pipelines.
- Quote-to-cash polish (Major); **Lifecycle Revenue grids** server-paged, credit-gated PII unlock, one-shot multi-record entity merge, 402 when no subscription.
- Voice/dialer refinements.

### May 23–29, 2026
- First-launch onboarding (company snapshot, brand voice, hot contacts, competitors, draft sequence, pixel install).
- **MCP & SDK developer platform** (Major): MCP reaches full parity with in-app surface; 12-tool quote-to-cash kit; **campaign builder suite**; always-on tasks; plan-aware rate limiter; 13 new dev doc pages (pricing, pipelines, public endpoints).
- 22 role pages/field guides; **Commission engine**; **AI Pipeline Builder via Copilot**; iMessage bridge; **Unified Hiring and Social signals** (Talent Moves on competitors, source-list registry); dual-provider warmup.
- **Sales Reports v2 completion:** agency scoping, daily aggregator, objection catalog, grading, **stuck-deal SLA radar**, cohort drill-down, channel/Tier filters, **ICP section reading enrichment data**, "honest empty-state disclosures on data-gapped sections".
- Tasks quick filters & subtasks; **MCP `g8_create_task` / `g8_update_task`** subtask args.
- Quote send-and-sign polish.

### May 16–22, 2026
- Sales Manager Cockpit (deal audit trail, bulk actions, Deal Intelligence custom fields).
- Universal Activity in inbox with AI thread summaries.
- Quote send-and-sign redesign; **Sales Reports v2** (cohort analytics, daily aggregator of lead/meeting/revenue events to rep-level reports); SDR leaderboards.
- Studio Canvas onboarding wow moments (competitors, intent, ICP fit).
- Newsletter double opt-in; **Entity merge manual & bulk** (with kill-switchable automation pipeline).
- **My Desk** signal generators (no-reply, intent spikes, champion changes, enrichment wins).
- Sequence & Nurture workflow nodes (add/remove).
- **MCP toolkit 0.8.0:** quote-to-cash (12 tools), campaign builder tools (context, editor, warmup, intel, research), task CRUD, meetings widget.
- Meta audience sync wizard; **hiring-signal saved campaigns with scheduled sync**; lifecycle grids server-paged, 10k-row cap dropped.

### Older highlights (context)
- Apr 11–17: Revenue lifecycle lists; subscription/behavior analytics; ABM platform; **scheduled workflow triggers**, Create Contact node; **streaming CSV import (100k rows)**; **enrichment from graph8 data index first (zero extra credits)**; intent search overhaul; copilot chat history.
- Apr 5–11: SDR Marketplace; Ads platform; Quote-to-Cash; Appointments; LLM+MAID keyword resolver; workflow JSON export/import; **Enrich contact / Verify email workflow nodes**; Workbench AG Grid; SugarCRM enhancements.
- Mar 29–Apr 4: **@graph8/sdk (14 modules), CLI, docs, MCP server for Claude Desktop/Cursor**; unified copilot incl. staging/workbench tools; **Web research v3**; data trial (10K credits) & PAYG; multi-path workflow node; Document/Contact Activity/**Workbench Lookup** nodes; campaign-workflow association; **workbench: Find People, copilot staging, LinkedIn lookup, PDF ingest, scraper-bot enrichment**.
- Mar 22–28: SugarCRM; copilot web search; 8 workflow triggers (LinkedIn accepted/message, email replied/bounced, call completed/no-answer, sequence started/completed); **scraper bot for staging workbench**; enrichment_data column.
- Mar 15–21: global copilot; **lead qualification engine**; staging export mapping wizard (unmapped → custom fields).
- Mar 1–7: redesigned detail views; Add Record; **webhook action node**; Developer/MCP docs.
- Feb 2026: Sequencer + Campaign Builder link (sequence inherits campaign personas/ICP/context); CRM leads/deals sync; **workflow triggers: contact enters list, deal stage changes, calendar event**; **performance analysis view per sequence/campaign/rep**; **Find People enrichment**; list Performance tab; SDR email attribution; webhook dry run.

---

# PART D — API / MCP / SDK / Webhook mentions (consolidated)

- MCP tool names explicitly named in these docs: **`g8_create_task`, `g8_update_task`** only. A full catalog exists at the "All MCP tools and input schemas" doc page (not in this file set).
- MCP families mentioned: quote-to-cash (12 tools), campaign builder suite (context, editor, warmup, intel, research), task CRUD, meetings/appointments, full-text search, **analytics data-access tools**, multi-org switching, batch field creation, custom-field value reads, sequences-nurture, Deals (with contact/owner associations), Quotes, Marketplace; "family-aware tool discovery search"; plan-aware rate limiter; MCP gated by role permissions.
- SDK: **`@graph8/sdk`** (14 modules) + CLI; Developer API; agency keys with **`X-Target-Org-Id`** header.
- Webhooks/ingest: workbench table **webhook endpoint** (raw JSON column + column discovery); workbench **email PDF ingest**; workflow **webhook action node** (outbound HTTP); lead_source "API / webhook"; sequence builder webhook step with dry run.
- Internal field names surfaced: `udo_*` (custom fields), `lead_source`, `is_converted`, `converted_date`, `valid_until`, `pdf_s3_key`, `stripe_quote_id`, `enrichment_data`, `unit_amount`, `discount_pct`.
- Workflow nodes relevant to data: Create Contact, Enrich contact, Verify email, Workbench Lookup, Pull Workbench Rows, contact-in-list, Create Deal, Create Quote, add/remove from sequence/nurture, Lookup Sequences, Contact Activity Lookup, Document Lookup, Send Email, Webhook, Agent node, multi-path branching, loops; triggers incl. contact enters list, deal stage changes, scheduled, inbox tag applied, engagement events.

---

# PART E — HACKATHON RELEVANCE

## Project 1: Source Scout (discover/evaluate external B2B data sources, score vs graph8 data, acquire into lists)

**Existing capabilities you can build ON (don't rebuild):**
- **Ingestion:** Staging Workbench already accepts CSV, paste, CRM, search import, **webhook JSON with auto column discovery**, PDF via email, and a **scraper bot** agent that extracts structured data from web pages. A scraped exhibitor list / directory / portfolio page could be pushed into a workbench table via webhook or the scraper bot.
- **Automation:** Workbench **Pipelines** triggered by Scraper Bot / Webhook / Import events → AI Group (extraction/classification) → Waterfall → Formula (G8X scoring) → Branch → **Export to List**. This is essentially an acquisition pipeline already.
- **Enrichment & people-finding:** waterfall (15+ providers), AI web research (7 credits/record, with citations), **Find People** (contacts at companies, by title/seniority/department; also inside workbench), email-verification waterfall; imports enrich from the **graph8 data index first at zero extra credit**.
- **Dedupe:** email-based dedupe on import/contact creation; audience-membership dedup in bulk enrichment; manual/bulk **entity merge**; contacts auto-link to companies by domain; CRM pulls create linked companies.
- **ICP fit scoring primitives:** CDP `company fit score`, contact confidence score (0–100) and email confidence; formula templates (Lead Score, Company Size Category, Industry Tech Score, Growth Stage); AI-generated formulas; Lead scoring "profile fit" factor; global custom field "ICP Score" idea is literally suggested in the docs.
- **Net-new comparison hooks:** Prospecting "Lists" filter (include/exclude existing lists); Data → Search over 200M contacts (fast index search with exact-match indicator & provenance) — usable to check "is this company already in graph8's DB?"; record `Source` tags (graph8 vs Custom vs CRM) tell provenance.
- **List management:** Master Lists (union rollups), dynamic lists, list routing (AI-suggested rules), per-company caps, suppressions to exclude customers/competitors.
- **Programmatic access:** MCP (full parity claimed), SDK, full-text search and analytics data-access tools, batch field creation, workflow nodes Pull Workbench Rows / Workbench Lookup / Create Contact / Enrich contact.

**Gaps = where Source Scout adds genuine value (no documented equivalent):**
- **Source discovery** itself (finding directories, exhibitor lists, portfolio pages worth mining) — nothing in docs.
- **Source-level evaluation/scoring**: coverage %, match rate vs graph8 DB, net-new %, ICP-fit distribution, freshness, cost-per-net-new-contact. graph8 scores *records*, not *sources*. (Changelog "source-list registry" under Hiring/Social signals is the closest concept — verify.)
- **Pre-acquisition sampling / dry-run** of a source (score a sample before paying credits). Credits estimate exists per enrichment run, but not per source.
- Scraper bot config, pagination, rate limits, and credit cost are **undocumented** — risky to depend on without testing; may need your own scraper feeding the workbench **webhook**.
- Pipelines: only **one branch**, no dedupe step, no Find People step, no scheduled start — Source Scout can orchestrate outside and use pipeline for per-row processing.
- Company-level dedupe against graph8 (by domain) isn't explicitly documented as a user-facing match API — test entity search/MCP.
- Credit model changed Jun 2026 (unified pool); per-record costs in docs may be stale.

**Suggested architecture sketch:** discover source → scrape to JSON → POST to workbench webhook (or MCP) → pipeline: AI Group normalize (company name, domain, category) → Formula ICP score → Branch (fit) → Export to List → Find People + waterfall on exported companies → Source scorecard computed from counts (rows, matched to graph8 index, net-new vs existing lists, ICP-pass rate, emails found).

## Project 2: Flywheel (analyze completed campaign outcomes → improved campaign playbook V2)

**Existing outcome data/analytics to consume:**
- CDP captures sequence events (opens, clicks, replies, bounces, call outcomes), website events with UTM, form fills, identity resolution.
- **List Performance tab** (engagement, delivery, activity trends; CSV incl. call metrics); **performance analysis view** per sequence/campaign/rep; **Performance Reports** (20 reports; ~30 accuracy fixes in Jun — earlier data may be unreliable); **Sales Reports v2** (cohort analytics, objection catalog, **grading rubrics**, stuck-deal SLA radar, **multi-path attribution incl. deal id**, ICP section from enrichment data, data-quality banner); **Sales Coach** per-motion objections (27 codes).
- Deals outcome data: stage history audit trail, won/lost, days-in-stage, deal signals, buying-committee roles, products/win rates by product, quotes accepted/declined (with decline reasons).
- Leads: `lead_source` = "Sequence replies", Qualified By, converted/converted_date — conversion funnel from campaign to pipeline.
- **AE Cockpit decision statuses** (approved/edited/skipped per type) = human-feedback signal; "Playbook Deviation" and "Coaching Insight" cards imply graph8 has *some* notion of an expected playbook (undefined in docs).
- Campaign ↔ Sequencer ↔ Workflow links: sequences inherit campaign personas/ICP/content (Feb); campaign-workflow association; dialer sessions linked to campaigns; SDR email attribution.
- Programmatic: MCP **analytics data-access tools**, campaign builder MCP suite (context, editor, warmup, intel, research) — could *write* the V2 campaign back into Studio; MCP/API calls stream into analytics warehouse.

**Overlaps to be careful about:**
- Sales Reports v2 / Sales Coach / Performance Reports already do outcome reporting and grading; **AE Cockpit Coaching Insight & Playbook Deviation** partly overlap with "learn what works." **Auto-compose workspaces** and Studio campaign builder already generate campaigns from ICP/personas.
- **What is NOT documented (Flywheel's differentiator):** a closed loop that takes *completed campaign outcomes* (by persona, segment, step, channel, copy variant, source list) and emits a *revised campaign playbook* (ICP refinements, list/source changes, sequence step/timing/channel changes, messaging and objection handling) and pushes it back into Studio/Sequencer as "V2". No A/B-test or step-level attribution learning loop is described in these pages.
- Data caveats: report accuracy was fixed as recently as Jun 13–19; "honest empty-state disclosures on data-gapped sections" means some segments will be sparse. Changelog is stale since Jun 26, so newer features may exist.

**Cross-project synergy:** Flywheel's outcome analysis (which sources/lists/segments converted) can feed Source Scout's source scoring ("which data sources produced replies/meetings/won deals") — list `Source` field, `lead_source`, list Performance tab and attribution make source-level ROI measurable, which neither graph8 doc set describes today.
