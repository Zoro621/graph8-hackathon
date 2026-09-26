# graph8 MCP Server — Knowledge Base Notes

Source: plain-text extracts of docs.graph8.com under `scratchpad/docs/` — `developers__mcp.md`, `developers__mcp-tools.md`, `developers__mcp-examples.md`, `developers__mcp-faq.md`, all 12 `developers__mcp-reference__*.md` family pages, `developers__api-mcp-coverage.md`, `developers__what-you-can-ask.md`, `developers__automation-platforms.md`, and the setup pages for Claude Code, Claude Desktop, Cursor, VS Code, n8n, LangChain, LlamaIndex, CrewAI, Pydantic AI and OpenAI Agents SDK. The scrape contains no `skill-library*` page. The docs site links to a "Skill Library" page, but that page was not captured. The Skill Library is covered here through its three MCP tools (`g8_library_*`). A few cross-references come from `roles__ae.md`, `roles__gtm-engineer.md`, `ai-features__skills.md` and `developers__skills.md`, and each one is labelled where it appears.

Nothing below is invented. Where the docs contradict each other (tool counts especially), both values are recorded and the conflict is flagged.

---

## 1. Server at a glance

| Item | Value (from docs) |
|---|---|
| Remote endpoint | `https://be.graph8.com/mcp/`, transport Streamable HTTP (LangChain `streamable_http`, CrewAI `streamable-http`, VS Code `"type": "http"`) |
| Remote auth (interactive clients) | OAuth in the browser, done once. graph8 issues an opaque session token tied to your PropelAuth identity, and the client holds it and rotates it automatically. Active sessions appear under **Profile -> Connections** |
| Remote auth (headless, e.g. n8n and automation platforms) | `Authorization: Bearer g8_...` header carrying a personal or org API key. Keys are long-lived: they "do not expire after 24 hours of inactivity" |
| Local server | `uvx g8-mcp-server` (PyPI package `g8-mcp-server`; `pip install g8-mcp-server` also installs the `g8` CLI). stdio transport, needs Python 3.10+ |
| Local env vars | `G8_API_KEY` (required), `G8_MCP_MODE` = `dev` / `gtm` / `all` (default `all`), `G8_API_URL` (default `https://be.graph8.com`, for self-hosted or staging) |
| Key types | **Personal API key**: Profile -> Developer. Scoped to your user inside the active org and recommended for end users. **Org API key**: Settings -> API. Admin only, for shared automation, service accounts and production |
| Credential file (CLI) | `~/.g8/credentials.json` if you ran `g8 login --api-key` |
| Doc index for agents | `https://docs.graph8.com/llms.txt` |
| REST mirror | "Interactive Swagger docs — same surface, exposed as REST". REST base shown in the skills page: `https://be.graph8.com/api/v1/...` with `Authorization: Bearer $API_KEY` |
| Supported clients (listed) | Claude.ai, Claude Desktop, Claude Code, Cursor, Windsurf, ChatGPT (Settings > Apps > Developer Mode), VS Code (1.86+, Copilot Agent Mode), n8n, LangChain/LangGraph, LlamaIndex, CrewAI, Pydantic AI, OpenAI Agents SDK. Zapier and Make are "coming soon" |

### Personal vs admin setup
- Most users should set up a **personal** MCP connection from Profile -> Developer, which does not need org admin rights.
- Org keys (Settings -> API) are for "Shared org automation and admin-managed integrations".
- Tip from the docs: a non-admin who wants MCP for themselves should use the personal flow in Profile, not the admin-only org API settings.

### Remote vs local (FAQ table)
| | Remote OAuth | Local stdio |
|---|---|---|
| Where it runs | graph8 cloud | your machine |
| Auth | OAuth in browser, one-time | `G8_API_KEY` env var |
| Install | none | `uvx g8-mcp-server` |
| Best for | Claude.ai, Claude Desktop, VS Code, hosted agents | Cursor, Windsurf, local dev, CI |
| Tools loaded | all tools your role grants (mode filtering "coming soon") | filterable via `G8_MCP_MODE` |

Data residency: graph8 returns tool results to your MCP client, and your LLM client then puts them in the prompt. graph8 "does not push data to model providers directly". If you have residency requirements, the docs recommend self-hosted stdio.

---

## 2. Modes, tool counts, progressive discovery

### Modes (`G8_MCP_MODE`, stdio only; remote loads everything your role grants)
The docs give conflicting counts:

| Mode | Overview page (`developers__mcp.md`) | FAQ / Claude Code / VS Code pages | Best for |
|---|---|---|---|
| `dev` | 32 tools | 17 tools | Developers in Cursor / Windsurf / Claude Code: repo scan, install snippets, forms, CRM ops |
| `gtm` | 51 tools | 23 tools | Campaign managers / marketing ops in Claude Desktop: campaigns, mailbox warmup, pipelines, ICPs, personas, CRM ops |
| `all` | 114 tools | 35 tools | Everything: dev + GTM + voice/dialer + workflow builder + skill authoring. This is the default for remote OAuth |

- In `all` mode, GTM tools are namespaced `g8_gtm_*` (e.g. `g8_gtm_list_campaigns` instead of `g8_list_campaigns`), along with `g8_voice_*` and `g8_workflow_*`, to avoid name collisions. The unprefixed forms (`g8_create_campaign`, `g8_get_icps`, `g8_launch_campaign`, ...) are the gtm-mode names.
- Skill tools are **dual-registered** as `g8_skill_*` and `g8_workflow_skill_*` (same handler), so the overview says there are "~100 distinct operations".

### Total registry size (also inconsistent across pages)
- `developers__mcp-tools.md`: "The graph8 MCP registry contains **586 tools** in this documentation version." Families: Campaigns 64, Clickhouse 2, CRM records 382, Intent 16, Skill library 3, Marketplace 36, Opensearch 4, Playbook 2, Skill 28, Voice 16, Workflows 33 (sum = 586). The generated per-family reference pages match these counts exactly.
- `g8_tool_search` description: "graph8 ships 586 tools but only **126 are visible at connect time**."
- Overview page: remote advertises "only **~31 always-on tools** at connect time, plus the `g8_tool_search` meta-tool", with 80+ more loaded on demand.
- `developers__api-mcp-coverage.md`: "In the audited contract, **all 564 API operations** have a direct call from a registered MCP tool. MCP server 0.64.0 includes 145 additional tools..." It also says "The current registry has **599 tools**."
- The API-coverage reference page: "These 145 tools extend progressive discovery", released across versions: 117 in 0.58.0, 5 reads in 0.59.0, 5 operator reports in 0.60.0, 9 app-object ops in 0.61.0, TLS readiness plus 2 public-widget calls in 0.62.0, 2 credential exchanges plus observed build reporting plus a human-approval handoff in 0.63.0, and a human-authorized decision relay plus app-record change history in 0.64.0.

### Progressive discovery (important for any agent build)
- `g8_tool_search(query=..., tool_names=[...], limit=8, activate=true)` ranks every registered tool and **activates** the top matches for the session. The server then emits `notifications/tools/list_changed`, and the tools show up on the next `tools/list`. The activated set is Redis-cached for 4 hours.
- Search is family-aware and understands synonyms ("automation" -> workflow, "dialer"/"phone" -> voice, "competitor"/"signals" -> intent). The result carries `detected_groups`, and the top matches include `input_schema`.
- Hidden until searched: workflow, voice/dialer, intent, skill, custom fields, forms, snippet and playbook tools.
- **`g8_execute(tool_name, arguments)`** runs ANY registered tool by name, even when the client has not refreshed its palette. It returns `{ok, result}` or `{ok:false, error, error_type, hint}` (plus `input_schema` on `invalid_arguments`). The docs say: "Never tell the user a graph8 capability is unavailable without trying this first." It does NOT turn arbitrary API routes into tools.
- Per-mode remote URLs (`?mode=dev`, `?mode=gtm`, `?groups=audience-sync,inbox`) are **roadmap, not shipped**.
- External-server note: when graph8 workflows or agents connect to *third-party* MCP servers, that configuration currently accepts **SSE and stdio** only. Do not assume a Streamable-HTTP or OAuth server will work there unchanged.

### Resources and prompt templates
- Resources (read-only): `g8://repos`, `g8://repos/{repo_id}/scan`, `g8://repos/{repo_id}/kb`, `g8://repos/{repo_id}/kb/{doc_id}`, `g8://repos/{repo_id}/campaigns`, `g8://repos/{repo_id}/campaigns/{campaign_id}/brief`, `g8://contacts`, `g8://companies`.
- Prompts: `gtm_setup(repo_url)` runs the full connect, scan, install, launch flow. `campaign_review(campaign_id)` reviews and optimizes a campaign. `icp_refinement(feedback)` refines the ICP from feedback. `g8_current_org` also mentions a `get_started` prompt for a guided walkthrough on first connect.

---

## 3. Permissions, orgs, safety model

- **Role-bound**: "The MCP can only do what your graph8 role can do." Permission-denied errors mean you lack the same capability in the app, and an admin fixes it in Settings -> Members. The OAuth session sees exactly what your user sees, with the same org boundaries.
- **Key scoping**: API keys cannot yet be restricted to specific tools; they carry the user's or org's full permission set (on the roadmap). Some tools need explicit scopes, e.g. `intent:read` for visitor and company-signal reads, `analytics:read` for analytics reports, `knowledge:export`, `objects:manage`, `workflows:write`, and `meetings:see_transcripts` / `meetings:see_all`. `g8_connection_describe_current_key` explains the scopes a key carries and answers "why did that call 403?".
- **Multi-org**: each MCP session is tied to one org.
  - OAuth binds to the org that was active when you authorized. To switch, revoke the session (Profile -> Connections), switch orgs in the web app, and reconnect. Alternatively, add several servers to `mcpServers` (e.g. `graph8-acme`, `graph8-staging`).
  - In-session tools: `g8_current_org` (call once at session start, surface the result, show the "activity brief"; `action_required=true` means the user has multiple orgs and none chosen), `g8_list_orgs`, and `g8_switch_org(org)`, which takes effect on the user's **next message** and applies to every connected client.
- **Parallelism**: several MCP clients or instances can run at once. Billing is per call and rate limits are per org.
- **Confirm before commit**: the server enforces a "confirm before commit" rule for any tool that costs credits or sends outreach. The usual patterns:
  - `dry_run=True` returns a ConfirmationPreview or confirmation widget; call again with `dry_run=False`.
  - For the 145 API-coverage tools, the default call returns `confirmation_required` without sending any request. Set `confirm=true` after review.
  - Every reference page repeats: "For actions that send messages, spend credits, delete data, or start execution, review the intended records and confirm the action before proceeding. Obtain IDs from a prior result; do not invent them. A registered tool does not guarantee that its supporting service is available in every organization."
- **Human approval relay (0.64.0)**: `g8_agent_submit_human_decision(approval_id)` needs a personal API key with `workflows:write` and approval permissions, plus `G8_APP_URL`. Without a stored authorization it returns a link to the exact approval in graph8. The human signs in, reviews and chooses, and the agent calls again within 5 minutes. The tool cannot choose a decision or edit action details. "A tool confirmation or elicitation response cannot substitute for human authorization." Org API keys cannot submit this relay. `g8_agent_human_approval_handoff` is the read-only companion.
- **Deliverability protection**: `g8_find_contacts`, `g8_find_companies` and the OpenSearch mashup reads automatically apply the org's default-on deliverability protection policy (Settings > Compliance > Deliverability), which may exclude high-risk account categories.
- **Suppression**: `g8_crm_list_suppressions` is the do-not-contact ledger that every send path checks (sequencer, newsletter, audience sync). Categories: `contact_initiated` (never lift), `org_initiated` (reversible), `system` (bounce, complaint, DNC).

---

## 4. Pricing, credits, limits, errors

- **Free tier**: Developer PAYG gives 1,000 free credits on signup with no card required. MCP calls bill the same way as SDK and REST calls.
- **Credit price**: $0.05 per credit on PAYG, $0.00666 per credit on Platform overage.
- **Free on both plans, within the 50 rps cap**: graph8-owned data. That covers first-party CRM (/contacts, /companies, /deals, ...), B2B index search and lookup (`g8_find_contacts`, `g8_find_companies`, `g8_lookup_person`, `g8_lookup_company`), all `g8_intent_*` reads, visitor reads, save-to-list, and internal email verify.
  - Conflict: the `g8_lookup_person` / `g8_lookup_company` tool descriptions and the FAQ "Preview tools" section both say lookups "cost 1 credit" and do not save.
- **Always charges credits**: waterfall enrichment through third-party providers (`g8_enrich_contacts`), copilot turns (per LLM token), AI reply drafts (`g8_get_reply_draft`), skill execute with type=llm, voice minutes (**20 credits/min**), meeting bookings (**20 each**; `g8_create_booking` says "~20"), sequencer / campaign / newsletter sends, intent signal processing (background ingest, 1 per 10 events), audience-sync pushes, and external email verifiers (Kickbox, ZeroBounce).
  - Enrichment specifics: waterfall costs the sum of provider step costs, AI research is ~3 credits per contact, and ZeroBounce verification is ~1 extra credit per row. Providers funded by graph8 system keys charge credits. BYOK keys charge no credits. `lusha` and `rocketreach` are BYOK-only.
- **Monitoring spend**: Profile -> Developer -> Usage panel (24h / 7d / month, broken down by source: MCP, SDK, REST, UI). Also `g8_usage_get_usage` and `g8_usage_list_usage_transactions`.
- **Rate limits**: 50 requests/second plus 1,000 requests/minute **per org** across REST, SDK and MCP. Bursts get HTTP 429 with `Retry-After`. Responses carry `X-RateLimit-*` headers.
- **Timeouts**: long tools (`g8_build_contact_list`, `g8_enrich_contacts`) can take 30–90 s, and most clients time out at 60 s. Workarounds: preview first with `g8_find_contacts` and then save smaller batches, raise the timeout in Claude Desktop, or raise the per-tool timeout in your framework.
- **Common errors (FAQ)**:
  - `spawn uvx ENOENT`: uv is not on PATH, so use the absolute path to `uvx`.
  - 401 / auth failed: the key is expired, revoked, or belongs to another org. Regenerate it and restart the client. For OAuth, revoke under Profile -> Connections and reconnect. Revocation is immediate.
  - Permission denied: role issue.
  - Tool not found: typo (names are case-sensitive with the `g8_` prefix), wrong mode, or an outdated `g8-mcp-server` (fix with `uvx g8-mcp-server@latest` or `pip install -U g8-mcp-server`).
  - OAuth redirect loop: clear cookies for be.graph8.com and app.graph8.com. For custom or self-hosted setups, check that `redirect_uri` is right.
  - Claude Desktop JSON parse error: invalid config JSON (trailing commas, smart quotes).
  - `g8_create_field` without enrichment providers leads to `422 waterfall_config_missing` when you later Enrich.
  - `g8_get_reply_draft` returns 402 when credits are insufficient.
- **Preview / dry-run tools (FAQ)**: `g8_find_contacts` (before saving), `g8_get_sequence_preview` (before launch), and `g8_lookup_*` (a data-quality check before bulk enrichment).
- **Name drift**: the FAQ, examples and framework pages refer to **`g8_build_contact_list`** (saving a list, "charges credits"). That tool does **not** appear in the 586-tool reference. The current reference equivalent is `g8_create_list(title, filters=[...], max_results, dry_run)` ("search + save from open data (free, no credits)"). `g8_gtm_launch_campaign` likewise refers to `g8_list_agents`, which is not in the reference (voice agents are listed by `g8_voice_list_agents`).
- **What-you-can-ask page is stale**: it still says "Currently, MCP provides read access to campaigns, accounts, deals, and intelligence. Creating new records requires using the graph8 Studio UI or API directly." That contradicts the current write tools (create_campaign, create_deal, etc.).

---

## 5. How to connect (config snippets, verbatim shapes)

**Claude Code** (`~/.claude/mcp.json`) — remote OAuth:
```json
{ "mcpServers": { "graph8": { "url": "https://be.graph8.com/mcp/" } } }
```
Then `claude mcp list`, run `claude`, and the first graph8 call opens a browser for OAuth.

**Claude Code / Cursor / Windsurf / Claude Desktop** — local stdio (headless / CI):
```json
{ "mcpServers": { "graph8": {
    "command": "uvx", "args": ["g8-mcp-server"],
    "env": { "G8_API_KEY": "<your-api-key>", "G8_MCP_MODE": "dev" } } } }
```
(`"gtm"` for campaign managers, `"all"` for everything.)

**Claude Code slash command** (`.claude/commands/prospect.md`), as given in the docs:
```
---
name: prospect
description: Find and save SaaS prospects via graph8 MCP.
---
Use the graph8 MCP server to find prospects matching: $ARGUMENTS.
1. Use g8_find_contacts to preview matches.
2. Show me the top 10 by signal score.
3. On my confirmation, save them with g8_build_contact_list.
4. Report the new list ID.
```
(Given the name drift above, use `g8_create_list(filters=...)` in practice.)

**Claude.ai / Claude Desktop**: Settings -> Connectors -> Add custom connector -> `https://be.graph8.com/mcp/` -> Add -> Connect -> authorize once. Older builds label this MCP Servers / Extensions / Plugins. The old `claude_desktop_config.json` flow no longer exists for remote servers.

**Cursor**: `.cursor/mcp.json` (project) or `~/.cursor/mcp.json` with `{"mcpServers":{"graph8":{"url":"https://be.graph8.com/mcp/"}}}`, then reload Cursor.

**VS Code** (`.vscode/mcp.json`):
```json
{ "servers": { "graph8": { "type": "http", "url": "https://be.graph8.com/mcp/" } } }
```
stdio variant: `"type": "stdio"`, `command: uvx`, `args: ["g8-mcp-server"]`, with `G8_API_KEY` taken from an `${input:g8-api-key}` promptString (`"password": true`).

**n8n / headless HTTP** (JSON-RPC):
```json
POST https://be.graph8.com/mcp/
Authorization: Bearer YOUR_G8_API_KEY
Content-Type: application/json
{ "jsonrpc": "2.0", "method": "tools/call",
  "params": { "name": "g8_list_campaigns", "arguments": { "status": "active" } }, "id": 1 }
```
The n8n MCP Client Tool node takes the URL plus Header Auth (`Authorization: Bearer g8_...`). The docs recommend a dedicated org key for production. Going the other way, graph8 outbound webhooks can trigger n8n.

**LangChain / LangGraph**: `pip install langchain-mcp-adapters langgraph langchain-anthropic`
```python
client = MultiServerMCPClient({"graph8": {"transport": "streamable_http", "url": "https://be.graph8.com/mcp/"}})
tools = await client.get_tools()
agent = create_react_agent(ChatAnthropic(model="claude-sonnet-4"), tools)
# stdio: {"transport":"stdio","command":"uvx","args":["g8-mcp-server"],"env":{"G8_API_KEY":...,"G8_MCP_MODE":"gtm"}}
```
**LlamaIndex**: `BasicMCPClient("https://be.graph8.com/mcp/")` -> `McpToolSpec(client).to_tool_list_async()` -> `ReActAgent.from_tools(...)`. stdio: `BasicMCPClient(command_or_url="uvx", args=["g8-mcp-server"], env={...})`.

**CrewAI**: `pip install crewai 'crewai-tools[mcp]'`. Use `MCPServerAdapter({"url": "https://be.graph8.com/mcp/", "transport": "streamable-http"})`, and every agent in the crew shares one authenticated session. stdio goes through `StdioServerParameters(command="uvx", args=["g8-mcp-server"], env={...})`. Worked example: a prospector (`g8_find_contacts`), then an enricher (`g8_enrich_contacts` after approval), then a sequence loader (`g8_list_sequences` -> `g8_get_sequence_preview` -> confirm -> `g8_add_to_sequence`).

**Pydantic AI**: `pip install 'pydantic-ai[mcp]'`. Use `MCPServerHTTP(url="https://be.graph8.com/mcp/")` with `Agent("anthropic:claude-sonnet-4", mcp_servers=[server], output_type=ProspectList)` and `async with agent.run_mcp_servers()`. The typed-output pattern `SequenceEnrollment{sequence_name, enrolled_count, confirmation_required}` gates credit-charging steps in code.

**OpenAI Agents SDK**: `pip install 'openai-agents[mcp]'`. Use `MCPServerStreamableHttp(name="graph8", params={"url": "https://be.graph8.com/mcp/"})`, or `MCPServerStdio(...)` for stdio, and pass it as `Agent(mcp_servers=[server], model="gpt-4o")`.

All frameworks: the first run of a hosted setup triggers browser OAuth and later runs reuse the cached token. For CI and headless runs, use stdio with an API key.

---

## 6. Complete g8_* tool catalog

Legend for **Flags**, derived from the tool descriptions:
- `$`: spends credits or real money.
- `SEND`: sends messages, places calls, pushes data externally, or starts live execution.
- `IRREV`: irreversible or permanent.
- `DEL`: delete, archive or stop (reversibility varies; see the description).
- `dry_run`: the tool takes a `dry_run` preview flag.
- `confirm=true`: the default call returns `confirmation_required` and executes only with `confirm=true`.
- `free`: the description says it is free.
- `ADMIN`: graph8 platform admin only.

Blank means a plain read or ordinary write. "Required inputs" lists the schema-required parameters.

Tool rows marked `[METHOD /path]` are thin API wrappers ("Uses the current organization and existing API permissions"). Their input is typically path params plus a `body`, and writes need `confirm=true`.


### 6.1 CRM records family (382 tools)
Despite the name, this family covers the core platform. It includes contacts and companies, lists, fields, enrichment, deals, tasks, notes, sequences, inbox, meetings, appointments, quotes, syncs, newsletter, Radar competitive intel, custom objects, knowledge, the Work room, forms and landing pages, the developer repo flow, the app builder, dashboards, org/discovery, and webhooks/usage. The sub-groupings below are mine (by name prefix). The docs publish this as one flat alphabetical page.

Key usage notes from descriptions:
- **`g8_search_*` vs `g8_find_*`**: `search` covers YOUR CRM, while `find` covers graph8's open index for new prospects (700M+ contacts, 100M+ companies per the overview; free).
  - `g8_find_contacts` filter fields: first_name, last_name, work_email, job_title, seniority_level, job_department, role, linkedin_url, city, state, country, company_name, company_domain, company_industry, company_employee_count, company_revenue, company_founded_year.
  - `g8_find_companies` filter fields: name, domain, industry, industry_group, employee_count, revenue, founded_year, country, state, city, linkedin_followers.
  - Operators for both: any_of, contains, all_of, none_of, is_empty, is_not_empty, between, exists. Paging is `limit` (default 25, max 200) and `page`. Seniority is stored as full strings ("Vice President"); abbreviations auto-expand.
- **`g8_create_list`** takes exactly one source: `contact_ids` (free), `rows` (explicit records, free, no enrichment), or `filters` (search plus save from open data, free, capped by `max_results`, default 100). Use `dry_run=True` first for rows or filters. `g8_add_to_list` supports contact_ids or rows, but not filters.
- **`g8_enrich_contacts`** has modes `auto` / `waterfall` / `ai-research` (the last needs `ai_group_id`).
  - Allowed providers: graph8, hunter, prospeo, dropcontact, icypeas, leadmagic, emaillistverify, apollo, lusha, rocketreach.
  - `target_field` (phone, mobile, email, linkedin, or a canonical `CONTACT_*` / `COMPANY_*` column) makes each provider run the correct action. `email_verification=True` adds ZeroBounce.
  - Waterfall is async and you poll `g8_get_enrichment_job`. Contacts must already be in a list.
- **`g8_company_open_jobs`**: hiring signal for CRM companies (max 200 ids; free; `window_days` 1–365, default 60). Treat `lcid_confidence` 1.0 as an exact LinkedIn match and 0.7 as a domain fallback.
- **`g8_list_hot_contacts`**: ranks contacts by recent INBOUND engagement (replies, opens, meeting RSVPs), with `days` up to 365.
- **`g8_analytics_get_campaign_visitors`** is a single tool that reads **60 analytics reports** through its `report` argument (scope `analytics:read`). Report families:
  - campaign-visitors
  - acquisition/{campaigns, channels, channels/trend, referrals, search, social, sources}
  - audience/{behavior, demographics, geo, geo/cities, languages, overview, technology, trend}
  - behavior/{events, exit-pages, landing-pages, page-metrics, pages}
  - conversions/{forms, forms/analysis, forms/trend, funnel, goals, goals/trend, rate}
  - dialer/{grading/search, leaderboard, leaderboard/sdr, performance, quality, quality/leaderboard}
  - engagement/{by-campaign, by-channel, by-landing-page, depth-distribution, overview, time-distribution, trend}
  - marketing/{campaigns, content, content/by-landing, outbound-bridge, outbound-bridge/by-campaign, outbound-bridge/by-channel, outbound-bridge/by-landing-page, outbound-bridge/top-sources, outbound-bridge/trend, overview}
  - realtime/{-, locations, pages, sources}
  - sdr/{ai-agents/summary, detail, leaderboard, summary, trends}

  Windows are set with `days`, `start_date`/`end_date` or `date_from`/`date_to`. `sdr_email` is required for sdr/detail and dialer/leaderboard/sdr, and `path` is required for behavior/page-metrics.
- **Sequences**: step types are EMAIL, PHONE, SMS, WHATSAPP, HEYREACH (LinkedIn) and MANUAL_DIALER.
  - input_type is one of ON_DEMAND, MANUAL_TEMPLATE, AI_GENERATED_TEMPLATE, and `time_interval` is in seconds.
  - `sequence_kind` is cold_outbound or nurture. Nurture needs `pinned_mailbox_id` and sits behind the ENABLE_NURTURE flag.
  - `g8_get_sequence_preview` returns `step_data` (raw spintax) and `rendered` (variants, `will_send_as_shown`, `content_issues`).
  - `g8_generate_spintax` charges credits.
- **Inbox**: `g8_list_inbox` previews are enough to answer "who replied / what did they say". Call `g8_get_reply` only for a specific thread. Bodies are capped unless `full_messages=True`.
- **Meetings**: `g8_get_meeting` bundles the full transcript, summary, key topics, action items, CRM tasks and custom-field extractions. It is redacted without `meetings:see_transcripts`.
- **Radar**: the competitive-intel suite covers competitors (cap of 20), page, ad, traffic and LinkedIn monitoring, gap analysis, opportunities and initiatives, battle cards, and AEO share-of-voice. Several tools are BILLABLE, e.g. scans, AEO runs, gap analysis and `discover_pages(refresh=True)` (a paid Firecrawl call).
- **Knowledge**: `g8_knowledge_*` returns authorized, cited tenant knowledge concepts, and `g8_knowledge_context(task)` assembles "the smallest authorized, cited context pack for a task".
- **Work room**: `g8_work_*` covers the team's operating room of channels, messages and routines (scheduled or event-triggered agent instructions). Mentioning an agent in `g8_work_send_message` starts an agent turn.


#### CRM family - Contacts / companies / lookup / prospecting (30)

| Tool | Purpose (docs, first sentence) | Required inputs | Flags |
|---|---|---|---|
| `g8_company_open_jobs` | Find out what companies in your CRM are hiring for right now. | company_ids | free |
| `g8_create_company` | Create a company in your CRM. domain is required (e.g. | domain |  |
| `g8_create_contact` | Create a contact in your CRM database. Use this after g8_lookup_person to save a prospect you want to track, or to manually add a contact you know about. | work_email |  |
| `g8_crm_assert_companies_batch` | Assert Companies Batch [PUT /companies/assert/batch] | body | confirm=true |
| `g8_crm_assert_company` | Assert Company [PUT /companies/assert] | body | confirm=true |
| `g8_crm_assert_contact` | Assert Contact [PUT /contacts/assert] | body | confirm=true |
| `g8_crm_assert_contacts_batch` | Assert Contacts Batch [PUT /contacts/assert/batch] | body | confirm=true |
| `g8_crm_assert_deal` | Assert Deal [PUT /deals/assert] | body | confirm=true |
| `g8_crm_assert_deal_contact` | Assert Deal Contact [PUT /contacts/{contact_id}/deals/assert] | contact_id, body | confirm=true |
| `g8_crm_delete_company` | Delete Company [DELETE /companies/{company_id}] | company_id | confirm=true DEL |
| `g8_crm_delete_company_column` | Delete Company Column [DELETE /companies/columns/{column_id}] | column_id | confirm=true DEL |
| `g8_crm_delete_contact` | Delete Contact [DELETE /contacts/{contact_id}] | contact_id | confirm=true DEL |
| `g8_crm_delete_contact_column` | Delete Contact Column [DELETE /contacts/columns/{column_id}] | column_id | confirm=true DEL |
| `g8_crm_get_company` | Get Company [GET /companies/{company_id}] | company_id |  |
| `g8_crm_list_duplicates` | Find duplicate records, and review merges that already happened. | - |  |
| `g8_crm_list_suppressions` | List the org's do-not-contact ledger - who may NOT be contacted. | - |  |
| `g8_crm_resolve_duplicate` | Dismiss a suggested duplicate pair, or undo a merge. | - | IRREV confirm=true |
| `g8_crm_update_company` | Update Company [PATCH /companies/{company_id} and POST /companies/{company_id}/lifecycle-stage] | company_id | confirm=true |
| `g8_find_companies` | Search graph8's company database for new prospects. | filters | free |
| `g8_find_contacts` | Search graph8's contact database to find new prospects. | filters | free |
| `g8_get_company_contacts` | List the contacts attached to a company. Returns the people your org has recorded at a given company. | company_id |  |
| `g8_get_contact_activity` | List recent activities for a single contact. Returns the activity timeline (calls, emails, meetings, notes) for this contact, newest first. | contact_id |  |
| `g8_get_contact_company` | Get the company record attached to a contact. | contact_id |  |
| `g8_get_contact_detail` | Get the full detail record for a single CRM contact. | contact_id |  |
| `g8_list_hot_contacts` | Most-ENGAGED ('hot') contacts by recent INBOUND activity. | - |  |
| `g8_lookup_company` | Instantly look up a single company in graph8's data index. | - | $ |
| `g8_lookup_person` | Instantly look up a single person in graph8's data index. | - | $ |
| `g8_search_companies` | Search companies already in your CRM database. | - |  |
| `g8_search_contacts` | Search contacts already in your CRM database. | - |  |
| `g8_update_contact` | Update fields on an EXISTING contact (partial update). | - |  |

#### CRM family - Lists (7)

| Tool | Purpose (docs, first sentence) | Required inputs | Flags |
|---|---|---|---|
| `g8_add_to_list` | Add contacts to an existing list, by id or by explicit records. | list_id | dry_run free |
| `g8_create_list` | Create a contact or company list, optionally pre-populated. | title | dry_run free |
| `g8_crm_delete_list` | Delete List [DELETE /lists/{list_id}] | list_id | confirm=true DEL |
| `g8_crm_get_list_contacts` | Get List Contacts [GET /lists/{list_id}/contacts] | list_id |  |
| `g8_crm_remove_contacts_from_list` | Remove Contacts From List [DELETE /lists/{list_id}/contacts] | list_id, body | confirm=true DEL |
| `g8_crm_update_list` | Update List [PATCH /lists/{list_id}] | list_id, body | confirm=true |
| `g8_get_lists` | List contact and company lists in your CRM. | - |  |

#### CRM family - Custom fields / columns (11)

| Tool | Purpose (docs, first sentence) | Required inputs | Flags |
|---|---|---|---|
| `g8_create_field` | Create a SINGLE custom column on contacts or companies. | title |  |
| `g8_create_fields` | Create one OR many custom columns on contacts or companies in a single call. | fields |  |
| `g8_crm_create_company_column` | Create Company Column [POST /companies/columns/create] | body | confirm=true |
| `g8_crm_create_contact_column` | Create Contact Column [POST /contacts/columns/create] | body | confirm=true |
| `g8_crm_list_company_columns` | List Company Columns [GET /companies/columns] | - |  |
| `g8_crm_list_contact_columns` | List Contact Columns [GET /contacts/columns] | - |  |
| `g8_delete_field` | Soft-delete a custom column from contacts or companies. | column_id | DEL |
| `g8_get_field_value` | Read a single custom column value from one contact or company row. | column_id, record_id |  |
| `g8_list_fields` | List the field definitions (base + custom columns) for contacts or companies. | - |  |
| `g8_set_field_value` | Set a custom column value on a single contact or company row. | column_id, record_id |  |
| `g8_set_field_values` | Set custom column values on ONE or MANY contact/company rows in a single call. | rows |  |

#### CRM family - Enrichment (6)

| Tool | Purpose (docs, first sentence) | Required inputs | Flags |
|---|---|---|---|
| `g8_enrich_contacts` | Enrich existing CRM contacts with third-party data or AI web research. | contact_ids, list_id | $ dry_run |
| `g8_enrichment_list_ai_configs` | List Ai Configs [GET /enrichment/ai/configs] | list_id |  |
| `g8_enrichment_start_enrichment` | Start Enrichment [POST /enrichment/enrich] | body | confirm=true |
| `g8_enrichment_verify_email` | Verify Email [POST /enrichment/verify-email] | body | confirm=true |
| `g8_get_enrichment_job` | Poll the status of an enrichment job by the job_id from g8_enrich_contacts. | job_id |  |
| `g8_list_enrichment_providers` | List enrichment providers with their credential mode and credit cost. | - | read-only (shows credit costs) |

#### CRM family - Deals & CRM pipeline (8)

| Tool | Purpose (docs, first sentence) | Required inputs | Flags |
|---|---|---|---|
| `g8_create_deal` | Create a new CRM deal. Requires an owner and at least one contact. | name, owner_id, contact_ids |  |
| `g8_delete_deal` | Delete a deal by ID. Irreversible. | deal_id | IRREV |
| `g8_get_company_deals` | List all deals associated with a company (account view). | company_id |  |
| `g8_get_contact_deals` | List all deals associated with a contact. Returns every deal where this contact is the primary or associated contact, with stage, value, currency, pipeline, and role. | contact_id |  |
| `g8_get_deal` | Get details for a single CRM deal. | deal_id |  |
| `g8_get_deals` | List deals with owner, outcome, stage, pipeline, activity and contact filters. | - |  |
| `g8_get_pipeline` | List deal pipelines and stages, and optionally the revenue lifecycle stages. | - |  |
| `g8_update_deal` | Update a deal (partial update). Common uses: change the deal stage, reassign the owner, add/remove contact associations, record the buying-committee role of contacts o... | deal_id |  |

#### CRM family - Tasks (10)

| Tool | Purpose (docs, first sentence) | Required inputs | Flags |
|---|---|---|---|
| `g8_assign_task_executor` | Save an eligible Work agent assignment without starting execution. | task_id, expected_updated_at |  |
| `g8_copy_task_to_people` | Create a separate human task for each selected person; leave the source unchanged. | task_id, assignee_ids, expected_updated_at, request_id |  |
| `g8_create_task` | Create a task linked to a contact or multiple typed business records. | title |  |
| `g8_crm_list_contact_tasks` | List Contact Tasks [GET /contacts/{contact_id}/tasks] | contact_id |  |
| `g8_delete_task` | Delete a task by ID. Irreversible. | task_id | IRREV |
| `g8_get_task` | Read one task, including typed related records and exact source context. | task_id |  |
| `g8_get_task_execution` | Read permitted execution history and result links for a CRM task. | task_id |  |
| `g8_get_tasks` | List tasks for the current organization with optional filters. | - |  |
| `g8_start_task_execution` | Explicitly start an agent-assigned task using the caller's permissions. | task_id, request_id |  |
| `g8_update_task` | Update an existing task (partial update). Pass only the fields you want to change. | task_id |  |

#### CRM family - Notes (4)

| Tool | Purpose (docs, first sentence) | Required inputs | Flags |
|---|---|---|---|
| `g8_create_note` | Add a note to a CRM contact, COMPANY or DEAL. | content |  |
| `g8_delete_note` | Delete a note by ID. Irreversible. | note_id | IRREV |
| `g8_list_notes` | List all notes on a CRM contact, COMPANY or DEAL. | - |  |
| `g8_update_note` | Update a note's content, on a contact, COMPANY or DEAL note. | note_id, content |  |

#### CRM family - Activity & analytics (3)

| Tool | Purpose (docs, first sentence) | Required inputs | Flags |
|---|---|---|---|
| `g8_analytics_get_campaign_visitors` | Read one graph8 analytics report [GET /analytics/campaign-visitors] | - |  |
| `g8_get_activities` | List recent CRM activities for the current organization. | - |  |
| `g8_get_activity_summary` | Summarize recent CRM activity for the current organization. | - |  |

#### CRM family - Sequences & copy (16)

| Tool | Purpose (docs, first sentence) | Required inputs | Flags |
|---|---|---|---|
| `g8_add_to_sequence` | Add contacts to an outbound sequence for automated outreach. | sequence_id, contact_ids, list_id | $ SEND dry_run |
| `g8_create_sequence` | Create a new outbound sequence (drafted state). | name, user_email |  |
| `g8_delete_sequence` | Soft-delete (archive) a sequence. Sets is_archived=True. | sequence_id | DEL |
| `g8_generate_spintax` | Rewrite a manual email into spintax for per-contact variation. | subject, body | $ |
| `g8_get_sequence_analytics` | Get comprehensive analytics for a sequence. Returns overview, performance, engagement, timeline, and contact distribution. | sequence_id |  |
| `g8_get_sequence_preview` | Preview a sequence with steps, channels and RESOLVED copy (read-only, no enrollment). | sequence_id |  |
| `g8_list_schedules` | List sending-window schedules the user can attach at launch. | - |  |
| `g8_list_sequence_steps` | List a sequence's steps with their resolved copy (read-only). | sequence_id |  |
| `g8_list_sequences` | List available outbound sequences in your organization. | - |  |
| `g8_pause_sequence` | Pause a live sequence. Contacts in progress will be wound down. | sequence_id | affects live outreach confirm |
| `g8_resume_sequence` | Resume a paused sequence. Contacts will resume receiving messages. | sequence_id | SEND (resumes live outreach) confirm |
| `g8_sequence_get_sequence` | Get Sequence [GET /sequences/{sequence_id}] | sequence_id |  |
| `g8_sequence_list_sequence_contacts` | List Sequence Contacts [GET /sequences/{sequence_id}/contacts] | sequence_id |  |
| `g8_sequence_run_sequence` | Run Sequence [POST /sequences/{sequence_id}/run] | sequence_id | confirm=true |
| `g8_update_sequence` | Update sequence metadata, or remove LinkedIn from the sequence entirely. | sequence_id | dry_run |
| `g8_update_sequence_step` | Update a single step within a sequence. Args: sequence_id: Sequence ID containing the step step_id: Step ID to update step_data: Step template/content data time_interv... | sequence_id, step_id |  |

#### CRM family - Inbox & replies (6)

| Tool | Purpose (docs, first sentence) | Required inputs | Flags |
|---|---|---|---|
| `g8_assign_reply` | Assign a user to an inbox thread. Args: reply_id: Thread/reply ID. | reply_id, assignee_email |  |
| `g8_get_reply` | Get a single inbox thread with its message history. | reply_id |  |
| `g8_get_reply_draft` | Generate an AI draft reply for an inbox thread. | reply_id | $ |
| `g8_list_inbox` | List inbox threads (email, SMS, LinkedIn) with tags, assignees, and status. | - |  |
| `g8_send_reply` | Send a reply through the specified channel. Sends a real message - confirm with user first. | reply_id, body, channel | SEND |
| `g8_tag_reply` | Attach tags to an inbox thread. Args: reply_id: Thread/reply ID. | reply_id, tag_ids |  |

#### CRM family - Meetings (3)

| Tool | Purpose (docs, first sentence) | Required inputs | Flags |
|---|---|---|---|
| `g8_get_meeting` | Get a single meeting with FULL transcript bundled inline. | meeting_id |  |
| `g8_list_meetings` | List calendar meetings as compact summary cards. | - |  |
| `g8_meetings_booked` | Count + recent list of BOOKED meetings (not cancelled/deleted/private). | - |  |

#### CRM family - Appointments / booking (63)

| Tool | Purpose (docs, first sentence) | Required inputs | Flags |
|---|---|---|---|
| `g8_appointments_add_booking_guests` | Add guest email addresses to an existing booking. | booking_uid, guests | SEND |
| `g8_appointments_add_booking_note` | Add an internal host-only note to a booking. Notes are not visible to attendees - only to org members in the booking detail view. | booking_uid, text |  |
| `g8_appointments_cancel_booking` | Cancel a booking and notify both parties. This sends cancellation emails and frees the slot - confirm with the user first. | booking_uid | SEND DEL |
| `g8_appointments_confirm_booking` | Confirm or reject a pending booking that requires host approval. | booking_uid, confirmed | SEND |
| `g8_appointments_connect_conferencing` | Connect a conferencing provider that does not need a browser OAuth flow. | provider |  |
| `g8_appointments_create_booking` | Book an appointment. CHARGES CREDITS (~20) and sends calendar invites + confirmation emails to attendee and host. | event_type_id, start_time, attendee_name, attendee_email | $ SEND |
| `g8_appointments_create_event_type` | Create a bookable event type (what people book on your calendar). | title, slug, length |  |
| `g8_appointments_create_ooo` | Create an out-of-office entry for the calling user. | start, end |  |
| `g8_appointments_create_routing_form` | Create a new routing form (sequence of questions that route the visitor to an event type based on answers). | name |  |
| `g8_appointments_create_schedule` | Create a named availability schedule with weekly rules and optional date overrides. | name, time_zone |  |
| `g8_appointments_create_workflow` | Create a booking workflow that automates actions (emails, reminders) tied to booking lifecycle events. | name, trigger, steps |  |
| `g8_appointments_delete_event_type` | Delete an event type permanently (irreversible). | event_type_id | IRREV |
| `g8_appointments_delete_ooo` | Delete an out-of-office entry permanently. The user's slots in the previously-blocked period become bookable again after deletion. | ooo_uuid | IRREV |
| `g8_appointments_delete_routing_form` | Delete a routing form permanently. Cascades to all fields, routes, and captured responses. | form_id | IRREV |
| `g8_appointments_delete_schedule` | Delete an availability schedule permanently. Confirm with the user first - this removes the schedule from any linked event types. | schedule_id | IRREV |
| `g8_appointments_delete_workflow` | Delete a workflow permanently. Pending reminders are cancelled; existing bookings are unaffected. | workflow_id | IRREV |
| `g8_appointments_deselect_calendar` | Remove a sub-calendar from conflict checking. | credential_id, integration, external_id | DEL |
| `g8_appointments_disconnect_calendar` | Disconnect a calendar account entirely: removes the credential, revokes the OAuth token (best-effort), and clears destination settings pointing at it. | credential_id | DEL |
| `g8_appointments_disconnect_conferencing` | Disconnect a conferencing provider. Real-credential providers (zoom, roam, whereby, jitsi, office365_video, roam_auto) have their credential deleted; Google Meet has n... | provider | DEL |
| `g8_appointments_duplicate_event_type` | Duplicate an event type into a copy with a unique "{slug}-copy" slug and the same hosts/config. | event_type_id |  |
| `g8_appointments_duplicate_routing_form` | Duplicate a routing form with all its fields and routes. | form_id |  |
| `g8_appointments_get_availability` | Get a schedule's availability list (recurring weekly rules with days 1=Mon..7=Sun, start_time, end_time) and overrides list (one-time overrides for specific dates). | schedule_id |  |
| `g8_appointments_get_booking` | Get a single booking by its UID. Returns the full detail: attendees, status, times, location, meeting_url, the attendee's form responses, and internal notes. | booking_uid |  |
| `g8_appointments_get_default_conferencing` | Get the default conferencing provider used for new bookings when no explicit location is specified. | - |  |
| `g8_appointments_get_destination_calendar` | Get the destination calendar where new booking events are pushed. | - |  |
| `g8_appointments_get_event_type` | Get full detail for one bookable event type: title, slug, duration (length minutes), locations, hosts, schedule, buffers, minimum notice, and the booking_fields an att... | event_type_id |  |
| `g8_appointments_get_insights` | Get aggregated booking insights (counts, show/no-show rates, per-event-type breakdowns) for the caller's org. | - |  |
| `g8_appointments_get_routing_form` | Get a routing form by ID with its full fields, routes, and response_count. | form_id |  |
| `g8_appointments_get_routing_form_responses` | List captured responses for a routing form (paginated). | form_id |  |
| `g8_appointments_get_schedule` | Get a single availability schedule with its weekly rules, date overrides, owner info, and linked event types. | schedule_id |  |
| `g8_appointments_get_workflow` | Get full details for a single workflow, including all steps and linked event types. | workflow_id |  |
| `g8_appointments_list_bookings` | List the caller's appointment bookings (paginated). | - |  |
| `g8_appointments_list_calendars` | List connected calendar accounts (Google Calendar, Outlook). | - |  |
| `g8_appointments_list_conferencing` | List connected conferencing providers. Returns each provider's name, type, meeting link (if applicable), and whether it is the default. | - |  |
| `g8_appointments_list_event_types` | List bookable calendar event types (Cal.com appointments). | - |  |
| `g8_appointments_list_ooo` | List all out-of-office entries for the calling user. | - |  |
| `g8_appointments_list_routing_forms` | List all routing forms owned by the current user. | - |  |
| `g8_appointments_list_schedules` | List the caller's appointment availability schedules. | - |  |
| `g8_appointments_list_workflows` | List all booking workflows configured for the organisation. | - |  |
| `g8_appointments_mark_absent` | Mark the host and/or attendees as no-show for a booking. | booking_uid |  |
| `g8_appointments_request_reschedule` | Ask the attendee to pick a new time (host-initiated reschedule request). | booking_uid | SEND |
| `g8_appointments_reschedule_booking` | Reschedule a booking to a new start time. Free (no extra credit charge); re-sends the updated calendar invite and notifies the attendee. | booking_uid, start_time | SEND free |
| `g8_appointments_select_calendar` | Add a sub-calendar to conflict checking; its busy times are then checked before offering booking slots. | credential_id, integration, external_id |  |
| `g8_appointments_set_conferencing_link` | Set or update the meeting URL for a link-based conferencing provider (roam, whereby, or jitsi). | provider, link |  |
| `g8_appointments_set_default_conferencing` | Set the default conferencing provider for new bookings when no explicit location is specified. | provider |  |
| `g8_appointments_set_default_schedule` | Set a schedule as the caller's default availability schedule, used for slot generation when an event type has no explicit schedule attached. | schedule_id |  |
| `g8_appointments_set_destination_calendar` | Set the destination calendar where new booking events are pushed. | integration, external_id |  |
| `g8_appointments_toggle_workflow` | Activate or deactivate a workflow. Deactivating cancels all pending reminders so scheduled jobs never fire for a disabled workflow. | workflow_id, active |  |
| `g8_appointments_update_availability` | Replace weekly availability rules and/or date overrides for a schedule. | schedule_id |  |
| `g8_appointments_update_booking_location` | Update the meeting location for a booking. Sends location-updated emails to both the host and attendee. | booking_uid, location | SEND |
| `g8_appointments_update_booking_sequence` | Associate a booking with a sequencer sequence, or detach it. | booking_uid |  |
| `g8_appointments_update_event_type` | Update an event type. Only the fields you pass are changed; omit a field to leave it as-is. | event_type_id |  |
| `g8_appointments_update_ooo` | Update an out-of-office entry [PATCH /appointments/out-of-office/{ooo_uuid}] | ooo_uuid, body | confirm=true |
| `g8_appointments_update_routing_form` | Update a routing form. Only the fields you pass are changed; omit a parameter to leave it as-is. | form_id |  |
| `g8_appointments_update_schedule` | Partial update of an availability schedule. Omit a field to leave it as-is. | schedule_id |  |
| `g8_appointments_update_workflow` | Update a workflow. Only the fields you pass are changed; omit a field to leave it as-is. | workflow_id |  |
| `g8_cancel_booking` | Cancel a booking and notify both parties. This sends cancellation emails and frees the slot - confirm with the user first. | booking_uid | SEND DEL |
| `g8_create_booking` | Book an appointment. CHARGES CREDITS (~20) and sends calendar invites + confirmation emails to attendee and host. | event_type_id, start_time, attendee_name, attendee_email | $ SEND |
| `g8_get_booking` | Get a single booking by its UID. Returns the full detail: attendees, status, times, location, meeting_url, the attendee's form responses, and internal notes. | booking_uid |  |
| `g8_get_event_type` | Get full detail for one bookable event type: title, slug, duration (length minutes), locations, hosts, schedule, buffers, minimum notice, and the booking_fields an att... | event_type_id |  |
| `g8_list_bookings` | List the caller's appointment bookings (paginated). | - |  |
| `g8_list_event_types` | List bookable calendar event types (Cal.com appointments). | - |  |
| `g8_reschedule_booking` | Reschedule a booking to a new start time. Free (no extra credit charge); re-sends the updated calendar invite and notifies the attendee. | booking_uid, start_time | SEND free |

#### CRM family - Quotes (quote-to-cash) (13)

| Tool | Purpose (docs, first sentence) | Required inputs | Flags |
|---|---|---|---|
| `g8_create_quote` | Create a new quote in draft status. Always creates, never sends. | title, line_items |  |
| `g8_crm_update_quote` | Update Quote [PATCH /quotes/{quote_id}] | quote_id, body | confirm=true |
| `g8_delete_quote` | Delete a draft quote. Irreversible. | quote_id | IRREV |
| `g8_duplicate_quote` | Clone any quote (any status) into a new draft. | quote_id |  |
| `g8_edit_quote_as_draft` | Convert a sent quote back into an editable draft via void+clone. | quote_id |  |
| `g8_get_company_quotes` | List every quote attached to a given company (account view). | company_id |  |
| `g8_get_contact_quotes` | List quotes where this contact is the signer. | contact_id |  |
| `g8_get_quote` | Get full quote detail: line items, activity log, envelope tracking, totals. | quote_id |  |
| `g8_get_quote_settings` | Get org-level quote settings (branding, default terms, sender identity). | - |  |
| `g8_list_quotable_products` | List products available for quote line items (Stripe + org manual catalog). | - |  |
| `g8_list_quotes` | List quotes in your org with optional status / company / deal / owner filters. | - |  |
| `g8_send_quote` | Send (or resend) a quote for e-signature. Sends a real customer-facing email. | quote_id | SEND |
| `g8_update_quote` | Update a quote (partial). Pass only the fields you want to change. | quote_id |  |

#### CRM family - Audience & CRM sync (14)

| Tool | Purpose (docs, first sentence) | Required inputs | Flags |
|---|---|---|---|
| `g8_create_audience_sync` | Create an audience sync config: syncs a graph8 audience list to an ad platform for custom audience targeting. | audience_id, platform |  |
| `g8_delete_audience_sync` | Delete an audience sync configuration (soft delete). | config_id | DEL |
| `g8_get_audience_sync` | Get details for a specific audience sync configuration. | config_id |  |
| `g8_get_audience_sync_errors` | Get error logs for an audience sync configuration. | config_id |  |
| `g8_get_audience_sync_runs` | Get sync run history for an audience sync configuration. | config_id |  |
| `g8_get_crm_fields` | Discover available fields for an entity type on a CRM provider (use to build field mappings before pushing data). | provider |  |
| `g8_get_crm_status` | Check connection health for a CRM provider. | provider |  |
| `g8_list_audience_syncs` | List audience sync configs for your org (ad platforms: Meta, LinkedIn, Google Ads, X) with status, cadence, last sync time. | - |  |
| `g8_list_crm_syncs` | List configured CRM integrations for your org (HubSpot, Salesforce, Pipedrive, Zoho, SugarCRM) with connection status. | - |  |
| `g8_push_to_crm_company` | Push companies to an external CRM provider. IMPORTANT: This creates real records in the external CRM. | provider, records | SEND |
| `g8_push_to_crm_contact` | Push contacts to an external CRM provider. IMPORTANT: This creates real records in the external CRM. | provider, records | SEND |
| `g8_push_to_crm_list` | Modify CRM list memberships (add/remove contacts from lists). | provider, records |  |
| `g8_trigger_audience_sync` | Manually trigger an audience sync to push latest members to the ad platform. | config_id | $ SEND (pushes to ad platform) |
| `g8_update_audience_sync` | Update an audience sync configuration. | config_id |  |

#### CRM family - Newsletter (15)

| Tool | Purpose (docs, first sentence) | Required inputs | Flags |
|---|---|---|---|
| `g8_newsletter_add_subscriber` | Add a single subscriber to a newsletter (status=subscribed). | newsletter_id, email |  |
| `g8_newsletter_create_issue` | Create a draft newsletter issue. Always creates, never sends. | newsletter_id, subject, html_body |  |
| `g8_newsletter_create_newsletter` | Create a new newsletter - the parent container issues live under. | name |  |
| `g8_newsletter_duplicate_issue` | Duplicate any issue (any status) into a new draft. | newsletter_id, issue_id |  |
| `g8_newsletter_get_issue` | Get full issue detail: subject, html body, status, send stats. | newsletter_id, issue_id |  |
| `g8_newsletter_get_issue_analytics` | Bucketed KPI counters for a sent issue: opens, clicks, bounces, unsubscribes. | newsletter_id, issue_id |  |
| `g8_newsletter_get_newsletter` | Get a single newsletter (name, status, goal, audience list). | newsletter_id |  |
| `g8_newsletter_list_issues` | List every issue (draft, scheduled, or sent) on a newsletter. | newsletter_id |  |
| `g8_newsletter_list_newsletters` | List every newsletter in your org. Call this first to discover a newsletter_id - every issue/subscriber tool below requires one. | - |  |
| `g8_newsletter_list_subscribers` | Paginated subscriber list for a newsletter. Args: newsletter_id: Newsletter UUID. | newsletter_id |  |
| `g8_newsletter_list_templates` | List org-level newsletter templates (reusable HTML scaffolds). | - |  |
| `g8_newsletter_send_issue` | Send a newsletter issue to every subscribed, deliverable subscriber. | newsletter_id, issue_id | $ SEND not idempotent |
| `g8_newsletter_send_test` | Send a test copy of an issue to ONE email address. | newsletter_id, issue_id, test_email | SEND |
| `g8_newsletter_unsubscribe_subscriber` | Soft-unsubscribe a subscriber. Sets status, preserves the row - does NOT hard-delete. | newsletter_id, subscriber_id | soft (row kept) |
| `g8_newsletter_update_issue` | Update a draft issue (partial). Pass only the fields you want to change. | newsletter_id, issue_id |  |

#### CRM family - Radar (competitive intelligence) (42)

| Tool | Purpose (docs, first sentence) | Required inputs | Flags |
|---|---|---|---|
| `g8_radar_ad_detail` | One ad's full detail for the creative drawer - a plain read on the stored ad_creative snapshot (copy / headline / image / dates) joined to the rival's traffic + threat... | ad_id |  |
| `g8_radar_add_competitor` | Add one competitor to track. Returns the created competitor profile. | domain |  |
| `g8_radar_aeo_overview` | Answer-engine share-of-voice: mention rate, citation rate, SoV vs rivals, leaderboard, and recent runs. | - |  |
| `g8_radar_aeo_probes` | List the org's tracked AEO buyer-intent probes (the questions queried against the baseline answer engine). | - |  |
| `g8_radar_analyze_gaps` | BILLABLE: enqueue gap analysis across the tracked competitor set. | - | $ |
| `g8_radar_approve_all_opportunities` | DESTRUCTIVE / BILLABLE: approve all scored opportunities in one lane (top-50 by score per call; re-run to drain the rest, remaining signals more). | - | $ IRREV |
| `g8_radar_approve_opportunity` | DESTRUCTIVE / BILLABLE: approve one scored opportunity (open gap) - converts it into an initiative + seeds the content stubs. | gap_id | $ IRREV |
| `g8_radar_battle_card` | Sales-enablement battle card composed from existing Radar intel (NO LLM / paid call): our evidence-gated advantages, the rival's edges + our exposure (open gaps citing... | competitor_id |  |
| `g8_radar_bulk_add_competitors` | Add many competitors at once (toggle-from-suggestions UX). | competitors |  |
| `g8_radar_compare_snapshot` | Before/after diff for one page snapshot. By default compares against the prior capture of the same URL; pass against to diff against a specific earlier capture (the ve... | snapshot_id |  |
| `g8_radar_competitor_ads` | Captured ad creatives for one competitor (distinct by ad, latest capture, newest first). | competitor_id |  |
| `g8_radar_competitor_engagers` | Steal-Their-Audience: people who engage this competitor's LinkedIn content who are ALREADY known to us - counts (engaged / in CRM / at open-deal accounts) + a per-enga... | competitor_id |  |
| `g8_radar_competitor_pages` | Distinct tracked pages for one competitor (latest snapshot per URL, kind='page'), newest-captured first. | competitor_id |  |
| `g8_radar_competitor_posts` | LinkedIn posts for one competitor (the "Posts / wk" click-through). | competitor_id |  |
| `g8_radar_competitor_suggestions` | Detected-but-untracked competitors surfaced from the org's existing intelligence (competitor_discovery) + the competitors global-context doc. | - |  |
| `g8_radar_competitor_traffic` | Traffic detail for one competitor: current estimate + trend plus the ETV / ranked-keyword-count history from the kind='traffic' snapshot series. | competitor_id |  |
| `g8_radar_delete_competitor` | DESTRUCTIVE: delete a tracked competitor and all its captured snapshots (pages, ads, traffic history). | competitor_id | IRREV |
| `g8_radar_discover_pages` | Discover a competitor's pages (Firecrawl /map) for the tracked-pages picker - traffic-ranked, pricing/feature boosted, current selection flagged. | competitor_id | $ |
| `g8_radar_dispatch_alerts` | DESTRUCTIVE: detect + deliver new competitor-move alerts now (in-app bell + bridge mirror for opted-in users), respecting the org's alert toggles + channels. | - | SEND IRREV |
| `g8_radar_feature_matrix` | Capability/feature comparison matrix (v1: one capability row per advantage claim) across the tracked competitor set. | - |  |
| `g8_radar_get_competitor` | Single-competitor aggregation: profile + pages-tracked count + recent content changes + open gaps citing this rival. | competitor_id |  |
| `g8_radar_get_settings` | Read the org's Radar settings: tier cadence days, alert toggles, delivery channels (in_app / bridge), and ad_source. | - |  |
| `g8_radar_keyword_gap` | Keywords each rival ranks for that the org does NOT ("what you're missing"). | - |  |
| `g8_radar_list_competitors` | List every tracked competitor profile (active + inactive), tier then domain order. | - |  |
| `g8_radar_list_gaps` | List competitive gaps, optionally filtered. Args: lens: Filter by gap lens (must be an allowed lens, else 400). | - |  |
| `g8_radar_list_initiatives` | List radar initiatives (converted opportunities under execution), optionally filtered by lane (now / next / later / live / done). | - |  |
| `g8_radar_list_opportunities` | List opportunities - the scored OPEN gaps (no separate table), optionally filtered to one lane (now / next / later). | - |  |
| `g8_radar_measure_initiatives` | Run the performance loopback now: write content-progression + rival-traffic outcome signals onto the org's active initiatives. | - | free |
| `g8_radar_monitoring_ads` | Ads & keywords. Reads the durable ad_creative snapshot corpus (never empty-by-design); optionally augments with a live provider fetch per the org's ad_source setting. | - |  |
| `g8_radar_monitoring_content` | Competitor content-change feed. Filter by competitor, page kind, change category / type, minimum significance (0-100), date range, and free-text search. | - |  |
| `g8_radar_monitoring_linkedin` | Competitor LinkedIn posts for the LinkedIn sub-tab (listener store first, then the MixRank company-post corpus fallback for tracked competitors). | - |  |
| `g8_radar_optimization_runs` | Radar-spawned content-refresh grids (ContentGrid 'Radar: ...') with lean score aggregates over their content jobs. | - |  |
| `g8_radar_overview` | Radar dashboard summary: tracked counts, 7-day moves, open gaps, act-now / live-initiative funnel, the threat board (one row per active competitor), recent moves, and ... | - |  |
| `g8_radar_own_traffic_estimate` | Estimated own-domain traffic (DataForSEO) - fallback for the Traffic & market view when the first-party tracking snippet isn't installed. | - |  |
| `g8_radar_page_history` | Full capture history for one page (competitor + url), newest-first - powers the per-page version timeline. | url, competitor_id |  |
| `g8_radar_run_aeo` | BILLABLE: trigger an AEO run (generate probes on first use, then query the baseline answer engine for each). | - | $ |
| `g8_radar_scan_all` | BILLABLE: enqueue a scan for every active competitor (up to 20). | - | $ |
| `g8_radar_scan_competitor` | BILLABLE: enqueue a fresh scan of one competitor (crawl pages, ads, traffic). | competitor_id | $ |
| `g8_radar_traffic` | Traffic & market view: per-competitor visit estimates + trend, with the org's own domain marked is_self. | - |  |
| `g8_radar_update_competitor` | Update a competitor profile (tier, active flag, name, or scan_config). | competitor_id |  |
| `g8_radar_update_gap` | Update a gap's status (open / dismissed / converted). | gap_id, status |  |
| `g8_radar_update_settings` | Replace the org's Radar settings (PUT - full object). | - |  |

#### CRM family - Custom objects (18)

| Tool | Purpose (docs, first sentence) | Required inputs | Flags |
|---|---|---|---|
| `g8_object_archive` | Archive a native object without deleting data. | object_slug | DEL |
| `g8_object_attribute_archive` | Archive a custom field without deleting its values; update can restore it. | object_slug, attribute_slug | DEL |
| `g8_object_attribute_create` | Create a CRM field with slug, title, attribute_type and optional constraints/config/defaults. | object_slug, definition |  |
| `g8_object_attribute_update` | Edit or restore a field using is_archived=false. | object_slug, attribute_slug, changes |  |
| `g8_object_attributes` | Discover typed fields, constraints, configured defaults and reference targets. | object_slug |  |
| `g8_object_create` | Create a native custom object. Requires objects:manage and current Admin access; standard names are reserved. | slug, singular_noun, plural_noun |  |
| `g8_object_get` | Read a native custom object's definition by its discovered API slug. | object_slug |  |
| `g8_object_list` | Discover native custom CRM objects, optionally including archived definitions without restoring them. | - |  |
| `g8_object_record_archive` | Archive a custom record, hiding it from listings while retaining its identity and history. | object_slug, record_id | DEL |
| `g8_object_record_changes` | Read custom-record or canonical contact/company mutation facts. | object_slug, record_id |  |
| `g8_object_record_create` | Create a native custom record. Discover attributes first; schema validation and scoped access apply. | object_slug, values |  |
| `g8_object_record_get` | Read one native custom record, canonical contact/company, or deal using its stable graph8 ID. | object_slug, record_id |  |
| `g8_object_record_history` | Read historical value generations and actor attribution, newest first. | object_slug, record_id |  |
| `g8_object_record_restore` | Restore an archived custom record under current schema and unique constraints. | object_slug, record_id |  |
| `g8_object_record_update` | PATCH a custom record, canonical contact or company. | object_slug, record_id, values |  |
| `g8_object_record_upsert` | Create or update by an active single-value unique attribute. | object_slug, matching_attribute, values |  |
| `g8_object_records` | List custom records or canonical deals with current values and revisions. | object_slug |  |
| `g8_object_update` | Update a native object; slug/data are preserved. | object_slug |  |

#### CRM family - Knowledge (7)

| Tool | Purpose (docs, first sentence) | Required inputs | Flags |
|---|---|---|---|
| `g8_knowledge_context` | Assemble the smallest authorized, cited context pack for a task. | task |  |
| `g8_knowledge_export` | Download authorized organization knowledge as a ZIP MCP embedded resource. | - |  |
| `g8_knowledge_get` | Read one authorized concept with Markdown, trust, sources, and warnings. | concept_id |  |
| `g8_knowledge_list` | Browse authorized organization knowledge concepts. | - |  |
| `g8_knowledge_related` | Traverse authorized typed relationships from one concept. | concept_id |  |
| `g8_knowledge_search` | Search authorized tenant knowledge and return concise cited matches. | query |  |
| `g8_knowledge_sources` | Read allowlisted evidence metadata for one authorized concept. | concept_id |  |

#### CRM family - Work room (channels, messages, routines) (6)

| Tool | Purpose (docs, first sentence) | Required inputs | Flags |
|---|---|---|---|
| `g8_work_delete` | Delete one graph8 Work message, channel or routine. | resource, resource_id | IRREV confirm=true |
| `g8_work_manage_channel` | Create a graph8 Work channel, change its settings, or assign its purpose. | action |  |
| `g8_work_manage_message` | Edit, forward or react to an existing graph8 Work message. | action, message_id |  |
| `g8_work_manage_routine` | Create, change or immediately run a graph8 Work routine. | action |  |
| `g8_work_read` | Read the graph8 Work room: channels, conversations, messages, files, search, the activity feed, the All Work board and scheduled routines. | - |  |
| `g8_work_send_message` | Post a message into a graph8 Work conversation. | channel | SEND |

#### CRM family - Forms, tracking snippet, landing pages (8)

| Tool | Purpose (docs, first sentence) | Required inputs | Flags |
|---|---|---|---|
| `g8_apply_landing_page_patch` | Submit ordered exact replacements to a landing-page draft. | edit_session, base_sha256, replacements, idempotency_key |  |
| `g8_forms_get_form_overview` | Get operational detail for one lead-capture form. | form_key, source_id |  |
| `g8_forms_list_forms` | List and search the org's website lead-capture forms. | - |  |
| `g8_get_form_template` | Return a complete, working progressive form-fill template for a framework. | framework, variant |  |
| `g8_get_landing_page_source` | Read the exact HTML and SHA-256 for a Studio landing-page edit session. | edit_session |  |
| `g8_get_tracking_snippet` | Return the graph8 tracking snippet (p.js) with framework-specific install code. | framework |  |
| `g8_landing_page_create_landing_page_agent_session` | Create Landing Page Agent Session [POST /landing-pages/{page_id}/agent-sessions] | page_id | confirm=true |
| `g8_snippet_get_form_template` | Get Form Template [GET /snippet/form] | - |  |

#### CRM family - Developer / repo integration (19)

| Tool | Purpose (docs, first sentence) | Required inputs | Flags |
|---|---|---|---|
| `g8_apply_install` | Apply the generated GTM patches to the repository. | repo_id |  |
| `g8_connect_repo` | Connect a GitHub/GitLab repository to graph8 for GTM automation. | repo_url, repo_name |  |
| `g8_doctor` | Report what graph8 knows about a repository's GTM readiness. | repo_id |  |
| `g8_get_campaign` | Get full details for a specific campaign. | repo_id, campaign_id |  |
| `g8_get_scan_results` | Get the latest scan results for a repository. | repo_id |  |
| `g8_install_spine` | Generate a GTM install patch set for a scanned repository. | repo_id |  |
| `g8_list_campaigns` | List generated campaigns for a repository. | repo_id |  |
| `g8_list_kb_documents` | List all documents in the GTM knowledge base. | repo_id |  |
| `g8_repo_create_campaign` | Create Campaign [POST /repos/{repo_id}/campaigns] | repo_id, body | confirm=true |
| `g8_repo_delete_repo` | Delete Repo [DELETE /repos/{repo_id}] | repo_id | confirm=true DEL |
| `g8_repo_get_campaign_document` | Get Campaign Document [GET /repos/{repo_id}/campaigns/{campaign_id}/documents/{document_id}] | repo_id, campaign_id, document_id |  |
| `g8_repo_launch_campaign` | Launch Campaign [POST /repos/{repo_id}/campaigns/{campaign_id}/launch] | repo_id, campaign_id | confirm=true |
| `g8_repo_list_repos` | List Repos [GET /repos] | - |  |
| `g8_repo_list_streams` | List Streams [GET /repos/{repo_id}/streams] | repo_id |  |
| `g8_repo_rollback_install` | Rollback Install [POST /repos/{repo_id}/rollback] | repo_id | confirm=true |
| `g8_repo_update_campaign` | Update Campaign [PATCH /repos/{repo_id}/campaigns/{campaign_id}] | repo_id, campaign_id, body | confirm=true |
| `g8_scan_repo` | Record repository scan results that YOU produced by reading the code. | repo_id, tech_stack |  |
| `g8_search_kb` | Search the GTM knowledge base for a repository. | repo_id, query |  |
| `g8_status` | Get the current status of a connected repository. | repo_id |  |

#### CRM family - App builder (39)

| Tool | Purpose (docs, first sentence) | Required inputs | Flags |
|---|---|---|---|
| `g8_app_apply_manifest` | Apply a graph8.app.yaml to an app: publish its objects, store its build config. | app_id, manifest |  |
| `g8_app_claim_app_domain` | Claim App Domain [POST /apps/{app_id}/domains] | app_id, body | confirm=true |
| `g8_app_clear_app_limit` | Clear App Limit [DELETE /apps/{app_id}/limit] | app_id | confirm=true DEL |
| `g8_app_clear_app_source` | Clear App Source [DELETE /apps/{app_id}/source] | app_id | confirm=true DEL |
| `g8_app_create` | Create an app you are building on graph8. An app is software your customers install into their own workspace, acting on their data with their consent. | name, slug |  |
| `g8_app_create_app_credential` | Create App Credential [POST /apps/{app_id}/credentials] | app_id, body | confirm=true |
| `g8_app_delete_app_secret` | Delete App Secret [DELETE /apps/{app_id}/secrets/{secret_key}] | app_id, secret_key | confirm=true DEL |
| `g8_app_deploy` | Start a deployment of this app's runtime. A deployment begins queued. | app_id, source_ref |  |
| `g8_app_get_active_deployment` | Get Active Deployment [GET /apps/{app_id}/deployments/active] | app_id |  |
| `g8_app_get_app_limit` | Get App Limit [GET /apps/{app_id}/limit] | app_id |  |
| `g8_app_get_app_logs` | Get App Logs [GET /apps/{app_id}/logs] | app_id |  |
| `g8_app_get_app_runtime` | Get App Runtime [GET /apps/{app_id}/runtime] | app_id |  |
| `g8_app_get_app_usage` | Get App Usage [GET /apps/{app_id}/usage] | app_id |  |
| `g8_app_get_deployment` | Get Deployment [GET /apps/{app_id}/deployments/{deployment_id}] | app_id, deployment_id |  |
| `g8_app_get_deployment_logs` | Get Deployment Logs [GET /apps/{app_id}/deployments/{deployment_id}/logs] | app_id, deployment_id |  |
| `g8_app_get_installed_app` | Get Installed App [GET /installed-apps/{app_id}] | app_id |  |
| `g8_app_install` | Install an app into a client organization. The install starts unconsented. | app_id, client_org_id |  |
| `g8_app_list` | List the apps your organization is building, newest first. | - |  |
| `g8_app_list_app_credentials` | List App Credentials [GET /apps/{app_id}/credentials] | app_id |  |
| `g8_app_list_app_deployments` | List App Deployments [GET /apps/{app_id}/deployments] | app_id |  |
| `g8_app_list_app_domains` | List App Domains [GET /apps/{app_id}/domains] | app_id |  |
| `g8_app_list_app_installs` | List App Installs [GET /apps/{app_id}/installs] | app_id |  |
| `g8_app_list_app_secrets` | List App Secrets [GET /apps/{app_id}/secrets] | app_id |  |
| `g8_app_list_installed_apps` | List Installed Apps [GET /installed-apps] | - |  |
| `g8_app_list_schema_versions` | List this app's published schema versions, oldest first. | app_id |  |
| `g8_app_promote` | Promote a deployment to live. Separate from deploying on purpose: promotion is what customers see, and it should be a decision rather than a side effect of a build fin... | app_id, deployment_id, image_digest |  |
| `g8_app_publish_schema` | Publish this app's object schema and materialize it in every consented tenant. | app_id, objects |  |
| `g8_app_put_app_secret` | Put App Secret [PUT /apps/{app_id}/secrets/{secret_key}] | app_id, secret_key, body | confirm=true |
| `g8_app_release_app_domain` | Release App Domain [DELETE /apps/{app_id}/domains/{hostname}] | app_id, hostname | confirm=true DEL |
| `g8_app_report_observed_build` | Observe a real Kubernetes build Job and report its derived progress after confirm=true. | app_id, deployment_id | confirm=true |
| `g8_app_revoke_app_credential` | Revoke App Credential [DELETE /apps/{app_id}/credentials/{client_id}] | app_id, client_id | confirm=true DEL |
| `g8_app_rollback_deployment` | Rollback Deployment [POST /apps/{app_id}/deployments/{deployment_id}/rollback] | app_id, deployment_id | confirm=true |
| `g8_app_set_app_limit` | Set App Limit [PUT /apps/{app_id}/limit] | app_id, body | confirm=true |
| `g8_app_set_app_source` | Set App Source [PUT /apps/{app_id}/source] | app_id, body | confirm=true |
| `g8_app_set_app_status` | Set App Status [POST /apps/{app_id}/status] | app_id, body | confirm=true |
| `g8_app_status` | Get one app: its lifecycle status, registered origins and hostname. | app_id |  |
| `g8_app_uninstall_app` | Uninstall App [DELETE /installed-apps/{app_id}] | app_id | confirm=true DEL |
| `g8_app_validate_manifest` | Check a graph8.app.yaml without applying it. No app id needed. | manifest |  |
| `g8_app_verify_app_domain` | Verify App Domain [POST /apps/{app_id}/domains/{hostname}/verify] | app_id, hostname | confirm=true |

#### CRM family - Dashboards (app pages) (13)

| Tool | Purpose (docs, first sentence) | Required inputs | Flags |
|---|---|---|---|
| `g8_dashboard_chat_edit_app_page` | Chat Edit App Page [POST /app-pages/{page_id}/chat-edit] | page_id, body | confirm=true |
| `g8_dashboard_create_app_page` | Create App Page [POST /app-pages] | body | confirm=true |
| `g8_dashboard_delete_app_page` | Delete App Page [DELETE /app-pages/{page_id}] | page_id | confirm=true DEL |
| `g8_dashboard_generate_app_page` | Generate App Page [POST /app-pages/{page_id}/generate] | page_id, body | confirm=true |
| `g8_dashboard_get_app_page` | Get App Page [GET /app-pages/{page_id}] | page_id |  |
| `g8_dashboard_get_app_page_artifact` | Get App Page Artifact [GET /app-pages/{page_id}/artifact] | page_id |  |
| `g8_dashboard_get_app_page_status` | Get App Page Status [GET /app-pages/{page_id}/status] | page_id |  |
| `g8_dashboard_invoke_app_page_action` | Invoke App Page Action [POST /app-pages/{page_id}/actions/{alias}/{action_name}] | page_id, alias, action_name, body | confirm=true |
| `g8_dashboard_list_app_page_actions` | List App Page Actions [GET /app-pages/{page_id}/actions] | page_id |  |
| `g8_dashboard_list_app_page_versions` | List App Page Versions [GET /app-pages/{page_id}/versions] | page_id |  |
| `g8_dashboard_list_app_pages` | List App Pages [GET /app-pages] | - |  |
| `g8_dashboard_mint_app_page_frame_session` | Mint App Page Frame Session [POST /app-pages/{page_id}/frame-session] | page_id | confirm=true |
| `g8_dashboard_restore_app_page_version` | Restore App Page Version [POST /app-pages/{page_id}/versions/{version_num}/restore] | page_id, version_num | confirm=true |

#### CRM family - Org, connection, discovery, support (9)

| Tool | Purpose (docs, first sentence) | Required inputs | Flags |
|---|---|---|---|
| `g8_connection_describe_current_key` | Describe the API connection this session is using. | - |  |
| `g8_connection_get_mcp_connection` | Get Mcp Connection [GET /mcp/connection] | - |  |
| `g8_connection_revoke_api_key` | Revoke one of the org's API keys, permanently. | api_key_id | IRREV confirm=true |
| `g8_contact_support` | Send the user's message to graph8's HUMAN support team. | message |  |
| `g8_current_org` | Report which organization your MCP actions currently run against. | - |  |
| `g8_execute` | Run ANY graph8 tool by name, even when it is not in your tools list. | tool_name |  |
| `g8_list_orgs` | List the organizations the signed-in user belongs to, marking the one currently in effect (is_current). | - |  |
| `g8_switch_org` | Switch which organization all your MCP actions run against. | org |  |
| `g8_tool_search` | REQUIRED FIRST STEP when the user asks for anything outside your currently visible tools. | - |  |

#### CRM family - Webhooks, usage, audit, saved search (12)

| Tool | Purpose (docs, first sentence) | Required inputs | Flags |
|---|---|---|---|
| `g8_audit_list_request_logs` | List Request Logs [GET /logs] | - |  |
| `g8_search_save_company_search` | Save Company Search [POST /search/companies/save] | body | confirm=true |
| `g8_usage_get_usage` | Get Usage [GET /usage] | - |  |
| `g8_usage_list_usage_transactions` | List Usage Transactions [GET /usage/transactions] | - |  |
| `g8_webhook_create_webhook` | Create Webhook [POST /webhooks] | body | confirm=true |
| `g8_webhook_delete_webhook` | Delete Webhook [DELETE /webhooks/{webhook_id}] | webhook_id | confirm=true DEL |
| `g8_webhook_get_webhook` | Get Webhook [GET /webhooks/{webhook_id}] | webhook_id |  |
| `g8_webhook_list_webhook_deliveries` | List Webhook Deliveries [GET /webhooks/{webhook_id}/deliveries] | webhook_id |  |
| `g8_webhook_list_webhook_events` | List Webhook Events [GET /webhooks/events] | - |  |
| `g8_webhook_list_webhooks` | List Webhooks [GET /webhooks] | - |  |
| `g8_webhook_rotate_webhook_secret` | Rotate Webhook Secret [POST /webhooks/{webhook_id}/rotate-secret] | webhook_id | confirm=true |
| `g8_webhook_update_webhook` | Update Webhook [PATCH /webhooks/{webhook_id}] | webhook_id, body | confirm=true |


### 6.2 Campaigns family (64 tools; all-mode prefix `g8_gtm_*`, gtm-mode unprefixed)
Key notes:
- **Campaign lifecycle**: `g8_gtm_create_campaign(name, brief, core_concept, primary_hook, target_persona, goal, audience_list_id, target_channels=["email"], secondary_hooks, auto_generate_documents=True)`.
  - The campaign starts in `copy_in_progress` while the doc-generator writes copy (~60–90 s), then flips to `active`.
  - Shape steps with the campaign-scoped step tools. Do NOT use standalone `g8_create_sequence` for a campaign, because launch never reads a free-floating sequence.
  - Then `g8_gtm_attach_audience` -> `g8_gtm_launch_campaign(dry_run=True)` (preview shows audience size, active mailboxes and per-step snippets; a failed preflight blocks it) -> `dry_run=False`.
  - Optional launch pickers: `sender_mailbox_ids`, `textual_agent_name`, `voice_agent_name`, `schedule_id` (from `g8_list_schedules`) and `appointment_id` (from `g8_list_event_types`).
- **Step (channel, mode) matrix**: email->email; phone->call|voicemail; sms->sms; social->connect_note|dm|comment|reply; voice_ai->call.
  - Other step fields: `day`, `angle_id` (default angle_1), `cta_type` (default soft_ask), `personalization_level` low/medium/high, `constraints` ({subject, body} for email and sms), `condition` (e.g. no_reply), `stop_on_reply` (default True), `do_not_send_rules` (update only).
- **`g8_gtm_get_campaign_metrics(campaign_id, days=30)`** returns email_metrics (sent/opened/replied/...), is_running, sequence_count and a **metric_status**:
  - available
  - zero
  - stale: receipts show sends the rollup has not counted yet. Report the receipt count, not an outage.
  - unknown: analytics unreachable, which is NOT zero.
  - missing: no launched sequences.

  Read `reconciliation` and `measured_range` before drawing conclusions.
- **Studio context tools** are the "GTM foundation":
  - `g8_gtm_get_global_context` covers categories brand, audience, messaging, market, offer, targeting and data.
  - `g8_gtm_get_icps` / `g8_gtm_get_personas` return structured, scored records.
  - `g8_gtm_list_intelligence_data` has ~16 doc types, e.g. website_scrape, company_enrichment, competitor_discovery, company_keywords, product_inventory, organic_keywords, paid_keywords.
  - `g8_gtm_list_research_reports` has 6 types: buyer_psychology, competitive_teardown, gtm_channel, industry_analyst, review_sentiment, voice_of_customer.
  - Write counterparts: create/update/archive ICP and persona, update_global_context (each save is versioned), and update_research_report (versioned and re-indexed to RAG).
  - `g8_gtm_get_company_profile` / `set_company_profile` / `regenerate_global_context` fix orgs whose Studio docs describe the wrong company.
- **Deliverability and mailboxes**: `get_deliverability_metrics` reports usable vs idle capacity, utilization, and per-mailbox placement against a 0.70 floor. The related tools are `list_mailboxes` (or `by_domain=True`), `get_mailbox_warmup` (Instantly / SmartLead analytics), `update_mailbox` (daily_limit, allows_nurture, signature), `test_mailbox_connection`, and `provision_sending_domain` (actions check_availability / add_external / connect_provider / check_propagation / buy_mailboxes; buying mailboxes spends credits; buying domains is deliberately not supported).
- **Paid ads** (Google, LinkedIn): `list_ad_campaigns`, `list_campaign_ads`, `create_campaign_ads` (SPENDS REAL MONEY on launched campaigns), `update_campaign_ad` (a REPLACE on live ads that restarts policy review and learning), `set_campaign_ad_status` (pause/resume), and `archive_campaign_ad` (one-way; refused on the last ad).
- **Pipelines (stage checklist v2)**: `list_stage_evidence_library` returns the 8 canonical evidence keys. `suggest_pipeline_from_context` costs credits and produces a draft only, which you commit with `create_pipeline_from_suggestion`. Targets are prospects_revenue, prospects_meeting or customers_revenue.

| Tool | Purpose (docs, first sentence) | Required inputs | Flags |
|---|---|---|---|
| `g8_gtm_archive_campaign_ad` | Permanently stop ONE ad. This cannot be undone. | campaign_id, ad_id | IRREV |
| `g8_gtm_archive_icp` | Archive a Studio ICP (soft delete - sets status to archived). | icp_id | DEL |
| `g8_gtm_archive_persona` | Archive a Studio buyer persona (soft delete - sets status to archived). | persona_id | DEL |
| `g8_gtm_attach_audience` | Attach (or detach) a saved list to a campaign as its audience. | campaign_id |  |
| `g8_gtm_create_campaign` | Create a new campaign with full Studio "Convert to Campaign" parity. | name |  |
| `g8_gtm_create_campaign_ads` | Add one ad, or several at once, to a paid ad campaign. | campaign_id | $ (real ad spend) SEND |
| `g8_gtm_create_campaign_document` | Create a new campaign document. Default status is "completed" since MCP-authored docs are usually ready to use. | campaign_id, file_type, display_name |  |
| `g8_gtm_create_campaign_step` | Add a step to a campaign sequence. The backend validates (channel, mode) against this matrix; a pair outside it returns 400 (no auto-coercion): - email -> email - phon... | campaign_id, name, channel, mode, day |  |
| `g8_gtm_create_icp` | Create a Studio ICP (Ideal Customer Profile) manually. | name, website_url |  |
| `g8_gtm_create_persona` | Create a Studio buyer persona manually. The write counterpart of get_personas. | title, website_url |  |
| `g8_gtm_create_pipeline` | Create a new pipeline with default stages seeded for the target. | - |  |
| `g8_gtm_create_pipeline_from_suggestion` | Persist a PipelineSuggestion (possibly edited) as a real pipeline. | suggestion |  |
| `g8_gtm_create_stage` | Add a new stage to a pipeline. Args: pipeline_id: Pipeline to add the stage to. | pipeline_id, name |  |
| `g8_gtm_delete_campaign_document` | Delete a campaign document. | campaign_id, document_id | DEL |
| `g8_gtm_delete_campaign_step` | Remove a step from the campaign sequence. | campaign_id, step_id | DEL |
| `g8_gtm_delete_pipeline` | Delete a pipeline. Fails if the pipeline has deals or is the only one. | pipeline_id | DEL |
| `g8_gtm_delete_stage` | Delete a stage. Fails if the stage has deals or the pipeline would drop below 2 stages. | pipeline_id, stage_id | DEL |
| `g8_gtm_get_ad_images` | List ad image creatives for one campaign. Returns every ad image that hasn't been marked hidden. | campaign_id |  |
| `g8_gtm_get_campaign` | Get campaign details. Optionally fetch the full editable payload. | campaign_id |  |
| `g8_gtm_get_campaign_document` | Get the full content of a campaign document. | campaign_id, document_id |  |
| `g8_gtm_get_campaign_ideas` | List saved campaign ideas. | - |  |
| `g8_gtm_get_campaign_metrics` | Get campaign execution metrics - sequence status + email counters. | campaign_id |  |
| `g8_gtm_get_campaign_sequence` | Get the campaign sequence and step catalog. | campaign_id |  |
| `g8_gtm_get_company_profile` | Read the org's company profile - the source Studio generation reads. | - |  |
| `g8_gtm_get_deliverability_metrics` | Deliverability capacity / sends / placement / warmup for this org. | - |  |
| `g8_gtm_get_global_context` | Read the org's Studio Global Context documents - the written GTM foundation. | - |  |
| `g8_gtm_get_icps` | List ICPs available for campaign targeting. | - |  |
| `g8_gtm_get_mailbox_warmup` | Get live warmup analytics for a single mailbox. | mailbox_id |  |
| `g8_gtm_get_personas` | List personas available for campaign targeting. | - |  |
| `g8_gtm_get_pipeline` | Get one pipeline by ID, including all stages and their checklist + scripts. | pipeline_id |  |
| `g8_gtm_hide_ad_image` | Hide one ad creative from the campaign's grid. | campaign_id, image_id |  |
| `g8_gtm_launch_campaign` | Launch a campaign to begin real outbound execution. | campaign_id | $ SEND dry_run |
| `g8_gtm_list_ad_campaigns` | List the org's PAID ad campaigns (Google, LinkedIn), or read one. | - |  |
| `g8_gtm_list_campaign_ads` | List the ads inside one paid ad campaign, or read a single ad. | campaign_id |  |
| `g8_gtm_list_campaign_documents` | List document metadata for a campaign. | campaign_id |  |
| `g8_gtm_list_campaigns` | List campaigns in your organization. | - |  |
| `g8_gtm_list_intelligence_data` | List documents in the Intelligence bucket of Studio Global Docs. | - |  |
| `g8_gtm_list_kb_documents` | List all documents in the GTM knowledge base. | - |  |
| `g8_gtm_list_mailboxes` | List sending mailboxes - or SENDING DOMAINS - for this org. | - |  |
| `g8_gtm_list_pipelines` | List all deal pipelines for your organization, with stages. | - |  |
| `g8_gtm_list_research_reports` | List documents in the Research bucket of Studio Global Docs. | - |  |
| `g8_gtm_list_stage_evidence_library` | List the 8 canonical evidence keys + human-readable labels. | - |  |
| `g8_gtm_patch_campaign_full` | Atomic deep-update of a campaign in one round trip. | campaign_id |  |
| `g8_gtm_provision_sending_domain` | Set up a sending domain: register, connect, verify, add mailboxes. | action | $ confirm=true |
| `g8_gtm_regenerate_global_context` | Regenerate Studio Global Context documents against a website. | website_url |  |
| `g8_gtm_reorder_stages` | Reorder stages in a pipeline. Pass the full ordered list of stage IDs. | pipeline_id, stage_ids |  |
| `g8_gtm_search_kb` | Search the GTM knowledge base. | query |  |
| `g8_gtm_set_campaign_ad_status` | Pause or resume ONE ad, leaving its siblings and the campaign alone. | campaign_id, ad_id, status |  |
| `g8_gtm_set_company_profile` | Set the org's company profile (website + fields). | website_url, fields |  |
| `g8_gtm_suggest_pipeline_from_context` | Generate an AI-suggested pipeline grounded in the org's GTM context. | - | $ |
| `g8_gtm_test_mailbox_connection` | Re-test a mailbox's stored SMTP/IMAP credentials, now. | mailbox_id |  |
| `g8_gtm_update_campaign` | Update campaign strategy fields or metadata. Default (no deep-update kwargs): updates ONLY the campaign row. | campaign_id |  |
| `g8_gtm_update_campaign_ad` | Edit one ad's creative. Omitted fields are left unchanged. | campaign_id, ad_id |  |
| `g8_gtm_update_campaign_document` | Save edits back to a campaign document. | campaign_id, document_id, content |  |
| `g8_gtm_update_campaign_sequence` | Replace the campaign sequence ordering with a new step list. | campaign_id, steps |  |
| `g8_gtm_update_campaign_step` | Update a campaign sequence step definition or placement. | campaign_id, step_id |  |
| `g8_gtm_update_global_context` | Update a Studio Global Context document (Context bucket). | doc_id |  |
| `g8_gtm_update_icp` | Update a Studio ICP's fields (partial update). | icp_id |  |
| `g8_gtm_update_mailbox` | Change a mailbox's sending settings. Only supplied fields change. | mailbox_id |  |
| `g8_gtm_update_persona` | Update a Studio persona's fields and/or status (partial update). | persona_id |  |
| `g8_gtm_update_pipeline` | Rename a pipeline and/or promote it to default. | pipeline_id |  |
| `g8_gtm_update_research_report` | Update a Studio Research report (Research bucket). | report_id |  |
| `g8_gtm_update_stage` | Update a stage. All parameters optional - pass only what changes. | pipeline_id, stage_id |  |
| `g8_gtm_upload_enablement_asset` | Upload an internal file to the org's Studio Enablement library. | file_name, content_base64 |  |


### 6.3 Intent signals family (16 tools, `g8_intent_*`; reads are free per the FAQ)
"Compete-tracking" keywords: you track a competitor domain or keyword, graph8 seeds its URL set, and it resolves the visitors on those URLs into contacts and companies.
- URLs are canonical, with no scheme and no www (e.g. `cognism.com/pricing`).
- `g8_intent_search_pages` supports operators such as `site:`, `intitle:`, `inurl:`, `type:blog`, `audience:b2b` and `-word`. `semantic_ratio` runs from 0 (text) to 1 (semantic).
- `g8_intent_page_visitors` has two modes: `quick` (~500 ms) and `full` (~2–3 s).
- Keyword `search_filters` include audience, exclude_page_types (news/finance/forum/vendor_marketing), min_commercial_intent_level (0–100), max_urls_per_domain, llm_triage and exclude_domains.

| Tool | Purpose (docs, first sentence) | Required inputs | Flags |
|---|---|---|---|
| `g8_intent_add_keywords` | Bulk-add plain compete-tracking keyword phrases (web-UI parity). | keywords |  |
| `g8_intent_create_from_domain` | One-shot compete-tracking keyword create from a competitor domain. | domain |  |
| `g8_intent_delete_keyword` | Soft-delete a compete-tracking keyword row. Args: keyword_id: UUID of the keyword row (from g8_intent_list_keywords). | keyword_id | DEL |
| `g8_intent_domain_search` | Find every indexed page on a competitor's domain (and subdomains). | domain |  |
| `g8_intent_keyword_companies` | Companies resolved against a keyword's URL set. | keyword_id |  |
| `g8_intent_keyword_contacts` | People resolved against a keyword's URL set. Each row includes full contact identity (name, job title, LinkedIn, work email) plus the company they're tied to. | keyword_id |  |
| `g8_intent_keyword_urls` | URLs linked to a compete-tracking keyword. Args: keyword_id: UUID from g8_intent_list_keywords. | keyword_id |  |
| `g8_intent_keywords_create_from_search` | Keywords Create From Search [POST /intent/keywords/create-from-search] | body | confirm=true |
| `g8_intent_list_keywords` | All compete-tracking keyword rows for this org. | - |  |
| `g8_intent_page_visitors` | Resolve the people who visited a specific page URL. | url |  |
| `g8_intent_pages_contacts` | Aggregated, deduplicated resolved contacts across multiple page URLs. | urls |  |
| `g8_intent_pages_visitor_counts` | Batched unique-visitor count per page URL. Useful for ranking a URL list by traffic before drilling into contacts. | urls |  |
| `g8_intent_search_pages` | Text / semantic / hybrid search across intent-enriched pages. | query | free (intent read) |
| `g8_intent_search_url_companies` | Companies that visited a single page URL, aggregated by company. | url |  |
| `g8_intent_stats` | Intent index coverage stats (doc count + size). | - |  |
| `g8_intent_update_keyword_filters` | Replace a keyword's search_filters JSON. Full replacement, not merge. | keyword_id, search_filters |  |


### 6.4 Voice & dialer family (16 tools, `g8_voice_*`)
- Voice minutes cost 20 credits per minute.
- `g8_voice_create_dialer_session` has two modes. With a list it creates a PAUSED session that the SDR works in the dialer UI. With `to_phone` it places ONE AI-agent call immediately.
- `g8_voice_resume_session` dials the next batch (up to 4). It is not idempotent.
- Call ids are `room_name` (livekit). Use them for transcripts and grading, and poll grading about every 10 s.
- Custom dispositions: at most 10 per org. `is_connected` locks once any call has used the disposition.

| Tool | Purpose (docs, first sentence) | Required inputs | Flags |
|---|---|---|---|
| `g8_voice_create_dialer_session` | Create a parallel-dialer session, or place ONE ad-hoc call. | name, from_phone | SEND (to_phone mode dials now) dry_run |
| `g8_voice_get_call_grading` | Fetch the AI-generated grading for a single dialer call. | room_name |  |
| `g8_voice_get_call_transcript` | Fetch the full transcript for a single dialer call. | room_name |  |
| `g8_voice_get_dialer_stats` | Get aggregated dialer analytics for the caller's org. | - |  |
| `g8_voice_list_agents` | List voice agents (personas), or read one agent's full config. | - |  |
| `g8_voice_list_calls_for_contact` | List dialer calls for a specific contact, newest first. | contact_id |  |
| `g8_voice_list_calls_for_sdr` | List dialer calls placed by a specific SDR, newest first. | user_email |  |
| `g8_voice_list_dialer_sessions` | List parallel dialer sessions for the caller's organization. | - |  |
| `g8_voice_list_dispositions` | List the call outcomes this org can record against a call. | - |  |
| `g8_voice_list_missed_callbacks` | Inbound calls the org missed (no SDR pickup), with caller info. | - |  |
| `g8_voice_list_numbers` | List the org's dialer-eligible phone numbers with usage stats. | - |  |
| `g8_voice_pause_session` | Pause an active parallel-dialer session. Reversible (call g8_voice_resume_session to flip back to ACTIVE) and idempotent (pausing a PAUSED session is a no-op). | session_id |  |
| `g8_voice_resume_session` | Resume a paused parallel-dialer session by dialing the next batch. | session_id | $ (voice 20 cr/min) SEND (real calls) confirm |
| `g8_voice_stop_session` | Stop a parallel-dialer session permanently. IMPORTANT: Marks the session COMPLETED. | session_id | IRREV dry_run |
| `g8_voice_upsert_agent` | Create a voice agent, or edit an existing one. | - |  |
| `g8_voice_upsert_disposition` | Create a custom call outcome, or edit one. Omit disposition_id to CREATE (name, color and is_connected are then required). | - |  |


### 6.5 Workflow builder family (33 tools, `g8_workflow_*`)
- Graph shape: `config = {metadata, settings, nodes:[{node_id, node_type, name, config, position, connections:[...]}], edges, start_node_id, trigger}`.
  - The executor traverses `node.connections`, NOT `edges`. Branch, loop and human_approval nodes use `conditional_connections` ({path_id: target} or {"true":..., "false":...}).
  - Template refs look like `{{node_id.result}}` / `{{trigger.field}}`.
- Recommended flow: `list_node_types` -> `describe_node_type` -> build -> `validate` -> `create(dry_run=True)` -> `create` -> `execute(dry_run=True)` -> `execute` -> poll `get_execution`.
  - For one-shot NL steps, use an **Action node (`llm_completion`) bound to an LLM skill**. Use an agent node only for multi-turn tool use.
- Node and trigger names seen in descriptions:
  - Triggers: `new_form_submitted`, `new_inbox_tag_set`, `new_call_disposition` (the only trigger with server-side disposition filters), `new_call_ended`, `new_voicemail_detected`, `new_email_reply`, `sequence_reply_trigger`, `linkedin_connection_accepted`, `linkedin_message_sent`, `linkedin_reply_received`.
  - Actions: `send_email`, `send_slack_notification`, `send_roam_notification`, `send_netrion_connection_request`, `send_netrion_message`, `add_to_workbench`, `workbench_lookup`, `workbench_pull_rows`, `human_approval`, `llm_completion`.
  - The UI (ai-features__skills.md) also lists these node kinds: Start, Action, Agent, Tool (MCP), Condition, Loop, Transform, State, Human, Handoff, End.
- Workbenches are staging tables (`list_workbenches` / `create_workbench`).
- Workflows with `managed_by.kind=work_routine` can only be enabled or disabled here.

| Tool | Purpose (docs, first sentence) | Required inputs | Flags |
|---|---|---|---|
| `g8_workflow_add_node` | Add one node to an existing workflow's graph. | action_id, node_id, node_type |  |
| `g8_workflow_connect_nodes` | Add an edge connecting one node to another. DUAL write: appends to top-level edges AND appends target to the source node's connections list (the field the executor act... | action_id, source, target |  |
| `g8_workflow_create` | Create a new workflow. Persists a real workflow row - ALWAYS confirm with the user first. | name, config | dry_run |
| `g8_workflow_create_workbench` | Create an empty workbench and return its workbench_id. | name |  |
| `g8_workflow_delete` | Delete a workflow permanently. One-way - g8_workflow_get 404s after. | action_id | IRREV dry_run |
| `g8_workflow_describe_form_fields` | Discover the field names submitted to a form by sampling recent submissions. | form_id |  |
| `g8_workflow_describe_node_type` | Get the config schema for a single node type. | node_type |  |
| `g8_workflow_execute` | Trigger a workflow run. Runs for real - can spend credits, send messages, or call external APIs depending on the nodes. | action_id | $ SEND dry_run |
| `g8_workflow_get` | Get the full graph for a workflow (nodes + edges + trigger). | action_id |  |
| `g8_workflow_get_execution` | Get a workflow execution's status / output / token cost. | execution_id |  |
| `g8_workflow_get_trigger_status` | Get the trigger status (cursor + config) for a workflow. | action_id |  |
| `g8_workflow_list` | List workflows owned by the caller's organization. | - |  |
| `g8_workflow_list_dispositions` | List every valid call disposition - system values AND this organization's own custom dispositions. | - |  |
| `g8_workflow_list_inbox_tags` | List the org's AI Inbox tags, so a human description becomes a tag ID. | - |  |
| `g8_workflow_list_linkedin_senders` | List the org's LinkedIn sender accounts (seats). | - |  |
| `g8_workflow_list_mcp_servers` | List MCP servers connected to the org with their available tools. | - |  |
| `g8_workflow_list_node_types` | List every workflow node type with its config schema. | - |  |
| `g8_workflow_list_roam_groups` | List Roam groups connected to the org. Resolves a group description into the address_id needed for send_roam_notification (mode=group, recipient_id=...). | - |  |
| `g8_workflow_list_roam_users` | List Roam users connected to the org. Resolves a user description into the user_ids needed for send_roam_notification (mode=dm, user_ids=[...]). | - |  |
| `g8_workflow_list_slack_channels` | List Slack channels in the connected workspace. | - |  |
| `g8_workflow_list_slack_users` | List Slack users in the connected workspace. Resolves a user description into the Slack user_id needed for send_slack_notification (mode=dm, user_id=...). | - |  |
| `g8_workflow_list_workbenches` | List the org's workbenches (staging tables). Resolves the workbench_id required by add_to_workbench, workbench_lookup and workbench_pull_rows. | - |  |
| `g8_workflow_list_workflow_executions` | List workflow executions for the caller's org (recover a lost execution_id) [GET /workflows/executions] | - |  |
| `g8_workflow_pause_execution` | Pause a running workflow execution. Reversible - call g8_workflow_resume_execution to flip back to running. | execution_id |  |
| `g8_workflow_plan_inline_workflow` | Preview a normalized execution plan for an inline workflow graph [POST /workflows/plan] | body | confirm=true |
| `g8_workflow_plan_workflow` | Preview a normalized execution plan for a saved workflow [POST /workflows/{action_id}/plan] | action_id | confirm=true |
| `g8_workflow_remove_node` | Remove a node from a workflow's graph. Also drops any edge referencing the node and scrubs the id from other nodes' connections / conditional_connections and from the ... | action_id, node_id | DEL |
| `g8_workflow_reset_trigger_cursor` | Reset the workflow's trigger cursor to now(). | action_id |  |
| `g8_workflow_resume_execution` | Resume a paused workflow execution. Idempotent. | execution_id |  |
| `g8_workflow_stop_execution` | Stop a workflow execution permanently. One-way - cannot be resumed after stop; use g8_workflow_pause_execution instead if the user might want to flip it back. | execution_id | IRREV dry_run |
| `g8_workflow_update` | Update a workflow's metadata or graph. Partial update - pass only the fields you want to change. | action_id |  |
| `g8_workflow_update_node` | Update one node's config / label / position / connections in place. | action_id, node_id |  |
| `g8_workflow_validate` | Validate a workflow graph WITHOUT saving it. Returns {errors: [...], warnings: [...], missing_references: [...]}. | config |  |


### 6.6 Skill authoring family (28 tools = 14 operations x 2 names: `g8_skill_*` and `g8_workflow_skill_*`)
- Skills are reusable **LLM** (prompt template + model) or **API** (HTTP request template) building blocks that workflows execute. They are distinct from playbooks and from the Skill Library.
- Single-brace `{variable}` placeholders form the input surface. `{{...}}` is ignored.
- Models come from `list_models`, e.g. gpt-4o and claude-sonnet-4-5 per the REST doc.
- Every create or delete supports `dry_run`. `execute` may consume credits (the LLM type always charges).
- `delete` refuses to run while any workflow references the skill. Otherwise it hard-deletes.

| Tool | Purpose (docs, first sentence) | Required inputs | Flags |
|---|---|---|---|
| `g8_skill_create_api` | Create an API-runtime skill. Persists a new skill in the org; call with dry_run=True first to confirm, then dry_run=False. | name, endpoint | dry_run |
| `g8_skill_create_from_node` | Lift a workflow action node into a standalone skill (a copy; the workflow is NOT modified). | workflow_id, node_id | dry_run |
| `g8_skill_create_from_template` | Clone a skill template into the org. Persists a new skill; confirm with dry_run=True before calling with dry_run=False. | template_id, name | dry_run |
| `g8_skill_create_llm` | Create an LLM-runtime skill. Persists a new skill in the org; call with dry_run=True first to render a confirmation preview, then again with dry_run=False after the us... | name, model, prompt_template | dry_run |
| `g8_skill_delete` | Delete a skill (with reference check). Scans every workflow in the org; if ANY node references the skill the delete is refused and the offending workflows are listed, ... | action_id | IRREV dry_run |
| `g8_skill_execute` | Run a skill once and return the execution result. | action_id | $ dry_run |
| `g8_skill_extract_variables` | Extract single-brace {variable} placeholders from a skill's templates (deduplicated, first-seen order). | action_id |  |
| `g8_skill_get` | Get a skill's full configuration (metadata + llm_config or api_config). | action_id |  |
| `g8_skill_list` | List skills (LLM + API runtimes) owned by the caller's org. | - |  |
| `g8_skill_list_models` | List supported LLM model identifiers for the model field of g8_skill_create_llm / g8_skill_update_llm. | - |  |
| `g8_skill_list_templates` | List skill templates available in the caller's org (plus shared system templates). | - |  |
| `g8_skill_update_api` | Update an API-runtime skill. Pass only the fields you want to change. | action_id |  |
| `g8_skill_update_llm` | Update an LLM-runtime skill. Pass only the fields you want to change. | action_id |  |
| `g8_skill_validate_template` | Dry-run a skill template through the variable extractor and warn-only validator. | - |  |
| `g8_workflow_skill_create_api` | Create an API-runtime skill. Persists a new skill in the org; call with dry_run=True first to confirm, then dry_run=False. | name, endpoint | dry_run |
| `g8_workflow_skill_create_from_node` | Lift a workflow action node into a standalone skill (a copy; the workflow is NOT modified). | workflow_id, node_id | dry_run |
| `g8_workflow_skill_create_from_template` | Clone a skill template into the org. Persists a new skill; confirm with dry_run=True before calling with dry_run=False. | template_id, name | dry_run |
| `g8_workflow_skill_create_llm` | Create an LLM-runtime skill. Persists a new skill in the org; call with dry_run=True first to render a confirmation preview, then again with dry_run=False after the us... | name, model, prompt_template | dry_run |
| `g8_workflow_skill_delete` | Delete a skill (with reference check). Scans every workflow in the org; if ANY node references the skill the delete is refused and the offending workflows are listed, ... | action_id | IRREV dry_run |
| `g8_workflow_skill_execute` | Run a skill once and return the execution result. | action_id | $ dry_run |
| `g8_workflow_skill_extract_variables` | Extract single-brace {variable} placeholders from a skill's templates (deduplicated, first-seen order). | action_id |  |
| `g8_workflow_skill_get` | Get a skill's full configuration (metadata + llm_config or api_config). | action_id |  |
| `g8_workflow_skill_list` | List skills (LLM + API runtimes) owned by the caller's org. | - |  |
| `g8_workflow_skill_list_models` | List supported LLM model identifiers for the model field of g8_skill_create_llm / g8_skill_update_llm. | - |  |
| `g8_workflow_skill_list_templates` | List skill templates available in the caller's org (plus shared system templates). | - |  |
| `g8_workflow_skill_update_api` | Update an API-runtime skill. Pass only the fields you want to change. | action_id |  |
| `g8_workflow_skill_update_llm` | Update an LLM-runtime skill. Pass only the fields you want to change. | action_id |  |
| `g8_workflow_skill_validate_template` | Dry-run a skill template through the variable extractor and warn-only validator. | - |  |


### 6.7 Skill Library family (3 tools, `g8_library_*`)
The public catalog of installable **SKILL.md** workflow recipes that a user installs into their own AI client (Claude Code, Claude Desktop, Claude.ai, Cursor).
- Categories: crm, enrichment, outbound, inbox, signals, workflows, voice, calendar. Example slug: `find-and-list-leads`.
- `g8_library_install_instructions(slug, client="claude_code")` returns the SKILL.md plus save steps. An agent with file access, such as Claude Code, may perform the save itself after confirming with the user.

| Tool | Purpose (docs, first sentence) | Required inputs | Flags |
|---|---|---|---|
| `g8_library_get` | Load one graph8 Skill Library skill - full SKILL.md content by slug. | slug |  |
| `g8_library_install_instructions` | Install a graph8 Skill Library skill into the user's AI client. | slug |  |
| `g8_library_search` | Search the graph8 Skill Library - installable agent skills. | - |  |


### 6.8 Playbook family (2 tools)
Playbooks are prescriptive markdown guides that the **agent itself reads in-session** (see Section 7).

| Tool | Purpose (docs, first sentence) | Required inputs | Flags |
|---|---|---|---|
| `g8_list_playbooks` | List available graph8 playbooks - prescriptive workflow guides. | - |  |
| `g8_load_playbook` | Load the full markdown content of a graph8 playbook by slug. | slug |  |


### 6.9 Marketplace family (36 tools, `g8_marketplace_*`)
A talent marketplace for SDRs, AEs, GTM engineers and campaign managers: job posts, applications, hire offers, contracts, meetings, invoices and payouts (Stripe Connect / Wise).
- SDR-side tools need a personal API key.
- `approve_org_invoice` triggers an immediate Stripe charge.
- The `admin_*` tools are for graph8 platform admins only.

| Tool | Purpose (docs, first sentence) | Required inputs | Flags |
|---|---|---|---|
| `g8_marketplace_accept_offer` | Accept a pending marketplace hire offer. Moves the hiring to active, creates the hiring-fee invoice, grants you membership in the client org, and notifies the client. | hiring_id | SEND |
| `g8_marketplace_admin_funnel` | Marketplace SDR supply funnel - conversion stages + snapshot counts. | period_from, period_to | ADMIN |
| `g8_marketplace_admin_hires` | Hire conversion + termination + rehire metrics. | period_from, period_to | ADMIN |
| `g8_marketplace_admin_operational` | Operational health - SLA, disputes, payout success. | period_from, period_to | ADMIN |
| `g8_marketplace_admin_revenue` | GMV, net commission, and money-loop state distribution. | period_from, period_to | ADMIN |
| `g8_marketplace_approve_my_invoice` | Approve your own draft invoice (sdr_review -> pending), submitting it for client review. | invoice_id |  |
| `g8_marketplace_approve_org_invoice` | Approve an SDR invoice - triggers an IMMEDIATE Stripe charge to your org's default payment method, transferring funds to the SDR. | invoice_id | $ (immediate Stripe charge) IRREV |
| `g8_marketplace_browse_talent` | Browse available marketplace talent. Already-hired SDRs are filtered out; anonymous profiles stay masked unless your org previously hired them. | - |  |
| `g8_marketplace_create_job_post` | Publish a marketplace job post (Open Role) under your org. | title, role_type |  |
| `g8_marketplace_delete_job_post` | Delete a job post your org owns, plus its applications. | post_id | DEL |
| `g8_marketplace_dispute_org_invoice` | Dispute an SDR invoice within the grace period. | invoice_id, reason | IRREV |
| `g8_marketplace_get_job_post` | Get one job post your org owns. Args: post_id: Job post id (from g8_marketplace_list_job_posts). | post_id |  |
| `g8_marketplace_get_my_connect_status` | Get your Stripe Connect onboarding status (live Stripe-enriched). | - |  |
| `g8_marketplace_get_my_meeting` | Get one of your meetings by ID - includes transcript, recording, attendees, notes. | meeting_id |  |
| `g8_marketplace_get_my_payout_account` | Get your payout account status (Stripe Connect / Wise / fallback). | - |  |
| `g8_marketplace_get_my_profile` | Get your own marketplace SDR profile. Returns rate, availability, role, country, bio, and an is_complete flag (gates marketplace visibility). | - |  |
| `g8_marketplace_get_org_hiring` | Get one hiring contract for your org, with the SDR's profile. | hiring_id |  |
| `g8_marketplace_get_org_invoice` | Get one invoice in full detail (SDR profile + hiring contract context). | invoice_id |  |
| `g8_marketplace_get_talent_match_score` | Get the cached match score for your org and this talent. | sdr_id |  |
| `g8_marketplace_get_talent_profile` | Get one talent profile by ID. Anonymous profiles stay masked unless your org has previously hired this SDR. | sdr_id |  |
| `g8_marketplace_list_job_applications` | List applicants for a job post - each with their role-scoped match scorecard and status. | post_id |  |
| `g8_marketplace_list_job_posts` | List your org's marketplace job posts (any status), newest first. | - |  |
| `g8_marketplace_list_my_hirings` | List active hiring contracts where you are the SDR side. | - |  |
| `g8_marketplace_list_my_invoices` | List invoices you issued, optionally filtered by status. | - |  |
| `g8_marketplace_list_my_meetings` | List your meetings across all hirings. Args: hiring_id: Filter to one hiring contract. | - |  |
| `g8_marketplace_list_my_offers` | List pending marketplace hire offers sent to your profile. | - |  |
| `g8_marketplace_list_org_hirings` | List active marketplace hiring contracts for your organization, enriched with the hired SDR's display name, role, and email. | - |  |
| `g8_marketplace_list_org_invoices` | List marketplace invoices owed by your organization, enriched with the issuing SDR's display name. | - |  |
| `g8_marketplace_reject_offer` | Reject a pending marketplace hire offer. Irreversible - the client must send a new offer to re-engage. | hiring_id | IRREV |
| `g8_marketplace_send_hire_offer` | Send a hire offer to a marketplace talent profile. | sdr_id, start_date | SEND |
| `g8_marketplace_submit_my_invoice` | Submit a monthly invoice for an active hiring contract. | hiring_id, period_start, period_end |  |
| `g8_marketplace_terminate_org_hiring` | Terminate an active hiring contract (org side). | hiring_id | IRREV |
| `g8_marketplace_update_application` | Move an applicant through review, or link a created hiring to it. | application_id |  |
| `g8_marketplace_update_job_post` | Edit a job post or change its status. Only the fields you pass change. | post_id |  |
| `g8_marketplace_update_my_meeting` | Update meeting notes + contact info (SDR side). | meeting_id |  |
| `g8_marketplace_withdraw_offer` | Withdraw a hiring offer the talent has NOT yet accepted (org side). | hiring_id | DEL |


### 6.10 OpenSearch family (4 tools) — raw data-index access
- Indices: `mashup_contacts`, `mashup_companies` (the same contact-grained index), `hem2contact` and `ip2company`.
- Fields are RAW UPPERCASE (e.g. `COMPANY_NAICS`, `COMPANY_STATE`, `COMPANY_ID`).
- `search` totals saturate at 10,000, while `count` is exact.
- `aggregate` does GROUP BY on 1–3 dimensions with count/uniqExact/sum/avg... For unique companies, use uniqExact on COMPANY_ID. The docs call this "the TAM matrix-walk primitive".
- Deliverability protection applies to all of these.

| Tool | Purpose (docs, first sentence) | Required inputs | Flags |
|---|---|---|---|
| `g8_opensearch_aggregate` | Generic GROUP BY over a whitelisted mashup index - the TAM matrix-walk primitive. | index, group_by |  |
| `g8_opensearch_count` | Exact match count for a whitelisted mashup index (TAM cell sizing). | index |  |
| `g8_opensearch_resolve_ids` | Bulk HEM -> CONTACT_ID or IP -> COMPANY_ID resolution. | kind, ids |  |
| `g8_opensearch_search` | Structured search against the graph8 OpenSearch mashup indices. | index |  |


### 6.11 ClickHouse family (2 tools)
- `g8_clickhouse_mashup` modes are by_upid, by_hem and by_domain, with up to 100 keys. Profiles are b2b (default), b2c or joined, and the server caps results at 1000 rows.
- `g8_clickhouse_org_analytics` datasets are people_visitors, company_visitors, 5x5_visitors and intent_resolved.
  - The window is capped at 90 days. Aggregations are raw, daily_counts or top_n. Only your own org is visible.

| Tool | Purpose (docs, first sentence) | Required inputs | Flags |
|---|---|---|---|
| `g8_clickhouse_mashup` | Bulk enrichment lookup against the ClickHouse Cloud mashup tables. | mode, values |  |
| `g8_clickhouse_org_analytics` | Per-org visitor + intent analytics: who visited the site, which companies, which keywords resolved. | dataset, since |  |


### 6.12 API-coverage-only tools (listed on the "Additional API operations through MCP" page, not in the 11 families above)
These are discoverable through `g8_tool_search` / `g8_execute`. Writes default to `confirmation_required` and execute only with `confirm=true`. Many other tools on that page (g8_app_*, g8_crm_*, g8_dashboard_*, g8_webhook_*, g8_repo_*, g8_usage_*, g8_enrichment_*, g8_sequence_*, g8_analytics_*) also appear in the CRM family table above.

| Tool(s) | Purpose / API | Notes |
|---|---|---|
| `g8_agent_create_agent_run`, `g8_agent_get_agent_run`, `g8_agent_list_agent_runs`, `g8_agent_cancel_agent_run` | Agent runs: `POST/GET /agent/runs`, `GET /agent/runs/{run_id}`, `POST .../cancel` | create and cancel need confirm=true |
| `g8_agent_list_agent_approvals`, `g8_agent_list_agent_approval_history`, `g8_agent_get_agent_approval_receipts` | Agent approval queue: `GET /agent/approvals`, `/agent/approvals/history`, `/agent/approvals/{id}/receipts` | read |
| `g8_agent_human_approval_handoff` | Opens the exact approval for human review in the graph8 UI, or inspects a recorded decision | needs `G8_APP_URL`. Never approves or rejects on its own |
| `g8_agent_submit_human_decision` (0.64.0) | Relays a decision that a signed-in human already made in the graph8 UI | required `approval_id`. Personal key with `workflows:write`, call within 5 minutes of the human decision |
| `g8_agency_get_agency_me`, `g8_agency_list_agency_clients` | Agency identity / client orgs: `GET /agency/me`, `/agency/clients` | read |
| `g8_sandbox_sandbox_status`, `_seed_fixtures`, `_reset_fixtures`, `_snapshot`, `_restore`, `_outbox`, `_set_failure_rule`, `_list_failure_rules`, `_clear_failure_rules` | **Test-mode sandbox**: seed sample data, snapshot/restore fixtures, view the simulated outbox, inject failures (`/sandbox/...`) | test-mode key only; a live key is rejected. Writes need confirm=true |
| `g8_intent_keywords_create_from_search` | `POST /intent/keywords/create-from-search` | confirm=true |
| `g8_workflow_list_workflow_executions`, `g8_workflow_plan_workflow`, `g8_workflow_plan_inline_workflow` | Recover lost execution ids. Preview a normalized execution plan for a saved or inline graph | plan tools need confirm=true |
| `g8_company_intent_signals`, `g8_visitor_company`, `g8_visitor_score` (0.59.0) | A company's buying signals from your visitor events (by domain). Visitor IP -> company. Visitor IP engagement score | need an explicit `intent:read` key scope. The visitor IP must be supplied explicitly |
| `g8_knowledge_export` (0.59.0) | Download authorized org knowledge as a ZIP (max 1 MiB) | `knowledge:export` |
| `g8_app_public_verification_keys` (0.59.0) | App-token JWKS public keys | read |
| `g8_ops_index`, `g8_ops_linkedin_actions`, `g8_ops_linkedin_actions_summary`, `g8_ops_linkedin_sequence_bindings`, `g8_ops_linkedin_webhook_events` (0.60.0) | Internal cross-org LinkedIn operations reports | internal operator key only. Audited |
| `g8_app_objects_list`, `g8_app_object_get`, `g8_app_object_attributes`, `g8_app_object_records`, `g8_app_object_record_get`, `g8_app_object_record_history`, `g8_app_object_record_create`, `g8_app_object_record_update`, `g8_app_object_record_restore` (0.61.0), `g8_app_object_record_changes` (0.64.0) | App-owned objects and records | separate local `g8-app-mcp-server` stdio connection plus an app token. Writes need confirm=true |
| `g8_app_tls_readiness`, `g8_public_copilot_chat`, `g8_public_enrich_lookup` (0.62.0) | TLS eligibility check. Public widget copilot. Progressive-form known/missing field lookup (potentially billable) | separate `g8-public-mcp-server` with a public write key plus an allowed site origin |
| `g8_app_exchange_browser_session`, `g8_app_issue_service_token`, `g8_app_report_observed_build` (0.63.0) | App-token acquisition. Kubernetes build-job progress reporting | isolated `g8-browser-app-mcp-server`, `g8-service-app-mcp-server` and `g8-controller-mcp-server` connections |


---

## 7. Playbooks, Skill Library, Skills: three different things

| Concept | Tools | What it is | Who consumes it |
|---|---|---|---|
| **Playbooks** | `g8_list_playbooks`, `g8_load_playbook(slug)` | Prescriptive markdown guides, each covering one user journey. The docs name the journeys: **prospecting, running a campaign, installing tracking, handling inbox replies**. The catalog returns `slug, title, summary, when_to_use`, and content is "prescriptive - follow the tool sequencing and confirmations it describes". The only slug named in the docs is **`prospecting-and-lists`** | The connected agent reads it in-session |
| **Skill Library** | `g8_library_search(query, category, limit=20)`, `g8_library_get(slug)`, `g8_library_install_instructions(slug, client)` | A public catalog of installable **SKILL.md** recipes. Categories: crm, enrichment, outbound, inbox, signals, workflows, voice, calendar. The only slug named is **`find-and-list-leads`**. Target clients are claude_code (default), claude_desktop, claude_ai, cursor and other | The user installs it into their own AI client. MCP servers cannot write to the host filesystem, so Claude Code saves the file itself after confirming with the user |
| **Skills (g8_skill_*)** | 14 ops x 2 names | Org records: an LLM prompt template or an HTTP API template, executed by workflow Action nodes. Built-in templates exist, e.g. "Summarize meeting". The UI lists 15+ built-in action templates (Company Research, Contact Dossier, Competitor Analysis, Keywords Research, FAQ Generation, Content creation) per ai-features__skills.md | Workflows, agents |

The docs do not enumerate the full list of playbook slugs or library slugs. Call `g8_list_playbooks` / `g8_library_search()` (no query) at runtime to get them.

Cross-references outside the MCP pages:
- `roles__gtm-engineer.md`: "Playbooks, Skills, and Web-chat routes don't exist yet [in the UI]. The MCP server instructions reference g8_tool_search("playbook") and g8_tool_search("skill") - those tools exist on the API surface but there's no UI route to manage them today."
- `roles__ae.md`: "Multi-pipeline, stage-checklist v2 programmatic gates, QuickBooks / Xero / Chargebee billing, and the **playbook editor / flywheel** are all in-progress or PRD-only."

**This is directly relevant to the hackathon Flywheel idea (Section 9).**

Other uses of the word "playbook" in graph8, all distinct from the MCP playbook tools:
- Voice-agent call playbooks ("a structured outbound script attached to an agent"), set via `g8_voice_upsert_agent` `outbound_instructions`.
- Pipeline stage `channel_scripts` (call/email/linkedin talk tracks).
- A "Playbook Deviation" deal signal.

Claude Code docs: example prompts are meant to "Tie these to graph8 skills (planned) so you can invoke a full flow with one prompt".

---

## 8. MCP examples: the worked end-to-end flows (`developers__mcp-examples.md`)

1. **Build a list of 50 VP Engineering at Series B SaaS.** Prompt: find 50, show the top 25 by signal score, confirm, save to "Series B SaaS VP Eng", then enroll in "New SaaS Outreach" after a second confirmation.
   - Tools: `g8_find_contacts` (preview, free) -> `g8_build_contact_list` (save, "charges credits"; today's equivalent is `g8_create_list(filters=...)`) -> `g8_list_sequences` -> `g8_get_sequence_preview` -> `g8_add_to_sequence` (real sends).
   - Outcome: a named list of 25 contacts plus an enrollment confirmation.
2. **Reply triage in your IDE.** Prompt: take the last 24 h of replies, pull the thread for each warm one, draft, approve each draft, send, and tag pricing mentions "pricing-q".
   - Tools: `g8_list_inbox` -> `g8_get_reply` -> `g8_get_reply_draft` (credits) -> `g8_tag_reply` -> `g8_send_reply` (real message).
3. **Push a list to Meta and LinkedIn ads.** Tools: `g8_get_lists` (find "Q1 ABM Targets") -> `g8_create_audience_sync` x2 (meta daily, linkedin) -> `g8_trigger_audience_sync` -> `g8_get_audience_sync_runs`.
4. **Install graph8 tracking plus a progressive form on Next.js** (dev mode).
   - Tools: `g8_connect_repo` -> the agent reads the code -> `g8_scan_repo` (graph8 does not scan server-side) -> `g8_get_scan_results` -> `g8_get_tracking_snippet` -> `g8_get_form_template`.
   - Verify: `window.g8` is defined and there is a `/p.js` network request.
5. **Voice dialer warmup for an SDR's start of day.** Tools: `g8_get_lists` ("Today's Dial List") -> `g8_voice_list_numbers` (best 7-day connect rate) -> `g8_voice_list_agents` ("Friendly Inbound SDR") -> `g8_voice_create_dialer_session` (paused; confirm) -> return the session id.
6. **Full GTM setup walkthrough.** Use the `gtm_setup` prompt with `repo_url`, which runs `g8_connect_repo` -> `g8_scan_repo` -> `g8_install_spine` -> `g8_apply_install` -> `g8_create_campaign` -> `g8_launch_campaign` (after confirmation, or a dry-run report).

Other flows documented on the setup pages:
- The CrewAI prospector, enricher and sequence-loader crew.
- LangGraph "prospect, qualify, enroll".
- The OpenAI Agents one-shot prospect list.
- The Pydantic AI typed `SequenceEnrollment` gate.
- n8n recipes: sync new campaigns to Slack (hourly `g8_list_campaigns(status="active")`), enrich CRM with company intelligence (`g8_find_companies`/`g8_search_companies` -> `g8_list_intelligence_data`), and a daily pipeline report (`g8_get_deals`).

Tracking snippet notes from the overview:
- `p.js` is loaded in the layout for SSR frameworks (Next.js, WordPress, Shopify, Webflow, HTML) and through `useEffect`/`onMounted` for CSR frameworks (React, Vue). With CSR, call `window.g8?.track(...)`.
- API: `g8.identify(id, traits)` and `g8.track(event, props)`.
- Privacy attributes: `data-privacy-dont-send`, `data-privacy-user-ids`, `data-privacy-ip-policy` (keep / stripLastOctet / remove), `data-init-only`.

"What you can ask" prompt patterns cover campaigns (list, details, search by persona or topic), companies (industry search, key contacts), deals (pipeline value, closing this month, by stage), intelligence (global and per-company; company intel only exists for enriched companies), documents (global context docs, value prop, positioning) and unified search ("Search for X across everything").

---

## 9. Hackathon relevance

### 9.1 Source Scout: discover and evaluate new external B2B data sources, score them against graph8 data, acquire into lists

**Establish graph8's baseline coverage (free, within the rate cap):**
- `g8_opensearch_count` / `g8_opensearch_aggregate` over `mashup_contacts` / `mashup_companies`, grouped by up to 3 dimensions (e.g. `COMPANY_NAICS` x `COMPANY_STATE` x employee band).
  - The docs call this "the TAM matrix-walk primitive". Use it to see where graph8 is thin, which is where a new source would add value.
  - For unique companies, use `uniqExact(COMPANY_ID)`, because the company index is contact-grained.
- `g8_find_contacts` / `g8_find_companies` (free) sample the same segment with the same filter grammar.
- `g8_opensearch_search` / `g8_opensearch_resolve_ids` (HEM -> CONTACT_ID, IP -> COMPANY_ID) and `g8_clickhouse_mashup(mode="by_domain" | "by_hem" | "by_upid", values<=100)` handle **overlap and match-rate** tests. Given a sample of an external source's domains or emails, they show which records graph8 already has and the canonical enrichment record for each.
- `g8_lookup_person` / `g8_lookup_company` (1 credit each per the tool text; the FAQ says free) return a confidence score for field-accuracy spot checks.

**Benchmark against existing providers** (graph8 already runs a multi-vendor waterfall):
- `g8_list_enrichment_providers` gives each provider's `system_funded`, `byok_configured` and `credits_per_row` (graph8, hunter, prospeo, dropcontact, icypeas, leadmagic, emaillistverify, apollo, lusha, rocketreach).
- `g8_enrich_contacts(providers=[...], target_field=..., dry_run=True)` on a test list, then `g8_get_enrichment_job(include_provider_errors=True)`, gives a head-to-head fill-rate and cost comparison. `g8_enrichment_verify_email` and `email_verification=True` (ZeroBounce) measure validity.
- **Credits apply**, so budget accordingly.

**Wrap a new external source as a reusable connector:**
- `g8_skill_create_api(name, endpoint with {vars}, method, headers, body_template, requires_approval)` -> `g8_skill_execute(dry_run=...)`. LLM skills (`g8_skill_create_llm`) can score or normalize records.
- Wire both into a workflow (`g8_workflow_*`, Action node `llm_completion` + API skill) that stages rows in a **workbench** (`add_to_workbench`, `workbench_lookup`, `workbench_pull_rows`; `g8_workflow_create_workbench`) before promotion.
- Workflow Tool nodes can call external MCP servers (`g8_workflow_list_mcp_servers`), but only SSE or stdio servers.

**Acquire into lists (free imports):**
- `g8_create_list(title, rows=[...], dry_run=True)` or `g8_add_to_list(list_id, rows=[...])`.
  - Accepted row fields: first_name, last_name, work_email, job_title, company_domain, seniority_level, linkedin_url, city, state, country, personal_emails, direct_phone, mobile_phone, job_department.
- `g8_create_company` (dedups on domain) and `g8_crm_assert_contacts_batch` / `g8_crm_assert_companies_batch` (upsert wrappers, confirm=true).
- Store provenance and scores as custom columns with `g8_create_fields` + `g8_set_field_values` (batch).

**Model the source registry and evaluations natively:**
- Custom objects: `g8_object_create` (e.g. a "data_source" object) -> `g8_object_attribute_create` -> `g8_object_record_upsert` / `g8_object_record_update`.
- History and audit: `g8_object_record_history` / `g8_object_record_changes`.

**Hygiene and compliance before acquisition goes live:**
- `g8_crm_list_duplicates` / `g8_crm_resolve_duplicate`.
- `g8_crm_list_suppressions` (never lift `contact_initiated`).
- Deliverability protection policy (automatic on find/opensearch).

**Overlapping existing capabilities (reuse or differentiate):**
- **Radar** (`g8_radar_*`) already does discovery and scraping of competitor sites (Firecrawl `/map` in `discover_pages`, BILLABLE scans), plus traffic (DataForSEO estimate), ads, LinkedIn posts, `competitor_suggestions` (from `competitor_discovery` intelligence) and `competitor_engagers`. The same machinery could profile data-vendor websites.
- **Studio intelligence** (`g8_gtm_list_intelligence_data`: website_scrape, company_enrichment, competitor_discovery, keyword docs).
- **Intent index** (`g8_intent_domain_search`, `g8_intent_search_pages`) lists a vendor's indexed pages. `g8_intent_create_from_domain` identifies who is researching a vendor.
- **Hiring signal** `g8_company_open_jobs`, an example of an already-ingested external corpus that is free to read.
- **Sandbox** (`g8_sandbox_*`, test-mode key) for safe demos: seed fixtures, simulated outbox, failure injection.

### 9.2 Flywheel: analyze completed campaign outcomes and produce an improved campaign playbook V2 for approval

**Pull what was run:**
- `g8_gtm_list_campaigns`.
- `g8_gtm_get_campaign(campaign_id, full=True)` returns in one call: brief, core_concept, hooks, audience, all docs with content, sequence, step_catalog, linked_sequences and is_launched.
- `g8_gtm_get_campaign_sequence` and `g8_list_sequence_steps` / `g8_get_sequence_preview` show the actual copy and spintax variants that were sent.

**Measure outcomes:**
- `g8_gtm_get_campaign_metrics(campaign_id, days)`. **Respect `metric_status`**: stale means pipeline lag, and unknown is not zero.
- `g8_get_sequence_analytics(sequence_id)` covers overview, performance, engagement, timeline and contact distribution.
- `g8_analytics_get_campaign_visitors(report=...)` offers `marketing/outbound-bridge/by-campaign`, `engagement/by-campaign`, `conversions/funnel`, `conversions/goals`, `sdr/leaderboard`, `dialer/performance`, `dialer/quality`, etc.
- `g8_meetings_booked`, `g8_get_deals(outcome / is_closed_won / stale_before)`, `g8_get_activity_summary`, `g8_list_hot_contacts`, and `g8_appointments_get_insights` (show and no-show rates).
- `g8_gtm_get_deliverability_metrics` / `g8_gtm_get_mailbox_warmup` separate deliverability failure from messaging failure.
- Voice: `g8_voice_get_dialer_stats`, `g8_voice_get_call_grading`, `g8_voice_get_call_transcript`.
- Unsubscribes: `g8_crm_list_suppressions(category="contact_initiated")`.

**Qualitative signal (why it worked or didn't):**
- `g8_list_inbox(sequence_id=...)`: previews answer "what did they say" without opening threads.
- `g8_get_reply` for specific threads.
- The AI inbox tags list (`g8_workflow_list_inbox_tags`: e.g. interested, out of office, referral, unsubscribe request) gives reply classification.
- `g8_get_meeting` returns the transcript, key topics and action items.

**Context to ground V2:**
- `g8_gtm_get_global_context` (messaging, offer, audience, market), `g8_gtm_get_icps` / `g8_gtm_get_personas`.
- `g8_gtm_list_research_reports` (voice_of_customer, buyer_psychology, competitive_teardown).
- `g8_radar_battle_card`, `g8_knowledge_context(task)`.
- `g8_gtm_get_campaign_ideas`.

**Write V2 for approval (without launching):**
- `g8_gtm_create_campaign(... secondary_hooks, target_channels, auto_generate_documents)`, or `g8_gtm_patch_campaign_full` on a copy.
- Rework steps with `g8_gtm_create_campaign_step` / `update_campaign_step`, changing `angle_id`, `cta_type`, `personalization_level`, `day`, `condition` and `stop_on_reply`. Add `g8_generate_spintax` (credits).
- Store the "Playbook V2" narrative as a campaign document with `g8_gtm_create_campaign_document(file_type="campaign_brief", status="draft")`. Draft docs are excluded from the launch checklist, which gives a natural "pending approval" state. Alternatively use a versioned Studio doc (`g8_gtm_update_global_context` / `g8_gtm_update_research_report`, where each save is versioned).
- ICP and persona refinements go through `g8_gtm_update_icp` / `g8_gtm_update_persona`.

**Approval gate:**
- Launch itself is dry-run gated (`g8_gtm_launch_campaign(dry_run=True)`).
- For a formal human sign-off:
  - A workflow `human_approval` node, or a skill with `requires_approval`.
  - The agent approvals queue (`g8_agent_list_agent_approvals`, `g8_agent_human_approval_handoff`, `g8_agent_submit_human_decision`).
  - Post the V2 summary to the team with `g8_work_send_message` or a Slack node, or assign a review task with `g8_create_task`.

**Overlaps and prior art to be aware of:**
- The MCP **prompt template `campaign_review(campaign_id)`** ("Review and optimize a campaign") and **`icp_refinement(feedback)`** already exist and are the closest built-in analogues.
- Radar's **`g8_radar_measure_initiatives`** is described as a "performance loopback" that writes outcome signals back onto initiatives, a flywheel-style loop for content work.
- **`roles__ae.md` explicitly lists "playbook editor / flywheel" as in-progress or PRD-only at graph8.** The concept is on graph8's roadmap but not shipped, which leaves an open slot for the hackathon but also puts it close to an internal roadmap item.
- MCP "playbooks" (`g8_load_playbook`) are static agent guides, not per-campaign playbooks. A campaign "Playbook V2" would be a new artifact, for example stored as a campaign document, Studio doc or custom object.

### 9.3 Practical build notes for both projects
- Connect Claude Code via `~/.claude/mcp.json` with the remote URL (OAuth). For unattended or CI runs, use stdio with `G8_API_KEY` and `G8_MCP_MODE=all`, or the remote URL plus `Authorization: Bearer` from a headless client.
- At session start, call `g8_current_org`. Use `g8_tool_search` to reveal hidden families (workflow, voice, intent, skill, field, form, snippet, playbook). If the client does not refresh its tool list, use `g8_execute`.
- Default to free reads (find, intent, opensearch, CRM). Gate every `$`/`SEND` tool behind `dry_run` or `confirm`. Stay under 50 rps / 1,000 rpm per org. Expect 30–90 s on enrichment and list builds.
- Use the test-mode sandbox (`g8_sandbox_*`) to demo safely without live sends.
