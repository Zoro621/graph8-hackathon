# graph8 Knowledge Base: Studio, Signals, Skill Library

Source: plain-text extractions of docs.graph8.com pages in `scratchpad/docs/` — every file starting with `studio__` (18 files), `signals__` (10 files), and `skill-library` (9 files) was read in full. Anything taken from outside those files is marked **[XREF: filename]**. Places where the docs are vague or don't say something are marked **[VAGUE]** or **[NOT DOCUMENTED]**.

Credit costs and limits below are copied exactly as the docs state them.

---

## PART 1 — STUDIO

Studio is graph8's AI GTM (go-to-market) content and strategy workspace. Its layers:
- **Global Context** (company profile, intelligence, context documents, research reports, personas, ICPs, Brand Kit), which feeds
- **Campaigns** (20 generated documents, a step editor, a dashboard, and a push to the Engage sequencer),
- **Companies** (per-account intelligence and deals),
- **Content** (SEO inventory, content grids, landing pages, ads),
- **Team** (AI Twins),
- **Copilot**, **Skills**, **Run Actions**, **Custom Records**, **Knowledge**, **Surveys**, and **Security Questionnaires**.

### 1.1 Global Context (`studio__global.md`)

**What it is.** The "foundation of Studio". It stores everything the AI needs about the org: brand, messaging, target audience, and competitive landscape. Every campaign, account document, and piece of content draws from it. The page says "Improving your context directly improves all AI outputs across Studio." Global produces three sections: **Intelligence, Context Documents, Research Reports**.

**Company Profile** (Studio → Global → Company Profile). Complete it before generating documents, because it is the starting point for all research.
- Basic info: name, website, industry, size, description
- Contact: HQ address, phone, support email
- Social media: LinkedIn, Twitter, YouTube, etc.
- Custom fields

**Intelligence items** (Studio → Global → Intelligence). This is raw data collection. There are 13 items:

| Item | What it collects |
|---|---|
| Website Content | Site pages, structure, messaging |
| Company Data | Firmographics |
| Products & Features | Product inventory from the website |
| Organic Keywords | Keywords you rank for |
| Paid Keywords | Keywords you bid on |
| Competitors | Competitor companies identified from your market |
| Top Content | Highest-performing pages and posts |
| Audience Questions | Questions your audience asks online |
| Search Trends | Trending searches in your industry |
| Brand News | News mentions and press |
| Brand Sentiment | Public sentiment across channels |
| Visual Assets | Imagery, logos, visual identity |
| Social Profiles | Social presence and activity |

- Click "Run All" or run items one at a time. Runs happen in the background and each item updates as it completes. Rerun periodically.
- Intelligence feeds context-document and research-report generation.
- **[VAGUE]** This list differs from the one on the separate Intelligence page (§1.2): 13 items here vs 10 document types there, with different names. Both describe the same subsystem, and the docs never reconcile them.

**Context Documents** (AI-generated strategic assets, 5 categories, 21 documents):
- **Brand** (5): Brand Brief; Brand Voice; Style Guide; Writing Style Guide; Compliance Rules
- **Market** (4): TAM Research; Competitors; Positioning Matrix; Market Insights
- **Audience** (4): ICP Research; Persona Research; Pains & Gains; Buying Journey
- **Offer** (4): Offer Brief; Value Propositions; Proof Catalog (case studies, testimonials, social proof); Pricing Matrix
- **Messaging** (4): Messaging House (themes, value pillars, proof points); Elevator Pitch; Narrative Templates; Channel Templates

Generation (Studio → Global): click "Generate All" or generate by category. The AI uses the profile, website, and intelligence data.
- **"Review and edit any document — your changes are preserved across regenerations."** **[VAGUE]** The docs don't explain how user edits are merged when a document is regenerated.
- Documents are versioned automatically, and each save creates a snapshot.

**How Global connects to campaigns**:
- Campaign ideas use ICP, personas, and positioning.
- Messaging pulls from the messaging framework and value props.
- Channel strategies align with audience and market.
- Updating Global improves all *future* campaigns. **[VAGUE]** The docs don't say whether existing campaigns get re-synced.

**Research Reports** are deep dives that use "extended AI thinking". There are 6: Review & Sentiment; Competitive Teardown; Analyst & Media; Voice of Customer; GTM Channel Strategy; Buyer Psychology. They can be regenerated, and rerunning intelligence first makes them more current.

**Personas** (who you target). Each persona has:
- Title and priority
- Why target
- Key signals
- Receptivity assessment
- Campaign approach
- Confidence scoring (data strengths and gaps)

Creation modes: AI-generated (with confidence scores), manual, or hybrid.

**ICPs** (where you target). Each ICP has:
- Firmographics (size, revenue, industry, growth stage)
- Technographics (e.g. "uses Salesforce")
- Business signals (buying triggers, growth indicators)
- **Tiers** (Tier 1 = best fit, Tier 2 = good fit…)
- **Market size** (estimated number of matching companies)

ICPs map to personas, so you can see which buyer roles matter per ICP tier.

**TAM.** TAM is a *context document* ("TAM Research": total addressable market size and segmentation) plus the per-ICP "Market size" estimate. There is a `tam-expert` Copilot skill. **[NOT DOCUMENTED]** There is no separate TAM builder or list-generation feature in these pages.

**Brand Kit** (Studio → Brand Kit):
- **Layouts**: archetype page structures (Demo, Lead Magnet, Product Launch…). Picks auto-save. "Create Custom Template" generates a layout from a prompt, and Regenerate gives a new variation.
- **Templates**: finished landing pages promoted from Drafts. Actions: Save as Template, Delete (the original draft is kept), Fix with AI (AI Review).
- **Design System (Mined CSS)**: colors, typography scale, spacing, shadows, gradients, border radii, and effects, extracted automatically from your website during the website intelligence pass. It is used by landing-page generation, the editor, and any "match your brand" prompt. Re-run intelligence after a redesign.

**Takeaway for builders:** Global Context is the single upstream store. Nearly every AI action (Copilot, Skills, Run Actions, campaign generation, ads, landing pages) automatically injects some or all of it.

### 1.2 Intelligence (`studio__intelligence.md`)

**What it is.** "Studio's research engine". Intelligence documents are auto-generated artifacts stored in the org. They feed the **Campaign Intelligence Brief** (named here and not described anywhere else **[VAGUE]**) and are referenced by Copilot, Skills, and all AI actions.

**Location:** Studio → Intelligence. **Flow:**
1. Pick a document type in the sidebar.
2. Click Generate (or Refresh).
3. Research takes 30 s to 5 min.
4. Review.
5. **Accept** to commit, or edit sections first.

Accepted documents become part of Global Context.

**Document types, refresh cadence, and credit cost:**

| Document | Contents | Refresh | Credits/gen |
|---|---|---|---|
| Website Scrape | Headlines, pricing, product pages | On demand or weekly | 10 |
| Company Enrichment | Size, revenue, industry, tech stack | On demand or monthly | 5 |
| Competitor Discovery | Direct and indirect competitors plus positioning | On demand | 15 |
| Competitor Teardown | Messaging, pricing, positioning per competitor | On demand | 20 **per competitor** |
| Company Keywords | Brand and product-name keywords | Monthly | 10 (any keyword doc) |
| Organic Keywords | SEO keywords driving traffic | Monthly | 10 |
| Paid Keywords | Keywords you run ads on | Monthly | 10 |
| Product Inventory | Products, pricing, positioning | On demand | 10 |
| Review Sentiment | G2/Capterra/Trustpilot themes | Monthly | 15 |
| Industry Analyst | Market size, growth, key players | Quarterly | 50 |

Refreshes cost the same as generations. Check the balance at Settings → Billing.

**Website Scrape** (this is web scraping that graph8 itself performs):
- **Extracts:** homepage headline copy; product and feature pages; pricing tables if public; customer logos and case studies; about/team content; blog taxonomies and post counts.
- **Config** (Intelligence → Website Scrape → Configure): root URL, then depth:
  - **Shallow**: homepage + 1 click, ~30 s
  - **Standard**: 3 clicks, the default, 2–3 min
  - **Deep**: 5 clicks + blog, 5–10 min
- **Manual refresh:** open the doc → Refresh → review the **diff** (changes since the last scrape are highlighted) → Accept.
- **[VAGUE]** The page implies the scrape is of *your own* site. Whether an arbitrary URL is allowed is not stated. Separately, Company intelligence (§1.4) scrapes *target companies'* websites, and Landing Pages can clone "any web page URL", including a competitor's.

**Competitor Discovery**:
- **Three sources:** SEO data (who ranks for your keywords); paid-ad intelligence (who bids on your brand and category terms); market data (companies in the same G2/Capterra category).
- **Types:** Direct (same problem, same audience); Indirect (same problem, different approach); Status quo (internal or manual alternative); Adjacent (same buyer, related product).
- **Review:** Keep / Exclude / Reclassify each competitor, then Save. The final list powers Competitor Teardown, battlecards, and Copilot competitive skills.

**Competitor Teardown sections:**
- Positioning (homepage messaging, target ICP)
- Value propositions (top 3)
- Pricing (public tiers and model)
- Key features
- Review sentiment (G2/Capterra strengths and weaknesses)
- Social proof (logos, case studies, stated ARR/users)
- "Your advantages" (auto comparison)

It is used in campaign outbound copy, in Copilot ("how do we compete with X?"), and in deal prep.

**Keyword intelligence:**
- Company Keywords: brand search volume.
- Organic: keyword, volume, rank, ranking URL, difficulty, monthly trend.
- Paid: keyword, monthly cost, CPC, landing page URL, quality score, month-over-month spend.

Keyword docs feed landing-page and ad-copy generation, so the AI targets terms you already win or bid on.

**Product Inventory fields:** product name, pricing, target audience, key features, positioning, CTA URL. It powers campaign ideation, **AE Cockpit deal scoring**, and landing-page generation.

**Review Sentiment outputs:** top 5 positive themes (with frequency), top 5 negative themes, feature requests, churn signals, competitor mentions.

**Industry Analyst** (quarterly):
- TAM/SAM/SOM with citations
- CAGR
- Key players (leaders, challengers, niche)
- Tailwinds, headwinds, regulatory

**Permissions:**
- Admin: generate, edit, delete.
- Member: generate and refresh; edit only with document-level write access.
- Viewer: read-only.

### 1.3 Campaigns (`studio__campaigns.md`)

**What it is.** Campaigns take you "from idea to execution". The AI generates concepts, writes all copy and collateral, and pushes the finished sequence into **Engage** (the sequencer). Each campaign has a unique, shareable URL that survives a refresh.

**Ideation** (Studio → Campaign → Generate Ideas). Output is **ranked** campaign concepts, each with:
- Name and category
- Core concept and primary hook
- Secondary hooks and proof points
- Target channels (email, LinkedIn, phone, voice…)
- Execution complexity and expected impact

**Categories.** "40+ campaign types" in groups:
- Outbound: social proof, trigger-based, ABM, event, authority, insight, persona-led
- Partnership: integration, marketplace, co-sell
- Product-Led: API, freemium, usage-based, feature launch, developer
- Lifecycle: expansion, renewal, win-back, cross-sell
- Co-Marketing: reseller, affiliate
- Thought Leadership: community, podcast, authority building

**What a campaign is made of.** Creating a campaign from an idea auto-generates **20 documents**:
- **Core Strategy (3):**
  - **Campaign Brief** ("Strategic overview with structured data")
  - **Targeting & Routing** (audience targeting and routing rules)
  - **Messaging & Objections**
- **Channel Copy (7):**
  - Email Copy (sequences with subject lines, body, CTAs)
  - Email Prompt (generation guidelines for variations)
  - LinkedIn Copy (connection notes, DMs, comment templates)
  - Social Prompt
  - Phone Call Script
  - Voicemail Script
  - Voice AI Script
- **Shared Assets (5):**
  - QA Rubric
  - Snippets
  - Reply Templates
  - Cadence Calendar
  - **Performance Tracker** ("Metrics and KPI tracking")
- **Operations (3):** Competitive Battlecard; Meeting Prep Checklist; Handoff Protocol

That lists 18 documents, but the page says 20. **[VAGUE]** The two unlisted ones may be the dashboard and ideas, or the Campaign Passport (see below).

All documents are editable and versioned automatically.

**The other parts of a campaign:**
- **Steps**, in the step editor:
  - Each step has a channel (email, LinkedIn, phone, voice AI), a timing (day), and conditions.
  - Modes: email, connection note, DM, call, voicemail.
  - Personalization level per step: low / medium / high.
  - Conditions: stop on reply, skip if already connected, etc.
  - Steps can be reordered by dragging.
  - **The step editor and channel-copy documents stay in sync**: editing steps updates the corresponding copy docs.
- **AI step content:** "Generate" per step, with a choice of **positioning angles**. Each angle gives a unique hook and messaging approach.
- **LinkedIn AI Instructions (HeyReach):** for LinkedIn steps powered by HeyReach, Copilot generates the message *at send time* from the contact's latest data instead of a fixed template.
- **Landing pages:** linked from the campaign dashboard ("Add Landing Page", from `studio__landing-pages.md`). Visits are attributed to the campaign.
- **Ads:** not linked in the campaigns doc itself. Ads live in Studio → Content → Ads and have their own "Campaigns" tab for paid campaigns, which is a *different* meaning of "campaign". **[XREF: MCP reference]** `g8_gtm_create_campaign_ads` / `g8_gtm_list_campaign_ads` / `g8_gtm_update_campaign_ad` / `g8_gtm_set_campaign_ad_status` / `g8_gtm_archive_campaign_ad` exist, which implies ads can attach to GTM campaigns.
- **Audience:** Studio auto-suggests a list name from the targeting criteria when you save an audience ("AI Suggested List Name").

**Push to Sequencer / Launch:**
- "Push to Sequencer" maps each campaign step to an Engage sequence step and creates the sequence automatically.
- "Launch" shows a preview of the sequence → Confirm → the campaign runs as an active multi-step sequence.
- **The campaign↔sequence link is preserved**, "so you can trace performance back to the original campaign".

**Campaign Dashboard** (AI-generated):
- **Readiness Score**: overall viability rating
- Strategic Assessment (confidence and risk)
- Audience Profile
- Messaging Summary (hook effectiveness, angles)
- Channel Strategy
- Risk Assessment (competitive threats, execution risks, mitigations)

The dashboard **regenerates when you make significant changes to campaign documents**. **[VAGUE]** "Significant" is not defined.

Tip from the page: use the dashboard before launch; if readiness flags missing proof points or weak messaging, refine those documents first.
- **[XREF: training__growth-manager__optimize.md]**
  - Readiness Score is 0–100, and <75 means there are gaps.
  - Statuses: `ready` / `needs_work` / `not_ready`.
  - Each document has a **Health Score**: good / warning / poor. Causes include thin content, missing sections, and "messaging that drifts from the Company Profile". Fix in Canvas or by Copilot regeneration.

**Campaign Passport** (not in the campaigns doc). **[NOT IN SCOPE FILES]** It is named only in **[XREF: training__growth-manager__optimize.md]**: "an auto-generated summary PDF that captures the campaign strategy, target personas, messaging themes, and key deliverables in a single document". It is exported with the campaign documents for client delivery.

**Regeneration summary:**
- Dashboard: automatic on significant document changes.
- Per-step content: via Generate with angles.
- Documents: via Copilot `/edit`, Sparkles field rewrite, or regenerate.
- Global Context documents: regenerated in Global, with user edits preserved.

**Performance data:**
- The Performance Tracker document exists ("Metrics and KPI tracking").
- Sequence metrics live in Engage.
- **[XREF]** MCP `g8_gtm_get_campaign_metrics`.
- **[NOT DOCUMENTED]** In these pages, nothing automatically feeds outcomes back into campaign documents.

### 1.4 Companies (`studio__accounts.md`, titled "Companies")

**Company Intelligence** (Studio → Companies → select → **Run Intelligence**). A multi-step background workflow with real-time step updates:
1. Website scrape of the target company
2. Competitor analysis
3. Content analysis (their public content and messaging)
4. API enrichment (firmographic and technographic)
5. Synthesis

**Output: 10+ documents per company:**
- Company Brief
- Prospecting Brief
- Qualification Checklist
- Pain Points
- Value Proposition (tailored)
- Competitive Analysis
- Trigger Events
- ROI Analysis
- Deal Risks
- Next Steps

These combine Global Context with company-specific research. **[NOT DOCUMENTED]** Credit cost is not stated.

**Deals & Pipeline:**
- Views: Board, List, Forecast.
- 7 default stages with win probability: Lead 10%, Qualified 20%, Meeting 40%, Proposal 60%, Negotiation 80%, Closed Won 100%, Closed Lost 0%.
- Customize in Settings → Pipeline: stages, probabilities, required fields per stage, multiple pipelines.
- Deals are created from a company profile, from the board "+", or via CRM sync.
- **Deal Signals:**
  - Combined signal score across deal contacts
  - Recent intent (site visits)
  - Email engagement
  - Meeting activity (bookings and cancellations)
- **Forecast:** Weighted Pipeline (amount × probability), Commit, Best Case.
- **CRM:** Salesforce and HubSpot, two-way (Settings → Integrations; map fields, set direction, conflict rules).

### 1.5 Content (`studio__content.md`)

**What it is.** An SEO and AI content engine.

**Inventory fields:**
- URL, Title, Meta description, H1, Word count, Primary keyword
- SEO score 0–100
- Content type (website / blog / landing page / LinkedIn / newsletter)
- Status (idea / in progress / done / published)

**Import:**
- **Deep Crawl** (Studio → Content → Import → Crawl Website):
  - The URL is **validated against your registered domain**, so crawling is restricted to your own domain.
  - Optional path filter.
  - **Up to 5,000 pages.**
  - Runs in the background with progress counts: found / scraped / imported / skipped / failed.
- **Sitemap Import:** sitemap URL plus glob filters; each URL is parsed and scraped.
- **Manual Add Page.**
- **Delete:** removes only the inventory record and detaches it from grids. The live site is unaffected. Bulk delete is available.

**SEO score inputs:**
- Title presence and length
- Meta description presence and length
- H1
- Word count (300+)
- Internal and external links
- Mobile signals
- Speed signals

The summary dashboard shows issues by severity (critical / warning / info) and score bands: excellent 80+, good 60–79, needs work 40–59, poor <40.

**Workspace:** filter by domain, type, SEO health, intent (buy / compare / best), refresh status, page type. You can edit topic, target keyword, intent, owner, and refresh scope.

**Content Grids** (batch AI):
- Operations: **Refresh**, **Create**, **Analyze**.
- New Grid → add pages as rows → assign keyword and author per row → Run.
- **Each row tracks before/after SEO scores.** This is a measured improvement loop.

**Integrations:**
- Google Search Console: clicks, impressions, CTR, average position.
- SEO data: authority, backlinks, referring domains, keyword position and volume. **[VAGUE]** The provider isn't named. **[XREF]** DataForSEO is named in the Radar MCP tool descriptions.

### 1.6 Landing Pages (`studio__landing-pages.md`)

**Location:** Studio → Content → Landing Pages. Lifecycle tabs: **Create → Drafts → Publish**.

**Create paths:**
- Pick a Layout: 30–60 s, uses credits.
- Generate from a Prompt: 30–60 s, uses credits.
- **Clone Any URL**: 10–30 s. Works on "your homepage or a competitor's page". Captures layout, styles, and structure with your branding overlaid. Logo hygiene strips AI-invented logos.
- **[NOT DOCUMENTED]** Exact credit amounts.

**Editor** (3 columns):
- Left: page library, sections, images.
- Middle: live canvas with inline text editing.
- Right: AI chat panel with highlight-to-chat and section-level rewrites.
- Image browser (images extracted from your website, uploads, categories).
- Section navigator: reorder, show/hide, add.
- Features and "Why Us" cards are auto-upgraded to interactive tabs (you can revert).

**AI Review:**
- Categories: conversion, accessibility, brand, content quality.
- Severity: critical / warning / info.
- "Fix with AI" works per finding or for all findings.
- Also available on Brand Kit templates.
- Safety: `javascript:` URLs and HTML injection are blocked at the schema layer.

**Versions:** auto-save on every edit, a History timeline, Restore. AI chat history is kept alongside versions.

**Publishing:**
- Deploys to **Cloudflare Pages** at `https://g8-lp-{org-id}.pages.dev/{page-slug}`.
- Republishing goes live immediately. Unpublish is available.
- Custom domain requires admin DNS setup.
- Publish tab: swap versions without changing the URL; search by URL, slug, or campaign.
- Export HTML; raw HTML/CSS edit mode.

**Campaign link:** Campaign dashboard → Add Landing Page (or pick a campaign from the editor). Visits are attributed to the campaign.

**Troubleshooting:**
- Clone styling depends on page load timing.
- Published URL not loading usually means the org is missing Cloudflare credentials.

### 1.7 Ads (`studio__ads.md`, `studio__ads-google.md`, `studio__ads-linkedin.md`)

**Location:** Studio → Content → Ads. Sidebar sections: Create / Drafts / Gallery / Campaigns.

**Platforms and limits** (enforced automatically):

| Platform | Headline limit | Body limit |
|---|---|---|
| Meta | 40 | 125 |
| LinkedIn | 70 | 600 (~150 visible) |
| Google | 30 | 90 |
| X | 70 | 280 |

CTA options are constrained per platform. Google does not allow free-text buttons.

**Create:**
- Start from: Starters (Product launch, Webinar/event, Retargeting offer, Lead magnet, Free trial, Social proof), My templates, or Blank.
- Details: optional brief, platform, format, name.
- Image: AI generate (optional reference images) or library.
- "Generate with AI" lands the creative in Drafts; generation continues in the background and uses credits.

**Campaign Sets:**
- personas × platforms × variants.
- **Capped at 24 creatives per batch.**
- Uses Studio personas.

**Concepts mode:** a board of directions (name, hook, tone, layout) that seeds a single ad or a set.

**Draft statuses:** Generating / Ready / Failed (retry).

**Editor:**
- Canvas / In-feed / Raw views
- Chat editing with quick chips
- Click-a-pin text edit
- Re-skin, alt copy, All sizes
- Versions
- **Persona lens** (preview how a persona would react)
- Review (limits, CTA rules, brand casing, placeholders)
- Export SVG/PNG
- Finalize → Gallery

AI edits cost credits. Re-skin, versions, and export are free.

**Gallery:** save as template, or use in a paid campaign ("Use an existing creative" auto-fills).

**Paid campaign wizard** (Google and LinkedIn documented), 6 steps:
1. **Platform** (name, platform; OAuth connect)
2. **Audience**
   - Keywords; By List / Segment / Individual; optional suppression lists.
   - Needs at least one item.
   - Contacts are synced as **hashed** Customer Match (Google) or Matched Audience (LinkedIn).
   - Suppressed contacts are never synced.
3. **Creative**
4. **Budget**
   - Daily budget in USD/EUR/GBP; start and end dates. With no end date it runs until paused.
   - Google only: Customer Match mode Observation / Targeting / Exclusion.
5. **Review**: Save Draft (Create permission) or Publish (Launch permission)
6. **Publish**

**Active Campaigns table:**
- Statuses: Active, Paused, Pending, Under review, Rejected, Completed, Failed.
- Metrics: budget, spend, impressions, clicks, CTR.
- Actions: Edit / Pause / Resume / Delete. **Refresh** pulls status and metrics from the platform.

**Permissions** (Settings → Roles → Ads row): View / Create / Edit / **Launch** (the money-spending one). Defaults allow admins, sales managers, and campaign managers to launch; everyone else is view-only.

**Platform prerequisites:**
- LinkedIn: Campaign Manager, Account Manager, or Billing Admin role (Viewer can't launch). Currency and Company Page are immutable. The ad hierarchy was renamed in late 2025 to Ad account → Campaign → Ad set → Ad. Review is usually within 24 h; set up 48 h ahead.
- Google: billing country and time zone are hard to change. Customer ID is under the profile. Review is usually within 1 business day.
- **[NOT DOCUMENTED]** Meta and X paid-launch guides; only creative generation is documented for them.

### 1.8 Team (`studio__team.md`)

**Profiles:**
- Fields: identity, contact, social, bio (short and full), expertise.
- Created automatically on login, or added manually. Filter by active / pending / inactive. Sync from your IdP.

**AI Twin:**
- Contents: voice tone (professional / casual / thought-leader), writing samples, job history, expertise, topics.
- Fastest setup is "Import from LinkedIn" (headline, about, skills, jobs, recent posts).
- Content types: LinkedIn posts, blogs, newsletters, thought leadership.
- Content status: draft → approved → published → archived.

**Thought Leadership Calendar:** themes, content mix, channels, authors, schedule ("50+ pieces" per quarter), success metrics (reach, speaking invites, inbound leads).

**AI Clones:** for people without an account (execs, advisors). The clone inherits the profile.

### 1.9 Copilot (`studio__copilot.md`)

**Modes:**
- **Global**: general GTM questions.
- **Document**: a specialist skill tied to the open document.
- A dashboard view shows meetings, activity, and suggestions.

**Memory:** built automatically from interactions (decisions, preferences, org context). **[VAGUE]** Scope, retention, and editing are not documented.

**Skill routing** (the active skill shows in the panel header):

| Open document | Copilot skill |
|---|---|
| None | global-advisor |
| Brand Brief / Voice / Style Guide | brand-strategist |
| Competitors / Positioning Matrix / Market Insights | market-analyst |
| Pains & Gains / Buying Journey | audience-expert |
| Offer Brief / Value Props / Proof Catalog / Pricing Matrix | offer-architect |
| Messaging House / Elevator Pitch / Narrative Templates | messaging-expert |
| ICP research | icp-expert |
| Persona docs | persona-expert |
| TAM research | tam-expert |
| Campaign Ideas | ideas-expert |
| Email Copy / Email Prompt | email-writer |
| LinkedIn Copy | linkedin-writer |
| Social Prompt | social-writer |
| Phone / Voicemail / Voice AI scripts, Battlecard, Meeting Prep, Handoff Protocol | sales-enablement |
| Campaign Brief, Messaging & Objections, Targeting & Routing, QA Rubric, Cadence Calendar, Performance Tracker | campaign-copy-editor |
| Campaign Dashboard | readiness-expert |
| Landing Pages | landing-page-designer |
| Security Questionnaires | security-advisor |

That is 18 skills. Note that "Campaign Ideas" is a document, which may be one of the 20 campaign documents.

**Editing features:**
- **Inline field editing:** a Sparkles button on Email and LinkedIn fields (subject, opening line, CTA, body) sends a focused rewrite request, streams the suggestion, and applies it instantly on accept.
- **Slash commands:** type `/`. Most run instantly. `/edit` needs confirmation and works on any structured document section. Skills are also invokable as `/skill_name` (from `studio__skills.md`).
- **Notifications:** background action completions show in the bell icon.
- **Global search:** ⌘K / Ctrl+K across campaigns, documents, contacts, companies.

**Actions & Saved Intelligence:** results of actions run on contacts or companies can be **saved as intelligence**. Saved intelligence attaches to the record and is used automatically by Copilot for outreach, campaigns, and Q&A.

### 1.10 Run Actions on Contacts and Companies (`studio__entity-action-execution.md`)

**Flow:** the lightning bolt icon on a contact or company page → pick an action → it runs with the record injected → results show in a panel with completion time.

**Available actions:** enabled LLM actions from **AI Agents**. Automation and webhook actions are *not* shown. Types: Research, Personalization, Analysis (ICP scoring), Enablement.

**Context injection:**
- Contact: name, title, company, email, phone, location, LinkedIn, custom fields.
- Company: name, domain, industry, employee count, revenue range, location, technologies, keywords, description, custom fields.
- **Plus Global:** Brand Brief, Value Props, ICP, Offer Brief, Personas.

**Result panel:**
- Copy, Copy as Markdown, Regenerate, Send to Copilot.
- **Save to Record** writes to the Notes tab, the CRM activity note (if sync is on), and the Inbox timeline as "AI Generated". Saved results become part of future record context.

**Scale-out options:**
- List bulk action: Data → Lists → Run Action
- Campaign step: Engage → Sequencer → Add AI Action Step
- Workflow trigger: Agents → Workflows
- **Enrichment column**: Data → Lists → + column → AI

**Permissions:**
- Admin: run and edit.
- Member: run.
- Viewer: cannot run.
- Role visibility per action is set at AI Agents → Action settings.

**Credits** (same tiers as Skills):

| Tier | Credits per run |
|---|---|
| Fast | 1 |
| Standard | 3–5 |
| Deep (web) | 10–20 |
| Thinking | 15–40 |

**Errors:**
- Missing required field (enrich first)
- Insufficient credits
- Model timeout
- Action disabled
- **Rate limited** (too many concurrent actions per user: wait 30 s)

**Activity log** (Settings → Activity → AI Actions): user, action, record, timestamp, credits.

### 1.11 Skills (`studio__skills.md`) — Studio's in-app prompt skills (not the Skill Library)

**What it is.** A named, templated, versioned, role-aware prompt that automatically receives Global Context plus the active record. "Think of skills as internal GPTs."

**Create** (Studio → Skills → New Skill):
- Name and description.
- **Type**: Contact / Company / Deal / **List-Audience** ("Score every contact against our ICP") / Document / Ad-hoc.
- Write the prompt, then **Save as Draft**, then test.

**Templating** (double-brace `{{ }}`):
- Record: `{{contact.first_name|last_name|job_title|email|linkedin_url}}`, `{{company.name|domain|industry|employee_count|description}}`, `{{deal.stage|amount|close_date}}`
- Global: `{{global.brand_brief}}`, `{{global.value_props}}`, `{{global.icp}}`, `{{global.personas}}`, `{{global.persona.vp_sales}}`, `{{global.offer_brief}}`
- Custom: `{{contact.custom.field_name}}`, `{{company.custom.field_name}}`; custom records use `{{record.field_key}}` (with filters like `| currency`)

**Testing:**
- Click Test and pick a record. Tests are logged but have no side effects (no notes, no CRM sync).
- **A/B Testing:** versions A and B → select 10 records → compare side by side → the winner becomes the published version.

**Versioning:**
- States: Draft (author only) / Published / Deprecated (hidden, but still runs for pinned references) / Archived (no runs).
- **Version pinning:** workflows and sequences pin to a version and do not auto-upgrade.

**Publishing:**
- Visibility: Private / Team / Organization.
- Who can run: all eligible users or specific roles.
- Member publishing needs admin approval. Only admins archive.

**Where skills run:**
- Contact, Company, and Deal pages (lightning bolt)
- List bulk action
- **Campaign step**
- **Workflow trigger**
- Copilot `/skill_name`

**Credits:** Fast 1 / Standard 3–5 / Deep 10–20 / Thinking 15–40. The tier is set per skill.

**Troubleshooting:**
- An unrendered `{{contact.x}}` in output means the field was empty on that record.
- For timeouts, reduce context or pick a faster tier.
- An archived skill has "disappeared" from view.
- Advice: build small, focused skills.

**Gotcha — two different placeholder syntaxes:**
- Studio Skills use `{{var}}`.
- The Skill Library's auto-reply-workflow says MCP-authored LLM skills (`g8_skill_create_llm`) for workflow nodes use **single-brace `{var}`**, and `{{var}}` is treated as literal text.
- These appear to be two different skill systems, or at least two different authoring paths. **[VAGUE]**

### 1.12 Custom Records (`studio__custom-records.md`)

**What it is.** User-defined object types beyond contacts, companies, and deals. Examples include Territories, Partners, Products, **Events (conferences, trade shows with attendee contacts)**, Support Tickets, Properties, Policies, Vehicles.

**Create** (Studio → Custom Records → New Type): singular and plural names, icon, attributes, relationships, permissions. A sidebar entry is added.

**Field types:**
- Text short/long, Number, Currency, Date, Datetime, Boolean
- Dropdown, Multi-select, URL, Email, Phone
- **Reference** (to contact, company, deal, or custom record)
- **Formula**
- **AI Field** (generated by an AI skill on create or update)

**Field config:** label; key (auto-generated, **immutable**); required; unique; default; help text; validation (regex, min/max).

**Relationships:**
- Cardinality: 1:1, many:1, 1:many, many:many.
- Cascade options: Cascade delete / Restrict delete / Nullify.

**Views:**
- AG Grid, default columns, saved views (shared or private).
- Bulk edit, bulk delete, run skills on a filtered view, export CSV/JSON.

**AI access:**
- Skills use `{{record.field_key}}`.
- Voice agents, Copilot, and workflows can read and write custom records if **AI Access** is enabled at Record Type → Permissions.

**Workflow triggers:** created, updated, deleted, field changed, relationship added or removed.

**CRM sync:** Salesforce, HubSpot, and Pipedrive custom objects (Settings → Integrations → [CRM] → Custom Objects). Field mapping, one-way or two-way sync, per-field conflict rules, configurable delete behavior.

**Limits** (default → max):

| Limit | Default | Max |
|---|---|---|
| Record types | 10 | 100 (Enterprise) |
| Fields per type | 50 | 500 |
| Records per type | 100,000 | 10M |
| Relationships per type | 20 | not stated |

**Permissions:**
- Admin: manage types.
- Member: records within accessible types.
- Viewer: read-only.
- Per-type restrictions are possible.

Related page says "Custom records can feed Global Context". **[VAGUE]** How is not explained.

### 1.13 Knowledge (`studio__knowledge.md`) — thin page

**Location:** Studio → Knowledge. A folder tree of documents and "concepts" that give org context. Browse, search, preview.

**Adding knowledge:**
- "Add knowledge" → contribution options → an authoring form.
- **Submission may create a proposal**, so check its status rather than assuming it became authoritative.
- Edit / **Amend** actions also go through proposals.

**Troubleshooting:** "If a generated answer conflicts with a source, review the underlying document and correct or amend it."

Links to a "Knowledge API". **[XREF: MCP reference]** Tools include `g8_knowledge_context|export|get|list|related|search|sources` and `g8_gtm_list_kb_documents` / `g8_gtm_search_kb`.

**[VAGUE]** The page is written generically: no fields, no approval roles, no relation to Global Context documents.

### 1.14 NPS and CSAT Surveys (`studio__surveys.md`) — thin page

- Surveys and Overview views, list or grid.
- **Create:** type (NPS or CSAT) → content and audience → review recipients and delivery → send → results (responses, timing).
- **Summary:** scores, sentiment, cadence, trends. NPS splits promoters, passives, and detractors.
- **Gotchas:**
  - A survey with no sends or responses is *missing evidence*, not zero.
  - Don't combine NPS and CSAT scores.
  - Resend needs a scope check.
  - Deleting a survey doesn't resolve the feedback.
- **[VAGUE]** No channels, question formats, API, or credit costs are documented.
- Potentially relevant to Flywheel as an outcome signal, but nothing links surveys to campaigns.

### 1.15 Security Questionnaires (`studio__security-questionnaires.md`)

**Why it exists.** Questionnaires run 150–400 questions and take 8–40 hours by hand. This brings it to 30–90 minutes of review.

**Flow:** Studio → Security Questionnaires → New → upload → parse → AI matches against the **answer library** → review → export in the same format.

**Formats:**
- XLSX (preserves formatting)
- DOCX (fresh DOCX out)
- PDF (input only; export as XLSX or DOCX)
- Google Sheets via Drive
- SIG Lite/Core and CAIQ natively

**Extraction:**
- XLSX: detects question, answer, and classification columns.
- DOCX: numbered hierarchy.
- PDF: AI, may need manual review.
- After parsing you can merge duplicates, reclassify, or mark skip.

**Answer library:**
- Fields: question pattern; canonical answer; alternate phrasings; tags; confidence (High/Med/Low, affects auto-approval); last reviewed; owner.
- Seed via Import from previous questionnaires, SOC 2, pen tests, runbooks.
- Lifecycle: Pending review → Approved → Needs update (after N months) → Deprecated. Default review cadence is **6 months**.
- Every approved answer is added back to the library. This is an explicit learning loop.

**Draft Answers:**
- Best match, reformatted to the question type (short / long / Y/N/NA), with a confidence score 0–100.
- Bands: ≥90 quick approve; 70–89 review; 40–69 deep review; <40 write from scratch.
- Bulk actions: approve all ≥90, flag all <40, reassign to owner.

**Review:**
- Approve or Needs Input (with comment).
- Collaboration: section owners, comments, presence, @mentions (email).
- Per-answer history and rollback.

**Export:**
- Original XLSX / formatted DOCX / PDF / CSV.
- Preserves order, headings, and branding.
- Optional **audit trail** page (approver, time, library canonical ID, edits).

**Library growth** (auto-match rate):

| Questionnaires done | Answers | Auto-match |
|---|---|---|
| 1 | ~200 | 20–30% |
| 3 | ~500 | 50–65% |
| 10 | ~1,200 | 75–85% |
| 25+ | ~2,000 | 85–95% |

**Integrations:** Google Drive, Slack, Jira/Linear, **Vanta/Drata** (compliance controls), SharePoint.

**Roles:** Admin / Reviewer / Contributor (additions pending admin approval) / Viewer. Per-section permissions are available.

**Security:** encrypted; tenant-scoped; "never used as training data". Audit logs at Settings → Audit → Security Questionnaires. The page says drafting is "powered by skills".

---

## PART 2 — SIGNALS

### 2.1 Signals Overview (`signals__overview.md`)

**Three sources:**
- **Visitors**: identified contacts, plus anonymous companies resolved via IP
- **Forms**
- **Intent**: first-party plus web intent

**Signals tab** (on contact, company, and deal pages): Intent Keywords, Web Research, Intent Topics, Page Visits, Email Engagement, Form Submissions, Meeting Bookings. It shows a **signal score 0–100** and a trend (rising / stable / declining).

**Score weights:**
- Form submission 25
- Email reply 20
- Keyword intent match 15
- Topic intent match 10
- Page visit 5

**Recency bonus:** within 3 days +20; within 7 days +10; within 14 days +5; older, none.

**Trend** (current score vs the 30–60-day average):
- Rising: ≥ +20%
- Stable: within ±20%
- Declining: ≤ −20%

**Intensity:** High ≤7 days; Medium 8–14 days; Low 15–30 days. **Signals older than 30 days are excluded from scoring.**

**Company score** aggregates all contacts plus anonymous IP visits.

**[VAGUE]** The score is capped at 100 but the docs don't say whether weights sum per event or per type.

### 2.2 Website Visitors (`signals__website-visitors.md`)

**Tracking script** captures pages (URL, title, time), city and country, referrer, session duration and page count, and form submissions, in real time.

**Identification:**
- Known visitors are auto-attributed to their contact record (e.g. after an email click).
- Anonymous visitors are resolved by **IP-to-company**: name, domain, anonymous visitor count, pages, first/last visit, geography.

**Views** (Signals → Visitors):
- **People**
- **Companies**
- **Campaigns**: visitor engagement per campaign — campaign pages visited, visitor counts, **visit → form conversion**. This is a campaign-outcome metric.

**Enrich workflow:** Companies → filter by ICP → Enrich (company details plus find contacts) → save to a list.

### 2.3 Intent Tracking (`signals__intent-tracking.md`)

**Two types:**
- **First-party**: your site's URL or title matches a keyword. Needs the tracking script.
- **Web intent**: graph8 searches the web for pages matching your keywords, then watches whether your contacts or target companies visit those pages. Source is "third-party data". **[VAGUE]** The provider isn't named.

**Keywords:**
- Signals → Intent → Add Keywords.
- Suggested categories: Buying (pricing, demo…), Comparison (vs, alternative…), Problem, Your product, Industry.
- Each keyword shows the number of resolved contacts and companies.
- Tip: start with 10–15 keywords and add competitor names.

**High-value pages** get a score boost: pricing, demo/trial, comparison/"vs", review, competitor-related.

**Topics:** 1,000+ predefined (industries, technologies, business functions).

**Views:**
- **Intent → Contacts**: keywords/topics matched, count, latest date, intensity H/M/L.
- **Intent → Companies**: from identified contacts plus IP-resolved anonymous visitors. Logo with a fallback.
- **Sites Visited** tab: URL, commercial intent score, audience classification.
- **Web Research signals**: relevance score, visit count, matched keywords, external link.

**Intent Search:**
- Search "millions of enriched web pages" by keyword, semantic, or hybrid.
- Filter by audience, page type, commercial intent.
- Intent keywords can also be used as filters on the Search page, with record counts.

### 2.4 Forms (`signals__forms.md`)

**Tracker capture:** all form fields (passwords and sensitive fields excluded), page URL/title/referrer, IP/country/session, timestamp. Works with any HTML form, AJAX, and WPForms.

**Signals → Forms:**
- Per form: Form ID, page URL, total submissions, last submitted.
- Drill into submissions; filter by date, country, page, IP.

**Map Fields:** email / first_name / last_name / company / phone / job_title → contact fields. Preview → **target list** → Save.

**Automation:** new submissions create or update contacts in the target list **in real time, within seconds**.

**Appointment and booking forms** are tracked too.

**Signal value:** 25 points (the highest) plus the +20 recency bonus. One demo form can push a contact above 40.

### 2.5 Hiring Signals (`signals__hiring.md`)

**Location:** Signals → Hiring (`/signals/hiring`). Layout mirrors the Social Listener: type tabs, a Listeners↔Results toggle, and New buttons.

**Hiring Wave** (a saved job search, re-run **daily**):
- Fields: keywords (chips); location/window; contacts per company; title / seniority / department.
- Results grid sub-tabs: **Jobs / Companies / Decision-makers / Recruiters**.

**Talent Moves** (job changes, resolved **hourly**):
- Source: a contact list or audience, or a **named company (competitor)**, which scans the global job-change feed for joins *and* leaves with no list needed.
- Filters: title contains, seniority floor, department, minimum days in previous role, employer allow/blocklist.
- Seniority and department are matched against the *new* title, so write them as title keywords.
- Results show on the contact's Hiring tab (job-change badge) and in the Signals feed.

**Auto-seed:**
- Hiring Wave listeners are proposed **from Studio docs (personas/ICP)**.
- Talent Moves listeners are proposed from existing lists.
- Pick with checkboxes and create in one click.

**Auto-enroll:** per-listener auto-sync upserts matches into a campaign audience, which triggers sequence enrollment.

**Signal types emitted:** `job_change`, `hiring`.

**[NOT DOCUMENTED]** Credit costs and data provider.

### 2.6 Trends (`signals__trends.md`)

- **15 industry categories.** Each trend is scored by growth velocity and relevance and updated continuously.
- **Card fields:** name, growth score 0–100, growth %, category, segments.
- **Detail page:**
  - **Company Correlations**, based on web activity, content publishing, **job postings**, and tech adoption.
  - Segment breakdown.
- **Prospecting flow:** rising trend → correlated companies → add to list → reference the trend in messaging.
- **[NOT DOCUMENTED]** Data sources and costs.

### 2.7 Social Listener (`signals__social-listener.md`)

**What it is.** X (Twitter) as a signal source.
- Location: Signals → Social.
- The worker polls every 10–30 min, classifies posts, and routes them to tabs.
- Author handles are resolved to CDP contacts, and signals flow into **My Desk** and **Sequencer** drafts.

**Listener types** (default poll):
- **Brand** (10 min): query auto-built from the brand snapshot
- **Keyword** (10 min): X query syntax; filters for language, minimum followers, exclude replies
- **Competitor** (10 min): spot their customers and prospects
- **Engagement** (15 min): intent operators like "just launched", "looking for", "frustrated with"; routes to the Engagement Inbox
- **User** (30 min): polls one account's timeline

Extras: plain-English query assist and a verified-only toggle.

**Auth modes:**
- **Shared** (default): graph8 pays X and bills credits; capped monthly.
- **BYO** X Developer App (Settings → Integrations → X API card): API Key and Secret, bearer token via OAuth2 client credentials; stored encrypted with Fernet. Disconnecting falls back to shared mode and re-activates paused listeners.

**Auto-seed** from Studio docs: one Brand listener, one Competitor listener per competitor found, Keyword listeners from tracked terms, and a couple of Engagement listeners.

**Engagement Inbox:**
- Sorted by classifier score.
- Each row: author info, text, engagement metrics, classifier badge (showcasing / asking / complaining / announcing), **0–100 intent score**, resolved contact.
- Actions: Mark reviewed, Dismiss, Reply on X, Save as contact, Add to list, **Enroll in sequence**, Open in X.

**Source Lists tab:** turns a graph8 list into tracked X handles. Shows status, count, handles tracked, contacts missing an X URL, dynamic flag, last sync.

**Every matched author becomes a signal.** Unknown authors are **stub-created as contacts** and added to a per-org "Social Signals" list, which triggers auto-enrichment.

**Admin capture settings** (Settings → Signals → Social):
- Master auto-create toggle.
- Per-type: enable, minimum follower floor, "only when classified".

**Pricing:**

| Charge | Shared mode | BYO mode |
|---|---|---|
| Post read | 7 credits per post | 0 |
| User lookup | 14 credits | 0 |
| Classification (per matched post) | 1 credit | 1 credit |
| Brand-query auto-build (one-off) | 5 credits | 5 credits |

Shared mode costs graph8 $0.005 per read and $0.010 per lookup, billed at a 40% margin.

**Spend controls:**
- The X Spend Banner warns at 80% of the cap; at 100%, listeners **auto-pause** until the next cycle.
- A cost-preview pill in the query editor shows estimated posts/day, X spend, and credits before you save.

**TOS-safe storage:** tweet text is scoped to the org row, never indexed cross-tenant, never redistributed.

The Contact Social tab shows a read-only feed. Twitter URL columns exist in the grids.

### 2.8 Buying Committees (`signals__buying-committees.md`)

**Personas by title:** **E** Economic Buyer / **C** Champion / **U** End User / **T** Technical.

**Rollup:** contact (keyword and topic hits, last 30 days) → committee category → account.

**Category reading** (distinct contacts with signals): Hot ≥5; Warm 2–4; Cool 1; Silent 0.

**Account strength:**
- Very strong: ≥3 Hot
- Strong: 2 Hot, or 1 Hot + 2 Warm
- Moderate: 1 Hot or ≥2 Warm
- Weak: otherwise

**High intent** flag: total signals ≥7, or any category Hot.

**Vocabularies:**
- Awareness (default): Selecting / Interested / Aware / Identified
- Barometer: Very strong / Strong / Moderate / Weak

**Where it shows:**
- Company page Buying Committee tab (`/companies/[id]`): per-category panels, ICP counts with example titles, contact table (Signal Strong/Light/None, Topics, Last active), "+N more in ICP without signals".
- Grid columns (Companies, Contacts, lifecycle deal grids `/deals/trials|customers|churned|prospects`): Account strength, High intent, E/C/U/T matrix.

**Gated by an allowlist.** The disabled state shows "ABM Intent not enabled". It generates no new signals, only reads intent.

### 2.9 Competitive Radar (`signals__radar.md`) — thin page

**Location:** Signals → Radar. Competitive intelligence and market monitoring.

**Workflow ("work from evidence"):**
1. Check the competitor or domain.
2. Open the result or comparison.
3. Review the source page, observation, and date.
4. **Record the opportunity or gap**.
5. **Use "initiative or follow-up controls" to track the response, then compare later evidence with the original finding.**

**Scope:** competitor records, tracked pages and page history, content and ad monitoring, traffic estimates, **keyword gaps**, feature comparisons, **opportunities and initiatives**. Results depend on the sources and services enabled.

**Caveats:**
- Treat estimated traffic and generated comparisons as inputs, not facts. Verify before making customer-facing claims.
- Scans are async: check status and don't start duplicate scans.

**[XREF: developers__mcp-reference__crm.md]** The in-scope page is vague; the MCP reference fills in the model:
- **Competitors**
  - `g8_radar_add_competitor`: 409 if already tracked; 422 over the **20-competitor limit**; tier1/tier2 (default tier2); scan_config auto/manual.
  - `g8_radar_bulk_add_competitors` (max 20); `_list_competitors` (threat_score, traffic_estimate, posts/wk, ads-live, scan status, page_budget); `_get_competitor`; `_update_competitor`; `_delete_competitor`.
  - `g8_radar_competitor_suggestions` pulls from the existing **competitor_discovery** intelligence and the competitors Global Context document.
- **Collection**
  - `g8_radar_scan_competitor` / `g8_radar_scan_all`: BILLABLE, async via Celery, crawl + ads + traffic.
  - `g8_radar_discover_pages`: **Firecrawl /map**, 6 h cache, billable on refresh.
  - `_competitor_pages`, `_page_history`, `_compare_snapshot` (before/after diff), `_monitoring_content` (change feed with significance 0–100), `_monitoring_ads`, `_competitor_ads`, `_ad_detail`, `_monitoring_linkedin` (listener store, MixRank fallback), `_competitor_posts`, `_competitor_engagers` ("Steal-Their-Audience": engagers of a competitor already in the CRM).
  - `_traffic`, `_competitor_traffic`, `_own_traffic_estimate` (**DataForSEO**, approximate).
- **Gaps → Opportunities → Initiatives**
  - `g8_radar_analyze_gaps`: BILLABLE LLM pass over "lenses".
  - `_list_gaps` (status open / dismissed / converted), `_update_gap`, `_keyword_gap`, `_feature_matrix`.
  - `_list_opportunities`: the scored OPEN gaps, lanes now / next / later.
  - `_approve_opportunity` / `_approve_all_opportunities`: DESTRUCTIVE/BILLABLE; converts to an **initiative** and seeds content stubs.
  - `_list_initiatives`: lanes now / next / later / live / done.
  - **`g8_radar_measure_initiatives`: "Run the performance loopback now: write content-progression + rival-traffic outcome signals onto the org's active initiatives. Free (DB-only; also runs on the weekly sweep)."**
  - `_optimization_runs`: Radar-spawned content-refresh grids named "Radar: …".
- **Other**
  - `_battle_card` (no LLM), `_overview` (the best entry point), `_dispatch_alerts`, `_get_settings` / `_update_settings` (tier cadence 1–365 days, alert channels in_app/bridge, ad_source).
  - AEO: `_aeo_overview`, `_aeo_probes`, `_run_aeo` (billable, Redis cooldown).

### 2.10 SEO and AI Visibility (`signals__seo.md`) — thin page

**Location:** Signals → SEO. Tabs:
- Overview
- **Keyword Research**: enter a query or domain; review metrics per market; "Track selected" hands off to Rank Tracking
- **Rank Tracking**
- **Site Audit**: findings are recommendations to investigate, not proof a fix shipped; rerun after fixing
- **AI Visibility**: how AI answer engines describe your org. Check prompt, engine, and time; one engine or prompt ≠ every buyer. Corresponds to the Radar AEO tools **[XREF]**.

**[VAGUE]** No metrics, costs, or providers.

---

## PART 3 — SKILL LIBRARY (`skill-library*.md`)

**What it is.** A curated set of install-ready markdown playbooks (SKILL.md, versioned; all at **v1.0.0**; repo tag **v0.1.0**). They teach any AI agent to run graph8 plays via the **graph8 MCP**. Each one encodes which tools to call, in what order, and the guardrails.

**Install options:**
- Claude Code: `claude plugin marketplace add graph8-com/skill-library`, then install from /plugin.
- Manual: `curl` into `.claude/skills/<name>/SKILL.md` from `https://raw.githubusercontent.com/graph8-com/skill-library/v0.1.0/skills/<name>/SKILL.md`.
- claude.ai / Claude Desktop: Settings → Capabilities → Upload skill.
- Cursor: `.cursor/rules/<name>.mdc`.
- Over MCP with no install: `g8_tool_search("library")` surfaces the playbooks as callable tools.

Categories: Calendar, CRM, Enrichment, Inbox, Outbound, Signals, Voice, Workflows. There are 8 skills.

**Common MCP conventions:**
- Tools are gated in families. Activate them with `g8_tool_search("<family>")` or `g8_tool_search(tool_names=[...])`.
- If the client doesn't refresh its tool palette mid-session, call through **`g8_execute`**.
- `g8_current_org` confirms the org.
- `g8_load_playbook` loads e.g. the "installing-tracking" playbook.
- Every skill has an explicit **human approval gate** before writes, sends, spending, or bookings.

### 3.1 Find and List Leads (CRM, Easy, 4 tools)

**Tools:** `g8_find_contacts`, `g8_find_companies`, `g8_create_list`, `g8_add_to_list`.

**Purpose:** turn a plain-language ICP into a saved list from **"graph8's open B2B data index"**.

**Credits:** search and previews are **free**; saving to a list *may* consume credits depending on plan.

**Steps:**
1. Extract titles, industries, locations, size, keywords. If ≥2 are missing, ask one clarifying question.
2. Preview with `g8_find_contacts`, page size 10–25 (free).
3. Show 3–5 sample rows plus the total. Iterate. For account-first motions, validate the company universe with `g8_find_companies`.
4. Confirm: "Save N contacts into a new list called <name>?"
5. `g8_create_list` with a dated name (e.g. `SaaS VP Sales - US - 2026-07`), then `g8_add_to_list`.
6. Report name, id, and count. Hand off to enrich or launch.

**Troubleshooting:**
- Loosen filters one at a time (seniority before title; widen geography last). Try title synonyms.
- For 100k+ matches, narrow the search or tier the list.
- `g8_tool_search("prospecting")`.

### 3.2 Enrich Stale Contacts (Enrichment, Easy, 4 tools)

**Tools:** `g8_get_lists`, `g8_search_contacts`, `g8_enrich_contacts`, `g8_get_enrichment_job`.

**Purpose:** waterfall enrichment (providers tried in order until verified data comes back) for email, mobile, and LinkedIn.

**Credits:** per contact **per data type**. Always preview the cost first.

**Steps:**
1. Find the list and count the gaps.
2. Preview the cost (N × data types) and get approval.
3. `g8_enrich_contacts` → job id.
4. Poll `g8_get_enrichment_job` after 30–60 s at sensible intervals; batches process in waves.
5. Report yield honestly (never 100%).
6. Hand off.

`g8_tool_search("enrich")`.

### 3.3 Launch an Outbound Sequence (Outbound, Intermediate, 7 tools)

**Tools:** `g8_gtm_get_global_context`, `g8_gtm_create_campaign`, `g8_gtm_get_campaign_sequence`, `g8_gtm_update_campaign_sequence`, `g8_gtm_attach_audience`, `g8_gtm_list_mailboxes`, `g8_gtm_launch_campaign`.

**Credits:** drafting is free; sending consumes credits and mailbox quota.

**Steps:**
1. **Load brand context** (`g8_gtm_get_global_context`) and ground every draft in it.
2. `g8_gtm_create_campaign` (name and objective). A created campaign is inert.
3. Draft 3–5 steps (day 0 opener, day 3 bump, day 7 angle change, day 12 breakup). Write them with `g8_gtm_update_campaign_sequence`, read back with `g8_gtm_get_campaign_sequence`, and show them verbatim.
4. `g8_gtm_attach_audience` with the list. State the count.
5. `g8_gtm_list_mailboxes`: check warmup and capacity; state the realistic daily rate.
6. **Launch gate:** summarize audience, steps, mailboxes, daily volume, and the fact that real emails will go out. Only launch (`g8_gtm_launch_campaign`) on an explicit yes, never on "looks good".
7. Suggest `g8_gtm_get_campaign_metrics` in a few days plus inbox triage.

Stop if mailboxes are cold. `g8_tool_search("campaign")`; campaign tools are "mostly always-on".

### 3.4 Prioritize Hot Accounts from Signals (Signals, Intermediate, 5 tools)

**Tools:** `g8_intent_pages_visitor_counts`, `g8_intent_page_visitors`, `g8_lookup_company`, `g8_create_list`, `g8_add_to_list`.

**Credits:** reading signals is free; identity lookups and saving *may* cost credits.

**Steps:**
1. Page visitor counts over the last 7 days (the default). Pricing, demo, integrations, and case studies outrank blog pages.
2. Pull visitors for the high-intent pages (repeat visits, recency).
3. Tier the accounts, enriching the top tier with `g8_lookup_company`:
   - A: high-intent page + repeated + recent
   - B: high-intent once
   - C: the rest
4. Confirm a dated list (e.g. `Hot signals - pricing - 2026-07`).
5. Save.
6. Hand off with urgency ("signals decay in days"): launch a sequence with signal-referencing copy, or book a meeting.

No data means tracking isn't installed; use `g8_load_playbook` "installing-tracking". Filter out ISP noise.

### 3.5 Triage and Reply Inbox (Inbox, Easy, 6 tools)

**Tools:** `g8_list_inbox`, `g8_get_reply`, `g8_get_reply_draft`, `g8_send_reply`, `g8_tag_reply`, `g8_assign_reply`.

Multi-channel: email, SMS, LinkedIn.

**Steps:**
1. List unhandled items.
2. Bucket them: positive / question / objection / not-now / unsubscribe / noise. Show counts plus the top 3–5 threads.
3. `g8_get_reply` for full context.
4. `g8_get_reply_draft`, then tighten it.
5. **Send gate:** show the exact text. Batch approval is OK; silent sending is not.
6. `g8_tag_reply` (e.g. `meeting-requested`, `objection-pricing`) and `g8_assign_reply`. Handle unsubscribes immediately.
7. Summarize.

Declines full autopilot and points to auto-reply-workflow instead.

**Relevance:** reply tags are a structured outcome signal usable by Flywheel.

### 3.6 Book a Meeting from a Hot Lead (Calendar, Intermediate, 4 tools)

**Tools:** `g8_appointments_get_availability`, `g8_appointments_create_booking`, `g8_get_contact_detail`, `g8_send_reply`.

**Steps:**
1. Contact detail (timezone, thread).
2. Real availability over the next 5–7 business days. Never invent times.
3. Branch:
   - Explicit intent: confirm the slot, then ask.
   - Vague: reply with 2–3 slots via `g8_send_reply` after approval.
4. **Booking gate:** a booking creates a real event and emails the invitee.
5. Confirm both directions.
6. Offer a `g8_create_task` reminder.

Needs an appointments event type configured. If the timezone is unknown, infer it and state the assumption.

### 3.7 Call Review and Follow-up (Voice, Intermediate, 4 tools)

**Tools:** `g8_voice_get_call_transcript`, `g8_voice_get_call_grading`, `g8_create_task`, `g8_create_note`.

Reading is free; only recorded graph8 dialer calls have transcripts.

**Steps:**
1. Locate the calls.
2. From the transcript, extract rep and prospect commitments, objections, dates, numbers.
3. From the grading: talk ratio, discovery quality, objection handling. Tie each weak grade to a transcript moment.
4. Propose tasks and a summary note.
5. Write on approval.
6. Give 1–2 coaching points.

Grading can lag the transcript. `g8_tool_search("voice"|"dialer")`.

**Relevance:** call objections are a Flywheel input.

### 3.8 Auto-Reply Workflow (Workflows, Advanced, 6 tools)

**Tools:** `g8_workflow_list_node_types`, `g8_workflow_describe_node_type`, `g8_skill_create_llm`, `g8_workflow_create`, `g8_workflow_validate`, `g8_workflow_update`.

**Credits:** each workflow execution calling an LLM skill consumes credits. The workflow ships **disabled**.

The doc notes that `g8_skill_*` tools author LLM/API skill records that workflow Action nodes execute. These are different from Skill Library entries.

**Steps:**
1. List node types and describe the reply trigger's output fields (sender, subject, body, thread). Don't guess them.
2. `g8_skill_create_llm` with **single-brace `{var}`** placeholders (`{{var}}` = literal). dry_run first.
3. Graph: trigger (reply received, scoped to a campaign or mailbox) → Action (LLM skill with input mappings) → delivery (draft-for-review by default).
4. `g8_workflow_create` with `enabled=false` (dry_run, then persist).
5. `g8_workflow_validate`. An unmapped placeholder means the model receives literal `{var}` text.
6. Explain in plain language, including the per-run credit cost.
7. `g8_workflow_update` with `enabled=true` only on approval. Test from a test address.

`g8_tool_search("workflow")` and `g8_tool_search("skill")`.

**Relevance:** this is the documented pattern for human-approved, durable automation: dry_run, then create disabled, then validate, then enable on approval. Flywheel can mirror it.

---

## PART 4 — Integrations, APIs, MCP tools named in scope files

**Integrations:**
- CRMs: Salesforce and HubSpot (two-way deals); Pipedrive (custom objects)
- Engagement: Engage sequencer; HeyReach (LinkedIn)
- Search: Google Search Console
- Hosting: Cloudflare Pages
- Ad platforms: Google Ads, LinkedIn Campaign Manager (OAuth), Meta and X (creative only)
- X API (shared or BYO)
- Security questionnaires: Google Drive, Slack, Jira, Linear, Vanta, Drata, SharePoint
- Review sites: G2, Capterra, Trustpilot
- WPForms
- Identity provider sync (Team)

**MCP tools named in scope files:**
- `g8_tool_search`, `g8_execute`, `g8_current_org`, `g8_load_playbook`
- `g8_find_contacts`, `g8_find_companies`, `g8_create_list`, `g8_add_to_list`, `g8_get_lists`, `g8_search_contacts`, `g8_enrich_contacts`, `g8_get_enrichment_job`, `g8_lookup_company`
- `g8_gtm_get_global_context`, `g8_gtm_create_campaign`, `g8_gtm_get_campaign_sequence`, `g8_gtm_update_campaign_sequence`, `g8_gtm_attach_audience`, `g8_gtm_list_mailboxes`, `g8_gtm_launch_campaign`, `g8_gtm_get_campaign_metrics`
- `g8_intent_pages_visitor_counts`, `g8_intent_page_visitors`
- `g8_list_inbox`, `g8_get_reply`, `g8_get_reply_draft`, `g8_send_reply`, `g8_tag_reply`, `g8_assign_reply`
- `g8_appointments_get_availability`, `g8_appointments_create_booking`, `g8_get_contact_detail`, `g8_create_task`, `g8_create_note`
- `g8_voice_get_call_transcript`, `g8_voice_get_call_grading`
- `g8_workflow_list_node_types`, `g8_workflow_describe_node_type`, `g8_skill_create_llm`, `g8_workflow_create`, `g8_workflow_validate`, `g8_workflow_update`

**Also relevant [XREF: MCP reference]** (`g8_gtm_*`):
- Campaigns: `create_campaign_document`, `get_campaign`, `get_campaign_document`, `list_campaign_documents`, `update_campaign_document`, `delete_campaign_document`, `create/update/delete_campaign_step`, `patch_campaign_full`, `update_campaign`, `list_campaigns`, `get_campaign_ideas`
- Global Context: `get/update/regenerate_global_context`, `get_company_profile`, `set_company_profile`, `list_intelligence_data`, `list_research_reports`, `update_research_report`
- ICPs and personas: `get_icps`, `create_icp`, `update_icp`, `archive_icp`, `get_personas`, `create_persona`, `update_persona`, `archive_persona`
- Knowledge base: `list_kb_documents`, `search_kb`
- Deliverability: `get_deliverability_metrics`, `get_mailbox_warmup`
- Pipelines: `list_stage_evidence_library`

**Not found in scope files:** REST endpoints, SDK methods, webhooks. Custom-record "workflow triggers" exist; Run Actions excludes "webhook actions". A Knowledge API is only linked.

---

## PART 5 — Gotchas, caveats, unfinished areas

1. **Thin pages** written as generic guidance with no specifics: Knowledge, Surveys, Radar, SEO. Their real capability detail lives in the MCP reference.
2. **Inconsistencies:**
   - Intelligence item lists differ between Global (13) and Intelligence (10).
   - "20 documents" per campaign, but 18 are listed.
   - Two skill systems with different placeholder syntax (`{{ }}` in Studio Skills vs `{ }` for MCP `g8_skill_create_llm`).
   - "Campaign" means both a Studio GTM campaign and a paid Ads campaign.
3. **Buying Committees** is behind an allowlist.
4. **Radar** has a 20-competitor cap. Scans are async and billable; avoid duplicate scans. Traffic figures are estimates.
5. **Social Listener** auto-pauses at 100% of the cap. Stub-contact creation can flood the CDP (use capture rules).
6. **Content crawl** is restricted to your registered domain, max 5,000 pages.
7. **Website Scrape depth** tops out at Deep (5 clicks + blog, 5–10 min).
8. **Signals** older than 30 days are excluded from scoring.
9. **Custom-record field keys are immutable.**
10. **Skill versions are pinned** in workflows and sequences, with no auto-upgrade.
11. **Rate limit:** too many concurrent actions per user; wait 30 s.
12. **Ads Launch permission** spends real money. Meta and X paid launches are undocumented.
13. **Performance feedback into campaign documents** is not documented in scope. Only the static "Performance Tracker" document exists, plus Engage traceability.

---

## PART 6 — HACKATHON RELEVANCE

### (1) Source Scout — discover and evaluate new external B2B data sources (directories, exhibitor lists, accelerator portfolios), score them against graph8 data, and acquire them into lists

**Existing overlap in scope:**
- **Scraping/crawling already exists in several places:**
  - Intelligence Website Scrape (Shallow/Standard/Deep).
  - Company Intelligence ("Website scrape" of *target* companies).
  - Content Deep Crawl (up to 5,000 pages, but **validated against your registered domain**, so it is not usable for third-party directories).
  - Sitemap import.
  - Landing-page "Clone Any URL" (any public page, competitors included).
  - Radar `g8_radar_discover_pages` (Firecrawl /map) and competitor scans **[XREF]**.

  So graph8 is not categorically "no-scraping". But none of these turn an arbitrary directory, exhibitor list, or portfolio page into *records*. They produce documents, content inventory, or snapshots.
- **Discovery of *companies*:**
  - Intelligence Competitor Discovery (SEO, paid ads, G2/Capterra category).
  - Trends company correlations.
  - Hiring Wave (companies posting matching jobs → decision-makers).
  - Visitors → Companies (IP-resolved) → Enrich → list.
  - Intent Search ("millions of enriched web pages").
  - Social Listener (auto stub-creates contacts from X authors into a "Social Signals" list with auto-enrichment). This is the closest analogue to "acquire an external source into a list".
- **Scoring against graph8 data:**
  - ICPs with tiers and a "Market size" estimate.
  - Studio Skills of type **List/Audience** ("Score every contact against our ICP"), A/B-testable, credit-tiered.
  - Run Action "Score this lead against our ICP".
  - Enrichment column (AI column on a list).
  - Signal score (0–100).
  - The Find-and-List-Leads skill queries graph8's **"open B2B data index"** via free previews. Source Scout could diff a scraped source against this: what share of the source's companies already exist in graph8, and what is net-new. Previews are free, so coverage checks are cheap.
- **Acquisition path:**
  - `g8_create_list` + `g8_add_to_list` (saving may cost credits).
  - `g8_enrich_contacts` waterfall (per contact per data type; preview the cost first).
  - Forms "Map Fields → target list" shows the field-mapping pattern.
  - **Custom Records** could model a "Data Source" object: Reference fields, an AI Field for the score, CSV/JSON export, workflow triggers. The docs literally list "Events: conferences, trade shows with attendee contacts" as an example object type, which is a natural home for exhibitor lists.
- **Guardrail patterns to copy:** free preview → cost preview → explicit approval → dated list names (e.g. `Source - <name> - 2026-09`).

**"No scraping" concern:**
- The docs show graph8 does web collection itself, but in scoped ways: own domain, competitor pages via a paid Firecrawl provider, X via the official API with TOS-safe, row-scoped storage.
- The Social Listener doc stresses TOS compliance (never indexed cross-tenant, never redistributed). This suggests graph8 cares about provenance and ToS.
- A Source Scout that scrapes arbitrary third-party directories into shared contact data could conflict with that posture. Nothing in scope documents a general "import from URL into list" feature.
- **Recommendation:** position Source Scout as *evaluate and score* sources and acquire via sanctioned paths:
  - Match discovered company names/domains against the graph8 index (`g8_find_companies`), then enrich.
  - Use official exports, CSVs, or APIs from the source.
  - Record provenance and ToS status per source, e.g. in a custom record.

### (2) Flywheel — analyze completed campaign outcomes and generate an improved campaign playbook V2 for human approval

**Where a campaign's messaging and targeting live** (the write-back targets):
- **Campaign documents** (20 per campaign; editable, auto-versioned):
  - Targeting: **Campaign Brief** (structured data) and **Targeting & Routing**.
  - Messaging: **Messaging & Objections**; **Email Copy** / **Email Prompt**; **LinkedIn Copy** / **Social Prompt**; Phone / Voicemail / Voice AI scripts.
  - **Reply Templates**, **Snippets**, **Cadence Calendar**, **QA Rubric**.
  - **Performance Tracker** is the natural place to record V1 outcomes and V2 hypotheses.
  - **Competitive Battlecard**.
  - **[XREF]** MCP: `g8_gtm_list_campaign_documents`, `g8_gtm_get_campaign_document`, `g8_gtm_update_campaign_document`, `g8_gtm_create_campaign_document`.
- **Step editor** (channel, day, mode, personalization low/med/high, conditions). This stays in sync with the channel-copy documents.
  - MCP: `g8_gtm_get_campaign_sequence`, `g8_gtm_update_campaign_sequence`, and **[XREF]** `g8_gtm_create/update/delete_campaign_step`, `g8_gtm_patch_campaign_full`, `g8_gtm_update_campaign`.
- **Audience:** `g8_gtm_attach_audience` (list-based).
- **Upstream Global Context** is shared by all campaigns: Messaging House, Value Props, Proof Catalog, Personas, ICPs/tiers.
  - MCP: `g8_gtm_get_global_context`, and **[XREF]** `g8_gtm_update_global_context`, `g8_gtm_update_icp`, `g8_gtm_update_persona`.
  - Learnings that generalize ("persona X doesn't respond to hook Y") belong here. Campaign-specific ones belong in campaign documents.
- **Safest V2 approach:** create a *new* campaign (or new versioned documents) rather than overwrite V1. Documents version automatically, but campaign↔sequence traceability and the "launch gate" argue for a V2 campaign shell that is created inert and launched only on explicit approval. This matches the launch-outbound-sequence pattern.
- **After writing V2:** the **Campaign Dashboard / Readiness Score** regenerates on significant document changes. **[XREF]** Readiness is 0–100, <75 = gaps, with ready / needs_work / not_ready, plus per-document **Health Scores** good / warning / poor. Use these as an automated quality check on V2 before the human review.

**Outcome data sources available:**
- `g8_gtm_get_campaign_metrics` (Engage sequence performance, traceable to the Studio campaign)
- **[XREF]** `g8_gtm_get_deliverability_metrics`
- **Signals → Visitors → Campaigns** (visits and visit→form conversion per campaign)
- Landing-page visits attributed to the campaign
- Ads Active Campaigns metrics (spend, impressions, clicks, CTR, via Refresh)
- Inbox reply classifications and tags (`g8_tag_reply`, e.g. `objection-pricing`, `meeting-requested`)
- Call transcripts and grading (objections)
- Deal Signals and pipeline stages (Closed Won/Lost)
- Signal score trends
- Buying Committee strength
- NPS/CSAT surveys (not linked to campaigns)

**Existing feedback and learning loops to cite or reuse:**
- **Radar performance loopback [XREF]:** gaps → opportunities (now/next/later) → approved initiatives (lanes now/next/later/live/done). `g8_radar_measure_initiatives` writes "content-progression + rival-traffic outcome signals" onto active initiatives. It is free, DB-only, and runs on a weekly sweep. This is the closest existing "measure the outcome of an action and write it back" loop, but it covers competitive and content initiatives, *not* outbound campaigns.
- **Content Grids:** before/after SEO score per row (a measured refresh loop). `g8_radar_optimization_runs` shows Radar-spawned refresh grids.
- **Studio Skills A/B testing** (A vs B on 10 records, winner published) plus version pinning and Deprecated/Archived states. This is a model for versioned playbook V1→V2 with rollback.
- **Security Questionnaire answer library:** approved answers are fed back, confidence-scored, and review-cadenced. A clean "learning from human approvals" design to mimic.
- **Copilot Memory** (automatic, but opaque) and **Saved Intelligence** (action results saved to records are auto-used later).
- **Knowledge "Add/Amend → proposal → review status"** is a documented propose-then-approve pattern. A Flywheel V2 could be submitted as a Knowledge proposal.
- **Auto-Reply Workflow pattern:** dry_run → create **disabled** → validate → enable only on explicit approval. Directly reusable for "generate V2, hold for approval".

**Gap (the hackathon opportunity):**
- The in-scope docs contain no documented loop that takes Engage sequence outcomes (replies, meetings, objections, conversions) and rewrites the campaign's documents or steps.
- The "Performance Tracker" is a document, and the Readiness Score measures *pre-launch* quality, not results.
- "Document health" and "Campaign Passport" appear only in training pages, not in the Studio reference.
- Flywheel would fill this gap by joining metrics, reply tags, and call objections to the campaign's Messaging & Objections, Email Copy, Targeting & Routing, and step settings, then proposing a V2 through the approval-gated MCP write tools.
