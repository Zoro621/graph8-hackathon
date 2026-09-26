# ReplyIQ: build plan and roadmap

## Context
**ReplyIQ** is our hackathon build for the graph8 Hackathon in Lahore, running 26–27 Sep 2026.

> ReplyIQ is a reply-intelligence layer for graph8. It analyses campaign replies to find why prospects didn't convert, turns each reason into a tailored follow-up campaign for approval, and flags proof gaps: objections the company can't yet answer. For each gap, it shows an Answer Card that explains what's missing and how to respond.

Why this build:
- graph8 already tags replies as Interested / Not interested / OOO and shows analytics on them.
- Nothing happens after the tag. graph8 has no follow-up campaign per objection group, no proof-gap view, and no V1→V2 learning. Its own AE guide lists the "flywheel" as unshipped.

This plan is built only from the stored docs and OpenAPI spec (`scratchpad/openapi.json`, 307 doc pages).
- Anything the docs don't confirm is marked **VERIFY** and goes on the hour-1 spike list.
- Companion docs: `PITCH.md` (the ReplyIQ pitch), `FLYWHEEL-RESEARCH.md` (feasibility), `GRAPH8-PLATFORM-GUIDE.md` (platform synthesis).

**Hard constraints** (from the brief at graph8.com/hackathon-brief):
- Timing: code written during the weekend; public repo by **Sun 14:00**; code freeze **Sun 17:30**; demo is **5 minutes, live**.
- Sending: no real sends, sandbox only.
- Scoring: 35 works end-to-end on graph8, 25 useful, 20 UX, 20 technical quality and platform usage.
- Sandbox keys arrive when the idea is locked on Saturday.

---

## 0. What's actually seeded (live dashboard check, 26 Sep, org `org_87325c23062e`)
| Area | What's there | What it means for ReplyIQ |
|---|---|---|
| **AI Inbox** (Engage → AI Inbox) | **12 email threads**, all marked `[DEMO]`/`[SYNTHETIC]`. Each has our outbound (from `hackathon-saad@example.com`) plus the prospect's reply, linked to a sequence and a "Fictional Company N". Sequence filter works. **Other** tab is empty. | Real replies exist, so the seeded-JSON fallback isn't needed. Tag write-back works on real threads. |
| Reply content | Only **6 templated replies**, repeated across Demo Contacts 01–12: "Interested in a demo, share the agenda" (2), "Can we schedule a follow-up next week?" (3), "Send pricing details" (2), "Not interested at this time" (2), "Please remove this contact" (2), "Out of office" (2). | Groups we'll get: **interested, no meeting** (5), **pricing request** (2), **hard no** (2), **unsubscribe** (2), **OOO** (2). No competitor, timing or referral objections, so the Price card is the main Answer Card demo. |
| **Inbox Analytics** | **0 replies, 0 tagged**, every chart empty. | The 12 threads aren't tagged. Tagging them makes the numbers appear, which gives the demo a before/after moment inside graph8's own UI. |
| **Sequencer** | 2 sequences, both **Completed**, **0 channels**, 2 steps, 10 contacts each. `[DEMO] Follow-up outcome history` = `96118ffd-cde3-5a7c-b57a-3ea8a0a02296` (inbox label "MapleMetrics Trial Activation", **2 threads**). `[DEMO] Product introduction history` = `90bda420-78bc-5634-9da0-51e4f46bdc4a` (label "OrbitDesk Demo Requests", **10 threads**). Dashboard totals: 26 emails, 17 completed, 2 bounced (7.7%), 7 replied (26.9%). | **Start from sequences, not Studio campaigns.** The list view counts 2 and 5 replies (7 total), but the inbox holds 2 and 10 threads, so the counts disagree. Report both and ask the engineers. |
| Sequence detail page | Both detail pages fail with **"Internal server error"**. | Use the API (`GET /sequences/{id}`, `/stats`, `/steps`) instead of the UI. Report the bug to the engineers. |
| **Dialer** | 2 completed sessions on the list `[DEMO] Sequencer and dialer test contacts`: 20 dials, 1 connect (5%), 0 booked. Call logs: 14 Missed, 3 Voicemail, 1 Not Interested, 2 SDR Hangup (Demo Contacts 01–20). | Stretch: add call outcomes via `POST /inbox/call-results/search` so a "Not Interested" call counts as a hard stop and missed/voicemail contacts are marked "not reached". |
| **Studio → Campaign** | 5 AI **ideas** about graph8 itself; none converted or launched. | The seeded sequences aren't linked to any Studio campaign, so `/campaigns/{id}/full` → `linked_sequences` finds nothing. The follow-up is still created as a new Studio campaign. |
| **Studio → Global** | 34/43 generated. Context 21/21 **Done**, including **Proof Catalog, Pricing Matrix, Value Props, Messaging House**, Offer Brief, Positioning Matrix. Research 0/6 and Targeting 0/3 not started. A "enter your domain" onboarding popup appears (left untouched). | The Answer Card inputs exist, so no generation is needed. The docs describe graph8's own offer, not MapleMetrics/OrbitDesk. Treat the org as selling graph8 and say so. |

## 1. Verified API surface (the endpoints we call)
Base URL: `https://be.graph8.com/api/v1`. Every request sends `Authorization: Bearer <key>`.

**Rate limits:** 50 requests per second and 1,000 per minute, per org. Responses carry `Retry-After` on a 429.

**SDK:** `@graph8/sdk` gives us:
- typed clients (`g8.campaigns.*`, `g8.lists.*`, `g8.contacts.*`, `g8.sequences.*`)
- the generic `request(base, path, apiKey, {query})` helper, which retries on 429/5xx and throws `G8Error`

| Step | Endpoint (verified in the OpenAPI spec) | Notes |
|---|---|---|
| Safety check | `GET /sandbox/status` → `{sandbox, environment, org_id}` | Run before every write. The docs say a test key may act on real data until the dedicated sandbox ships. |
| Sender | `GET /mailboxes` | Launch needs an active mailbox. |
| Pick source | **Primary:** `GET /sequences` → `GET /sequences/{id}`, `/stats`, `/steps` (the seeded data lives here). **Also:** `GET /campaigns/{id}/full` (returns `linked_sequences`, `is_launched`, docs) for Studio campaigns. | The seeded sequences aren't linked to Studio campaigns (§0). |
| Metrics | `GET /campaigns/{id}/metrics?days=`, `GET /sequences/{id}/stats` | Respect `metric_status`: available / zero / stale / unknown / missing. |
| Replies | `GET /inbox?channel=email&sequence_id=&page_size=100` → threads with `messages[].responder` (`OTHER` = prospect), `contact{email,name,company}`, `tags` | An org key can see an empty inbox, so use a **personal key**. Fallback: `GET /inbox/emails/by-sequence/{id}`. |
| Tag write-back | `POST /inbox/tags {name, description, color, ai_can_apply}`, `POST /inbox/{reply_id}/tag?channel=email {tag_ids}` | Tags must already exist before they can be attached. |
| Contact resolve | `GET /contacts?email=` → id; `GET /contacts/{id}/suppression` | Reads the same suppression ledger the sequencer uses. |
| Audience | `POST /lists {title, description}`, `POST /lists/{id}/contacts {contact_ids}` | Free (CRM CRUD). |
| Studio context | `GET /global-context/documents?include_content=true` | Includes Proof Catalog, Value Propositions, Pricing Matrix, Competitors, Messaging House. |
| Draft campaign | `POST /campaigns {name, brief, core_concept, primary_hook, target_persona, goal, audience_list_id, target_channels:["email"], auto_generate_documents:true}` | Returns `status:"copy_in_progress"` and generates about 15–20 docs asynchronously. The launcher requires `auto_generate_documents`. |
| Read and patch docs | `GET /campaigns/{id}/documents`, `PUT /campaigns/{id}/documents/{doc_id} {content}` | Versioned. Used to write the Answer Card into "Messaging & Objections" and "Reply Templates". |
| Launch (approval only) | `POST /campaigns/{id}/launch {sender_mailbox_ids}` | Email only. Needs an audience, completed copy, at least 1 step and an active sender. Returns 409 if already launched; 502 carries a recovery status. |
| Proof of send | `GET /sandbox/outbox?channel=email` | Simulated sends. |
| Studio write-back (stretch) | `PATCH /global-context/documents/{doc_id} {content}` | Creates a DocumentVersion snapshot. |
| Test data | `POST /sandbox/fixtures/seed` | Seeds **companies and contacts only**; the response has no reply counts. |

**Confirmed gaps:**
- No API creates inbound replies, and the sandbox only simulates outbound.
- No delayed-start field exists, so "not now" timing is advice shown on the approval screen, not automation.
- Opens are not tracked.
- Proving lift needs about 14 days of sends.

---

## 2. Hour-1 spike (go/no-go before building UI)
Run a single `scripts/spike.ts` that prints each result:
1. `GET /sandbox/status` with the sandbox key. Expect `sandbox:true` and a matching org_id.
2. `GET /inbox?channel=email` with a personal key. Do any threads have `responder:"OTHER"`, and does filtering by `sequence_id` work? **This decides real or seeded replies.**
3. `GET /global-context/documents`. Does a Proof Catalog with content exist? If not, generate it in Studio → Global. **VERIFY** the credit cost first.
4. `POST /campaigns` with `auto_generate_documents:true` on a throwaway draft:
   - time how long until every doc is `completed`
   - record the real `file_type` names for "Messaging & Objections", "Reply Templates" and "Email Copy"
5. `GET /mailboxes`: is there an active sender in the sandbox?
6. Launch the throwaway campaign, then check `GET /sandbox/outbox` for the simulated emails. Also check whether the 2-week new-mailbox ramp blocks sandbox sends. **VERIFY**
7. `POST /inbox/tags`, then tag one thread (only if step 2 found threads).

Questions to ask the engineers in person:
- Can you seed replies into our sandbox inbox?
- Is the flywheel overlap OK to build?
- Does sandbox launch honour the mailbox ramp?

**Decision:**
- **Result from the live check (§0): replies exist.** Run on the 12 real threads, including tag write-back. Still confirm that the API returns them with the sandbox key.
- **Only if the API returns nothing:** load `data/seed-replies.json` (about 40 realistic replies) mapped onto **real sandbox contacts** from the fixture seed. Every later step still runs for real on graph8 (lists, campaigns, doc patches, launch, outbox). The UI shows a "Seeded replies" badge, and we say so out loud in the demo.

---

## 3. Architecture
- **Stack:** Next.js (App Router) and TypeScript, one repo. All graph8 and Gemini calls run in server route handlers. Keys stay in `.env.local` (`G8_API_KEY`, `GEMINI_API_KEY`) and never reach the client.
- **LLM:** Gemini via `@google/genai`, with JSON-schema structured output (`responseMimeType: application/json` + `responseJsonSchema`).
  - `gemini-3.5-flash-lite` for classification (fast and cheap, batches of 20).
  - `gemini-3.8-flash` for Answer Cards and campaign briefs.
- **State:** one JSON file per run in `data/runs/{runId}.json`. No database.

```
replyiq/
  scripts/spike.ts
  lib/g8.ts            # wraps @graph8/sdk request(); assertSandbox(); paginate inbox
  lib/gemini.ts        # classify(), answerCard(), campaignBrief()
  lib/taxonomy.ts      # categories + hard-stop rules
  lib/pipeline/        # fetchReplies, classify, resolveContacts, answerCards, draftCampaign, launch
  lib/store.ts         # run JSON read/write
  data/seed-replies.json
  app/page.tsx                         # campaign picker + sandbox badge
  app/runs/[id]/page.tsx               # objection groups + Answer Cards
  app/runs/[id]/groups/[g]/page.tsx    # approval screen (V1→V2, audience, cost, launch)
  app/api/{preflight,campaigns,runs,runs/[id]/groups/[g]/{draft,launch,save-studio}}/route.ts
  README.md
```

### Pipeline
1. **Preflight:** check sandbox status and that a mailbox exists; show a green "Sandbox ✓ org_…" badge.
2. **Load source:** pick a **sequence** (`GET /sequences`; the seeded ones are `90bda420…` with 10 threads and `96118ffd…` with 2). Show its steps and stats. If a Studio campaign is picked instead, use `/full` → `linked_sequences` and its "Messaging & Objections" doc.
3. **Fetch replies:** `GET /inbox?channel=email&sequence_id=<id>`, paged, keeping the prospect messages. Record the gap between the sequencer's reply count and the inbox thread count (§0).
4. **Classify:** each reply gets one category:
   - interested, no meeting
   - timing / not now
   - price
   - competitor lock-in
   - wrong person / referral
   - no need
   - hard no
   - unsubscribe
   - OOO
   - other
   
   Each result also carries `{confidence, quote, referred_name?, revisit_hint?}`. Anything under 0.6 confidence goes to "Needs review".
5. **Tag write-back** (real threads only): create `ReplyIQ · <category>` tags once, then tag each thread. The existing Inbox tag filter and `/inbox/analytics` then show our categories. That's native platform usage.
6. **Resolve and guard:** email → contact_id, then a suppression check. **Hard-stop rule:** hard no, unsubscribe and suppressed contacts are never added to a list. The approval screen lists everyone excluded, with the reason.
7. **Answer Card** per group. Inputs are the group's quotes, the Studio Global docs and the original campaign's objection doc. The output is:

   | Field | Meaning |
   |---|---|
   | `summary` | the objection in one line |
   | `quotes[3]` | representative replies |
   | `proof_we_have[{claim, source_doc_id, excerpt}]` | proof graph8 already holds, with its source |
   | `proof_gap` | missing proof, or null if the gap is covered |
   | `how_to_answer` | how to respond |
   | `email_angle` | the angle the follow-up emails take |

   **Grounding check in code:** a proof claim survives only if `source_doc_id` exists and `excerpt` is a substring of that doc's content. Anything that fails moves to `proof_gap`. That is what makes the ⚠ proof-gap line trustworthy.
8. **Draft follow-up campaign** (only for groups with at least 2 contacts and not hard-stopped):
   - create the list and add the contacts
   - `POST /campaigns` with a brief that embeds the Answer Card, the quotes and the proof, plus `auto_generate_documents:true`
   - poll `/documents` until they're completed (timeout from the spike measurement)
   - `PUT` an Answer Card section into the campaign's "Messaging & Objections" and "Reply Templates" docs
   
   **Nothing launches automatically.**
9. **Approval screen** shows:
   - V1 vs V2 (hook, angle, step list from `/full`)
   - the Answer Card
   - audience count and exclusions
   - a timing note (e.g. "revisit after Q1", advisory only)
   - a credit estimate (1 credit per email step per contact, plus about 1 credit per 1k tokens of generation; ⚠ confirm against `GET /usage/transactions`)
   
   **Approve & launch** opens a confirm modal, runs `assertSandbox()`, calls `POST /launch`, then shows the simulated emails from `GET /sandbox/outbox`.
10. **Save to Studio:**
    - **MVP:** the Answer Card is already in the follow-up campaign's docs.
    - **Stretch:** propose an append to Global "Messaging House" or "Proof Catalog" as a diff, which a person approves before we call `PATCH /global-context/documents/{id}` (versioned, so reversible).

**Referral group (stretch):** extract the name from the reply, look it up with `POST /enrichment/lookup/person` (**VERIFY** the schema and cost), and add the colleague to the referral list.

---

## 4. Roadmap: hackathon weekend (times PKT)
| When | Milestone | Done means |
|---|---|---|
| Sat 13:00–14:00 | Idea locked, keys received, repo scaffolded (Next.js, env, `lib/g8.ts`) | `npm run dev` works; the spike script runs |
| Sat 14:00–16:30 | **Spike §2** plus engineer questions. Choose real or seeded replies. Write `seed-replies.json` if needed. | All 7 checks printed; decision logged in the README |
| Sat 16:30–18:00 | Pipeline steps 1–4 (fetch and classify) with a CLI runner | Run JSON contains grouped replies with quotes |
| **Sat 18:00 progress check** | Show the groups printed from real graph8 data | |
| Sat 18:00–22:00 | Steps 5–7: tags, contact resolve and suppression, Answer Cards with the grounding check | Every card cites real Studio doc ids; gaps flagged |
| Sat night (off-site) | Step 8: draft campaigns, doc patch, polling | One draft campaign visible in Studio → Campaigns with the Answer Card in its docs |
| Sun 12:00–14:00 | UI: picker, groups/cards page, approval screen, sandbox launch plus outbox view. **Repo public by 14:00** | End-to-end click-through works |
| Sun 14:00–16:00 | Hardening: loading states, 429/402/409/502 handling, a pre-run backup snapshot (`POST /sandbox/fixtures/snapshot`), README with an architecture diagram and a sandbox disclosure | A fresh run works twice in a row |
| Sun 16:00–17:30 | Stretch only if green: Global Studio patch, referral lookup. Rehearse the demo path 3 times | **Freeze 17:30** |

**Suggested split** (merge roles if the team is smaller):
- **A** – graph8 integration (`lib/g8`, spike, draft/launch)
- **B** – AI (classification, Answer Cards, grounding check)
- **C** – UI and UX
- **D** – seed data, README, pitch, demo script

---

## 5. Demo (5 min, live)
| Time | Beat |
|---|---|
| 0:00 | **Problem:** graph8's Inbox Analytics shows the Interested %, and every other reply dead-ends. |
| 0:40 | Run ReplyIQ on the finished `[DEMO] Product introduction history` sequence: the 10 replies are grouped with counts and quotes. Refresh Inbox Analytics: it goes from **0 tagged** to our categories, inside graph8's own UI. |
| 1:40 | **Price Answer Card:** proof we have (cited from the Proof Catalog), the ⚠ proof gap ("no ROI case study for mid-market"), and how to answer. |
| 2:40 | Open the draft follow-up campaign in Studio. Show the approval screen (V1→V2, exclusions, cost), then **Approve → sandbox launch → outbox**. |
| 3:40 | **Learning loop:** the Answer Card is now in the campaign's objection doc, and the next generation uses it. |
| 4:15 | **Money:** same list and data, more meetings, more execution credits for graph8. Proving lift takes 14 days of sends, so we don't claim it. |

---

## 6. Post-hackathon roadmap
- **V1.1 (weeks 1–2):**
  - real-time re-runs via the `engagement.email_replied` webhook (`POST /webhooks`; payload has `is_positive`, `sequence_id`, `campaign_id`)
  - Global Studio write-back with a diff approval
  - referral enrichment
  - `new_inbox_tag_set` workflow trigger so graph8 Workflows can react to ReplyIQ tags
- **V1.2 (weeks 3–6):**
  - lift measurement: V1 vs V2 reply-to-meeting rate from `/campaigns/{id}/metrics` and `/sequences/{id}/reports` after 14 days
  - a proof-gap backlog per org handed to marketing (the landing-page idea returns here, using the verified `/landing-pages` API)
- **V2:**
  - cross-campaign playbook memory (objection → winning angle, by persona and industry)
  - LinkedIn and SMS replies (the inbox API already returns them)
  - multi-org view for agencies via `X-Target-Org-Id`
  - package it as a graph8 Skill or Marketplace app

---

## 7. Risks and mitigations
| Risk | Mitigation |
|---|---|
| No replies in the sandbox | Seeded replies over real sandbox contacts, disclosed; everything after classification is real |
| Doc generation too slow for a live demo | Pre-generate one draft before the demo and generate a second live; poll with a timeout |
| Test key touches real data | `assertSandbox()` before every write; launch requires the confirm modal |
| Hallucinated proof | Substring grounding check against the Studio doc content |
| Re-contacting people who said no | Hard-stop categories plus the suppression API, with exclusions shown on screen |
| 429s | The SDK's retry with `Retry-After`, batched calls, no search hammering |
| Overlap with the roadmap "flywheel" / Autopilot team | Position as campaign-level, approval-first, Studio-learning; confirm with the engineers |

---

## 8. Verification (end-to-end)
1. `npx tsx scripts/spike.ts`: all checks pass or have documented fallbacks.
2. Full run through the UI on one campaign. Then confirm **in the graph8 app**:
   - the ReplyIQ tags appear in the Inbox filter (real threads only)
   - the new lists appear under Lists with the right counts and no suppressed or hard-no contacts
   - the draft campaigns appear in Studio → Campaigns with the Answer Card in "Messaging & Objections"
3. Approve one group: the launch returns `live` or `scheduling`, and `GET /sandbox/outbox` shows the simulated emails.
4. Grounding test: remove the Proof Catalog excerpt from the input, and the claim must move to `proof_gap`.
5. Safety test: a reply classified as unsubscribe never appears in any list.
6. Rerun on a clean snapshot (`/sandbox/fixtures/restore`) to prove it's repeatable before the demo.
