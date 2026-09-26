# ReplyIQ: implementation plan (start here)

This file is the build guide. [REPLYIQ-PLAN.md](REPLYIQ-PLAN.md) holds the product plan, the verified API list (§1) and the live dashboard findings (§0).

**Deferred by the team.** Mailbox setup and seeding richer email replies come later. The code is built so neither blocks progress:
- **Launch is behind a flag** (`ENABLE_LAUNCH=false`). The approval screen shows the launch button, but it only calls the API once the flag is on and a mailbox exists.
- **The taxonomy already covers** competitor, timing and referral objections. When richer replies are seeded, they get classified and grouped with **no code change**.

---

## M1 results (26 Sep, verified live)
- **The graph8 client is built on the SDK's `request()`.** It accepts `{method, body, headers, query, idempotencyKey, maxRetries}`; retries 429/5xx/network, honouring `Retry-After`; and adds an `Idempotency-Key` on writes. Checked in the installed SDK source.
- **There's no sandbox environment for this key.** `/sandbox/status` returns **404** ("only in the developer sandbox environment"). The key acts on production, org `org_87325c23062e` (role admin), which holds the seeded hackathon data. The team confirmed this org is the hackathon sandbox, so it's allowlisted in `replyiq/lib/config.ts`. **Writes still fail closed for any other org**: they're allowed only if sandbox status is true, or if the key's org (from `GET /roles/me/permissions`) is in that allowlist (plus optional `G8_WRITE_ORG_ID`).
- **How replies are read:** `GET /inbox?sequence_id=` misses the seeded `[DEMO]` threads. **`POST /inbox/emails/search`** (a search that changes nothing) returns them, with the thread id, **contact id**, `campaign_id` (= sequence id), tags and summary. Mailboxes come from `GET /inbox/mailboxes/all`.
  - **It must be called one mailbox at a time.** Passing two mailboxes returned 0 of the 10 demo threads.
  - The client uses both readers and merges them by thread id.
- **Data found:** 6 sequences (4 not shown in the Sequencer UI), 40 replies across 4 sequences, all with contact ids:
  - `[DEMO] Product introduction history`: 10
  - `[DEMO] Follow-up outcome history`: 2
  - `[Full copy] Kill Your Tool Stack v2`: 19 anonymised real replies (mostly OOO, "left the company, contact X", "not interested")
  - `[Hackathon copy] … v2`: 9 placeholders ("Original private reply omitted")
- **The real data is the graph8 team's SMB campaign** (`[Full copy] Kill Your Tool Stack — Tech SMB Sales v2`, mailbox `campaign-saad@example.com`, workspace "Graph8 Tech SMB Sales — full campaign"): 7,111 contacts, 2,136 sent, 19 replies. One reply is an 8-message thread that ends in a **booked meeting**, so each `Reply` now carries `conversation` (the last 8 messages) and graph8's `summary`, and `Category` gained `meeting_booked`. No graph8 Workflows exist yet (`GET /workflows` returns 0).
- **Other checks:**
  - 14 inbox tags already exist (Interested, Not Interested, Out of Office, Referred Colleague, Time Objection…)
  - 17/17 contacts resolved, none suppressed
  - all 6 key Studio docs are present (Proof Catalog 20k chars, Pricing Matrix 26k…)
  - 2 mailboxes, 0 active
- **Privacy:** the live samples contain real phone numbers and the owner's email, so they're kept in the gitignored `tests/fixtures/live/`. Only the scrubbed `[DEMO]` sample in `tests/fixtures/demo/` is committed.
- **Tests:** 27 unit tests covering retries, 4xx/5xx handling, pagination, the write policy (including "a refused write never hits the network"), per-mailbox search and merge, normalisers, text cleanup, scrubbing and the real demo threads. `npm run spike` passes 20/20.

## 1. Scope of the first build

**In scope:**
- read sequences and replies from the real sandbox
- classify replies and group them
- tag the threads in graph8
- resolve contacts and check suppression
- Answer Cards with the grounding check
- draft follow-up campaigns in Studio (list, campaign, doc patch)
- the approval screen
- run history

**Out of scope for now:**
- the actual launch (flagged)
- the sandbox outbox view (only needed after launch)
- referral enrichment
- Global Studio write-back
- webhooks
- call outcomes

---

## 2. Project setup (M0, ~30 min)

**Location:** `D:\GitHub\graph8\replyiq\`. This folder becomes the **public GitHub repo**; the research notes stay private.

```bash
npx create-next-app@16.3.6 replyiq --ts --app --eslint --tailwind --no-src-dir --import-alias "@/*" --use-npm --disable-git --yes
```
```bash
npm i openai @graph8/sdk zod nanoid
```
```bash
npm i -D @types/node@^22 @next/env@16.3.6 tsx vitest
```

`.env.local` (gitignored; the variables are also listed in `replyiq/README.md`):
```
G8_API_BASE=https://be.graph8.com/api/v1
G8_API_KEY=            # sandbox PERSONAL key (an org key can see an empty inbox)
OPENAI_API_KEY=        # OpenAI platform key
OPENAI_CLASSIFY_MODEL=gpt-6-luna
OPENAI_REASON_MODEL=gpt-6-sol
ENABLE_LAUNCH=false
MIN_GROUP_SIZE=2
```

**Rule:** keys are read only in server code (`lib/`, `app/api/`). No component imports `lib/g8.ts`.

---

## 3. Folder structure
```
replyiq/
  lib/
    env.ts              # zod-validated env; throws early on missing keys
    types.ts            # shared types (§4)
    g8.ts               # graph8 HTTP client + one function per endpoint (§5)
    taxonomy.ts         # categories, labels, hard-stop + follow-up rules (§6)
    llm.ts              # classify(), answerCard(), campaignBrief() via OpenAI structured outputs (§7)
    grounding.ts        # verifyProof(): substring check against Studio docs (§8)
    store.ts            # data/runs/{runId}.json read/write
    pipeline/
      loadSource.ts     # sequence detail + steps + stats
      fetchReplies.ts   # inbox threads → Reply[]
      classify.ts       # batches of 20 → Classified[]
      tagThreads.ts     # ensure tags exist, tag each thread
      resolveContacts.ts# email → contact_id, suppression, hard-stop filter
      answerCards.ts    # per group, grounded
      draftCampaign.ts  # list → contacts → campaign → poll docs → patch docs
      runPipeline.ts    # orchestrates steps 1–6; step 7 is on demand per group
  app/
    page.tsx                          # sandbox badge + sequence picker + past runs
    runs/[runId]/page.tsx             # groups + Answer Cards
    runs/[runId]/groups/[key]/page.tsx# approval screen
    api/preflight/route.ts
    api/sequences/route.ts
    api/runs/route.ts                 # POST start run, GET list
    api/runs/[runId]/route.ts         # GET run state (polled by the UI)
    api/runs/[runId]/groups/[key]/draft/route.ts
    api/runs/[runId]/groups/[key]/launch/route.ts   # 403 unless ENABLE_LAUNCH
  components/  SandboxBadge, SequencePicker, StepProgress, GroupCard, AnswerCard, ExclusionsTable, V1V2Diff, ConfirmModal
  scripts/
    spike.ts            # hour-1 checks (§10)
    run.ts              # CLI: npx tsx scripts/run.ts <sequenceId>
  tests/  taxonomy.test.ts, grounding.test.ts, resolveContacts.test.ts, fixtures/*.json
  data/runs/            # gitignored
  README.md
```

---

## 4. Core types (`lib/types.ts`)
Field names follow the verified API schemas (§5).
```ts
export type Category =
  | 'interested_no_meeting' | 'meeting_request' | 'pricing_request' | 'price_objection'
  | 'timing_not_now' | 'competitor_locked_in' | 'referral_wrong_person' | 'no_need'
  | 'hard_no' | 'unsubscribe' | 'out_of_office' | 'other';

export interface Reply {
  threadId: string;            // InboxThreadResponse.id  (used for POST /inbox/{id}/tag)
  sequenceId: string;
  contactEmail: string;        // thread.contact.email
  contactName?: string;        // thread.contact.name
  company?: string;            // thread.contact.company
  subject?: string;
  outbound?: string;           // first message with responder USER|AI
  replyText: string;           // last message with responder OTHER
  repliedAt?: string;
  existingTags: { id: string; name: string }[];
}

export interface Classified extends Reply {
  category: Category;
  confidence: number;          // 0..1; < 0.6 → needsReview
  quote: string;               // short verbatim span from replyText
  referredName?: string;
  revisitHint?: string;        // "next week", "after Q1"
  needsReview: boolean;
}

export interface ProofItem { claim: string; sourceDocId: string; sourceDocName: string; excerpt: string; verified: boolean }

export interface AnswerCard {
  summary: string;
  quotes: string[];
  proofWeHave: ProofItem[];    // verified only
  proofGap: string | null;     // includes claims that failed grounding
  howToAnswer: string;
  emailAngle: string;
}

export interface Group {
  key: Category;
  label: string;
  replies: Classified[];
  eligible: { contactId: number; email: string }[];
  excluded: { email: string; reason: 'hard_no' | 'unsubscribe' | 'suppressed' | 'not_found' | 'no_followup_category' }[];
  card?: AnswerCard;
  draft?: { listId: number; campaignId: string; docsPatched: string[]; status: 'drafting' | 'ready' | 'failed'; error?: string };
}

export interface Run {
  id: string; createdAt: string; orgId: string;
  source: { sequenceId: string; name: string; stats?: unknown; steps?: unknown };
  steps: Record<'load'|'fetch'|'classify'|'tag'|'resolve'|'cards', 'pending'|'running'|'done'|'failed'|'skipped'>;
  counts: { threads: number; prospectReplies: number; sequencerReplies?: number };
  groups: Group[];
  errors: string[];
}
```

---

## 5. graph8 client (`lib/g8.ts`)

### 5.1 HTTP core
Build our own `g8fetch(method, path, {query, body})` on native `fetch`. The docs only show the SDK's `request()` with GET query options, so body/method support is unconfirmed (**VERIFY** in the spike; if it works, swap the core for `request()` and use `G8Error`).

Behaviour, matching what the docs say the SDK does:
- **Headers:** `Authorization: Bearer ${G8_API_KEY}` and `Content-Type: application/json`.
- **Retries:** retry 429/5xx/network errors up to 2 times with exponential backoff and jitter (200 ms base), honouring `Retry-After`. Never retry other 4xx errors.
- **Responses:** unwrap `json.data`. Throw a `G8Error {status, detail, requestId: res.headers.get('x-request-id')}`.
- **Error bodies:** parse all three documented envelope shapes (`detail`, `error{}`, `type/code`).
- **Idempotency:** add an `Idempotency-Key` header on creates (list and campaign) using `runId:groupKey`.

### 5.2 Functions (all verified in `openapi.json`)
| Function | Call | Fields we use |
|---|---|---|
| `sandboxStatus()` | `GET /sandbox/status` | `sandbox, environment, org_id` |
| `assertSandbox()` | calls `sandboxStatus()` | throws unless `sandbox === true`; runs before **every write** |
| `listSequences()` | `GET /sequences` | `id, name, status, contact_count, step_count` |
| `getSequence(id)` | `GET /sequences/{id}` | `name, status, associated_list_id` |
| `getSequenceSteps(id)` | `GET /sequences/{id}/steps` | `steps[]` (with `rendered` copy) → the V1 side of the diff |
| `getSequenceStats(id)` | `GET /sequences/{id}/stats` | `total_contacts, step_stats[]` |
| `listThreads(sequenceId)` | `GET /inbox?channel=email&sequence_id=&page=&page_size=100` | pages until `pagination.has_next` is false |
| `listInboxTags()` | `GET /workflows/inbox-tags` | id + name (used for idempotent tag creation) |
| `createInboxTag(name, color)` | `POST /inbox/tags {name, description, color, ai_can_apply:false}` | the response is untyped, so re-read `listInboxTags()` to get the id |
| `tagThread(threadId, tagIds)` | `POST /inbox/{id}/tag?channel=email {tag_ids}` | `tagged` |
| `findContactByEmail(email)` | `GET /contacts?email=&limit=1` | `data[0].id` (integer) |
| `getSuppression(contactId)` | `GET /contacts/{id}/suppression` | `is_suppressed, active_channels` |
| `listGlobalDocs()` | `GET /global-context/documents?include_content=true` | `id, display_name, file_type, category, content` |
| `createList(title, description)` | `POST /lists` | `id` (integer), `total` |
| `addToList(listId, contactIds)` | `POST /lists/{id}/contacts {contact_ids, conflict_resolution:'add_all'}` | |
| `createCampaign(body)` | `POST /campaigns` | `id, status, generation_status, total_documents` |
| `listCampaignDocs(id)` | `GET /campaigns/{id}/documents` | `documents[]: id, display_name, file_type, status` |
| `getCampaignDoc(id, docId)` | `GET /campaigns/{id}/documents/{docId}` | `content` |
| `updateCampaignDoc(id, docId, content)` | `PUT /campaigns/{id}/documents/{docId}` | version bump |
| `getCampaignFull(id)` | `GET /campaigns/{id}/full` | sequence and step catalog → the V2 side of the diff |
| `listMailboxes()` | `GET /mailboxes` | active sender (launch gate) |
| `launchCampaign(id, mailboxIds)` | `POST /campaigns/{id}/launch {sender_mailbox_ids}` | **flagged**; handle 409 and 502 `detail.status` |

**Sequence ids for testing** (from §0):
- `90bda420-78bc-5634-9da0-51e4f46bdc4a`: 10 threads
- `96118ffd-cde3-5a7c-b57a-3ea8a0a02296`: 2 threads

---

## 6. Taxonomy and rules (`lib/taxonomy.ts`)
| Category | Label (tag name) | Follow-up? | Answer Card? | Follow-up angle |
|---|---|---|---|---|
| interested_no_meeting | ReplyIQ · Interested, no meeting | ✅ | ✅ | Send the agenda, make booking easy |
| meeting_request | ReplyIQ · Meeting request | ✅ (flag for the rep first) | – | Confirm a time |
| pricing_request | ReplyIQ · Pricing request | ✅ | ✅ | Pricing plus ROI and proof |
| price_objection | ReplyIQ · Price objection | ✅ | ✅ | ROI and a cheaper path |
| timing_not_now | ReplyIQ · Not now | ✅ (timing note) | ✅ | New hook later |
| competitor_locked_in | ReplyIQ · Competitor | ✅ | ✅ | Displacement or comparison |
| referral_wrong_person | ReplyIQ · Referral | ✅ (stretch: find the colleague) | – | Intro to the named person |
| no_need | ReplyIQ · No need | ✅ | ✅ | A different pain |
| out_of_office | ReplyIQ · OOO | ❌ (re-queue note) | – | – |
| **hard_no** | ReplyIQ · Hard no | ❌ **never** | – | – |
| **unsubscribe** | ReplyIQ · Unsubscribe | ❌ **never** | – | – |
| other | ReplyIQ · Needs review | ❌ | – | – |

- `HARD_STOP = ['hard_no', 'unsubscribe']`
- Any suppressed contact is also excluded, whatever its category.
- A group gets a draft campaign only if it's a follow-up category and has at least `MIN_GROUP_SIZE` eligible contacts.

**Expected groups on the reference campaign** (graph8 Tech SMB Sales, sequence `e470a095`, 19 replies; see REPLYIQ-PLAN §0b):
- out of office: ~8 (keep the return date in `revisitHint`)
- referral / wrong person: ~5–6 (keep the named person in `referredName`)
- left the company, no referral: 1–2 (`other`, no follow-up)
- hard no: 1
- meeting booked: 1 (never followed up)
- auto-reply / invalid address: 2 (`other`)

**Test set for the objection categories** (synthetic `[DEMO]` sequence `90bda420`, committed in `tests/fixtures/demo/`):
- interested/meeting: 4
- pricing request: 2
- hard no: 2
- unsubscribe: 2

Classification must use `Reply.conversation`, not just `replyText`. In the SMB meeting thread, the last prospect message reads like a complaint ("the time I picked wasn't 9 am").

---

## 7. OpenAI calls (`lib/llm.ts`)
- **SDK:** `openai` (v7.23). `const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY })`.
- **Structured output:** the Responses API with zod: `openai.responses.parse({ model, input: [{role:'system', content}, {role:'user', content}], text: { format: zodTextFormat(Schema, 'name') } })`, then read the typed `response.output_parsed`. `zodTextFormat` comes from `openai/helpers/zod`; the installed helper supports zod v4. One retry with the error text if parsing fails.
- **Models** (OpenAI's model list, 26 Sep 2026): `gpt-6-luna` for classification (most efficient, high volume) and `gpt-6-sol` for Answer Cards and briefs (balanced capability and cost). `gpt-6-astra` is available if quality needs a boost. All are set in the env so they can be swapped without code changes.
- **Errors:** the SDK retries 429/5xx itself; mark the step failed after that.

### 7.1 `classify(replies[])` → `OPENAI_CLASSIFY_MODEL`, batches of 20
- **System prompt:** you label B2B cold-email replies. Use only the reply text. Pick exactly one category from the list, with its definitions (a copy of the table in §6). `quote` must be copied verbatim from the reply. If a reply asks to be removed, the category is `unsubscribe` even if it's polite.
- **Output schema `record_labels`:** `{labels: [{threadId, category (enum), confidence 0..1, quote, referredName?, revisitHint?}]}`
- **Code checks after the call:**
  - every `threadId` was returned exactly once
  - `quote` is a substring of `replyText`; otherwise use the first 140 characters and set `confidence = min(confidence, 0.5)`
  - `needsReview = confidence < 0.6`

### 7.2 `answerCard(group, docs, originalSteps)` → `OPENAI_REASON_MODEL`, one call per group
- **Inputs:**
  - the group label and all its reply texts
  - the original outbound copy (from sequence steps)
  - the Studio docs whose `display_name` matches Proof Catalog, Pricing Matrix, Value Props, Messaging House, Positioning Matrix, Offer Brief or Pains And Gains, each wrapped in `<doc id="…" name="…">…</doc>` and trimmed to about 6k characters
- **System prompt:** you write an Answer Card for a sales team. Only claim proof that appears verbatim in the provided docs. For each proof item, copy an exact excerpt of 8–40 words and its doc id. If the docs don't contain proof that answers the objection, say so in `proof_gap`. Don't invent numbers, customers or case studies.
- **Output schema `write_answer_card`:** `{summary, quotes[1..3], proof_we_have[{claim, source_doc_id, excerpt}], proof_gap|null, how_to_answer, email_angle}`
- The result then goes through `verifyProof()` (§8).

### 7.3 `campaignBrief(group, card, source)` → `OPENAI_REASON_MODEL`
**Output schema `write_campaign_fields`** returns fields within the API limits:
- `{name ≤255, core_concept, primary_hook, target_persona ≤200, goal ≤255, brief}`
- `brief` = a Markdown block with: why this audience exists (the group and its quotes), the Answer Card, the verified proof, the email angle, the timing note, and "Do not claim: <proof_gap>".

---

## 8. Grounding check (`lib/grounding.ts`)
```ts
verifyProof(card, docs): AnswerCard
  norm = s => s.toLowerCase().replace(/\s+/g,' ').replace(/[“”]/g,'"').replace(/[‘’]/g,"'").trim()
  for each item in card.proofWeHave:
    doc = docs.find(d => d.id === item.sourceDocId)
    verified = !!doc && norm(doc.content).includes(norm(item.excerpt)) && item.excerpt.split(' ').length >= 6
  keep verified items; append failed claims to proofGap as "Unverified: <claim>"
```
The UI shows the ✓ source doc name next to each proof item and ⚠ on the proof-gap line.

---

## 9. Pipeline and state (`lib/pipeline/runPipeline.ts`)
`POST /api/runs {sequenceId}` creates the run JSON, **returns `runId` immediately**, and continues in the background. The UI polls `GET /api/runs/[runId]` every 1.5 s and renders the `steps` progress.

| Step | Does | Writes to graph8? | On failure |
|---|---|---|---|
| load | sequence, steps, stats | no | fail the run |
| fetch | threads → `Reply[]` (keep threads with at least 1 `OTHER` message) | no | fail the run; 0 replies shows an empty state |
| classify | batches → `Classified[]` → groups | no | fail the run |
| tag | ensure the 12 tags exist, tag each thread with its category | **yes** (`assertSandbox` first) | mark skipped and continue (non-critical) |
| resolve | email → contact id → suppression; fill eligible/excluded | no | per-contact `not_found`; continue |
| cards | `answerCard` + `verifyProof` per Answer Card group, 3 in parallel | no | per-group error; continue |

**On demand, per group:** `POST /api/runs/[id]/groups/[key]/draft`. This is not automatic, because campaign generation spends AI credits:
1. `assertSandbox()`
2. `createList("ReplyIQ · <sequence> · <label> · <date>")`, then `addToList(eligible ids)`
3. `campaignBrief()`, then `createCampaign({...fields, category:'Outbound', audience_list_id: String(listId), target_channels:['email'], auto_generate_documents:true})`
4. poll `listCampaignDocs` every 5 s until every doc is `completed` (timeout 240 s → `status:'ready'` with a "docs still generating" warning)
5. find the docs whose `display_name` matches `/objection/i` and `/reply/i`, then `updateCampaignDoc` to append a `## ReplyIQ Answer Card` section
6. save `draft` on the group

**Launch route:** returns 403 `{reason:'launch_disabled'}` unless `ENABLE_LAUNCH=true`. When enabled, it checks:
- `assertSandbox()`
- `listMailboxes()` has an active sender
- the confirm token from the modal

Then it calls `launchCampaign`.

---

## 10. `scripts/spike.ts` (run first, prints ✅/❌ per check)
1. `sandboxStatus()`, printing `org_id`
2. `listSequences()`: expect the 2 `[DEMO]` sequences
3. `listThreads('90bda420…')`: expect 10 threads with `OTHER` messages; print the first thread's JSON (this becomes `tests/fixtures/thread.json`)
4. `listInboxTags()`: print the existing tags
5. `findContactByEmail` for one thread's contact email, then `getSuppression`
6. `listGlobalDocs()`: print `display_name` and content length (expect Proof Catalog, Pricing Matrix and the others to be non-empty)
7. `listMailboxes()`: print only (mailbox setup is deferred)
8. **VERIFY:** does the SDK's `request()` accept `{method, body}`? Try a harmless GET through it.

The spike does **not** create campaigns. The first campaign is created in M5 so we only spend credits once.

---

## 11. Build order (milestones)
| # | Milestone | Tasks | Done when |
|---|---|---|---|
| **M0** | Scaffold | create-next-app, deps, `env.ts`, `.env.example`, `git init`, create the public GitHub repo | `npm run dev` shows the page; the repo is pushed |
| **M1** | graph8 client and spike | `g8.ts` core and read functions, `spike.ts` | all 8 checks print; fixtures saved |
| **M2** | Fetch and classify (CLI) | `fetchReplies`, `taxonomy`, `llm.classify`, `store`, `scripts/run.ts` | `run.ts 90bda420…` prints groups matching §6; `taxonomy.test.ts` passes |
| **M3** | Write-back and guards | `tagThreads`, `resolveContacts` | the tags appear in the **graph8 Inbox tag filter**; Inbox Analytics is no longer 0; unsubscribe/hard-no contacts are always excluded (tested) |
| **M4** | Answer Cards | `answerCard`, `grounding` | the pricing card cites the real Pricing Matrix / Proof Catalog doc ids; `grounding.test.ts` passes (a fake excerpt moves to proof gap) |
| **M5** | Draft campaign | `draftCampaign`, `campaignBrief` | a new campaign appears in **Studio → Campaign** with the ReplyIQ list as its audience and the Answer Card in its objection doc; note the real doc-generation time |
| **M6** | UI | the 3 pages, polling, components, flagged launch button | click-through: pick sequence → run → cards → draft → approval screen |
| **M7** | Hardening and repo | error states (402 credits, 409, 429), empty states, README (setup, architecture, sandbox and data disclosure), screenshots | a fresh run works twice in a row; repo public by **Sun 14:00** |
| later | Deferred | mailbox → `ENABLE_LAUNCH=true` → outbox view; richer replies → just re-run | launch returns `live` or `scheduling`; `/sandbox/outbox` shows the sends |

**Parallel tracks** (4 people; merge if fewer):
- **A**: M1 → M3 → M5
- **B**: M2 (classify) → M4
- **C**: M6 UI against `tests/fixtures` and mock run JSON from the start
- **D**: README, demo script, pitch, and preparing the seed-reply wording for when the team seeds richer replies

---

## 12. Tests (vitest, run with `npx vitest run`)
- **`taxonomy.test.ts`:** each hard-stop category gives `eligible=false`; follow-up rules and min group size are respected.
- **`grounding.test.ts`:**
  - a real excerpt is verified
  - an altered excerpt fails and moves to proof gap
  - excerpts under 6 words fail
  - whitespace and quote differences are normalised
- **`resolveContacts.test.ts`** (with a mocked `g8`):
  - `is_suppressed` → excluded as suppressed
  - contact not found → `not_found`
  - unsubscribe → excluded even if not suppressed
- **Smoke test:** `npx tsx scripts/run.ts 90bda420-78bc-5634-9da0-51e4f46bdc4a`, then check in the graph8 UI (tags and analytics).

---

## 13. Guardrails (apply from the first commit)
- `assertSandbox()` before every write. Launch is flagged and needs a confirm modal.
- Never add hard-no, unsubscribe or suppressed contacts to any list. Show the exclusions on screen.
- No searches in bulk; batch calls; respect `Retry-After` (the brief's "no scraping, fair use" rule).
- Keys only in `.env.local`, which is gitignored, and never logged. The README says all data is sandbox and synthetic.
- Draft campaigns are created only when the user clicks, because they spend credits.
