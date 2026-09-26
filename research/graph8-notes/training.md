# graph8 Role-Based Training: Knowledge Base Notes

Source: 27 `training*` files extracted from docs.graph8.com/training/. All content below is taken from those files. Where the docs are inconsistent (menu paths, category names), that is flagged rather than resolved.

---

## 0. How training is structured

**Hub page (`/training/`)**: "Role-Based Training". Stated philosophy: missions guide you "through the real features — so training IS the work."

- Pick a role; each path has 4-5 missions.
- **graph8 auto-detects progress**: importing contacts, creating a sequence, or launching a campaign is automatically checked off.
- **Managers see team progress** from a **Training tab** (who completed what).

**Platform value by role (as claimed):**

| Role | Primary value | Time saved |
|---|---|---|
| SDR | Prioritization and research at scale | 2+ hrs/segment |
| Account Executive | Account prep and deal tracking | 45+ min/account |
| Growth Manager | Campaign delivery automation | 20+ hrs/week/client |

**Two kinds of pages exist:**
1. **Mission tracks** (hands-on, step-by-step): General (3 missions), SDR (5), AE (4), Growth Manager (5).
2. **Reference guides** (week-1 plans, metrics, checklists): SDR (`/training/sdrs/`), AE (`/training/account-executives/`), Growth Manager (`/training/growth-managers/`), Sales Manager (`/training/sales-managers/`), SDR Manager (`/training/sdr-managers/`).

Important: **Sales Manager and SDR Manager have reference guides only, no mission tracks.**

**Top-level app areas named in training:** Data (Contacts, Companies, Lists), Studio (Global: Company Profile, Personas, ICPs, Context & Grounding, Research; Campaign), Engage (Sequencer/Sequences, Inbox, Dialer, Tasks, Appointments), Audiences (Companies, ICPs, Personas), Campaigns (Ideas, per-campaign Dashboard, documents/Canvas), Workflows (Intelligence Workflow card), Companies (Deals tab, Team Dashboard, Contacts/Meetings/Deals subtabs), Settings (Team, Connections/Integrations, Mailboxes, Billing, Company Profile), Copilot (bottom-right on any page), Research tab.

**Menu-path inconsistencies to be aware of:**
- CRM connect: "Settings → Connections" (General M3) vs "Settings → Integrations" (SDR M4).
- Mailboxes: "Settings → Channels → Mailboxes" (`app.graph8.com/studio/settings?tab=mailboxes`) vs "Settings → Mailboxes".
- Companies: "Data → Companies" vs "Audiences → Companies" vs "Companies tab in the left sidebar".
- Contact import: "Data → Contacts → Import" vs "Companies → Import" (SDR reference).
- Company Profile: "Settings → Company Profile" (GM M1) vs "Studio → Global → Company Profile" (General M1).
- Navigation described both as "top navigation" and "left sidebar".
- Company Intelligence categories differ between SDR and AE docs (see Section 3).

---

## 1. General track: "Getting Started Training" (3 missions)

### Mission 1: Navigate graph8
**Goal:** learn the layout; "graph8 is organized around five main sections" (four are then explored).
1. **Data** (top nav): Contacts (individual people), Companies (organizations), Lists (saved groups of contacts for targeting). Click any record for detail view.
2. **Studio** ("where graph8's AI does the heavy lifting — company intelligence, campaigns, and content"): select **Global** to see Company Profile (brand, offer, positioning), Personas (AI-generated buyer personas), ICPs. Switch to **Campaign** to see campaign creation/management.
3. **Engage** ("where outreach happens"): Sequencer (multi-step automated outreach), Inbox (unified view of all replies), Dialer (power dialer).
4. **Settings** (gear icon): Team (invite users, roles), Connections (CRM/third-party), Mailboxes, Billing.
Completion: explored all four areas.

### Mission 2: Get Your Data In
**Goal:** "Before you can do anything in graph8, you need data."
1. **Import contacts:** Data → Contacts → Import (top right) → select CSV (columns like email, first_name, last_name, company) → graph8 auto-maps common column names → review mapping → Import → success message with count. Tip: even 10-20 contacts exported from a CRM is enough.
2. **Create a list:** Data → Lists → Create List → name (e.g., "First Outreach List") → add contacts via filters or manual grid selection → save.
3. **View a company profile:** Data → Companies ("graph8 automatically groups contacts by company") → click company → basic info (industry, size, location), associated contacts, activity history.

### Mission 3: Connect Your Tools
1. **CRM:** Settings → Connections → HubSpot / Salesforce / Pipedrive → Connect → authorize → background sync of contacts, companies, deals; check Contacts/Companies after a few minutes. Unlisted CRM: contact support.
2. **Mailbox:** Settings → Channels → Mailboxes → Add Mailbox → "Sign in with Google" or "New SMTP Connection" → green status when connected. Caution: configure SPF, DKIM, DMARC for deliverability.
Completion: CRM + mailbox connected.

---

## 2. SDR track

### 2a. SDR Mission track (5 missions, 15-30 min each)
Prerequisites: SDR permissions; CSV with at least 10 contacts (email, first name, last name, company, title); CRM credentials (Salesforce or HubSpot); mailbox credentials.

| Mission | Focus | Time |
|---|---|---|
| 1 Foundation | Contacts, lists, enrichment, ICP scores | 20 min |
| 2 First Sequence | Sequence creation and activation | 15 min |
| 3 Intelligence | Company research and Copilot | 20 min |
| 4 Tools | CRM, mailbox, calendar | 15 min |
| 5 Daily Workflow | Repeatable daily routine | 20 min |

#### SDR Mission 1: Set Up Your Foundation
**Goal:** contacts imported, organized, enriched, and prioritized by ICP score.
1. **Prepare CSV:** email, first name, last name, company name, title, owner name; one row per contact.
2. **Upload:** Data → Contacts → Import → drag CSV.
3. **Map fields:** auto-map; fix "Unmapped" fields; Next when required fields are green.
4. **Confirm/import:** summary (total rows, mapped fields, skipped rows) → Start Import → progress bar.
   - **AI/automation:** "Importing automatically queues each new contact for enrichment."
5. **Create a list:** Data → Lists → Create List → descriptive name (e.g., "Q2 Target Accounts - VP Engineering") → add via list page (Add Contacts, search/filter) or Contacts table (checkboxes → Add to List bulk action).
6. **Review enrichment:** Data → Contacts → Enrichment column (green check = done, clock = processing). Contact Overview tab shows verified email, phone, LinkedIn URL, company data.
7. **Spot gaps:** if phone/LinkedIn blank, "the data was not available" → manually add or re-run enrichment from contact's action menu. (Manual gap-filling = automation opportunity.)
8. **Review ICP scores:** Audiences → ICPs. Scoring: Fit 0-40 (industry, size, tech stack), Opportunity 0-30 (growth, funding, expansion), Readiness 0-30 (intent, timing), Total 0-100.
9. **Sort companies:** Companies tab by Total Score descending; 80+ = top priority. Tip: bookmark this view as the "daily prioritization dashboard."

#### SDR Mission 2: Launch Your First Sequence
1. Engage → Sequences → Create Sequence. Name (e.g., "Q2 VP Engineering - Cold Outreach"); select sending mailbox.
2. Add Step → Email; subject + body; merge fields `{{first_name}}`, `{{company_name}}`.
3. Typical 3-5 steps:

| Step | Type | Delay | Purpose |
|---|---|---|---|
| 1 | Email | Day 0 | Initial outreach |
| 2 | Email | Day 3 | Follow-up with new angle |
| 3 | Phone | Day 5 | Call attempt |
| 4 | Email | Day 7 | Value-add content |
| 5 | Email | Day 14 | Breakup / final touch |

   Tip: first sequence = 3 email steps over 10 days.
4. **Add contacts:** from sequence (Add Contacts; individuals or entire list) or Data → Contacts → checkboxes → Add to Sequence. Verify count on sequence Contacts tab. Tip: start with 10-20 contacts to test messaging.
5. **Activate:** proofread each step, check merge-field preview, schedule, delays → Activate → confirm. Check Activity tab for queued/sent emails.
6. **Monitor:** summary stats Sent / Opened / Replied / Bounced. Contact statuses: Active, Replied, Completed, Paused, Bounced. Replying contacts are **automatically removed** from the sequence; respond via Engage → Inbox.
   - **Explicit thresholds:** check metrics daily first week; **open rate < 30% → revisit subject lines; reply rate < 3% → revisit messaging.**

#### SDR Mission 3: Master Company Intelligence
1. Audiences → Companies, sort by Total Score, pick a company scoring 60+.
2. Company detail → **Run Intelligence** ("researches the company across multiple sources", 1-2 min). Done when all six categories show green checks. Tip: run on top 10 companies first.
3. **Six research categories (SDR version):**

| Category | Contains | Use |
|---|---|---|
| Company Overview | Summary, founding, HQ, size | Opening context |
| Products & Services | Offerings | Align pitch |
| Recent News | Funding, leadership changes, launches | Timely hooks |
| Technology Stack | Tools/platforms | Integration opportunities |
| Competitors | Competitors, market position | Differentiation |
| Pain Points | Industry and company-specific issues | Lead with relevance |

4. Note hooks: funding round, integratable tool, specific challenge.
5. **Stakeholder mapping:** company → Contacts subtab → Buying Role (Champion, Decision Maker, Influencer, End User) + Engagement Score.
6. **Copilot** (bottom-right icon or keyboard shortcut): "What do we know about Acme Corp?", "Who are the decision makers at Acme Corp?", "What challenges does Acme Corp face?", "Who competes with Acme Corp?", "What's happened recently at Acme Corp?". Copilot pulls from generated intelligence data. Tip: before every call ask "Summarize what we know about [company]" (30-second briefing vs 15 min manual).
7. **Talking points:** 2-3 hooks per company; one company-specific hook in the opening line; match hooks to personas (Audiences → Personas); reference specifics ("I saw your Series B announcement").

#### SDR Mission 4: Connect Your Tools
1. **CRM:** Settings → Integrations → Salesforce or HubSpot → Connect → OAuth → sync settings: contact sync direction (bidirectional recommended), activity logging (enable), field mapping → **Sync Now** (5-30 min).
2. **Mailbox:** Settings → Mailboxes → Add Mailbox → Google Workspace / Microsoft 365 / Other SMTP (server, email, app password) → set daily send limits:

| Mailbox age | Daily limit |
|---|---|
| New (< 2 weeks) | 20-30 |
| Warming (2-4 weeks) | 30-50 |
| Established (4+ weeks) | 50-100 |

   → Send Test Email (verify inbox not spam). New sending domain: ask admin about warmup schedule.
3. **Calendar:** Settings → Integrations → Calendar → Connect Calendar → Google Calendar or Microsoft Outlook OAuth → working hours, buffer (15 min recommended), meeting types (15 min intro, 30 min demo) → graph8 generates a **booking link** for outreach → Preview.
4. **Verify:** Integrations dashboard green "Connected" badges; spot-check CRM fields (CRM ID, last activity date) on contacts; mailbox "Active"; Engage → **Appointments** shows calendar and slots.

#### SDR Mission 5: Build Your Daily Workflow (the SDR daily cadence)
**Morning Prep (15 min)**, done before Slack/email:
1. Engage → Inbox: reply to overnight responses within first 30 minutes ("Hot replies go cold fast").
2. Engage → Tasks: follow-ups, scheduled calls, reminders due today; sort by Due Date.
3. Engage → Sequences: replies since yesterday; bounces needing cleanup; contacts completing sequences without reply ("candidates for a different approach").
4. Audiences → Companies sorted by Total Score: pick 3-5 companies; click Run Intelligence on any missing it.

**Working Companies (core of day; block 2-3 hours):**
1. Open priority company; review intelligence (esp. Recent News, Pain Points).
2. Contacts subtab: buying roles, engagement scores; who is unreached / engaged.
3. Execute outreach by state:
   - No prior contact → add key contacts to active sequence.
   - Sequence completed, no reply → different channel (Engage → Dialer, or LinkedIn).
   - Replied but not booked → personalized follow-up with calendar link.
   - Meeting booked → prep with Copilot ("Summarize what we know about [company]").
4. Log activity: contact → Activity tab → add note ("keeps your CRM synced and your manager informed").
5. Repeat for 3-5 priority accounts, then lower-priority/new contacts.

**Logging:**
- Calls: contact → Log Activity → Call; disposition (Connected, Voicemail, No Answer) + note, every dial.
- Sequence replies tracked automatically; manual emails / LinkedIn messages logged manually.
- Contact status lifecycle: **New → Working → Replied → Meeting Booked**, or **Disqualified** (not a fit, wrong contact, opted out).

**End-of-Day Review (10 min):** Engage → Tasks mark done/carry over; check numbers (emails sent via sequences + manual, calls made, replies received, meetings booked); queue tomorrow's tasks (e.g., "Call back Sarah at Acme..."); write top 3 priorities.

**Daily routine table:**

| Time block | Activity | Where |
|---|---|---|
| First 15 min | Inbox, tasks, sequence review | Engage → Inbox, Tasks, Sequences |
| Morning block | Priority companies (research, outreach) | Audiences → Companies, Engage → Dialer |
| Midday | Follow up morning replies, log activities | Engage → Inbox, contact records |
| Afternoon block | Remaining companies, add new contacts | Data → Contacts, Engage → Sequences |
| Last 10 min | Review numbers, queue tomorrow | Engage → Tasks |

### 2b. SDR Reference Guide (`/training/sdrs/`)
**Role:** "Maximize outreach efficiency through AI-powered prioritization and personalized research at scale." 2+ hours/segment saved on ICP/persona research.

**Core capabilities:** Auto-generated Personas (1-2 h/segment), Auto-generated ICPs (scored; 1-2 h/segment), **TAM Definition** ("Firmographic boundaries for targeting", 30 min setup), **Contact Import** ("CSV/webhook sync with enrichment", 30 min/batch), Company Intelligence (30-45 min/company).

**Week 1:**
- Day 1 (ICPs): Audiences → ICPs; review firmographic criteria (industry, company size, revenue range, geography, tech stack, pain points); Companies tab filter by ICP criteria, sort by `total_score`.
- Day 2 (Contact research): import CSV (Companies → Import); auto-enrichment; Run Intelligence on top companies; Contacts subtab: `buying_role`, `engagement_score` (0-100).

**Daily Outreach Prep (tree):** Morning prep 15 min (check priority companies, run missing intelligence, review research docs, queue personalization notes) → Research per company 5 min (Copilot "What do we know about [company]?", news, stakeholders, pain points) → Outreach execution (reference **campaign messaging docs**, personalize with intelligence, log activities).

**Copilot commands:** "Summarize what we know about TechCorp"; "Who are the VPs in our companies?"; "What challenges does TechCorp face?"; "Who competes with TechCorp?"; **"Add [email] as champion"** (write action); "Recent news about TechCorp".

**Personas** (Audiences → Personas): title/role patterns, pain points, motivations/goals, communication style, common objections. Match contact title → persona → use its pain points/objections.

**Research reports** (Research tab): Voice of Customer (language to mirror), Buyer Psychology (objection patterns), Competitive Intel (differentiators), Market Trends (industry context), **Win/Loss Themes** ("What resonates with similar prospects").

**Prioritization matrix:**

| Total Score | Priority | Action |
|---|---|---|
| 80-100 | Highest | Immediate, personalized outreach |
| 60-79 | High | Multi-touch sequence |
| 40-59 | Medium | Nurture sequence |
| 0-39 | Low | Batch campaigns only |

**Conversion metrics (Team Dashboard):** Companies Worked, Contacts Added, Intelligence Complete, MQLs, SQLs, Opportunities Created.

**Outreach checklist (before any company):** ICP score reviewed (>=60 for personalized); Company Intelligence 6/6; stakeholders mapped with buying roles; persona matched for primary contact; recent news reviewed; talking points noted; campaign messaging referenced.

**Troubleshooting:** low ICP scores → verify firmographics; missing enrichment → check email format, retry; no intelligence → verify website URL, run workflow manually; company not appearing → org filter / import completed.

**Best practices:** "Let AI Prioritize" (work highest ICP scores first); run intelligence before outreach; use persona pain points; check news before calling; "Log everything — Your activity data informs team strategy."

---

## 3. Account Executive track

### 3a. AE Mission track (4 missions)
Prereqs: Studio access with Companies module; at least one target company; **Global Context configured** ("Company Intelligence relies on your company profile and context documents").

| Mission | Skill | Time |
|---|---|---|
| 1 Company Research | Intelligence, stakeholders, pre-call prep | 15 min |
| 2 Pipeline | Create/manage deals across stages | 10 min |
| 3 AI Selling | Copilot, AI email, transcripts | 15 min |
| 4 Closing | Velocity, updates, export summaries | 10 min |

#### AE Mission 1: Master Company Research
1. Companies tab (left sidebar) → select company or **+ Add Company** → **Run Intelligence** → 6-step workflow; each category becomes a searchable document. **AE version of the 6 categories:** Website Scrape, Company Enrichment, Financial Intelligence, Leadership Research, News & Events, Tech Stack. Results are **cached** ("only need to run it once"); 1-2 min each; top 10 first.
2. **Map stakeholders:** Contacts subtab → + Add Contact or CSV → `buying_role`: Champion, Decision Maker, Influencer, **Blocker** (note: AE uses Blocker; SDR mission lists End User) → set `engagement_score` 0-100 manually from interaction history. Aim: at least one Champion and one Decision Maker before first call ("Missing a Decision Maker is the most common reason deals stall").
3. **Pre-call Copilot:** "Summarize what we know about [company]"; "Who are the key decision makers at [company]?"; "Any recent news about [company]?"; also pain points, tech stack, competitors.
Checklist: intelligence run, 6/6 generated, 2+ stakeholders mapped, a Copilot prep query run.

#### AE Mission 2: Build Your Pipeline
1. Companies → company → **Deals subtab** → **+ New Deal** → Deal Name (e.g., "Acme Corp - Enterprise License"), Deal Value, Expected Close Date, Stage = Discovery.
2. Deal detail: update value, close date, owner; Add Note.
3. Stages: **Discovery** (qualifying) → **Qualified** (budget, authority, need, timeline confirmed) → **Proposal** (pricing sent) → **Negotiation** → **Closed Won** / **Closed Lost**. Stage dropdown → confirm → **Stage Entry Date updates automatically**. Also via Copilot: "Move the Acme deal to Proposal stage".

#### AE Mission 3: Leverage AI for Selling
1. **Deep Copilot research (cross-account):** "Compare the tech stacks of Acme Corp and Beta Inc"; "Which of my accounts have recent funding rounds?"; "What pain points has [contact] mentioned?" Copilot searches all 6 intelligence categories, meeting transcripts, and CRM notes.
2. **AI email generation:** from account page, Copilot: "Draft a follow-up email to [contact] at [company] about [topic]". Draws on intelligence docs, meeting notes, stakeholder roles and engagement history. Edit, then copy into email client or sequence. Prompts: post-demo follow-up; proposal recap; re-engagement ("we haven't spoken in 3 weeks"); champion enablement ("Help my champion at Acme build an internal business case"). Always review before sending.
3. **Meeting transcripts:** RAG-indexed; account → **Meetings subtab** → auto-generated summary (discussion points, action items, next steps). Copilot: "What did we discuss with Acme in our last meeting?", "Has anyone at Acme mentioned concerns about pricing?", "What action items are outstanding for the Acme deal?" After 3-4 meetings Copilot "can surface patterns and objections you might have missed."

#### AE Mission 4: Close Deals Faster
1. Companies → Deals subtab → **My Deals** toggle → Days in Stage, Stage Entry Date, Total Deal Value → sort Days in Stage descending. Rule: **>14 days in same stage without activity = immediate attention** (advance, update, or mark at risk).
2. **Copilot updates:** move stage, set value, add note ("Legal review in progress..."), add contact as influencer, set expected close date. Copilot **shows the change before applying** (confirm step).
3. **Deal summary export:** Copilot "Give me a full summary of the Acme Corp deal" → stage/value, stakeholders/roles, recent meeting notes/action items, intelligence highlights → copy for pipeline reviews/forecast calls. "Show me all my deals in Proposal stage."

### 3b. AE Reference Guide (`/training/account-executives/`)
**Role:** "Maximize deal velocity through AI-powered company intelligence and efficient pipeline management."
Capabilities: Company Intelligence (30-45 min/company), Copilot Chat (15-20 min/interaction), Deal Pipeline (10 min/day), Stakeholder Mapping (20 min/company), Meeting Transcripts (RAG-indexed, 15 min/meeting).
- **Pre-call checklist (5 min):** Copilot summary → 6 categories → buying roles → transcript summaries → recent news.
- **During/after call via Copilot:** move stage, add contact as decision maker, log note, set deal value. Post-call: update stage immediately, log key points (auto-indexed), add stakeholders, set next step (close date, follow-up tasks).
- **Engagement score inputs:** meeting attendance, email responsiveness, document views, champion behaviors.
- **Warning signs:** >14 days same stage without activity; multiple deals stuck at same stage; no stakeholder engagement movement.
- **Metrics:** Pipeline Coverage (deal value / quota), Deal Velocity (avg days per stage), Win Rate (Closed Won / Total Closed), Avg Deal Size; Company health: Intelligence Completeness (6/6), Stakeholder Coverage, Engagement Trend.
- **Best practices:** intelligence before first call; update deals in real time ("Stale pipeline = wrong forecast"); map stakeholders early; use Copilot; review days_in_stage weekly.

---

## 4. Growth Manager track (agency / campaign-delivery role)

Framing: "deliver high-quality, AI-powered campaigns **for clients**" — graph8 positions Growth Managers as serving multiple client organizations (20+ hrs/week/client saved; "Batch client onboarding"). Prereqs: GM permissions, at least one client org, client's website URL. Total active time ~1.5 h; missions must be done in order ("Each one builds on the output of the previous mission").

| Mission | Active | AI processing |
|---|---|---|
| 1 Onboard client | 15 min | 5-10 min |
| 2 Global Context | 15 min | 20-30 min |
| 3 First Campaign | 30 min | 10-15 min |
| 4 Sequencer | 20 min | - |
| 5 Monitor & Optimize | 15 min | - |

#### GM Mission 1: Onboard Your First Client
1. Settings → **Company Profile** → paste client Website URL (seed for Intelligence Workflow) → fill Company Name, Industry, Headquarters.
2. **Workflows** (top nav) → Intelligence Workflow card → **Start Intelligence** → extracts **11 structured data points** (value propositions, target markets, product offerings, competitive positioning, key differentiators, etc.), 5-10 min. Individual steps can be retried.
3. Review Company Profile (esp. Value Propositions, Target Markets) → edit (industry classification, company size, VP language) → **Approve**. Approval "locks the profile and unlocks downstream workflows: Context Generation, Research Reports, and Campaign Ideas." Post-approval edits "may trigger re-generation of dependent documents."
- **Human-in-the-loop gate:** Approve.

#### GM Mission 2: Generate Global Context
1. Studio → Global → **Context & Grounding** → **Generate** → **21 documents** (messaging frameworks, positioning statements, brand voice guidelines, "and more"), 20-30 min, background.
2. Studio → Global → **Research** → **Generate All Reports** → **6 reports** in parallel (10-15 min): Voice of Customer, Buyer Psychology, Competitive Intelligence, Market Trends, Win/Loss Themes, Industry Analysis.
3. Audiences → Personas: 3-5 auto-generated personas; review title/role patterns, pain points, motivations, communication style, objections; edit; verify buying-committee coverage (decision maker, champion, technical evaluator, end user). Prefer re-running generation with better Company Profile input over manual persona creation.
4. Audiences → ICPs: Fit 0-40 (industry, size, tech stack), Opportunity 0-30 (funding, expansion, **hiring**), Readiness 0-30 (timing, urgency); review/adjust firmographic criteria (industry, size, revenue, geography, tech stack). "Accurate ICPs drive better contact targeting in campaigns and sequences."
5. Read reports; flag gaps ("Any gaps or inaccuracies here will cascade into campaign content"). Bookmark VoC and Competitive Intelligence.
Output: 21 context docs, 3-5 personas, scored ICPs, 6 reports.

#### GM Mission 3: Create Your First Campaign
1. Campaigns (left sidebar) → **Ideas** tab → **Generate Ideas** → 5-10 concepts in 2-3 min, from context docs, personas, ICPs. Each card: core concept (`core_concept`), primary hook (`primary_hook`), target persona, suggested campaign type. Regenerate for fresh angles.
2. **Human evaluation criteria:** aligns with client's immediate goals? hook addresses a real persona pain point? campaign type fits audience?
3. Select idea → **Push to Campaign** → name → **10+ campaign documents** auto-generated (email copy, landing page concepts, ad variations, social posts, more), 10-15 min.
4. Campaign → **Dashboard** tab → **Readiness Score** 0-100 (aim 75+) → **Risk Assessment** (missing documents, low-quality content, incomplete persona coverage) → launch status **ready / needs_work / not_ready**.
5. **Canvas** editor: open document, edit text blocks (tone, client terminology). Copilot: "Make this more conversational", "Rewrite the headline to focus on ROI", "Shorten this to 50 words", "Add a stronger call to action". Prioritize first email + landing page headline.

#### GM Mission 4: Master the Sequencer
"A sequence is the execution layer of your campaign."
1. Campaign → **Create Sequence** (auto-linked, pre-populated with campaign content) or Engage → Sequences → New Sequence. Name e.g. "Acme Corp — Q1 Outbound — Decision Makers".
2. Steps: Add Step → Email (subject, body, sender); first email may be pre-filled from campaign docs; merge fields; Step 1 delay 0; **send window** (e.g., 8 AM-6 PM contact timezone). Follow-ups: 3-5 email steps; Step 2 +3 days, Step 3 +4 days, Step 4 +5 days. Vary angle (pain point → case study → meeting offer). First email under 150 words.
3. Contacts tab → Add Contacts from **a list**, manual search, or **CSV import**. Required: email, first name, last name, company name (missing → flagged and skipped). **Automatic duplicate check** across this and other active sequences.
4. Preview each email with sample data; settings: authenticated sender, send window, timezone handling (contact or fixed), unsubscribe handling → Activate/Launch → status Active. Send test email to self (desktop + mobile).

#### GM Mission 5: Monitor and Optimize
1. **Campaign Dashboard:** Readiness Score (<75 = gaps; auto-updates as documents improve); Risk Assessment items state what's wrong and what to fix (missing docs, weak proof points, incomplete persona coverage, low content-quality scores). Status actions: ready → proceed to delivery; needs_work → fix, re-check; not_ready → do not proceed.
2. **Document health:** each doc Health Score good/warning/poor; filter warnings first; causes: thin content, missing sections, drift from Company Profile; fix in Canvas or Copilot regenerate ("Expand the proof points section with specific metrics", "Align this with our value proposition"). **Usage Count** (times referenced during generation) and **Citation Count** (Copilot references); low usage → improve or irrelevant. "Fix 'warning' documents before they cascade."
3. **Export deliverables:** select docs (Campaign Passport + key email copy + landing page content) → Export (PDF or editable) → **Campaign Passport** = auto-generated summary PDF (strategy, target personas, messaging themes, key deliverables) → client walkthrough.
4. **Sequence performance:** Engage → Sequences → active sequence → step-level metrics:

| Metric | Tells you |
|---|---|
| Open Rate | Subject line effectiveness |
| Click Rate | Content / CTA relevance |
| Reply Rate | Message resonance, personalization |
| Bounce Rate | Contact data quality |
| Unsubscribe Rate | Audience-message fit |

   Identify steps significantly below others. Fixes: low open → rewrite subject (shorter, curiosity-driven); low click → stronger CTA; low reply → more personalization or new angle; high bounce → clean list, verify emails. Daily first week, then weekly. **Change one variable at a time.**
5. **Daily optimization checklist:** Readiness 75+; no "poor" docs; sequences sending without errors; **bounce rate < 5%**; no unaddressed risk items.

### 4b. Growth Manager Reference Guide (`/training/growth-managers/`)
Capabilities and claimed savings: Intelligence Workflow (11 data points, 4-6 h/client), Global Context 21 docs (8-12 h/client), Research Reports 6 (6-8 h/client), Campaign Ideas AI 5-10 concepts (2-3 h/campaign), Campaign Dashboard readiness/gap analysis (1-2 h/campaign).

**Week 1 onboarding:** Day 0 (30 min): Intelligence Workflow → review/Approve profile → Context Generation → Research Reports. Day 1 (1 h): personas, ICPs (`fit_score`, `opportunity_score`, `readiness_score`), Generate Ideas, Push to Campaign. Day 2 (45 min): Dashboard (75+, `risk_assessment`), Canvas refinement, Export + Campaign Passport, client walkthrough.

**Daily execution pattern:** Morning 30 min (check in-progress generation, **review failed workflows and retry**, prioritize by client deadlines); Midday 1-2 h (Canvas refinement, Copilot messaging, client comms); End of day 15 min (**queue overnight generation tasks**, verify document health scores, update client status notes).

**Copilot commands:** "What's the status of GlobalTech's campaign?"; "Rewrite this headline to focus on ROI"; "What are GlobalTech's main competitors?"; "Give me 3 more campaign ideas for enterprise SaaS"; "Find our messaging house document".

**Metrics:** Readiness 75+; **Documents Complete 31+** (X/21 context + Y/10 campaign docs); Launch Readiness "ready"; doc Health / Usage / Citation counts; time efficiency: `generation_started_at` → completion; active time vs AI time.

**Troubleshooting:** intelligence stuck → check profile approved, retry; context doc warnings → review low `health_score`, update source content; campaign generation incomplete → verify all 21 context docs exist, **"check Celery worker status"** (reveals Celery-based backend job queue); low readiness → review `risk_assessment`, address weak `proof_analysis`.

**Best practices:** batch client onboarding; "garbage in = garbage out" on Company Profile; AI content is "a starting point, not final"; monitor health scores; leverage Copilot.

---

## 5. SDR Manager Reference Guide (`/training/sdr-managers/`) - no missions

**Role:** consistent, high-quality outreach; optimize territory coverage and conversion. Key value: conversion funnel visibility + team metrics + territory management.

**Surfaces:** Team Dashboard (Companies → Team Dashboard), Conversion Funnel (MQL → SQL → Opportunity), Territory View (Companies tab), Activity Log (Team Dashboard), ICP Coverage (Audiences → ICPs).

**Team Dashboard metrics:** MQL Count, SQL Count, Opportunity Count, MQL→SQL rate, SQL→Opp rate; Company Count (territory), Active Campaigns, Activity Volume.

**Funnel definitions:** MQLs = "Companies meeting ICP criteria"; SQLs = "Companies with validated interest"; Opportunities = deals in pipeline.

**Benchmarks:** MQL→SQL target >25% (warning <15%); SQL→Opp >40% (<25%); overall MQL→Opp >10% (<5%).

**Diagnosis table:** low MQL→SQL → poor ICP targeting → review ICP criteria; low SQL→Opp → weak discovery → train on BANT; high volume/low conversion → focus on personalization; high conversion/low volume → expand territory/team.

**Territory management:** Companies tab → Owner filter per SDR; company count per SDR, ICP score distribution, status (prospect/active). Balance: count ±20%, each SDR gets high/med/low scores, industry specialists vs generalists, time zones. Import with `company_owner` CSV field → maps to `owner_name` → auto-assigns territories; **webhook sync maintains assignments**.

**Weekly cadence:**
- **Monday funnel review (20 min):** MQL volume vs historical, ICP score distribution; MQL→SQL by SDR (top/bottom); SQL→Opp, pipeline quality, deal value averages.
- **Wednesday activity review (15 min):** Activity Log past week, volume per SDR, engagement patterns; compare activity to results (high activity/low conversion = quality issue; low/low = effort issue; high/high = best practices).
- **Friday territory health (15 min):** high-score accounts being worked? gaps? new accounts needing assignment? % accounts with full intelligence; flag accounts needing research.

**Activity types:** `account_viewed`, `contact_added`, `intelligence_run`, `deal_created`. Healthy vs concerning: consistent vs burst; intelligence before outreach vs none; regular contact additions vs stale lists; steady opp creation vs long gaps.

**ICP utilization targets:** % accounts with ICP match >80%; avg total_score worked >60; high-score accounts contacted 100%. **ICP refinement triggers:** conversion dropping despite high scores; high scores not generating opps; low scores outperforming high scores.

**Weekly QA checklist:** intelligence complete on priority accounts; personas aligned with campaign messaging; stakeholder roles assigned; recent contacts have buying_role; campaign messaging being used. Spot checks: research depth 6/6; buying roles; messaging alignment (campaign talking points); personalization evidence.

**Coaching with data:** low conversion (funnel per SDR vs team, which stage drops, coach qualification or BANT); low activity (volume vs peers, capacity, time mgmt/tool confusion/motivation); quality issues (spot-check activities, research depth, roles; coach research, persona use, messaging consistency).

**1:1 targets:** MQL→SQL >25%; SQL→Opp >40%; consistent daily activity; intelligence complete 100% priority. Team: overall >10% MQL→Opp; high-score coverage 100% worked.

**Weekly manager checklist:** funnel; activity log; territory distribution; ICP coverage/usage; research quality spot-check; coaching points; training needs; **update team on campaign changes**.

Troubleshooting: funnel empty → accounts need proper status; territory imbalanced → re-assign via import with owner_name; ICP scores missing → **regenerate ICPs**, verify firmographics.

---

## 6. Sales Manager Reference Guide (`/training/sales-managers/`) - no missions

**Role:** visibility into team pipeline health, deal velocity, campaign effectiveness "without micromanaging."

**Surfaces:** Team Dashboard (Companies → Team Dashboard), Deal Pipeline (Companies → Deals), Deal Velocity (Team Dashboard), **Campaign Readiness** ("AI-scored campaign health (0-100)", Campaigns → Dashboard), Activity Log.

**Team Dashboard:** Pipeline Summary (Total Pipeline Value, Deal Count by Stage, Avg Deal Size, Deals Requiring Attention); Deal Velocity (Avg Days in Stage, Stage Conversion Rate, Stuck Deals >14 days, Velocity Trend); Campaign Health (Active Campaigns, Avg Readiness Score, Campaigns Needing Work = readiness <75).

**Monday pipeline review (30 min):** pipeline vs quota coverage (healthy = more in Qualified/Proposal than Discovery); days per stage vs benchmarks; filter `days_in_stage > 14`, cross-reference activity log, schedule 1:1 if no recent activity; activity trends (declining AEs, high performers).

**Campaign oversight - per active campaign:** Readiness Score (75+); Launch Readiness (ready/needs_work/not_ready); **Strategic Assessment** (goal alignment, market positioning); **Audience Profile** (persona/ICP targeting); **Messaging Summary** (core hooks, value props); **Channel Strategy** (distribution plan); **Proof Analysis** (strong/adequate/weak); **Risk Assessment** (blockers, mitigation).
**Campaign quality checkpoints:** readiness >=75; **all 21 context documents generated**; proof analysis strong/adequate; no "critical" risk items; target personas aligned with ICPs.

**Velocity benchmarks:** Discovery 7-10 days (warn >14); Qualified 10-14 (>21); Proposal 7-14 (>21); Negotiation 7-14 (>28). Warning patterns: many stuck in Discovery → weak qualification; long Proposal → pricing/objections; Negotiation stalls → legal/procurement; uniform stuck stage → process bottleneck.

**Activity types:** `deal_created`, `deal_updated`, `contact_added`, `account_viewed`, `intelligence_run`.

**Coaching:** stuck deals (days_in_stage, activity log, "What's blocking [deal]?", classify: stakeholder access / objection handling / pricing / technical validation); low activity; **poor campaign performance** (review readiness scores, document health scores, weak proof_analysis areas, "Coach on content improvement").

**1:1 targets:** pipeline coverage 3x quota; velocity within benchmarks; win rate >25%; daily engagement; stakeholder depth 3+ per opportunity. Team: total pipeline = quota x team size x 3; stage conversion >50% per stage; campaign readiness avg >75.

**Weekly checklist:** Team Dashboard; stuck deals; campaign readiness; activity log; coaching points; **update forecast based on velocity data**; flag at-risk deals. Best practice: review dashboard daily. Troubleshooting: missing velocity → deals need `stage_entry_date`; campaign scores missing → "Ensure dashboard has been generated."

---

## 7. Consolidation (a): End-to-end GTM workflow in graph8

Canonical sequence reconstructed from the missions (citations in brackets):

1. **Workspace & connections** - CRM (HubSpot/Salesforce/Pipedrive, bidirectional sync, activity logging, field mapping), mailbox (Google/M365/SMTP, SPF/DKIM/DMARC, send limits by mailbox age), calendar (availability, booking link). [General M3; SDR M4]
2. **Company context setup** - Company Profile seeded by website URL → Intelligence Workflow (11 data points) → human edit → **Approve** (unlocks everything downstream). [GM M1; GM reference Day 0]
3. **Global Context generation** - 21 context documents (Context & Grounding) + 6 Research Reports (VoC, Buyer Psychology, Competitive Intel, Market Trends, Win/Loss Themes, Industry Analysis). [GM M2] AE track requires this as a prerequisite. [AE overview]
4. **ICP & personas** - auto-generated 3-5 personas and scored ICPs (Fit 0-40 / Opportunity 0-30 / Readiness 0-30); human review/edit of firmographics; TAM definition. [GM M2; SDR M1; SDR reference Day 1]
5. **List building** - in training this is **only**: CSV import (Data → Contacts → Import or Companies → Import), webhook sync, CRM sync, then Lists built via filters or manual selection; companies filtered by ICP criteria and sorted by Total Score. Training never shows sourcing net-new contacts/companies from an external database or data marketplace. [General M2; SDR M1; SDR reference; SDR-mgr territory import]
6. **Enrichment** - automatic on import (verified email, phone, LinkedIn, company data); manual re-run or manual fill if gaps. [SDR M1]
7. **Account research / scoring** - Run Intelligence per company (6 categories), stakeholder mapping (buying roles, engagement score), Copilot briefings; prioritization matrix by Total Score. [SDR M3; AE M1; SDR reference]
8. **Campaign** - Generate Ideas (5-10) → human choose → Push to Campaign (10+ docs) → Dashboard readiness (75+), risk assessment → Canvas + Copilot refinement → export Campaign Passport for client approval. [GM M3, M5]
9. **Sequence** - create from campaign (pre-populated) or from scratch; 3-5 steps with delays, send windows, merge fields; add contacts from list/manual/CSV; dedupe; preview, test, Activate. [GM M4; SDR M2]
10. **Inbox / replies** - replies auto-remove contact from sequence; respond in Engage → Inbox within 30 min; status lifecycle New → Working → Replied → Meeting Booked / Disqualified; multichannel fallback (Dialer, LinkedIn). [SDR M2, M5]
11. **Meetings** - booking link from calendar integration, Engage → Appointments; Copilot pre-meeting prep; recorded meeting transcripts RAG-indexed under Meetings subtab. [SDR M4, M5; AE M3]
12. **Deals** - + New Deal, stages Discovery → Qualified → Proposal → Negotiation → Closed Won/Lost, auto stage-entry dates, Copilot updates, deal summaries. [AE M2, M4]
13. **Reporting** - SDR daily numbers; sequence Sent/Opened/Replied/Bounced + step-level open/click/reply/bounce/unsubscribe; Team Dashboard funnel MQL→SQL→Opp; pipeline/velocity; campaign readiness/document health; activity log. [SDR M5; GM M5; SDR-mgr; Sales-mgr]
14. **Optimization** - manual: rewrite subject lines/CTAs/angles, clean lists, fix warning docs, refine ICP criteria, coach reps, update team on campaign changes. [GM M5; SDR M2; SDR-mgr; Sales-mgr] - **This is where the loop is NOT closed automatically; nothing feeds outcomes back into Company Profile / ICP / campaign generation.**

## 8. Consolidation (b): Every place a human is told to manually analyze and improve (automation opportunities)

**Data / list quality**
1. Map CSV columns; fix Unmapped fields. [SDR M1; General M2]
2. Spot enrichment gaps (phone/LinkedIn blank) → manually add or re-run enrichment. [SDR M1]
3. Missing enrichment → check email format, retry. [SDR reference]
4. Sequence Mission: bounces "need cleanup"; high bounce → "clean your contact list. Verify email addresses before re-sending"; keep bounce < 5%. [SDR M5; GM M5]
5. Review flagged duplicate enrollments and decide include/exclude; contacts missing required fields get skipped. [GM M4]
6. Territory balancing (count ±20%, score mix, industry, time zone), assign new accounts, re-assign via import. [SDR-mgr]
7. Import at least 10 contacts from CSV / export from CRM as the starting data - no sourcing step exists. [General M2; SDR prereqs]

**Targeting / ICP**
8. Review and adjust ICP firmographic criteria (industry, size, revenue, geography, tech stack). [GM M2; SDR ref Day 1]
9. Filter companies by ICP criteria and sort by total score; pick 3-5 daily. [SDR M5; SDR ref]
10. ICP refinement triggers (conversion dropping despite high scores; high scores not generating opps; low scores outperforming high) - detected manually. [SDR-mgr]
11. Diagnose funnel (low MQL→SQL = poor ICP targeting → review ICP criteria). [SDR-mgr]
12. Low ICP scores → verify firmographic data. [SDR ref]

**Context / content**
13. Verify and edit Company Profile before Approve. [GM M1]
14. Review/edit personas for buying-committee coverage; decide re-run vs manual add. [GM M2]
15. Read all 6 research reports; flag gaps/inaccuracies that "cascade into campaign content". [GM M2]
16. Evaluate 5-10 campaign ideas for fit (goals, pain point, type); regenerate if weak. [GM M3]
17. Refine documents in Canvas; prioritize first email and landing page headline. [GM M3]
18. Act on Readiness/Risk Assessment items; fix warning/poor documents; interpret usage/citation counts. [GM M3, M5]
19. Sales manager reviews proof analysis / document health and "coach[es] on content improvement". [Sales-mgr]
20. Review and personalize AI-drafted emails before sending. [AE M3]

**Sequence / campaign performance**
21. Check metrics daily first week; open < 30% → revisit subject lines; reply < 3% → revisit messaging. [SDR M2]
22. Identify underperforming steps; rewrite subject/CTA/angle; change one variable at a time; daily then weekly monitoring. [GM M5]
23. Contacts completing sequence without reply → decide different approach/channel. [SDR M5]
24. End-of-day review of numbers and queuing tomorrow. [SDR M5]
25. Manually log calls, manual emails, LinkedIn messages; update contact statuses. [SDR M5]
26. Win/Loss Themes report is consulted manually for "what resonates". [SDR ref]

**Pipeline / team**
27. Sort by Days in Stage; >14 days → advance/update/mark at risk. [AE M4; Sales-mgr]
28. Weekly funnel/activity/territory reviews; compare activity to results; SDR-vs-SDR best-practice identification. [SDR-mgr]
29. Classify stuck-deal causes; update forecast from velocity. [Sales-mgr]
30. Retry failed workflows each morning; queue overnight generation. [GM ref]
31. "Update team on campaign changes." [SDR-mgr]
32. Manually set `engagement_score` for stakeholders (AE M1) even though AE reference lists behavioral inputs.

---

## 9. Hackathon relevance

### (1) Source Scout - discover/evaluate new external B2B data sources and acquire them into lists
**Gap it fills:** In every training path, data enters graph8 only via CSV import, webhook sync, or CRM sync; "Before you can do anything in graph8, you need data" (General M2) and every track presumes a CSV already exists (SDR prereq: "A CSV file with at least 10 contacts"). Enrichment happens after import, and gaps are simply "not available" (SDR M1). There is no training step for discovering where new accounts/contacts come from.

**Manual workflows it would automate:**
- Sourcing the initial CSV / exporting from CRM (General M2, SDR M1 prereqs).
- Building lists by filtering to ICP criteria (SDR ref Day 1; General M2; SDR M1) - Source Scout could translate ICP firmographics (industry, size, revenue, geography, tech stack) and Opportunity/Readiness signals (funding, expansion, hiring, intent) into queries against candidate external sources.
- Filling enrichment gaps (phone/LinkedIn) and reducing bounce (list cleaning, bounce < 5%) by evaluating source coverage/quality before acquisition.
- Friday territory-health "new accounts needing assignment" and "territories with gaps" (SDR-mgr) - scout could fill under-covered territories and import with `company_owner` → `owner_name` auto-assignment.
- "High conversion, low volume → capacity issue / expand territory" (SDR-mgr) - scout provides net-new TAM.
- Evaluation scoring of a source could reuse graph8's own vocabulary: ICP match %, (>80% target), avg total_score (>60), enrichment completeness, bounce rate.
- Output lands where the training expects it: Data → Lists, then Add to Sequence / campaign Contacts tab.

**Buyer / user:** primary users are **Growth Managers** (run multi-client campaign delivery; need audiences per client ICP) and **SDRs** (list building, 2+ hrs/segment claimed). **SDR Managers** are the natural buyer/approver (own territory coverage, MQL volume, "% accounts with ICP match >80%" targets).

### (2) Flywheel - analyze completed campaign outcomes → generate improved campaign playbook V2 for human approval
**Gap it fills:** graph8 automates the forward path (Profile → 21 docs → 6 reports → ideas → 10+ campaign docs → sequence) but the backward path is entirely manual. The Readiness Score/Risk Assessment grades content quality *before* launch, not outcomes after. Nothing in training feeds reply/meeting/deal outcomes back into ICPs, personas, context docs, or campaign ideas.

**Manual workflows it would automate:**
- GM M5 sequence optimization: step-level open/click/reply/bounce/unsubscribe analysis → the prescribed fixes (subject rewrite, CTA, personalization/angle, list cleaning) → V2 step copy with one-variable-at-a-time test plan.
- SDR M2 thresholds (open < 30%, reply < 3%) as automated triggers.
- SDR-mgr ICP refinement triggers (high scores not converting, low scores outperforming) → proposed ICP criteria/weight edits using MQL→SQL→Opp by segment.
- SDR-mgr funnel diagnosis table (poor ICP targeting / weak qualification / quantity over quality) → automated diagnosis.
- Sales-mgr campaign oversight (proof analysis, risk, readiness) and "coach on content improvement"; velocity/stuck-stage patterns (long Proposal = pricing/objection) → messaging updates.
- AE meeting transcripts ("surface patterns and objections") + Win/Loss Themes report + Voice of Customer → objection handling and proof points for V2.
- Deal outcomes (Closed Won/Lost, win rate, stage conversion) linked back to originating campaign/persona.
- "Update team on campaign changes" (SDR-mgr) → the V2 playbook is the artifact.
**Human-approval fit:** mirrors graph8's existing approval patterns - Company Profile **Approve** gate (GM M1), human choice among AI campaign ideas (GM M3), Copilot "shows you the change before applying it" (AE M4), Campaign Passport export for client walkthrough (GM M5). A V2 could be packaged as a Campaign Passport-style diff (what changed + evidence) and pushed back via Push to Campaign / Create Sequence.

**Buyer / user:** primary user is the **Growth Manager** (owns Mission 5 "Monitor and Optimize", daily optimization checklist, client deliverables; 20+ hrs/week/client value claim). Approvers/buyers are **Sales Managers** (campaign readiness oversight, win rate, pipeline) and **SDR Managers** (funnel conversion, ICP refinement, messaging consistency); for agencies, the **client** approves via the Campaign Passport walkthrough.

### Combined loop
Source Scout feeds the front of the funnel (step 5-6 in Section 7), Flywheel closes the back (step 14 → steps 2-4 and 8-9). Together they turn graph8's linear, human-analyzed GTM flow into a closed loop where outcome data drives both *who* to target (new sources/ICP) and *what* to say (playbook V2).
