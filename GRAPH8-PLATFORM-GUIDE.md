# graph8 platform guide

Written 26 Sep 2026 from:
- **all 307 English pages** of docs.graph8.com (the in-app Help Center at `app.graph8.com/help` embeds this same site in an iframe)
- the public OpenAPI spec (2,701 paths)
- a logged-in walkthrough of the app (org "Hackathon Saad Saleem")

The detailed per-module notes are in [`research/graph8-notes/`](research/graph8-notes/), about 82k words plus every API endpoint grouped by tag. This file is the synthesis.

> Reliability warning: the docs contradict each other often. Menu paths, credit prices, tool counts, webhook header names and the error envelope all vary between pages. The public changelog stops at **26 Jun 2026**. Treat anything marked ⚠️ as something to check live.

---

## 1. Mental model

graph8 is an **"autonomous revenue system"**: one **buyer graph** that CRM, data, signals, content, outreach, agents, pipeline and billing all read from and write to. It came out of CIENCE, an outbound agency (10 years of campaigns), and it shows. Much of it is built for **agencies running campaigns for many client orgs** (Growth Manager role, agency API keys, `X-Target-Org-Id`).

The core loop the product is designed around:

```
Company website ─► Studio "brand DNA" (≈44 AI docs: profile, ICPs, personas, messaging, research)
                      │ grounds every AI output
Data (700M/100M index + your CRM) ─► Lists ─► Studio Campaign (≈17–20 docs) ─► Engage Sequence
      ▲                                                                           │
Signals (visitors, intent, hiring, social, forms) ──────────────────────────────┤
                                                                                   ▼
                                    Inbox replies / Dialer / Meetings ─► Deals ─► Quotes ─► Stripe
                                                                                   │
                                           Analytics / Reports / My Desk (AI decision cards)
                                                                                   │
                                          (optimisation = MANUAL today; "flywheel" is unshipped)
```

**Top nav:** Data · Signals · Studio · Revenue (called "Deals" in some docs) · Engage · Agents · Work. Plus Copilot (sparkle icon or Cmd+Shift+K), CRM search (Cmd+K), and the Settings tree at `/studio/settings?tab=…`.

---

## 2. Modules

### 2.1 Data
| Surface | What it does | Key facts |
|---|---|---|
| **Search** (`/search`) | Prospect across the open index: 700M contacts and 100M companies (some pages say 200M+) | Filters: persona, company, location, intent topics, intent keyword, include/exclude your lists. Up to 50k results per search. Saved filters are re-run manually. "Limit employees per company" picks the most senior first. |
| **Contacts / Companies** | Your CRM records | Email is the contact dedup key. Companies are keyed by domain. Detail pages have an AI Intelligence panel (7 contact docs, 10+ company docs), a ⚡ Run Action button, Signals, and Next Steps. |
| **Lists** | The core container. Every saved search, import and audience is a list. | Types: contacts, companies, deals, leads (suppression is no longer a list type). Also dynamic lists, **Master Lists** (unions of lists), and lifecycle lists. Bulk actions: merge, clone, verify emails, unlock, suppress. |
| **Workbench** (`/enrichment/staging`) | Isolated staging tables for messy data before it becomes a list | Import from CSV, paste, CRM, search, **webhook JSON** (automatic column discovery), email-PDF, or a **scraper bot**. Add waterfall / AI / formula columns, **Find People**, then Map & Export to a list or send to a sequence. Has an auto-enrich toggle with a daily credit cap. |
| **Workbench Pipelines** | Event-triggered chains per table | Starts on: Email PDF / Webhook / **Scraper Bot** / Import. Steps: AI Group → Waterfall → Formula (G8X) → **one** Branch → Export to List. No dedupe step, no Find People step, no schedule. |
| **Enrichment** | Waterfall across 15+ providers (Apollo, Hunter, Prospeo, Dropcontact, Lusha, Icypeas, RocketReach, LeadMagic, Clearbit, BuiltWith, ZeroBounce…) | You pay only for the provider that hits. The graph8 index is tried first at no extra cost. AI web research costs ~7 credits per row; AI formula columns 1 credit per row, each with a 0–100 confidence score. JS formula columns are free. Find People is ~1 credit per contact. |
| **Suppressions / Compliance** | One central suppression engine across sequencer, newsletter and audiences | Scope: all channels, email, phone or LinkedIn. DNC works per contact and **per domain**. Hard-bounce suppression is opt-in. Every change is written to an audit log. |
| **CDP / Data Pipelines** | `track`/`identify`/`group` events → Streams → JS Functions → Destinations (warehouses, GA4, webhooks…) | Identity resolution in 4 layers: hashed-email network, B2B/B2C graph, IP→company, anonymous ID stitching. |
| Custom fields / objects | Text and numeric fields, global or scoped to one list. Custom objects are admin-only. | Internal field names look like `udo_*`. |

### 2.2 Signals
- **Visitors**: IP→company resolution and known-contact attribution, with People / Companies / **Campaigns** views. The Campaigns view shows visit→form conversion per campaign.
- **Intent**: two kinds. First-party (your site) and **web intent**: graph8 indexes "millions of enriched web pages", then watches which of your contacts and companies visit the pages matching your keywords. Also 1,000+ topics and an Intent Search.
- **Hiring**: *Hiring Wave* is a saved job search re-run daily, split into jobs, companies, decision-makers and recruiters. *Talent Moves* detects job changes every hour, including joins and leaves at a competitor. Both can be auto-seeded from Studio docs and can **auto-enroll matches into a campaign audience**.
- **Social Listener (X)**: brand, keyword, competitor, engagement and user listeners. Matched authors are stub-created as contacts in a "Social Signals" list. Costs 7 credits per post read in shared mode.
- **Forms**: captures any HTML form, maps fields, and routes submitters to a target list in real time.
- **Signal score 0–100**: form 25, email reply 20, keyword 15, topic 10, page visit 5, plus a recency bonus. Signals older than 30 days are dropped.
- **Buying Committees**: Economic buyer, Champion, User, Technical (E/C/U/T) rollups. Requires allowlist access.
- **Radar** (competitive): up to 20 competitors, Firecrawl page discovery, ads, traffic, LinkedIn, **gaps → opportunities → initiatives**, and `measure_initiatives` as a *performance loopback*. This is the only real feedback loop in the product, and it covers content work, not outbound.
- SEO / AI visibility, Trends.

### 2.3 Studio (AI content and strategy)
- **Global Context ("brand DNA")**: you enter a domain and get ~44 docs. That is 21 context docs across Brand, Market, Audience, Offer and Messaging (e.g. Messaging House, Proof Catalog, Pains & Gains, Buying Journey), 13–16 intelligence docs (website scrape, competitors, keywords, reviews…), 6 research reports (Buyer Psychology, Competitive Teardown, Voice of Customer, GTM Channel, Industry Analyst, Review Sentiment) and 1 Campaign Intelligence Brief. Every doc is versioned. **Almost every AI feature injects these docs.**
- **ICPs** carry firmographics, tech stack, buying signals, tiers and a market-size estimate, scored Fit 0–40 + Opportunity 0–30 + Readiness 0–30. **Personas** carry title, priority, why-target, key signals, receptivity and confidence. ⚠️ Your org has **zero ICPs** until you generate them from your domain.
- **Campaigns**: Generate Ideas gives ranked concepts across 40+ campaign types. Converting one to a campaign generates **~17–20 documents**:
  - Campaign Brief, Targeting & Routing, **Messaging & Objections**
  - Email / LinkedIn / Social / Phone / Voicemail / Voice-AI copy
  - QA Rubric, Snippets, **Reply Templates**, Cadence Calendar, **Performance Tracker**
  - Battlecard, Meeting Prep, Handoff

  Each campaign also has a step editor that stays in sync with the copy docs, a **Readiness Score 0–100** (a *pre-launch* quality grade; 75+ is "ready") and **Push to Sequencer**, which keeps the campaign↔sequence link.
- **Copilot**: 18 specialist skills routed by whichever doc is open, 4 memory scopes, approval dialogs before destructive or publishing actions, and slash commands.
- **Skills**: templated prompt "GPTs" with `{{contact.*}}` / `{{global.*}}` variables, versioned. Includes A/B testing of a skill on 10 records.
- Also: Content (SEO inventory and refresh grids), Landing Pages (clone any URL; published to Cloudflare Pages), Ads (Meta, LinkedIn, Google, X creative; paid launch on Google and LinkedIn), Team / AI Twins, Custom Records, Knowledge (proposal-then-review), NPS/CSAT surveys, and Security Questionnaires (an answer library that learns from approvals).

### 2.4 Engage
- **Sequencer**
  - Step types: email, LinkedIn (via HeyReach), voice-AI call, manual dialer, SMS and WhatsApp.
  - Content per step can be on-demand, an AI template, or a manual template.
  - 7 condition types. When a condition fails the step can skip, exit or wait-and-retry.
  - **Branches** with a "winning branch" side-by-side view. This is the *only* A/B mechanism. There's no random split and no automatic winner.
  - Cross-channel fallback when a channel fails.
  - **Capacity:** 15 cold emails per warmed mailbox per day. The warm-up ramp by week is 0, 0, 5, 10, then 15, so **a new mailbox sends nothing cold for 2 weeks**. Sends rotate across mailboxes.
  - LinkedIn limit: 25 actions per day (the HeyReach page says 50/50/300/100).
  - Analytics: sent / delivered / replied / bounced per step, a funnel, and 24h / 48h / 7d response rates. **Opens are not tracked (no pixel)**, even though some payloads include an "opened" field.
- **AI Inbox**: always on, across email, LinkedIn, SMS, chat, calls and meetings.
  - Replies are classified **only through tags you define** that are marked "AI-applicable" (applied at confidence above 0.7). SDR analytics also does positive/negative, and the webhook carries `is_positive`.
  - Auto-respond is a per-mailbox setting. Each message records whether the responder was a user, the contact, or the AI.
  - AI composition costs 1 credit per transformation.
- **Dialer**: power dialing, or parallel on up to 4 lines. It needs a Twin agent. Dispositions include has-solution, not-ICP, callback and gatekeeper, with sub-sentiments. Every call is recorded, transcribed and AI-graded.
- **Nurture**: for consented audiences. One pinned mailbox sending up to 500 per day, with no warm-up ramp.
- Also Newsletter (SES), Web Chat (AI agents), Appointments (Cal.com-style: routing forms, round-robin, CRM sync), Meetings (transcripts, key topics, **campaign mentions**, action items), LinkedIn Publishing, and HeyReach campaign views.
- **Work**: agent and team conversations. **Routines** run an agent on a schedule and post the result into a conversation. Agents can ask for approval.

### 2.5 Revenue / Deals
Leads, Prospects, Customers (with a Stripe MRR overlay), Trials (activation pulse and conversion blockers), Churned, Products, **Quotes** (quote → e-sign → Stripe subscription), and pipelines (customisable stages, forecast).

**AE Cockpit / My Desk** turns 14 signal generators into AI decision cards:
- The generators include meeting prep, at-risk deal, no-reply, intent spike, champion change, enrichment win, **Playbook Deviation** and **Coaching Insight**.
- Each card type can be set to one of three autonomy lanes: **Autopilot** (30-minute undo), **Approve** (one-click) or Off.
- Graph8 suggests Autopilot after 8 approvals with no edits, and dismissals feed back into how often cards are generated.

Sales Reports v2 adds an objection catalog, grading rubrics and multi-path attribution. Sales Coach handles per-deal objections, and its manager view shows the top objection types.

### 2.6 Agents and AI
- **Agents and Twins** (a Twin is cloned from a LinkedIn profile, including voice). Each has persona sliders, knowledge collections (up to 4) and skills. Skill types are LLM, API, Script (up to 300 s) or Workflow, and a skill can require approval.
- **Operators**: autonomous RevOps agents (RevOps/CRM Admin, Lead Ops, Deal Desk, Deliverability, Chief of Staff). They find problems, raise findings and propose fixes, with a trust dial per skill (Off / Detect / Propose) and a scorecard. In this org they are **all off** and their skills cover data hygiene only.
- **Workflows**: triggers include visitor, form, intent, webhook, schedule, contact enters list, deal stage, and email replied/bounced. Nodes include action, agent, **MCP Tool**, condition, loop, **Human Approval**, add to list, add to sequence, create deal, workbench lookup, and others. ⚠️ The GTM-engineer guide says there's no UI route for it on the showcase tenant, so it may be API-only there.
- **Agents → MCP Servers**: you can register an external MCP server (SSE or stdio). Its tools then become workflow Tool nodes and tools the agents can use. **This is the cleanest way to plug a hackathon project *into* graph8.**
- Voice agents run on Twilio or Telnyx with Cartesia voices, and support post-call webhooks. Lead Scoring uses one global model.

### 2.7 Analytics
Website analytics: overview, acquisition (with an **AI/LLM channel**), behaviour, conversions and realtime.

**Marketing Intelligence** has the Outbound Bridge funnel (visitors → identified → added to outbound → replied → meetings) and campaign attribution by UTM. `/reports` holds about 20 performance reports, deep-linkable as `?report=aN`.

⚠️ `/analytics/attribution` is empty on the showcase tenant. Report accuracy fixes landed as late as June.

### 2.8 Desktop app
A local Electron-style app that stores its data in SQLite and markdown on disk:
- a LinkedIn/X browser automation layer using your real session
- a local Workbench that syncs to cloud lists
- **Radar**, which OCRs your screen every 30 s and extracts signals
- **Brain**, an auto-built knowledge graph
- Copilot with 40+ local tools
- **Autopilot**, a "suggest → accept/dismiss" pattern detector
- a stdio MCP server with 11 browser tools

### 2.9 Marketplace
A two-sided marketplace for hiring SDRs, AEs and GTM engineers. Talent are AI-scored, certify over 30 days, and are paid a base plus a per-meeting rate through Stripe Connect. Clients grant hired talent access to their lists.

---

## 3. Developer platform (what we will actually build on)

| Item | Value |
|---|---|
| REST base | `https://be.graph8.com/api/v1` with `Authorization: Bearer <key>`. The org comes from the key. Swagger is at `/api/v1/docs`. |
| Keys | **Personal** (Profile → Developer) or **Org** (Settings → API, admin only). Keys start with `g8_live_…` or `g8_test_…`, and can have scopes (`contacts:read`, `campaigns:launch`…; mostly log-only for now). Agency keys use the `X-Target-Org-Id` header. |
| Other surfaces | SDK `@graph8/sdk` (server `apiKey`, browser `writeKey`, React hooks; generic `request()` / `paginate()` helpers). CLI `g8` (`pip install g8-mcp-server`). MCP at `https://be.graph8.com/mcp/` (OAuth), or stdio via `uvx g8-mcp-server` with `G8_API_KEY` and `G8_MCP_MODE=dev|gtm|all`. |
| Rate limit | 50 requests/s + 1,000 requests/min per org, shared across REST, SDK and MCP. A 429 comes with `Retry-After`. We have seen 429s in the UI. |
| Pagination | `page` / `limit` (≤200) or `cursor`. Search is capped at 100 per page and 10k results deep. |
| Idempotency | The `Idempotency-Key` header works only on `POST /contacts` for now. `PUT …/assert` upserts are the other safe-retry tool. |
| Errors | Three different envelope shapes (`detail` / `error{}` / `type,code`), so handle all three. 402 means out of credits. |
| Webhooks | `X-Studio-Signature` is an HMAC over `"{timestamp}.{raw_body}"`. Maximum 10 per org. 40+ events, e.g. `engagement.email_replied` (with `is_positive`), `meeting.booked` (with `sequence_id`/`campaign_id`), `sequence.*`, `campaign.*`, `deal.*`. `GET /events` is a polling alternative. ⚠️ The FAQ and SDK describe an older `X-G8-Signature` scheme. |
| Sandbox | Test keys plus `/sandbox/status`, `/outbox` (simulated sends), failure injection (bounce, timeout…), and fixture seed / reset / snapshot / restore. ⚠️ The api-keys page says to **"treat a test key as operating against real data"** until the dedicated sandbox ships. **Inbound replies, meetings and clicks cannot be simulated.** |
| MCP | 586–599 tools across 11 families, but only about 31–126 are visible when you connect. `g8_tool_search` loads more, and `g8_execute` runs any tool by name. Anything that spends credits or sends has a `dry_run` or `confirm=true` gate. Built-in prompts include `campaign_review(campaign_id)` and `icp_refinement(feedback)`. Also: playbooks (`g8_load_playbook`), Skill Library (`g8_library_*`), and human-approval tools (`g8_agent_*`). |

**Gotchas that will bite in the first hour:**
1. `POST /contacts` requires a `list_id` and **returns no id**. Assert upserts return counts only. Search results carry **no graph8 ids**. To get ids, save or assert, then re-read.
2. `/search/*/save` runs asynchronously (202) and **always creates a new list**.
3. `PATCH …/steps/{id}` **replaces `step_data` wholesale**.
4. REST skills interpolate `{var}` (single braces). Studio and SDK examples show `{{var}}`.
5. Workflow graphs have different shapes in REST (`node_id`/`edges`) and the SDK (`id`/`connections`). Call `/workflows/validate` first.
6. Launching a campaign through the API is **email-only**. It needs an audience, completed copy, at least one step and an active mailbox. A 502 response can mean an uncertain state, so don't retry blindly.
7. The docs never mention a `g8.api` client despite the hackathon brief. Use `request()` or plain fetch for anything the SDK doesn't wrap.

---

## 4. Credits cheat-sheet (⚠️ the unified credit pool changed pricing in June; confirm with `GET /usage/transactions`)

| Free (on paid plans, within the rate cap) | Charges credits |
|---|---|
| CRM CRUD, lists, fields, tasks, notes | Waterfall enrichment: 0.5–20 credits per provider hit (typically 1–3) |
| Index search and save, `lookup/person` and `lookup/company` ⚠️ (other pages say 1–2 credits; the **free trial is metered at 1 credit per record**) | AI/LLM: roughly 1 credit per 1k tokens (copilot, drafts, LLM skills, generation) |
| Intent reads, visitor reads, OpenSearch `resolve` | AI web research: ~7 per row; AI formula: 1 per row; Find People: ~1 per contact |
| Studio reads (ICPs, personas, docs), webhooks, meeting and transcript reads | Sends: 1 per step. Voice: 20 per minute. Booking: 20. Placement test: 20. Visitor resolution: 20 |
| Workflow and skill CRUD (running them may cost) | Radar scans, research reports, dashboard generation (a GET can spend credits on a cache miss) |

This org shows **2,196 credits**. The Team plan is $99 per month for 10k credits. PAYG is $0.05 per credit.

---

## 5. Known bugs, empty states and contradictions (as observed on the docs showcase tenant and in our org)
- Work inbox: "could not be loaded". Workbench: intermittent 429 ("Network Error") that works on retry.
- `/analytics/attribution` is empty. The dialer analytics endpoint returns **422** to Copilot. The Outbound Bridge funnel shows **0 added, 0 replied**.
- Many `?tab=` deep links silently fail. Known 404s: `/campaigns`, `/copilot`, `/leaderboard`, `/deals/forecast`, `/fields`, `/duplicates`, `/merge`, `/landing-pages`.
- Numbers that conflict between pages:
  - MCP tool counts: 586 / 599 / 114 / 35
  - Default pipeline probabilities
  - LinkedIn daily caps
  - Whether search and lookup are free
  - Webhook scheme
  - Campaign document count: 17 / 18 / 20
- Menu paths drift: Deals vs Revenue, Sequencer vs Sequences, Settings → Integrations vs Connections.
- Roadmap items **not yet built**, per graph8's own AE guide: *"Multi-pipeline, stage-checklist v2 programmatic gates, QuickBooks / Xero / Chargebee billing, and the **playbook editor / flywheel** are all in-progress or PRD-only. Don't pitch them yet."*

---

## 6. What graph8 does not do (openings for Level 2)
| Gap | Evidence |
|---|---|
| **Discovering and scoring whole data sources** (directories, exhibitor lists, portfolios): coverage, net-new share, ICP density, value before you spend credits | Every training track assumes the data already exists as a CSV, CRM or search. graph8 scores *records*, not *sources*. The scraper bot and `/scrape/*` acquire data but don't evaluate it. |
| **Campaign-level learning loop**: outcomes → patterns → an explained V2 playbook → approval → relaunch → compare | The docs prescribe a manual "Monitor & Optimize" checklist (32 manual steps found in training). Readiness is pre-launch only. There's no A/B winner selection, and graph8's own roadmap lists "flywheel" as unshipped. |
| **Reply intelligence at campaign level**: an objection taxonomy across email replies | Reply tags are user-defined; built-in email sentiment is just positive/negative. Structured objections exist only for calls and meetings. |
| Source attribution: which list or source produced the replies and wins | No native per-source outcome attribution. You have to use a custom field or a separate list per source. |
| Automated ICP refinement from outcomes | Manual "ICP refinement triggers" in the SDR-manager guide. The `icp_refinement(feedback)` MCP prompt exists but only takes feedback you supply. |

---

## 7. What this means for our two ideas
- **Source Scout** (see [PLAN.md](PLAN.md)):
  - Build on **OpenSearch count/aggregate** (TAM per segment, ⚠️ needs a subscription), **lookup with `capture:false`**, and `search` with `domain any_of` for coverage.
  - Use **assert batch + `/fields/batch`** for provenance, **Workbench / webhook / scraper bot** or `/scrape/requests` for acquisition, and **Find People** for contacts.
  - It can be exposed to graph8's own agents by **registering our MCP server under Agents → MCP Servers**.
  - Main risks: the brief's "no scraping" rule, and whether test keys touch real data.
- **Flywheel** (see [FLYWHEEL-RESEARCH.md](FLYWHEEL-RESEARCH.md)):
  - Read with `get_campaign(full=True)`, campaign metrics (respect `metric_status`), sequence analytics, `/inbox?sequence_id`, `engagement.email_replied`, and meetings (`key_topics`, `campaign_mentions`).
  - Write V2 with `create_campaign`, `patch_campaign_full`, and a **draft** document (drafts are excluded from launch checks). Route approval through the Human Approval node or My Desk's approve lane.
  - The idea lines up with graph8's own roadmap.
  - Blocker: **no simulated inbound replies in the sandbox**.

---

## 8. Detailed notes index
| File | Covers |
|---|---|
| [training.md](research/graph8-notes/training.md) | Role missions, end-to-end GTM workflow, 32 manual optimisation steps |
| [studio-signals-skills.md](research/graph8-notes/studio-signals-skills.md) | Global Context, campaigns (doc list), Copilot, Skills, Signals, Radar, Skill Library playbooks |
| [engage-start-marketplace.md](research/graph8-notes/engage-start-marketplace.md) | Sequencer, Inbox, Dialer, Nurture, Meetings, Work/Routines, onboarding, Marketplace |
| [data-deals.md](research/graph8-notes/data-deals.md) | Search, lists, workbench, pipelines, enrichment, CDP, deals, quotes, AE Cockpit, changelog |
| [ai-analytics.md](research/graph8-notes/ai-analytics.md) | Copilot/Bridge, agents, workflows, Sales Coach, voice, enrichment, analytics |
| [developers.md](research/graph8-notes/developers.md) | REST reference, SDK methods, CLI, sandbox, webhooks, pricing, cookbook |
| [mcp.md](research/graph8-notes/mcp.md) | MCP setup plus a **601-row tool catalog** with cost/send flags |
| [settings-roles.md](research/graph8-notes/settings-roles.md) | Settings, roles/permissions, 21 role field guides (bugs, URL map) |
| [desktop.md](research/graph8-notes/desktop.md) | Desktop app: Workbench, Radar, Brain, Copilot tools, Autopilot |
| [api-endpoints-by-tag.txt](research/graph8-notes/api-endpoints-by-tag.txt) | Every OpenAPI operation grouped by tag |
