# graph8 Knowledge Base: AI Features and Analytics

Source: 20 plain-text pages from docs.graph8.com (`ai-features*`, `analytics*`), all read in full. Everything below comes from those pages. Where the docs are vague, aspirational or inconsistent, that is noted.

**Global observations across these 20 pages**
- **No `g8_*` MCP tool names, REST endpoints, or SDK methods are documented on any of these pages.** The only programmatic surfaces mentioned are:
  - voice webhook events (`call.*`, `agent.flagged`)
  - bridge inbound webhook signature schemes
  - workflow "Webhook" trigger/core nodes
  - user-registered MCP servers (Agents → MCP Servers)
  - "MCP" and "API key" appearing as connection types in Profile → Apps → Connections
- **Quality varies a lot.** Some pages are specific and read like the shipped product: Copilot, Bridge, Enrichment, Voice Agents, Workflows, Sales Coach, and all the Analytics pages. Others are generic marketing templates with no menu paths, fields or credit numbers: Content Generation, Lead Scoring, Research. Those also have illustrative example percentages and emoji checkboxes.
- **Naming is inconsistent.**
  - The "Skills" page (`/ai-features/skills/`) is titled "Agents & Actions" and uses the word "Actions". Voice Agents and Workflows call the same thing "Skills" (runtime types LLM/API/Script).
  - Two menu paths appear for agents: "Agents → Create Agent" and "Agents → Agents → New".
- **Global context underpins everything.** Almost every AI feature grounds itself in the org's "global context": 44 generated documents, created in **Studio → Global**.

---

## 1. AI Features landing page (`/ai-features/`)
- An index page only. It lists Overview, Content Generation, Lead Scoring and Research, and describes AI "from data enrichment and inbox management to campaign creation and sales coaching."
- It has no feature detail. The left nav order (from the Previous/Next links) runs:
  1. Overview
  2. Agents & Actions (skills)
  3. Workflows
  4. Sales Coach
  5. Voice Agents
  6. Enrichment
  7. Copilot
  8. Copilot Bridge
  9. Content Generation
  10. Lead Scoring
  11. Research
  12. Analytics Overview

## 2. AI Features Overview (`/ai-features/overview/`)

**What it is:** a map of every AI capability and where it lives in the app.

| Feature | What it does | Location |
|---|---|---|
| Copilot | Chat assistant for lookups, deals, navigation | Top nav sidebar |
| Enrichment | Waterfall enrichment, AI formulas, staging tables | Data → Workbench |
| Content Generation | AI emails, subject lines, call scripts | Sequencer, Inbox, Studio |
| Voice Agents | AI phone agents, outbound and inbound | Engage → Voice Agents (other pages say Agents → Agents) |
| Lead Scoring | Scoring on signals, fit and engagement | Data → Contacts |
| Sales Coach | Deal coaching, objections, next steps | Agents → Sales Coach |
| Skills | Reusable AI capabilities agents use | Agents → Skills |
| Workflows | Chain skills into automated workflows | Agents → Workflows |
| Research | Company research, competitive intel | Studio → Companies |
| Copilot Bridge | Copilot via WhatsApp/Slack/Roam/iMessage | Profile → Apps |

**Global context:** "44 documents that graph8 generates about your business." Named examples:
- Brand brief
- Value propositions mapped to personas
- ICPs and personas
- Competitive intel
- **Campaign Intelligence Brief**, described as "a pre-extracted summary of all context"

You set this up in Studio → Global before using the AI features. The docs stress that output quality depends on it.

**Credits (headline table)**

| Action | Cost |
|---|---|
| Contact enrichment | 1 credit per match |
| AI email generation | 1 credit per generation |
| Copilot interaction | 1 credit per exchange |
| Voice agent call | Based on call duration (no rate given) |
| AI formula (staging) | 1 credit per row processed |

- Usage is shown in Settings → Billing → Usage.
- Credits refresh monthly according to plan.
- **Inconsistency:** Bridge says one exchange costs "1–10 credits depending on tools invoked", which conflicts with the flat 1 credit here.

**Getting started order:** global context → enrich → try Copilot → generate content in Sequencer → enable Lead Scoring.

## 3. Copilot (`/ai-features/copilot/`)

**What it is:** a built-in chat assistant, opened from the Copilot icon in the top nav. It is available on every page as a sidebar. It searches the CRM, looks up contacts, checks deals, manages sequences, searches the web and navigates the app.

**Chat modes (5)**

| Mode | Purpose |
|---|---|
| Global | General questions and CRM lookups |
| Document | Skill-matched editing of Studio campaign docs |
| Web Search | Live internet data (a toggle) |
| Thinking | Extended step-by-step reasoning (a toggle) |
| Research | Dual-provider search (company + general) |

**Context modes (5):** these switch automatically with the page, or can be toggled by hand.

| Context | Focus | Notes |
|---|---|---|
| General | Cross-functional | Deal creation available |
| Contacts | Lookup, company intel, ICP fit | |
| Deals | Pipeline, at-risk deals, stage updates | Deal creation available |
| Inbox | Email, mailbox health, chat history | |
| Sequencer | Sequence stats, pause/resume, step editing | Step editing is only available here |

Viewing a Studio campaign document switches Copilot to a specialised skill ("Studio Copilot", covered in a separate doc, with slash commands).

**Tool categories**
- Contacts (search, details, the contact's deals and company)
- Companies (signals, engagement, ICP fit scores)
- Deals (list, risk, create, update stage)
- Lists (browse, create)
- Campaigns (list, metrics, **create and publish**)
- Sequences (list, pause, resume, duplicate, reports)
- Inbox (emails, chats, mailboxes, tags)
- Calendar
- Phone (numbers and assignments)
- Enrichment (person or company on demand)
- Navigation
- Knowledge Base search
- Documents (create, update, manage campaign docs)
- Landing Pages (edit via chat)
- Analytics (call analytics, visitor activity, dialer sessions)
- Voice Agents (list, capabilities)

Tool names are not given.

**Approval gates:** a confirmation dialog with Approve/Cancel appears before:
- creating a contact list
- publishing a campaign
- deleting a document

**Memory (4 scopes)**

| Scope | Examples |
|---|---|
| Org | Positioning, brand voice preferences |
| User | Preferred tone, common requests |
| Campaign | Target audience notes, messaging decisions |
| Company | Stakeholders, deal history |

The docs do not explain how memory is written or read.

**Collaboration:** @mentions notify teammates, who can then join the session. Sessions can be shared.

**Sessions:** pin, rename, delete, restore. Each response can be rated thumbs up/down, regenerated or copied.

**Credits**
- Simple lookup: 1 credit
- Web search: extra credits per query (amount not given)
- Multi-step actions: scale with the number of tools used

**Example prompts relevant to campaigns:**
- "How is the Q2 outbound sequence performing?"
- "How is the ABM campaign performing?"
- "Find recent funding announcements for companies in our pipeline"

## 4. Copilot Bridge (`/ai-features/bridge/`)

**What it is:** a per-user way to use the full Copilot tool set from messaging apps. It lives at **Profile → Apps**, with sub-tabs Setup and Connections.

It is different from the workspace-wide integrations:
- Settings → Integrations → Slack: notifications to channels
- Settings → Integrations → Roam: syncs meeting transcripts into the inbox

**Platforms and setup**
- **WhatsApp**
  - Identified by phone number (digits only, with country code).
  - Runs on graph8's self-hosted **GOWA** server.
  - The number goes into a routing index. **One number maps to exactly one org.**
- **Slack**
  - OAuth install, then you pick your Slack user from a list.
  - The bot only has DM access.
  - Identified by Slack user ID, so switching workspaces means reconnecting.
- **Roam**
  - OAuth, then you pick a group or DM as the routing target.
  - Connections made before March 2026 must reconnect to get new scopes.
- **iMessage**
  - Phone or email.
  - Runs on a self-hosted **BlueBubbles** server and depends on Apple APNs, so it can be slow.

**Example uses**
- "What do we know about Acme Corp?" (enrichment + signals + deal)
- Top 5 leads this week (CDP by recency + score)
- Replies from Stripe
- Enrich an email
- Add Jane to the Q2 Outbound list
- Summarize a deal
- Draft a follow-up
- Campaign performance, pipeline forecast, unread threads

**Tool availability**
- Search: contact, company, deal, inbox
- CRUD: create contact, update deal stage, add to list, add to sequence
- Enrichment: single contact, find people
- Analytics: pipeline forecast, campaign performance, sequence stats
- Web research: **Deep model tier only**
- Actions: run a Skill, send an email, draft

Tools that send or modify ask for confirmation in the thread.

**Connections table columns:**
- Platform: WhatsApp / Slack / Roam / iMessage / **MCP / API key**. This is the only hint on these pages that MCP and API-key connections exist per user.
- Identifier
- Connected
- Last Active
- Status: Active / Expired

Disconnect takes effect immediately and keeps history. Reconnect refreshes an expired OAuth token.

**History:** Copilot sidebar → History tab → filter by "Bridge" mode. Sessions are separate per platform.

**Privacy**
- Scoped to the user. Admins need "explicit elevation" to view.
- Every action is audited at **Settings → Activity**, recording platform, message, tool calls and credit cost.
- Retention is 90 days by default, configurable in Settings → Compliance.

**Webhook verification (inbound)**

| Platform | Scheme |
|---|---|
| WhatsApp | HMAC-SHA256 in `X-Hub-Signature-256` (GOWA secret) |
| Slack | HMAC-SHA256 + timestamp (Slack signing secret) |
| Roam | Svix (`x-svix-signature`, `x-svix-timestamp`, `x-svix-id`) |
| iMessage | Internal password validation |

**Coming soon:** Auto-Match. It would match users to bridge connections by platform email versus their graph8 **PropelAuth** email (this reveals graph8 uses PropelAuth for auth). Until it ships, you pick users by hand.

**Troubleshooting**
- WhatsApp echo loop: GOWA webhook misconfigured.
- Slack picker is missing your user: the Slack email differs from your graph8 email.
- Slack OAuth fails: the bot was uninstalled.

**Best practices:** reconnect every quarter. Each connection costs credits when it routes a message.

## 5. AI Content Generation (`/ai-features/content-generation/`)

**What it is:** AI-written outreach. The page gives **no menu path** (Overview says it lives in Sequencer, Inbox and Studio).

**Quick Compose:** select a prospect → **AI Compose** → choose a type (Cold outreach / Follow-up / Meeting request / Re-engagement) → review and edit → send.

**Inputs:**
- Prospect name and title
- Company info
- Industry
- Previous interactions
- Your product
- (FAQ) company news and custom fields

**Features**
- **Subject Line Generator:** multiple variants, and an **A/B test** where you pick 2–3 and "AI tracks performance, learn what works". The mechanism is not described.
- **Personalization Suggestions:** hooks from news, job changes, funding, launches and social activity, plus a suggested opener.
- **Call Scripts:** discovery, demo, follow-up and objection handling. Components are opening hook, qualification questions, value prop, objection responses and CTA.

**Settings**
- Tone: Professional / Casual / Formal / Friendly
- Length: Short (2–3 sentences) / Medium (1 paragraph) / Long
- Focus: Problem / Solution / Benefit / Question

**"Train the AI":** rate content, give feedback, save the best examples as templates; "AI learns your style". This is vague, with no mechanism described.

**FAQ**
- Regenerate button.
- English only (multi-language "on the roadmap").
- Generation takes 2–5 seconds and runs in the background if you navigate away.

**Assessment:** generic. There are no credit specifics here (Overview says 1 credit per generation). The "{company}" placeholders are illustrative.

## 6. AI Lead Scoring (`/ai-features/lead-scoring/`)

**What it is:** a 0–100 score per lead. Overview places it at Data → Contacts. The page itself has no UI path or setup steps.

**Inputs:**
- Firmographics
- Demographics
- Behavior (opens, clicks, visits)
- Intent (research, competitor visits)
- ICP fit

**Bands**

| Score | Band | Suggested action |
|---|---|---|
| 80–100 | Hot | Call now |
| 60–79 | Warm | Email today |
| 40–59 | Neutral | Nurture |
| 20–39 | Cool | Low priority |
| 0–19 | Poor fit | Deprioritise |

**Components**
- **Fit (0–50):**
  - Company size +10
  - Industry +10
  - Title/seniority +15
  - Location +5
  - Technology +10
- **Engagement (0–50):**
  - Email open +5 each
  - Click +10 each
  - Visit +5 each
  - Content download +15 each
  - Meeting booked +20

The docs do not say whether per-event engagement points are capped at 50.

**Uses**
- Sort and prioritise.
- Route to reps: Hot → senior reps, Warm → all reps, Cool → SDR team.
- Trigger automation: score hits 80 → alert; drops below 40 → nurture; rises 20+ → create task. How these are configured is not documented; presumably through Workflows or routing.

**Customising**
- Weights (e.g. company size 2x, industry 1.5x, location 0.5x).
- Custom signals (technologies, titles, custom fields, **list membership**).
- ICP definition (size, industries, titles, locations).

**Score analytics**
- Distribution (the example percentages are illustrative).
- **Score accuracy**: conversion rate by band, "adjust model based on results".
- Trends: rising, falling, sudden.

**FAQ / constraints**
- Engagement updates in real time. Fit recalculates daily.
- **Scores cannot be edited manually.** Use tags or custom fields instead.
- Drops usually mean bounce, unsubscribe, spam flag or ICP change.
- **Only one global scoring model.** There are no per-segment models.

**Assessment:** a generic-looking page. It somewhat conflicts with Enrichment's AI-formula scoring ("Score this lead 1-10") and Voice's "qualification score 0–100".

## 7. AI Research Assistant (`/ai-features/research/`)

**What it is:** instant company and contact research. Overview places it at Studio → Companies. The page itself says: open a company profile → **AI Research** → view → save findings.

**Company profile output:**
- Overview
- Products
- Recent news
- Key executives
- Tech stack
- Funding
- Competitors

(The example is a fictional Acme Corp.)

**Contact research:**
- Career history
- Recent activity
- Mutual connections
- Interests
- Communication style
- Personalization hooks

**News monitoring**
- Company alerts: funding, leadership changes, launches, partnerships, acquisitions.
- Industry news: trends, competitor moves, regulation, tech shifts.

**Competitive intelligence**
- Competitor tracking: product updates, pricing, customer wins/losses, campaigns.
- AI **battle cards**: strengths, common objections, win themes, proof points.

**Research settings**
- Sources: company website, LinkedIn, news, press releases, social. **Paid databases are off by default** and used only if connected.
- Refresh frequency: real-time (hot leads) / daily (active deals) / weekly (general).

**FAQ**
- Data is mostly within 30 days old.
- Findings save to prospect/company records and are shared with the team.
- **You can research a company not in the DB by entering its domain, then save it as a new account.**
- Counts toward AI usage limits (no numbers given; Enterprise plans have higher or unlimited limits).

**Assessment:** generic and vague. There are no credit costs, no API, and no description of how alerts are delivered.

## 8. Agents & Actions, i.e. "Skills" (`/ai-features/skills/`)

**What it is:** AI agents you build and deploy on phone, email, web chat or internal workflows. Each has a persona, a knowledge base and a set of actions.

**Types**
- **Agent:** custom persona.
- **Twin:** cloned from a real person's LinkedIn URL. graph8 extracts their profile, writing style and background, and you can upload writing samples (emails, posts). Used for outbound that sounds like that person.

**Create:** Agents → Create Agent, then set:
- Name
- Role (SDR, support, researcher…)
- Persona sliders: formality, conciseness, assertiveness
- Instructions
- Identity: phone number, voice (preset or clone), calendar
- Actions and knowledge collections

**Action types**

| Type | Runs | Example |
|---|---|---|
| LLM | Prompt template | Research company, draft email, score lead |
| API | External endpoint | CRM lookup, notification |
| Script | Custom code | Transform, calculate scores |
| Workflow | Multi-step workflow | Lead qualification pipeline |

**Templates (15+ built in):**
- Company Research
- Contact Dossier
- Competitor Analysis
- Keywords Research
- FAQ Generation
- Content creation (social posts, emails, summaries)

**Approval:** turn on **Requires Approval** per action. The agent pauses, and you approve or reject from the execution history.

**Action Execution Input dialog:** a form that walks you field by field through the action's **input schema**, with required fields marked and hints inline. The same form is reused inside agent chat.

**Workflows (summary):** Agents → Workflows, in Visual (ReactFlow) / Simple / Code (JSON) modes.

| Node | Purpose |
|---|---|
| Start | Entry point, trigger and input data |
| Action | Runs an LLM, API or script action |
| Agent | Hands off to another agent |
| **Tool** | Calls an MCP server tool |
| Condition | Branches on data |
| Loop | Repeats over a list |
| Transform | Reshapes data between steps |
| State | Stores intermediate state |
| Human | Pauses for approval |
| Handoff | Transfers to a human or another system |
| End | Completes the workflow |

Templates here: Lead Qualification, Content to Social Media, and your own saved templates.

**Knowledge Collections:** Agents → Collections. Upload PDFs, docs and spreadsheets, organise them in folders, and attach them to agents, which retrieve from them.

**MCP Servers:** Agents → MCP Servers → Create Server.
- Transports: **SSE** (remote URL) or **Stdio** (local process).
- You test the connection, and graph8 caches the tool list.
- **MCP tools appear as Tool nodes in workflows and are available to agents in chat.** This is a key extensibility hook: you can plug a custom MCP server into graph8 agents and workflows.

**Agent Chat:** a Chat tab on the agent detail page, with a side panel showing tool executions. Sessions are saved.

**Agent Analytics:** call analytics, activity feed, and execution history with inputs and outputs.

## 9. Workflows (`/ai-features/workflows/`)

**What it is:** multi-step automation at Agents → Workflows. Create → trigger → steps → activate.

**Triggers:**
- New website visitor
- Form submitted
- **New intent signal**
- **Webhook**
- Manual run
- (in How It Works) new contact added, deal stage changed

**Builder modes:** Visual / Simple / Code. Switching between them converts the workflow automatically.

**Node palette**

| Category | Nodes |
|---|---|
| Core | Start, End, Trigger, Webhook |
| Actions | Action (LLM/API/Script), Agent, Built-in Tool (web search, knowledge search) |
| Control Flow | If/Else, Loop (for-each / while / times), Human Approval |
| Data | Transform (map / filter / extract / format), Set Variable |
| Multi-Agent | Handoff (with context) |
| Integrations | Add to List, Add to Sequence, Send Email, Send Slack Notification, Send Roam Notification |

**Variables:** `${input.field_name}`, `${step1.result}`, `${stepN.result}`. They work in any text field of a node.

**Integration actions**
- **Send Email:** send or draft through a connected mailbox, with to, subject, content, CC/BCC.
- **Add to List:** add to a CDP list via field mapping.
- **Add to Sequence:** enrol, with an optional list association.
- **Slack:** channel or DM mode.
- **Roam** notification.
- **Round-Robin Assignment:** a rep pool with weighting and skip-rules.
- **Visitor Enrichment:** fills several fields in one call (work email, phone, title, company size…).

**Error strategy per node**
- Stop
- Continue
- Retry (attempts, delay, fixed or exponential backoff)
- Fallback node

**Skills in workflows:** skills are "reusable AI action definitions with a fixed prompt, input schema, and output format". In a workflow they appear as Action nodes with `runtime_type: llm`. Skill template categories:
- Sales (lead qualification, company research)
- Marketing (summarisation, social posts)
- Support (ticket analysis, KB search)
- Research (competitive analysis, meeting prep)

**Workflow templates**

| Template | Steps |
|---|---|
| Lead Qualification | Research company → qualify → draft email |
| Content to Social Media | Summarise → LinkedIn post → Twitter thread |
| **Contact Data Enrichment** | Enrich company → validate email → contact summary |
| Customer Support | Analyse ticket → search KB → draft response |
| Meeting Preparation | Research attendees → agenda → discussion points |
| **Competitive Intelligence** | Research competitor → analyse features → comparison report |

**Monitoring**
- Run statuses: running / completed / failed / paused.
- Per-node results, duration and errors.
- Human Approval nodes pause the run.
- A **Test Execution** dialog runs with sample data without triggering real actions.

**Best practices**
- One workflow per outcome.
- Chain workflows via webhooks.
- Put Human Approval before sends or enrolments.

## 10. Sales Coach (`/ai-features/sales-coach/`)

**What it is:** deal-specific AI coaching at **Agents → Sales Coach** (select a deal or account → review → apply). It is grounded in global context rather than generic sales tips.

**Coaching areas:**
- Deal strategy
- **Objection handling**
- Meeting prep
- Competitive positioning
- Risk assessment
- **Email coaching** (messaging and follow-up timing)
- Discovery frameworks (BANT / MEDDIC / SPICED)

**Where it surfaces**
- **AE Cockpit** decision queue:
  - Meeting Prep cards
  - At-risk alerts with recovery actions
  - Post-meeting follow-up cards
  - **Coaching Insight cards**: "AI-generated coaching tips based on your patterns and performance"
- **Revenue → Prospects → deal → Intelligence tab:**
  - Competitive positioning
  - ROI analysis
  - Next steps
  - Risk indicators
- **Pre-meeting briefings:**
  - Pushed to the Cockpit
  - Shown on the meeting detail page in the inbox
  - Optionally emailed 30 minutes before

**Inputs: global context docs**
- Brand brief
- Value props
- ICPs/personas
- **Competitor teardowns**
- **Battle cards**
- **Proof catalog**
- **Buyer psychology** (decision frameworks, **objection patterns**, triggers)
- Industry analyst reports

**Inputs: per-deal data**
- Stage
- Value
- Buying committee
- Activity timeline
- Engagement signals
- Competitor mentions

**Objection handling**
- Paste an objection, **or it is auto-detected from inbox/call transcripts**.
- Returns:
  - The underlying concern
  - A response framework (from battle cards)
  - Proof points
  - Follow-up questions
- Competitive objections pull in the competitor teardown.

**Meeting prep:** Generate Prep, ready in 10–30 seconds. Covers:
- Attendee research
- Account context
- Agenda
- Discovery questions
- Talking points
- Likely objections

**Post-meeting:** for recordings from Roam, Gong or another integrated provider:
- Transcript analysis
- Framework summary
- Action items and gaps
- Follow-ups as Cockpit decisions
- Flagged coaching moments (missed discovery, unanswered objections)

**Competitive positioning:** a detected mention produces:
- Strengths to lead with
- Weaknesses to highlight
- Trap questions
- Switch case studies

**Risk signals (defaults)**
- Engagement drop for 7+ days
- Champion silent 14+ days
- Stage stalled 21+ days
- Late stage with no Decision Maker
- Single-threaded deal
- Rising competitor mentions

Each becomes a Cockpit card.

**Manager view:** Agents → Sales Coach → Team.
- Per-rep scorecard
- **Top objection types across the team**
- Common discovery gaps
- Wins
- Risk concentrations

**Settings:** Agents → Sales Coach → Settings.
- Framework
- Risk thresholds
- Pre-meeting timing
- Aggressiveness: Conservative / Balanced / Aggressive
- Auto-generate vs on-demand

**Credits**

| Action | Cost |
|---|---|
| Pre-meeting brief | 5–10 |
| Post-meeting summary | 5–10 |
| Objection handling | 1–3 |
| Deal risk (per deal, daily) | 2–5 |
| Competitive positioning | 1–3 |

"Daily auto-generated coaching across your pipeline is included in standard usage". This contradicts the per-deal daily cost and is left unexplained.

**Assessment:** deal- and rep-level, not campaign-level. It aggregates objections for managers but does not rewrite campaigns.

## 11. Voice Agents (`/ai-features/voice-agents/`)

**What it is:** AI personas that make and receive calls, generate personalised copy and answer email. Found at Agents → Agents → New → Agent or Twin.

**Persona tab**
- Role: SDR / AE / Receptionist / CSM / GTM Engineer / Intake / Custom.
- Formality: 0.1 / 0.5 / 0.8.
- Conciseness: 0.1 / 0.5 / 0.8.
- Assertiveness: 0.1 / 0.5 / 0.8.
- Persona Prompt.
- Outbound and Inbound Call Instructions.
- Voicemail Message. Variables are `{first_name}`, `{bot_name}` and `{company_name}`; it falls back to the org default.

**Identity tab**
- Twilio phone number (required for calls).
- **Cartesia** preset voices (Michael, Sarah, David, Emma…).
- Calendar appointment type.
- Company Knowledge toggle.

**Voice cloning (twins only):** Custom voice → record up to 10 seconds or upload WAV/MP3 → clone. Cloned voices are reusable across the org. Twins inherit their source agent's persona, role and voice.

**Knowledge**
- Company Knowledge: description, services, products, pain points, value prop, pitch, FAQs, audience, competitive advantage.
- Up to **4 collections per agent** (chunked and vectorised).

**Skills (runtime types)**
- LLM: temperature and token limits.
- API: method, headers, body template, auth.
- Script: Python, JS or TS, timeout up to **300 seconds**.
- Optional approval.
- Execution history records input, output, duration, tokens and cost.

**On-demand content generation at send time**
- Per-contact Email, LinkedIn message, Call Script and Voicemail.
- Uses Global Context, campaign documents and contact enrichment.
- Applies the twin's tone profile.
- "No static templates needed."

**Calls**
- Outbound via Twilio or Telnyx, linked to a campaign and sequence step for attribution.
- The callback returns transcript, summary, disposition, sentiment, recording and duration.
- Inbound falls back to voicemail or queues for an SDR to claim.

**Outbound Playbooks:** a structured script pasted into Outbound Call Instructions. Sections:
- Opening (15 seconds)
- Discovery (2–4 questions)
- Value pitch
- **Objection handling (top 5 objections)**
- Close

The docs claim you can "A/B test scripts" but give no A/B mechanism. The recommendation is one playbook per persona.

**Receptionist routing (first match wins)**
- Rule types: keyword, intent classification, business hours, caller identity, voicemail fallback.
- Actions: transfer to a human (warm or cold), transfer to another agent, take a message, book a meeting, hang up.
- A warm transfer adds about 10 seconds.

**Post-call summary fields:**
- Disposition (Booked / Callback / Not Interested…)
- Summary
- Key points (topics, **objections**, commitments)
- Next steps
- Sentiment
- **Qualification score 0–100**
- Intent signals

Summaries push to the CRM as notes and to the Inbox timeline.

**Coaching loop:** calls are auto-flagged for:
- Low qualification score
- **Unresolved objections**
- Frustration transfers
- Long silences or interruptions

Flags carry timestamps and appear in the Activity tab. The recommended loop: review 10 flagged calls weekly → find the top 3 gaps → **update the playbook** → redeploy → "measure conversion delta". This is a **manual** improvement loop.

**Webhook events:** configured at Settings → Developer → Webhooks, signed with HMAC-SHA256.
- `call.started`
- `call.answered`
- `call.ended`
- `call.transferred`
- `call.voicemail`
- `call.summary.generated`
- `agent.flagged`

**Compliance**
- Recordings kept 90 days (extendable).
- Transcripts kept indefinitely.
- Two-party-consent states get an automatic notice.
- The DNC list is scrubbed automatically.

**Testing:** Test Digital Agent.
- Outbound test call with a live transcript (Dialing → Ringing → Active → Completed).
- Inbound test.
- Email Respond scenarios: Billing, Technical Support, Sales Inquiry, Feature Request, Service Complaint.
- Email Compose.

**Activity and analytics**
- Filters: Calls / Skills / Workflows.
- Analytics tab: total calls, success rate, average and total duration.

## 12. Enrichment (`/ai-features/enrichment/`)

**What it is:** a waterfall across providers. It queries A, then B, then C, and **you pay only for the provider that matches**.

**Entry points**
- Single contact: Enrich.
- Bulk: Data → Contacts or a list → select → Enrich. You see a **credit estimate** first, then it runs in the background.
- **Staging table:** Enrich on the toolbar, with a field selection.

**Staging tables (Data → Workbench → Create Table)**
- Sources:
  - Search results (people/company)
  - **File upload (CSV, Excel, paste)**
  - CRM sync
  - **Find People**
- Actions:
  - Add columns
  - Enrich
  - AI columns
  - **Export to list**
  - **Send to sequence**
- **Auto-Enrich:** a toggle so new rows enrich on arrival, with a choice of fields and a **daily credit limit**.

**AI formulas:** Add Column → AI Formula.
- Write a plain-language prompt (e.g. "Score this lead 1-10 based on ICP fit") and pick the input columns.
- It runs across all rows at **1 credit per row**.
- Uses: ICP scoring, persona classification, summaries, cleanup and dedupe.
- **Every output has a confidence score (0–100)**, so you can filter, e.g. export only rows above 70.
- **AI presets:** intent classification, lead scoring, company analysis. You can save your own formulas as templates.
- Empty input rows are skipped.

**Provider configuration:** Settings → Enrichment.
- Providers: Apollo, Hunter, Clearbit, Prospeo, Dropcontact and "more".
- Set the order, credentials, rate limits and daily caps.
- Put the best providers first.

**Find People:** from a staging table.
- Filters: titles, seniority, departments, companies.
- Results populate the table; you then enrich them.
- 1 credit per contact discovered.

**Routing rules (after enrichment)**
- Add to list (e.g. valid email → "Outbound Ready")
- Add to sequence (high ICP → auto-enrol)
- Tag

**Credits:** email, phone and company lookups are 1 credit per match each. Find People is 1 per contact. The tip says to **score with AI formulas before enriching**.

**Other**
- **Dynamic columns** (no AI): concatenate, extract domain from email, format. They update automatically.
- **Job management:** progress bar, per-record status, pause/resume/cancel, retry failed. Runs chunked in the background.
- **Connections:**
  - CRM (Salesforce, HubSpot…)
  - **Scheduled syncs (recurring imports)**
  - Two-way sync back to the CRM

**Troubleshooting:** name + company matches better than email alone.

---

# Analytics

## 13. Analytics Overview (`/analytics/overview/`)

**What it is:** a website analytics snapshot. The data comes from the graph8 tracking script.

**Metrics (each with a trend):**
- Unique Visitors
- New Visitors
- Sessions
- Page Views
- Bounce Rate
- Avg Session Duration

**Top Traffic Sources:** a bar chart of Direct, Organic Search, Paid Search, Social, Email, Referral and **AI/LLM**.

**Audience Trend:** a line chart of users, new users, sessions and page views.

**Controls**
- Date range: 1–365 days.
- **Stream selector** (for multiple websites).
- **Browser key** (tracking key).

**Trend calculation:** the second half of the period compared with the first half. For 30 days, that is days 16–30 against days 1–15. There is no true prior-period comparison.

## 14. Marketing Intelligence (`/analytics/marketing-intelligence/`)

**What it is:** connects web analytics to the outbound pipeline, from anonymous visitor to meeting.

**Cards**
- Qualified Traffic (identified visitors and identification rate)
- Engagement Quality (average time and trend)
- Campaign Influence (top campaign by influenced contacts)
- Pipeline Impact (meetings and replies)

**Outbound Bridge funnel:** Web Visitors → Identified Visitors (identity resolution) → Added to Outbound (enrolled in sequences) → **Replied** → **Meetings Booked**. Summary stats:
- Identification Rate
- Outbound Conversion
- Reply Rate

**Campaign Attribution table:** columns are campaign (**from UTM**), visitors, Engaged, Identified, Added to Outbound, **Reply Rate**, **Meetings Booked**. It is sortable. "Engaged" means more than one page and more than 30 seconds.

**Engagement Trend:** a daily line chart.

**Content Performance:** page, views, uniques, identified, added to outbound, **reply rate of contacts who visited the page**, meetings booked.

**Assessment:** campaigns here are UTM/web campaigns. It is unclear whether these link to Sequencer campaigns.

## 15. Realtime (`/analytics/realtime/`)

**What it is:** a live site view that refreshes **every 10 seconds**.

**Windows:** 5 minutes and 30 minutes for Active Users and Page Views.

**GTM metrics**
- Identified Visitors
- **High Intent Visitors** (repeat visits, high engagement)
- Campaign Visitors

**Other views**
- Active Locations map.
- Active Pages.
- Traffic Sources.
- **Live Visitors:**
  - Visitors mode: visitor (name or anonymous ID), **Company (via IP or contact match)**, current page, time on page, session start, Known/Anonymous, Active/Idle.
  - **Companies mode:** company, active visitors, recent activity.
  - Controls: 5 minutes / 30 minutes / 1 hour window; all / known / anonymous; stream.

## 16. Acquisition (`/analytics/acquisition/`)

**What it is:** where visitors come from.

**Cards:** Total Users, Total Sessions, Engagement Rate (the inverse of bounce), Top Channel.

**Channels:** Direct, Organic, Paid Search, Social, Email, Referral, Display, **AI/LLM**. AI/LLM is automatically separated from referral traffic.

**Tables**
- Source / Medium: visitors, sessions, page views, bounce.
- **Campaigns (UTM):** campaign, source, medium, visitors, sessions, page views. Sorted by visitors, descending.
- **Referrals:** referring domain, visitors, sessions, page views, bounce.
- **AI Channels:** Total AI Visitors, AI Sessions, AI Sources count, AI channel chart, AI referrals table.

## 17. Behavior (`/analytics/behavior/`)

**Top Pages:** title, path, views, unique visitors, average time on page, bounce.

**Top Events:** category, action, label, total, unique. Custom events are sent through the tracking script: CTA clicks, video plays, scroll depth, feature usage, downloads.

**Full Pages and Events reports:** the same columns with no row limit.

**Interpretation guide:**
- High views + high bounce: the page attracts but does not engage.
- High time on page: the content resonates.
- Low uniques + high views: a reference page that people revisit.

## 18. Conversions (`/analytics/conversions/`)

**Cards:** Goal Completions, Conversion Rate, Form Submissions, Top Form.

**Goals table:** goal (type icon: form / meeting / signup / purchase), completions, unique completions, conversion rate bar, **Value** (revenue, if configured).

**Forms table:** form, form ID, Viewers (needs **form analysis** enabled), submissions, unique submitters, conversion rate, last submission. Bar colours:
- Green: above 10%
- Blue: 5–10%
- Yellow: below 5%

A badge appears above 15%.

**Default funnel:** Site Visitors → Viewed Form → Submitted Form → Booked Meeting. Per step it shows Users, Share of Total, Conversion Rate and Dropoff Rate. The page gives interpretation for drops at each stage.

**Gaps:** custom funnel creation is not described; only the "default funnel" is.

## 19. SDR Analytics (`/analytics/sdr-analytics/`)

**What it is:** a personal dashboard at **Outbound → SDR**, scoped to the signed-in user.

**Date presets:** Today / 7d / 14d / 30d / custom.

**Panels**
1. **Execution Health:** tasks due, completed, completion rate, SLA adherence.
2. **Outcome Feedback:**
   - Positive replies (interested / questions / moving forward)
   - Negative replies (no-thanks / not-now / unsubscribe)
   - Conversations (real back-and-forth)
   - Meetings booked
   - **Reply classification is automatic**: graph8 reads each reply and tags it positive or negative.
3. **Action Guidance:** a next-best-action queue. Each card has action type (Call / Email / Follow-up), contact, a "Why now" signal, and a CTA. Priority comes from engagement, sequence stage and time since last touch.
4. **Personal Stats:** your reply rate against the team average, the difference, and the trend.

**Manager view**
- Roll-up at Agency → Manage Orgs.
- Org-restricted scoping.
- For team-level reporting, "use the campaign and sequence dashboards in Engage" (not documented here).

**Coaching tip:** if your rate is below average, review replies for tone and timing patterns. This is manual.

## 20. Dialer Analytics (`/analytics/dialer-analytics/`)

**What it is:** built into **Engage → Dialer → Analytics panel**. There is no separate page.

**Metrics**
- Dials
- Connections (humans)
- Connection rate
- Voicemail rate
- Talk time
- Average duration
- **Disposition breakdown** (booked, callback, not interested, DNC, gatekeeper…)
- Success rate (meetings per connection)
- Redial metrics
- Peak calling hours

**Filters**
- Date
- Team member
- Dialing session
- **Score range** (min/max on graded calls). Calls under 30 seconds and non-conversation dispositions are excluded from grading, which implies calls are **AI-graded/scored**, though the method is not described.

**Redial analytics:** attempts and conversion per disposition, plus a cursor state so paused sessions do not double-dial.

**Other features**
- Team leaderboard (daily, weekly, monthly).
- Call targets (org or per SDR).
- **Campaign linkage:** calls from a campaign-linked session roll up into campaign reporting alongside **email and LinkedIn metrics**. This implies a campaign-level multichannel report exists; it is documented elsewhere.

---

# Hackathon relevance

## Project 1: Source Scout (discover and evaluate new B2B data sources, score against graph8 data, acquire into lists)

**Existing capabilities that overlap or can be reused**
- **Staging tables (Data → Workbench)** are the natural landing zone for an acquired source.
  - They accept CSV/Excel/paste, search results, CRM sync and Find People.
  - They support enrich → AI formula → **Export to list** / **Send to sequence**.
  - A scraped exhibitor list or portfolio could be pushed into a staging table rather than straight into a list.
- **AI formulas with confidence scores (0–100)** already do per-row "score vs ICP" at 1 credit per row, and presets exist for lead scoring and company analysis.
  - Source Scout's *per-record* scoring overlaps with this.
  - Its *per-source* scoring (overlap %, freshness, ICP density, novelty against the existing CDP) is **not** covered anywhere.
- **Waterfall enrichment + Find People** already cover "fill in contacts at the companies found in the source" (1 credit per match or per discovered contact). Credit estimates exist before bulk runs; Auto-Enrich has daily credit caps.
- **Routing rules** (after enrichment: add to list, add to sequence, tag) and **Workflow "Add to List" / "Visitor Enrichment" nodes** give the "acquire into lists" last mile.
- **Scheduled syncs** exist for recurring imports, but only from CRM connections. **There is no documented connector for arbitrary web sources, directories or exhibitor lists.** That gap is Source Scout's opportunity.
- **Research Assistant** can look up a company not in the DB by domain and save it as a new account. Its sources are website, LinkedIn, news, press and social, with paid databases off by default. It works one company at a time, not per source.
- **Copilot Research mode / Web Search** and the **Deep-tier web research tool** could discover sources conversationally, but nothing evaluates a source as a dataset.
- **Agents → MCP Servers (SSE/Stdio)**: a Source Scout MCP server could be registered in graph8 and show up as Tool nodes in Workflows and as agent tools. This is the cleanest integration path documented on these pages.
- **Analytics → Acquisition → Referrals / AI Channels** covers inbound *traffic* sources, not data sources. Only the name is similar; there is no real overlap.
- **Lead Scoring** is a single global model with fixed-looking fit weights. Scores cannot be edited manually and there is no per-segment model. A per-source ICP evaluation would need its own logic.

**Verdict:** the ingest, enrich, score and list plumbing exists. **Discovering sources, deduping or overlap-scoring a source against the existing graph8 data, and judging whether a source is worth acquiring are all absent.** No `g8_*` tools are documented in these pages, so check the API/MCP docs for list-create, contact-search and staging endpoints.

## Project 2: Flywheel (analyse finished campaign outcomes and generate an improved playbook V2 for approval)

**Existing capabilities that overlap or feed it**
- **Outcome data sources**
  - **SDR Analytics:** automatic positive/negative reply classification, conversations, meetings booked. Per user only; team-level is "in Engage campaign and sequence dashboards", not documented here.
  - **Marketing Intelligence:**
    - Outbound Bridge funnel (identified → added to outbound → replied → meetings)
    - Campaign Attribution by UTM campaign (reply rate, meetings)
    - Content Performance (reply rate by page visited)
  - **Dialer Analytics:** disposition breakdown, success rate, redial conversion. Campaign-linked sessions roll into campaign-level reporting with email and LinkedIn metrics.
  - **Voice post-call summaries:** disposition, key points including **objections**, sentiment, 0–100 qualification score, intent signals. The `call.summary.generated` and `agent.flagged` webhooks can stream this into Flywheel.
  - **Conversions:** goals, forms and funnel drop-off.
- **Objection analysis**
  - **Sales Coach** auto-detects objections from inbox and call transcripts and maps them to battle cards.
  - **The manager Team view already aggregates "Top objection types raised across the team"** and common discovery gaps.
  - This is the closest existing overlap, but it works per deal and per rep and produces coaching, not a rewritten campaign.
- **Improvement loops that already exist, all manual or half-built**
  - Voice **Coaching Loop**: flagged calls → a human extracts the top 3 gaps → **updates the playbook** → redeploys → measures the conversion delta. **This is essentially Flywheel done by hand**, for voice playbooks only.
  - Content Generation "Train the AI" and the subject-line **A/B test** where "AI tracks performance". Both are vague, with no mechanism documented.
  - Lead Scoring "Score accuracy": conversion by band, "adjust model based on results". Manual.
  - Copilot thumbs up/down and Copilot **Campaign-scope memory** (messaging decisions).
- **Playbook V2 targets and approval mechanics already in graph8**
  - Voice **Outbound Playbooks** (Opening / Discovery / Value pitch / top-5 Objections / Close) are a ready schema for a V2.
  - Global context docs a V2 could propose edits to: **Campaign Intelligence Brief**, battle cards, competitor teardowns, proof catalog, **buyer psychology (objection patterns)**, Studio campaign documents.
  - Approval primitives:
    - Copilot approval gates (publish campaign, create list)
    - Action **Requires Approval**
    - Workflow **Human Approval** node
    - AE Cockpit decision cards, including "Coaching Insight" cards
  - A Flywheel V2 could be delivered as a Workflow: webhook or manual trigger → LLM skill that analyses the outcomes → Human Approval → update the document or sequence.
- **Gaps Flywheel would fill**
  - Nothing documented takes a *completed campaign* as a unit and synthesises replies, objections and conversions into a *revised campaign playbook*.
  - Sales Coach is deal/rep scoped.
  - The voice coaching loop is manual.
  - Reply classification is only binary (positive/negative).
  - There is no documented objection taxonomy across email replies at campaign level, no V1-to-V2 diff or versioning, and no approval UI built specifically for playbooks.

**Credit notes for both projects**
- Copilot: 1 credit per exchange (Bridge says 1–10).
- AI formula: 1 credit per row.
- Enrichment: 1 credit per match.
- Sales Coach: 1–10 per action.
