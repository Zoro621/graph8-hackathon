# Flywheel: does it already exist in graph8?

Researched 26 Sep 2026 in three places:
- the live app, logged in as org "Hackathon Saad Saleem"
- the public API spec (`be.graph8.com/api/v1/openapi.json`)
- docs.graph8.com and the graph8.com marketing pages

**Idea:** completed campaign outcomes (replies, objections, positives, conversions) → find the patterns in what worked and what failed → explained findings → an auto-generated **Campaign V2 playbook** (messaging + targeting) → human approval → run it → repeat.

## Verdict

**The loop does not exist as a product.** Most of the ingredients do, and graph8's marketing already *claims* the loop. That claim makes Flywheel an easy pitch ("we built the Learn → Improve step you advertise"), but it's also the first objection you'll hear.

## What already exists (use these; don't rebuild them)

| Piece | Where | What it actually does |
|---|---|---|
| Step-level email metrics | `GET /analytics/outbound/email-metrics/by-step`, `/by-sequence`, `/trend` | Sent, delivered, replied and bounced, per step. Descriptive only. |
| Sequence performance through to meetings | `GET /analytics/outbound/sequence-performance[/{id}]` | Contacts → replies → meetings, per sequence |
| **Audience breakdowns** | `GET /analytics/outbound/audience/{seniority,industry,industry-group}` | "Answers who replies, not who was mailed … the reports that change targeting rather than copy." These are exactly the **segment** inputs Flywheel needs. |
| Channel attribution, meeting funnel, SDR leaderboards | `/analytics/outbound/*` | Descriptive dashboards |
| AI campaign dashboard | `GET /campaigns/{id}/dashboard` | A model-generated **readiness** assessment: a 0–100 score plus a risk list covering missing docs and weak proof points. It judges the campaign **before launch** from its documents, not from outcomes. |
| Campaign generation | `/campaigns/suggest` (concept/playbook library), `/campaigns/generate-ideas`, `/campaigns/{id}/documents/{doc}/regenerate`, `/campaigns/{id}/sequence/steps/{step}/generate` | Creates and regenerates campaign docs and step copy. **This is where a V2 gets written back.** |
| Per-thread reply handling | AI Inbox: per-conversation "AI analysis", inbox tags with an AI auto-tagger (`ai_can_apply` + rules), `/inbox/drafts/generate` | Labels and answers one thread at a time. **No aggregation across a campaign.** |
| Copy variation | `/sequences/generate-spintax` | The spec itself says: "ONE-TIME generation, **not a live variation engine**." There is no A/B experiment engine. |
| Propose → approve framework | Agent operators: `/agent/operators/{op}/findings`, `…/approvals/{id}/decide`, trust dials, scorecards | The live bench has **RevOps/CRM Admin, Lead Ops, Deal Desk, Deliverability, Chief of Staff**. The RevOps skills (13 of them) are all hygiene: attribution, routing, SLA, ownership, billing. **None of them learns from messaging or campaign outcomes.** |
| Agent memory | `GET /agent/memory` | Per-agent planner state ("what the agent has learned"). Not a campaign playbook. |
| Radar "performance loopback" | `POST /radar/initiatives/measure`, `/radar/optimization-runs` | A loop for **competitive-gap content initiatives**, not for outbound campaigns |

## What's missing (this is Flywheel)

1. **Outcome → pattern mining across a whole campaign.** Which opening, CTA, step, segment or objection-handling approach won, with sample sizes. Today the docs tell a human to do this by hand: Growth Manager "Mission 5: Monitor and Optimize" is a manual checklist ("Look for steps with significantly lower open or reply rates … rewrite the subject line …").
2. **Reply and objection taxonomy at campaign level.** Replies are only tagged thread by thread. "Reply intelligence" is itself on the hackathon's list of ideas, which suggests it isn't built.
3. **An explained, versioned playbook diff (V1 → V2)** with the evidence behind each change.
4. **Approval → V2 launch → compare V2 with V1**, closing the loop.

## The objection to prepare for

graph8.com/platform/ai advertises *"Perceive. Decide. Act. **Learn.** **Improve.** … Every result sharpens the next play, for this agent and every other"*, a Reporting agent that "closes the loop", and agents "trained on a decade of CIENCE outbound".

**Your answer:** "That loop is per agent and per play, and it's stored in memory you can't read as a playbook. Flywheel works at campaign level. It's explainable: every change cites the replies and numbers behind it. It's versioned: V1 → V2 is a diff you can read. And it goes through the same propose → approve pattern graph8's operators already use."

## The biggest feasibility risk: no outcome data

- The org has **no sequences and no campaigns** ("No team sequences found").
- Hackathon rule: **no real sends**, so no real replies will arrive.
- The API has **no endpoint to inject inbound replies**. Sequences only record outbound side effects in `/sandbox/outbox`.
- `POST /sandbox/fixtures/seed` inserts "the standard sandbox fixture set". ⚠️ **Whether that includes sequences with replies and meetings is unknown. Ask at kickoff.**

What each answer means:
- **Fixtures include replies:** Flywheel runs on graph8 data end to end. It's a strong idea.
- **They don't:** you'd have to bring outcome data (a CSV of past campaign results, or a clearly labelled synthetic set). Then the *learning* half doesn't run on graph8 data, which directly hurts the 35-point "works end to end on graph8" score. You could mitigate that by writing V2 back through graph8's campaign and sequence APIs and launching it in the sandbox. But the headline insight would still come from data you supplied.

## Update after reading all the docs (26 Sep)
- **graph8's own roadmap names it.** The AE field guide (docs.graph8.com/roles/ae, May 2026) says: *"the playbook editor / flywheel are all in-progress or PRD-only. Don't pitch them yet."*
  - The upside: graph8 clearly wants this, and it fits "ship something the platform does not do yet".
  - The risk: judges may already have an internal design in mind. Ask a graph8 engineer at kickoff whether it's off-limits.
- **Closest things already built:**
  - The MCP prompt `campaign_review(campaign_id)` ("Review and optimize a campaign") and `icp_refinement(feedback)`.
  - Sales Coach's manager view, "top objection types".
  - The voice coaching loop: flagged calls → top 3 gaps → update the playbook → redeploy → measure. This is a manual process, for voice only.
  - Radar's `measure_initiatives` "performance loopback", which covers content work, not outbound.
- **Signals that already exist:**
  - The webhook `engagement.email_replied` carries `is_positive`, `sequence_id` and `campaign_id`.
  - `meeting.booked` carries `sequence_id` and `campaign_id`.
  - `GET /inbox?sequence_id=` returns reply text, and `responder=OTHER` marks the prospect's messages.
  - Meetings include `key_topics` and `campaign_mentions`.
  - Dialer dispositions such as has_solution and not_icp.
  - `g8_gtm_get_campaign_metrics` returns a `metric_status` (available/zero/stale/unknown/missing) that must be respected.
  - Opens are **not** tracked (no pixel).
- **Where V2 goes:**
  - Create it with `g8_gtm_create_campaign` or `patch_campaign_full`.
  - The V2 narrative is a campaign document with `status:"draft"`. Draft docs are excluded from the launch checklist, which gives a natural "pending approval" state.
  - Generalised learnings go to `g8_gtm_update_global_context` (Messaging House, objections) and `update_icp`/`update_persona`.
  - For approval, use a Human Approval workflow node, or a card in the approve lane on the **My Desk** screen. My Desk already has a "Playbook Deviation" card generator.
- **Sandbox still can't simulate replies.** Failure injection covers outbound failures only.

## Where replies show up in the app (checked live, 26 Sep)
| Place | Path | What it shows |
|---|---|---|
| AI Inbox | Engage → Inbox (`/inbox/all?channel=email`) | Threads, with tabs Inbox / Unread / **Replies Needed** / Drafts / Sent, Focused vs Other, and filters for **mailbox, sequence and tags**. Filtering is by sequence, not campaign. |
| **Inbox Analytics** | Engage → Inbox → **Analytics** (`/inbox/analytics`) | Replies, tagged replies, **Interested / Not interested / Out of office %**, intent over time, intent distribution, channel mix, **intent mix per sequence**, **sequence rank by interested share**, landing-page visits, and **Export CSV**. None of this is in the docs. |
| Sequencer | Engage → Sequencer → sequence | Replies per step, funnel, 24h/48h/7d response rates |
| Reports | `/reports` (Reply Health, Sequence Performance `a12`) | Team-level reply and sequence reports |
| Studio campaign | Studio → Campaign → campaign → Dashboard | Readiness score (pre-launch) and the Performance Tracker doc. This org has 12 AI campaign **ideas** and none launched. |
| Contact record | Contact → Inbox / Activity tab | One person's thread |
| API | `GET /inbox?sequence_id=`, webhook `engagement.email_replied` (`is_positive`) | Raw reply text and sentiment |

So graph8 already measures *what share* of replies were interested, per sequence. Flywheel therefore has to cover the gaps below, not reply counting.

## Gaps: what graph8 does not do yet
1. **No "why".** Analytics shows the interested share per sequence, but doesn't link reply outcomes back to the opener, CTA, angle, step, persona or segment that produced them.
2. **Intent labels are shallow.** Interested / not interested / out of office, plus custom tags. There's no campaign-level objection breakdown for email replies (price, timing, competitor, wrong person, already have a tool). Structured objections exist only for calls and meetings.
3. **Audience and copy aren't joined.** Reply rate by seniority and industry exists as a separate report, but not crossed with which message each group received.
4. **No write-back.** Insights never flow into the campaign documents (Messaging & Objections, Email Copy, Targeting & Routing). Readiness is scored before launch only.
5. **No V1→V2.** No versioned playbook diff with evidence, no approval step for it, and no A/B winner selection.
6. **No follow-up campaign per reply group.** graph8 drafts replies one thread at a time. It doesn't build a tailored second campaign for each group of responders: "not now" gets a new angle in 60 days, price objections get an ROI angle, referrals go to the person named, interested-but-no-meeting gets a meeting push, and non-responders get a new hook.
7. **No shared memory of what works.** Learnings like "fintech VP Eng respond to X" aren't saved into Global Context or ICPs for the next campaign.

## Feasibility check (from the API spec and docs, assuming reply data exists)

**Precondition:** the replies must live in graph8's AI Inbox, attributed to a sequence (synced mailbox or seeded sandbox fixtures). There is **no API to inject replies**. If the data arrives as a CSV instead, features 1–2 run on the CSV and we can't tag inbox threads, but features 3–5 still run on graph8.

| # | Feature | Verdict | How, in graph8 | Risks / notes |
|---|---|---|---|---|
| 0 | Read a campaign's replies | ✅ | `GET /campaigns/{id}/full` → linked sequences → `GET /inbox?channel=email&sequence_id=` (full threads, `responder=OTHER` = prospect, tags) or `GET /inbox/emails/by-sequence/{id}` (cheap paging). Webhook `engagement.email_replied` (`is_positive`). | ⚠️ The `/inbox` docs say an **org** API key acts as a synthetic user with no threads for assignee filters. Use a **personal** API key and test visibility early. |
| 1 | Classify **why** (price, timing, competitor, wrong person, referral, not now…) with quoted evidence | ✅ | Our own LLM (Claude) over the thread text. Write results back as graph8 tags: `POST /inbox/tags {name, ai_can_apply, rules}` → `POST /inbox/{reply_id}/tag {tag_ids}`. An in-platform option is a graph8 LLM skill or the workflow `llm_completion` node (costs credits). | Accuracy depends on reply volume and quality. Show counts and quotes, not percentages, when numbers are small. |
| 2 | Group contacts per reason → one list per group | ✅ | Thread gives the contact **email** → `GET /contacts?email=` → id → `POST /lists` + `POST /lists/{id}/contacts`. Check suppression with `GET /contacts/{id}/suppression`; sends are also blocked at execution time. | Inbox threads don't return a contact id, so resolve by email. Never re-contact "not interested" or unsubscribes. |
| 2b | Referral → find the named colleague | ✅ 🟡 | Extract the name from the reply → `POST /enrichment/lookup/person {first_name, last_name, company_domain}` or `POST /search/contacts` → `PUT /contacts/assert/batch` into the referral list. | Only works if the name is in the reply and in graph8's index. |
| 3 | Generate a **follow-up campaign per group** | ✅ | `POST /campaigns {name, brief, core_concept, primary_hook, target_persona, audience_list_id, target_channels:["email"], auto_generate_documents}` → `PATCH /campaigns/{id}/full {documents[], sequence_steps[]}` / `POST /campaigns/{id}/sequence/steps {channel, mode, day, angle_id, cta_type, personalization_level, constraints{subject,body}}` → `PUT /campaigns/{id}/audience`. Ground copy with `GET /global-context/documents` (Proof Catalog, Messaging House) and the reply quotes. | `auto_generate_documents:true` spends credits and is async (60–90 s). Writing our own copy with it set to `false` is free and faster. |
| 3b | "Not now" → re-contact in N days | 🟡 | No "start date" field exists on sequences or campaigns. Options: set the first step's `day`/`time_interval` to N days (**unverified**), or keep the campaign as a draft and launch it later (our scheduler, or a graph8 scheduled-trigger workflow). | Test at kickoff. For the demo, show "scheduled for +60 days" and launch a copy immediately in the sandbox. |
| 4 | Human approval with the "why" and the cost | ✅ | Simplest: our own approval screen. The campaign stays **draft**, and the V2 narrative is a draft campaign document (drafts are excluded from launch checks). In-platform: workflow `human_approval` node, or the agent approvals queue (`g8_agent_*`, needs a personal key). Launch: `POST /campaigns/{id}/launch` (a dry run first via MCP). | Launch is **email-only** and needs an audience, completed copy, at least 1 step and an **active mailbox**. New mailboxes send 0 cold emails for 2 weeks, so check whether the sandbox bypasses that (`GET /sandbox/outbox`). |
| 5 | Save learnings into Studio | ✅ | `PATCH /global-context/documents/{doc_id} {content}` (versioned, same history as the UI). Also the Messaging & Objections / Reply Templates docs, `g8_gtm_update_icp` / `update_persona`, and `POST /campaigns/ideas/{id}/archive {reason}` to steer future idea generation. | Propose the edit and apply it only after approval. Versions allow rollback. |
| 6 | "Why": which step, angle or segment drove replies | 🟡 | `GET /sequences/{id}/stats` (per step), `GET /sequences/{id}/contacts` (current step), step catalog `angle_id` / `cta_type`, contact firmographics via `GET /contacts/{id}`. | Needs real volume. With a handful of replies, show a breakdown, not conclusions. |
| 7 | Prove V2 beats V1 | ❌ this weekend | `GET /campaigns/{id}/metrics` (respect `metric_status`) after about 14 days | Pitch only. |

**Overlap to acknowledge:** graph8 workflows can already trigger on `new_inbox_tag_set`, so a user can hand-wire "tag X → add to a pre-written sequence". Our difference is that the follow-up campaign **content is generated from the actual replies**, grouped per campaign, approved with evidence, and the learnings are written back.

**Bottom line:** everything except proving lift is buildable with documented endpoints, **if the replies exist in graph8's inbox**. The four things to verify in the first hour:
1. Inbox visibility with our key.
2. A delayed start.
3. Whether a sandbox launch actually sends (warm-up and mailbox).
4. The credit cost of campaign generation.

## Overlap with the listed Level 2 ideas
Flywheel = **"Reply intelligence"** (listed) + a playbook generator + the operator-style approval loop. The organisers asked for the first part themselves, so the overlap works in your favour.
