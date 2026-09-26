# graph8 Desktop — Knowledge Base Notes

Source: 34 pages scraped from docs.graph8.com/desktop/* (files `desktop*.md`). All pages are short (≈400–3,000 chars each, ≈27 KB total). The docs are **feature-level overviews, not technical references**: almost no numeric limits, pricing/credit costs, API endpoints, or data schemas are given. Where a detail is absent it is marked *(not documented)*.

Missing page: the hub lists "What is graph8 Desktop?" as a popular article, but no file for it was downloaded (only `desktop.md`, the hub index). The nav sequence also shows Desktop comes after a "Switching Between Accounts" page (Cloud docs) and the Desktop section ends by linking to "Getting Started" (next top-level section).

---

## 1. What graph8 Desktop is (hub page)

A native desktop app (macOS + Windows) that runs **locally** alongside graph8 Cloud ("Studio"). Eight functional areas:

| Area | One-line purpose (from hub) |
|---|---|
| Get Started | Install, run setup wizard, connect accounts |
| LinkedIn | Organize network, track engagement, take actions |
| X (Twitter) | Manage X presence, organize data, post |
| Workbench | Local data tables with AI enrichment, formulas, triggers, cloud sync |
| Radar | Screen intelligence that captures and surfaces sales signals from daily work |
| Brain | Auto-generated knowledge graph of contacts, companies, signals |
| Copilot | AI assistant with 40+ tools (browser control, research, productivity) |
| Tasks & Autopilot | Autonomous multi-step tasks + pattern detection that suggests actions |

Core architectural idea (inferred from pages collectively, stated piecemeal): a built-in browser with a persistent logged-in profile scrapes/organizes the user's own LinkedIn and X data into a local SQLite "Workbench"; Radar OCRs the whole screen every 30 s and extracts signals; an LLM synthesis pipeline turns signals into markdown "Brain" pages; Copilot (agent with 40+ local tools) operates over all of it; data goes to graph8 Cloud only on explicit sync.

---

## 2. Get Started

### Installation (`/desktop/installation/`)
- **OS:** macOS (Apple Silicon and Intel) or Windows 10+. **RAM:** 8 GB+ recommended.
- **Download:** from graph8.com or a direct link in your account.
- **First-launch permissions (macOS):** Accessibility (desktop-control features), Screen Recording (Radar).
- **Auth:** PropelAuth. Click *Connect* → browser opens login/signup → log in/create account → deep-link callback `g8-desktop://auth` returns you to the app.
- After login the app **auto-generates an API key** and **connects to the WebSocket job server** (the cloud-to-desktop job channel; no further detail on protocol or what jobs are pushed).

### Setup Wizard (`/desktop/setup/`)
Steps (any can be skipped; re-run from Settings > Services > *Re-run setup wizard*):
1. Welcome
2. Browser Setup — creates the persistent browser profile
3. LinkedIn Login — built-in browser opens LinkedIn; log in normally; Desktop detects session and confirms
4. X Login — same flow; multiple X accounts via X's native account switcher
5. Radar Permissions — Screen Recording + Accessibility (macOS)
6. Complete

### Browser Profile (`/desktop/browser-profile/`)
- Built-in browser with a **persistent profile stored locally**; sessions survive restarts (no re-login to LinkedIn/X).
- Clear the profile from Settings to start fresh; browser status shown at Settings > Profile > Device.
- Gotcha: automation (LinkedIn/X actions, scraping, MCP) runs **through the user's real authenticated session** — account-risk implications are not discussed in docs. `check_session` tool exists to "detect CAPTCHAs", implying LinkedIn/X bot checks are an expected failure mode.

### Settings (`/desktop/desktop-settings/`)
- **Profile tab:** account info (email, name, **org ID, user ID**); **Personal context** free-text that shapes *all* Copilot responses; theme (Light/Dark/System); **Device info** (device ID, **job client connection status, MCP server status**); About (version, **API endpoint**); Sign out.
- **Services tab:** LinkedIn status/login/logout; X multi-account add/remove; session display (profile, connection date, status); re-run wizard.
- **Schedules tab:** table of all scheduled sync jobs with columns **name, frequency, daily limit, lookback days, retry interval, last run**; enable/disable toggle per workflow; *Add new schedule* = select **skill** + frequency (Hourly/Daily/Weekly/Monthly) + daily limit + lookback days + retry interval; delete workflow. → Sync jobs are themselves "skills" run on a schedule. No default values documented.
- **Connectors tab:** manage external integrations.
- **Skills tab:** **view and edit skill source code** (skills are user-editable code locally).
- **Radar tab:** role configuration (SDR / AE / CSM) and Radar settings.
- **LLM tab:** local model status (ready / not downloaded), model ID and size, download with progress bar, test model. → There is an **on-device LLM** (model name/size not documented) used by the `local_llm` tool for classification/extraction/tagging/summarization.

### MCP Server (`/desktop/mcp-server/`)
- Built-in MCP server exposing **11 browser tools**; launched with `npm run mcp` (implies a Node/Electron codebase; unclear how an end user runs this from an installed app — possibly a dev-oriented instruction).
- **Transport:** stdio. **Clients:** Claude Desktop, Cursor IDE, any stdio MCP client.
- **Tools:** `browser_navigate`, `browser_click`, `browser_type`, `browser_scroll`, `browser_snapshot` (accessibility snapshot with reference numbers), `browser_hover`, `browser_go_back`, `browser_go_forward`, `browser_wait`, `browser_select_option`, `browser_extract`.
- **Shared session:** the MCP server drives the *same* browser instance as the app (so an external agent can browse with the user's LinkedIn/X login).
- Note: this Desktop MCP server is **browser-only**; it does not expose Workbench, Brain, Radar or Cloud list tools. (Cloud-side MCP is documented elsewhere, not in these files.)

---

## 3. LinkedIn

### Overview
Built-in browser where you log into LinkedIn normally; "as you use LinkedIn, Desktop helps you organize and enrich the data you interact with." Capabilities: network organization (local), company intelligence, content tracking (posts, comments, feed), **search and discovery** (find/organize people from LinkedIn search results), **cloud sync** ("push organized data to graph8 Cloud when you're ready").

### Organizing Data (`/linkedin/syncing/`) — 15 auto-sync data types
Your Profile; Profiles (viewed/interacted); Connections; Followers; Following; Messages; Feed; Your Posts; Your Comments; **Search Results** (people from LinkedIn searches); Companies; Company Posts; Company Followers; Company Visitors; Company Messages.

Scheduling (Settings > Schedules): Hourly/Daily/Weekly/Monthly; **weekday-only** option; **"Smart refresh"** detects incomplete data and retries automatically. Per-schedule daily limit + lookback days (from Settings page) — defaults undocumented, presumably to stay under LinkedIn rate limits.

### Actions (`/linkedin/actions/`)
Connect (optional note), Accept pending requests, Message, Post, Like, Comment, Visit Profile. Triggered via **Copilot natural language** ("send a connection request to [name]"); executed through the built-in browser in the authenticated session. No bulk-action limits, throttling or sequencing documented.

### Company Intelligence (`/linkedin/companies/`)
- Workbench left panel lists tracked companies (i.e., company pages you admin — followers/visitors/messages are admin-only LinkedIn data). Per company choose to monitor Followers / Visitors / Messages.
- Shows name, follower count, visitor count, message count.
- Periodic refresh; company posts on a separate schedule. All company data flows into **Workbench tables and Radar** for extraction.

---

## 4. X (Twitter)
- Multi-account via X's native switcher; add accounts in Settings > Services.
- Data types: Profile, Your Tweets, Followers, Following (4 types; much narrower than LinkedIn — no feed, search, DMs).
- Actions: Post Tweet, Reply to Tweet (via Copilot NL).
- Scheduling same as LinkedIn.

---

## 5. Workbench (local data tables)

### Overview
- Local data tables stored in **SQLite on your machine**.
- Two types: **Auto-sync tables** (populated from LinkedIn/X: connections, profiles, posts, companies, messages, followers, following, search results) and **User workbenches** (custom tables for any purpose).
- UI: left sidebar of auto-sync types with counts, **new-row badges (+N)**, sync status indicators; main grid (sortable columns, row selection, detail sidebar); **Analytics tab** for visualization.

### Importing
- **CSV upload** with column mapping (file picker).
- **Paste import** from clipboard (tabular).
- **Cloud list import** — pull graph8 Cloud (Studio) lists into a local workbench.
- **Auto-sync import** — from any auto-sync data type.
- Column mapping available for CSV and cloud list imports.
- No row limits documented.

### AI Enrichment
- Add **AI columns**; each uses an LLM with a **prompt template** + selected input columns from the row.
- Configure via the **AI Config sidebar**: set template → select input columns → run.
- Batch processing with real-time progress; cancel any time; rerun failed rows individually; "run all AI columns at once."
- Not documented: which model (cloud vs the local LLM), cost/credits, whether it can do web research, output typing.

### Formulas & Triggers
- **Formula columns:** expressions over other columns; *Evaluate* (test before applying); *Recompute* (recalc all). Expression syntax not documented.
- **Triggers:** automation rules firing on **row changes**: define a condition + an action; update/delete; dedicated Triggers tab. Available action types not documented.

### Cloud Sync
- **Push to Cloud** — sync local workbench data to graph8 Cloud (Studio).
- **Map & Export Wizard** — map local columns → cloud **list fields**, then export.
- **Link Cloud List** — associate a local workbench with a cloud list for ongoing sync; "changes can flow between local and cloud" (bidirectional implied, conflict behavior undocumented).
- **Download Cloud List** — import a cloud list locally.
- **Sync status** — last sync time and error states per linked workbench.
- This is the documented bridge **Desktop → graph8 Cloud lists**. Underlying API not documented here.

---

## 6. Radar (screen intelligence)

### Overview
- Watches your screen: captures via **OCR**, analyzes with AI to extract structured data, surfaces sales signals.
- **Role-based views:** SDR → prospecting signals; AE → deal signals; CSM → retention signals.
- **8 tabs:** Dashboard, Timeline, Deals, Campaigns, Contacts, Companies, Discoveries, Meetings.
- Status indicator: Green active/capturing, Yellow starting, Gray off, Red error.

### Screen Intelligence
- **Records screen every 30 seconds**, auto-ingested. Text cleaned + deduplicated before storage.
- Timeline view by date; keyword search across all captured text.
- **Privacy:** "All data is stored locally and never sent to the cloud unless you explicitly sync it." (Note: whether the AI extraction step uses a cloud LLM vs the local LLM is not stated — potential tension with the privacy claim; unverified.)
- `search_screen` Copilot tool mentions **OCR text and audio** — audio is captured too (meetings).

### Signals & Discoveries
- Signal types: **Hiring** (job posts, team growth), **Promotion** (title changes), **Funding** (investment rounds), **Company news** (launches, partnerships), **Job change** (people moving companies), **Engagement** (who interacts with your content).
- New signals go to the **Discoveries queue**. Review: **Accept → creates a Brain page**; **Dismiss → removes**.
- **Relevance scoring:** ranked by importance based on role (SDR/AE/CSM). Scoring formula undocumented.

### Data Grids
Per-entity grids with sort, filter, detail sidebar, entity dialogs: **Deals** (stage, value, contacts, signals), **Campaigns** (campaign performance and engagement data — source unclear; possibly pulled from Cloud or extracted from screen), **Contacts** (merged from LinkedIn, X, meeting captures), **Companies** (all sources), **Discoveries** (awaiting review), **Meetings** (speakers, action items).

### Meetings
- Captured from Radar **audio + screen recording** (tool-agnostic — no Zoom/Meet integration named).
- Automatic speaker detection; rename, merge duplicates, hide speakers.
- Detail dialog: info, participants, **extracted signals**; **meeting notes auto-generated from transcript**.

### Productivity
- Daily productivity metrics from screen activity; **"Digital twin analysis"** (AI profile of your work patterns/time use); daily summaries of work and people interacted with; trend tracking. No metric definitions.

---

## 7. Brain (personal knowledge graph)

### Overview
- "Second brain" — **all pages auto-generated from Radar extractions**; "you never write them manually" (though pages are editable).
- Stored as **markdown files at `~/.config/graph8 Desktop/brain/`** (plain files → easy to read/ingest from outside the app).
- Two modes: **Work** (sales/professional) and **Life** (personal). Full-text search. Pages linked by **backlinks**.

### Pages & Types — 16 types
contact (synthesized from LinkedIn, X, meetings), company, deal, signal (hiring, funding, etc.), meeting (notes + action items), journal (daily, auto), weekly (weekly review), **workflow** (automation workflow documentation), project, resource, idea, reference, template, snippet, archive, other.
Browse by type/search/recent; rich-text editor with autosave; backlinks panel.

### Knowledge Graph
Visual network of pages; **importance scoring** (most connected = larger nodes); **community detection** (clusters); connections form automatically from backlinks and **shared entities**. Click to navigate, zoom/pan.

### Auto-Synthesis
- **LLM-powered pipeline** creates/updates Brain pages from Radar extractions.
- **60-second queue**: Radar extracts a signal → synthesis creates or updates a page. UI shows pending and processing counts.
- **Daily memory journals** auto-generated. Fully automatic.
- Inconsistency: Signals page says Brain page is created on *Accept* in Discoveries; Synthesis page says it's fully automatic from extractions. Likely: entity pages auto-synthesize, signals need acceptance — unconfirmed.

---

## 8. Copilot (agent)

### Overview
AI assistant with **40+ local tools**: browser control, files, Brain search, skills, workflows, desktop apps. **Three-tier memory:** Agent memory (past tool outcomes stored for reuse), Brain search, Session memory (rolling summaries). Project-based conversations, streaming, access to all skills and desktop controls.

### Chat & Projects
- Streaming chat; **model selector** (models not listed).
- Attachments: images, files, **select skills (e.g., `/skill-creator`)** — skills are slash-invoked and there is a skill that creates skills.
- Projects organize conversations.
- Session memory: **last 10 messages verbatim**, older compressed into summaries, token budgeting trims context.
- All messages saved **locally**; sessions support full CRUD.
- Personal context from Settings > Profile shapes all responses.

### Tools & Capabilities (full list)
- **System:** `system_state` (browser, executor, session, upload queue status — note an "upload queue" exists, i.e., cloud upload pipeline), `restart_browser`, `flush_executor` (clear stuck skill executor), `read_logs`, `read_db` (**SELECT queries on the local database** — the SQLite Workbench/Radar store), `check_session` (verify LinkedIn/X login, detect CAPTCHAs).
- **Browser:** `get_browser_pages`, `browser_navigate`, `browser_click`, `browser_type`, `browser_scroll`, `browser_snapshot`, `browser_hover`, `browser_wait`, `browser_select_option`, `browser_extract`, `browser_go_back/forward`.
- **Search & memory:** `search_screen` (OCR text, audio), `search_brain` (**Brain pages, agent memory, playbooks** — "playbooks" are a searchable artifact, undefined elsewhere), `brain_cleanup` (clean false-positive extractions).
- **Workflows:** `execute_skill` (any registered skill), `manage_workflow` (create/update/delete/toggle **scheduled workflows**), `run_radar_skill` (Radar extraction on captures — extraction is itself a skill), `schedule_radar_skill` (**cron**), `manage_autopilot` (accept/dismiss proposals).
- **Desktop control:** `desktop_screenshot`, `desktop_click`, `desktop_type`, `desktop_hotkey`, `desktop_launch_app`, `desktop_list_windows`, `desktop_focus_window`, `desktop_move_window`, `desktop_read_clipboard`, `desktop_write_clipboard`, `desktop_list_apps`, `desktop_script` (run system scripts), `desktop_notification`.
- **File system:** `list_directory`, `read_file`, `write_file`, `move_file`, `delete_file`, `search_files`, `create_directory`, `download_file`.
- **Integrations:** `run_gws` (Google Workspace: Gmail, Drive, Calendar, Sheets, Docs, Chat, Tasks), `local_llm` (classification, extraction, tagging, summarization on-device), **Dynamic MCP tools** from connected MCP servers (Copilot is also an MCP *client*).
- Notably **absent** from the documented list: any explicit graph8 Cloud tool (push to list, enrich via Cloud, sequence enrollment). Cloud interaction appears to go through Workbench sync, the WebSocket job server, or skills.

---

## 9. Tasks & Autopilot

### Tasks Overview
- Autonomous multi-step agent executions powered by Copilot.
- Lifecycle: **Planning → Running → Awaiting Input → Completed/Failed**.
- **Execution canvas:** visual step list with tool inputs/outputs.
- **25-iteration agent loop** (max 25 tool calls per task) — a hard limit worth noting.
- **Permission system** (approval before risky actions), **choice cards** (multi-choice decisions), streaming, **Task ideas** (AI-suggested tasks from your data and patterns).

### Connectors
- Multi-step wizard per connector. Auth: **OAuth** (browser flow) or **API key** (paste).
- Add/update/remove in Settings > Connectors; each connector **adds tools to Copilot**; available connectors come from a **connectors registry** (contents not listed).

### Autopilot
- Detects patterns in your activity and suggests actions.
- **Hourly light scan** (obvious patterns) + **nightly full scan** (deep AI reasoning).
- **Proposals:** Accept → activates the automation; Dismiss → removes.
- **Insights dashboard:** filter Suggested / Active / Dismissed.
- Configure in Settings (options undocumented). What data it scans (screen captures, Workbench, Brain, task history) is not specified — "your activity".

---

## 10. Cross-cutting facts, gotchas, and gaps

- **Local-first:** Workbench = SQLite; Brain = markdown on disk; Radar captures local; chat history local. Cloud only via explicit sync (Workbench Cloud Sync) — plus an upload queue and WebSocket job server whose scope is undocumented.
- **Skills are the unit of automation:** sync jobs, Radar extraction, and user automations are skills; editable source in Settings > Skills; scheduled via Schedules / `manage_workflow` / `schedule_radar_skill` (cron).
- **Undocumented everywhere:** pricing/credits for AI enrichment, which LLMs, rate limits/daily-limit defaults, trigger action types, formula syntax, conflict resolution in linked sync, Autopilot data inputs, Radar extraction schema, any REST/SDK API.
- **Platform risk:** LinkedIn/X automation through a real browser session (CAPTCHA detection tool exists).
- **Windows note:** macOS permission steps documented; Windows equivalents not.
- `npm run mcp` suggests the MCP server instructions target a source checkout/dev build.

---

## 11. Hackathon relevance

### (1) Source Scout — discover/evaluate new external B2B data sources and acquire them into graph8 lists

Directly usable Desktop pieces:
- **Browser automation as the scraping engine.** Desktop MCP server (stdio, 11 `browser_*` tools, shared logged-in session) lets an external agent (Claude Desktop/Cursor/our own MCP client) navigate a candidate source (directory site, association member list, conference exhibitor page, G2 category, job board), `browser_snapshot` + `browser_extract` rows. Copilot has the same tools plus `download_file`, `read_file`, `local_llm` for extraction/classification.
- **Workbench as the staging area.** Paste/CSV import scraped rows into a *User workbench*; **AI Enrichment columns** (prompt template over row columns) can score each row for ICP fit, normalize titles, or classify the source's data quality; **Formula columns** compute fill-rate/quality metrics; **Triggers** could flag rows meeting criteria.
- **Acquisition into graph8 lists** = **Cloud Sync → Map & Export Wizard** (local columns → cloud list fields) or **Link Cloud List** for recurring refresh. This is the only documented Desktop → Cloud list path.
- **Recurring acquisition** via Schedules (skill + frequency + daily limit + lookback days + retry interval) or `manage_workflow`; a custom "source scraper" could be written as a **skill** (Skills tab edits source; `/skill-creator` exists).
- **LinkedIn Search Results** auto-sync table is itself a "source" (people from LinkedIn searches) — a template for how a new source becomes a table.
- **Source evaluation signals:** Radar's signal taxonomy (hiring, funding, job change, promotion, company news, engagement) gives a ready vocabulary for scoring a new source by "which signals does it provide."
- Gaps/risks: no documented API to create cloud lists programmatically from Desktop (use Cloud APIs from other doc sections); no documented enrichment credit costs; scraping ToS/CAPTCHA risk; 25-iteration Task limit constrains long agentic crawls (chunk work or use scheduled skills).

### (2) Flywheel — learn from completed campaign outcomes to generate an improved campaign playbook V2

Directly relevant Desktop pieces:
- **Radar Campaigns grid** ("campaign performance and engagement data") and **Deals grid** (stage, value, contacts, signals) are outcome-shaped data local to Desktop; **Engagement signals** (who interacts with your content) and **Meetings** (transcripts, auto-notes, extracted signals, action items) are rich qualitative outcome inputs.
- **Autopilot pattern detection** (hourly light / nightly deep AI scan → proposals Accept/Dismiss, Suggested/Active/Dismissed) is conceptually the same loop as Flywheel (observe outcomes → propose improvements → human accepts). Flywheel could mirror its UX: proposals with accept/dismiss rather than auto-applying.
- **Brain synthesis** is a model for turning raw events into structured knowledge pages: LLM pipeline, 60 s queue, daily journals + **weekly review** pages, importance scoring and community detection over the graph. A "playbook V2" could be emitted as a Brain page (types `workflow`, `template`, or `reference`) or as markdown in `~/.config/graph8 Desktop/brain/` — readable by Copilot via `search_brain`, which already indexes **"playbooks"**.
- **Agent memory** ("past tool outcomes stored for future reference") is a precedent for outcome-conditioned learning.
- `read_db` (SELECT over local DB) gives an agent structured access to Workbench/Radar tables for analysis; `run_gws` can pull Gmail/Sheets campaign data.
- Gaps: the Desktop docs don't describe campaign/sequence execution or reply/meeting-booked metrics — those live in graph8 Cloud (sequences/campaigns sections, not in these files). Flywheel should source outcomes from Cloud APIs and optionally enrich with Desktop meeting/engagement context.

### Overlap between the two projects (shared building blocks)
- **Workbench + AI Enrichment + Cloud Sync**: Source Scout's acquisition path; Flywheel could also use AI columns to label outcome rows (e.g., classify reply sentiment).
- **Radar signal taxonomy & relevance scoring by role**: Source Scout evaluates sources by signal coverage; Flywheel correlates which signals preceded wins.
- **Autopilot proposal pattern (suggest → accept/dismiss)**: good UX template for both ("new source proposed" / "playbook change proposed").
- **Brain synthesis/knowledge graph**: Source Scout could write a `resource`/`reference` page per evaluated source; Flywheel writes playbook pages. Both benefit from the markdown-on-disk format.
- **Skills + Schedules**: both can be packaged as scheduled skills (recurring source refresh; periodic post-campaign retro).
- **Desktop MCP server**: only browser tools — useful to Source Scout's scraping, not to Flywheel.
