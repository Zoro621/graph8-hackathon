# ReplyIQ: implementation plan (start here)

This file is the build guide. [REPLYIQ-PLAN.md](REPLYIQ-PLAN.md) holds the product plan, the verified API list (§1) and the live dashboard findings (§0).

**Deferred by the team.** Mailbox setup and seeding richer email replies come later. The code is built so neither blocks progress:
- **Launch is behind a flag** (`ENABLE_LAUNCH=false`). The approval screen shows the launch button, but it only calls the API once the flag is on and a mailbox exists.
- **The taxonomy already covers** competitor, timing and referral objections. When richer replies are seeded, they get classified and grouped with **no code change**.

---

## M5b results (27 Sep, verified live): follow-up emails via the Sequencer, and company-wide learnings
**Why:** Studio's generator loses the campaign's Emails document in this org (see the regression section below). graph8's own SMB sequence (`e470a095…`) shows the path that works:
- step 1 is `EMAIL` + `ON_DEMAND`: graph8's AI writes each contact's email at send time from `step_data.instructions`
- step 2 is `MANUAL_TEMPLATE`

**What ReplyIQ builds** (`lib/pipeline/followupSequence.ts`, run as the last stage of `npm run draft`, or on its own with `--sequence-only`):
1. **Facts:**
   - the Answer Card's verified proof
   - up to 6 facts a model picks from the company's documents and the original sequence's own copy (the team's approved pitch), each kept only if its excerpt is verbatim in its source
   - voice documents (Brand Voice, style guides, Compliance) guide tone but are never facts
2. **Step 2 text:** written by ReplyIQ from those facts only. Fact-check:
   - deterministic: every number must be in a fact; merge fields from a fixed list; no placeholders; length; the original campaign's hard rules turned into checks (banned word, no dashes)
   - model audit: lists any statement about the company that the facts don't support; it is told where the email sits in the sequence
   - one rewrite with the problems; if it still fails, step 2 is left out
3. **Step 1 instructions**, assembled by code in the same shape as graph8's own AI steps:
   - what the group said (verbatim) and the goal (the card's angle, else one per follow-up type)
   - the facts, the never-claim list and the original campaign's rules
   - the classifier's internal notes are stripped out
4. **`POST /sequences`:**
   - draft, on the draft's list, linked to the Studio campaign
   - owner = the original sequence's owner (or `G8_SEQUENCE_OWNER_EMAIL`)
   - **no sender attached, never run**
   - read back and compared; `--refresh-sequence` re-writes the steps in place with `PATCH`/`POST .../steps`, so there is never a second sequence
5. **Previews** (`--previews n`): graph8's `POST /sequencer/content/email/generate` drafts step 1 per contact with CRM fields only, as at send time. ReplyIQ fact-checks each, and numbers from the recipient's own details are allowed. graph8's `/estimate` prices each first (about 9 credits; 0 when cached).

**Live:**
- `[DEMO]` "Interested, no meeting" → sequence `82997ef4…` (list 4): step 2 passed first time, both graph8 previews passed.
- SMB "Out of office" → sequence `c5a08249…` (list 3, 9 contacts), no previews because these are real people:
  - 5 rules carried over from the team's own instructions (never "free", no dashes, no meeting asks…)
  - facts from the original sequence's copy; step 2 passed first time
  - both sequences were read back as matching, with no sender attached.
- **Audit tuning, from real output:**
  - graph8's AI wrote "what a 25-minute demo *typically* covers", and the audit rightly flagged the generalisation.
  - Step 2's "in case it got buried" was wrongly flagged until the auditor was told where the email sits in the sequence.
  - Wording about the meeting itself ("what I'd walk you through") is now treated as fine.

**Company-wide learnings** (`lib/pipeline/studioLearnings.ts`, `npm run learn`):
- **Propose** (read-only): turns the run's Answer Cards into two blocks.
  - Messaging House: "Heard in the field", with verbatim quotes, how to answer, verified proof and don't-claim.
  - Proof Catalog: "Proof we still need", listing the proof gaps.
  - The proposal is stored on the run for review.
- **Apply** (`--apply`, after approval): saves exactly the reviewed text.
  - It re-reads each document first and replaces only ReplyIQ's block, marked with start and end comments; there is one block per source campaign, so re-runs don't duplicate. Everyone else's text is untouched.
  - It reads the document back to verify and records graph8's new version number.
- **Applied live after approval** (`[DEMO]` run `t5ee87bjjv8y`) to the Messaging House and the Proof Catalog. Each block was read back and found exactly once.
- **Undo** (`npm run learn -- --remove`) takes ReplyIQ's block out and leaves the rest of the document as it is. `--apply` also keeps a local backup of each document as it was before ReplyIQ's first save (in the run file; `data/runs` is gitignored).
- **Version history finding:** a document's *first* save through the API became version 1 containing the new text, so the text from before it was not in graph8's history. `current_version` counts saves, but `version` stayed at 1.
  - To create a real restore point, the undo was tested live: remove, which restored the original as **version 2**, then re-apply, which gave **version 3**, identical to the first save.
  - So graph8's history now has the pre-ReplyIQ text, and the local backups match it.

## Integration status (27 Sep)
- **Backend ↔ graph8:** every stage is integrated and verified live by reading graph8 back. The chain is discovery, then fetch, classify, themes, tags, audience, Answer Cards, Studio draft, follow-up sequence (with previews) and company-wide learnings. Commands: `npm run e2e`, `npm run test:live`, `npm run spike`.
- **Backend ↔ UI: connected (M6, `feat/replyiq-ui`, PR #1).** `main` was merged into the UI branch, keeping `main`'s `lib/types.ts` / `lib/taxonomy.ts`. The demo engine is gone: every screen reads the real backend.
  - **API routes** (`app/api/*`) are thin wrappers over `lib/server/service.ts`, which takes its dependencies as arguments (tested offline in `tests/service.test.ts`):

    | Route | Does |
    |---|---|
    | `GET /api/status` | keys present, write policy, credit balance (never the key values) |
    | `GET /api/sources` | `discoverSources()`, cached 60 s (`?refresh=1` re-reads) |
    | `GET /api/runs`, `POST /api/runs {sequenceId \| campaignId, writeTags?}` | recent runs; start a run: saves the empty run, then `runPipeline` runs after the response (`next/server` `after`) |
    | `GET /api/runs/[id]` | the run without full conversations or document backups, plus the job working on it and `interrupted` |
    | `POST /api/runs/[id]/groups/[key]/draft {action: create \| patch \| previews}` | `draftCampaign` in the background (waits up to 150 s for Studio, then "patch" adds the card later) |
    | `POST /api/runs/[id]/learnings {action: propose \| apply \| remove}` | Studio learnings |
  - **One job per run** (`lib/server/jobs.ts`): pipeline, draft and learnings each rewrite the whole run file, so a second job on the same run gets 409. If the server restarts mid-job, the run view reports `interrupted` and the UI offers to run again or resume the draft (the draft reuses its list and campaign). The lock lives in the server process, so run **one** server process (`npm run dev` or `npm start`); several instances would need a shared lock.
  - **Actions only from the app itself:** every POST must be JSON and, when the browser sends an `Origin`, come from the same host (`lib/server/origin.ts`; the `Host` header, or `x-forwarded-host` only on Vercel, which overwrites it), so another website can't trigger runs or drafts through a browser that can reach the app.
  - **The UI polls** `GET /api/runs/[id]` every 1.5 s only while something is working (`lib/client/api.ts`), pauses while the tab is hidden and refreshes the moment it is shown again. Without keys, every screen shows how to connect instead of sample data.
  - **Runs belong to an org:** a run saved with a key for another graph8 org (after switching keys) is hidden from the lists and opens read-only; the server refuses to draft it or use it for Studio learnings (409 `other_org`), since its contacts and replies don't exist in the key's org.
  - **Windows fix:** saving a run renames a temp file over the run file; on Windows that fails with `EPERM` while another process reads it (the UI polling it, OneDrive, antivirus). `lib/store.ts` now retries the rename with backoff.
  - **Deploying:** runs are JSON files in `data/runs/`, which needs a persistent disk. On a serverless host, swap `createFileStore` for a hosted key-value store (the `RunStore` interface is the only thing to change).

**Tests (final run, 27 Sep):** 205 offline, 22/22 live, 26/26 spike checks, `npm run e2e -- --once` 31 passed and 0 failed (the 1 warning is the stale Demo Contact 05 tag). The 40 new offline tests cover: rules extraction, number, merge-field and placeholder checks, claim verification, instructions, retries, fail-closed audit, previews, reuse, in-place refresh, read-back, block upsert keeping others' edits, propose/apply/remove with backup, and the client calls. The live tests and the e2e run now also verify every recorded sequence, and every applied Studio block, against graph8.

## Full app, end to end through the UI (27 Sep, production build, write-allowlisted sandbox org)
`next build && next start`, driven in the browser like a user, then verified by reading graph8 back with `npm run e2e` (35 passed, 1 warning, 0 failed; the warning is the stale Demo Contact 05 tag).
- **Run** (`[DEMO]` OrbitDesk, 10 replies): all 7 steps done in 23 s with 7 LLM calls; 6 groups, 4 hard stops excluded, 2 Answer Cards with 5 proof quotes found word for word. The `[Full copy]` SMB run (19 replies) finished in 27 s.
- **Draft** (Pricing request, 2 fictional contacts): list, Studio campaign and a 2-step follow-up sequence with no sender, ready in about 2.5 min. Studio again left 7 of 9 documents empty (the known graph8 issue above); ReplyIQ filled the three it owns, and "Add the card to late docs" patched Reply Templates afterwards. Step-1 previews: 2 generated, one flagged by the fact-check ("custom quote" is not in the documents). Read back: not launched, the list equals the audience, no hard stop or suppressed contact, the section appears once.
- **Learnings:** propose, apply (v7), remove (v8), apply again (v9), each read back; the documents ended with ReplyIQ's block exactly once, as found.
- **Referral draft** on the SMB run: none of the 6 named people is in this org's CRM, so the draft stops at the audience step with each name explained. Nothing is created in graph8 and no credits are spent.
- **API edge cases:** unknown or malformed ids 404, invalid bodies 400, drafts the rules don't allow 409, a second job on the same run 409, non-JSON 415, another origin 403, wrong methods 405.
- **ReplyIQ never cites its own text:** once learnings were saved to Messaging House, Answer Cards and the follow-up email facts began citing ReplyIQ's own block there (4 pricing facts named Messaging House for text that is really in Pricing Matrix or Positioning Matrix). `withoutOwnSections` (`lib/text.ts`) now drops ReplyIQ's learnings blocks and campaign-doc sections wherever documents are proof: cards, email facts and their fact-check, and the e2e check. Card proof is also re-checked against its document when the emails are written, so drafts from older runs don't carry it over. The pricing draft was refreshed in place: its 5 facts are all in the company's own text of the documents they name.
- **Learnings takeover:** Studio holds one ReplyIQ block per campaign, so saving a newer run's block marks an older run's record "replaced" (with a link to the newer run); the older run can no longer take out or re-save what is now the newer run's text. The e2e check only verifies runs still marked applied.
- **A crashed run is marked failed:** if the pipeline itself throws (e.g. its run file can't be saved), the run is recorded as failed with the reason instead of staying "running".
- **Fixed from this pass:** runs from another org (above); the run's duration now ends when the pipeline ends, not at its last draft (`finishedAt`); the learnings preview shows Studio's real version (the list endpoint has no save counter); proposing over applied learnings is refused (the run's record would stop matching Studio); logs and notes name people and documents instead of thread ids and file types; no CLI flags in UI notes; the confirm dialog only promises an Answer Card when the group has one; clearer API errors (invalid JSON, "goes to a rep", "never re-contacted").

## End-to-end regression (27 Sep, `npm run e2e -- --draft auto`)
One command runs the whole chain against the real org and **verifies every result by reading graph8 back** (`scripts/e2e.ts`; report in `data/e2e/`, gitignored). Result: **37 passed, 1 warning, 0 failed** in 8 minutes.
- **Safety:** writes allowed only via the org allowlist; a client with an empty allowlist is refused before any request leaves (checked live).
- **Discovery:** 6 sequences, 4 with replies, found at runtime: SMB full campaign (19), `[DEMO]` OrbitDesk (10), `[Hackathon copy]` SMB (9), `[DEMO]` MapleMetrics (2).
- **Every source, twice:** each run finished with every critical step done. Invariants held on all 40 replies: one group each, verbatim quotes, themes covering each group exactly once, and every thread carrying its ReplyIQ tag when read back from graph8. The audience never includes a hard stop, and suppression was re-checked live for all 22 eligible contacts. The second run gave **100% identical labels** on every source, with no thread re-tagged.
- **Answer Cards** (`[DEMO]` OrbitDesk): 2 cards, 5 proof excerpts re-verified verbatim against freshly read documents, 2 proof gaps named, 0 unverified claims.
- **Draft:** fresh campaign `e09cbc54…` for "Interested, no meeting" (list 4, 2 contacts). Read back: the audience list is attached, the draft is not launched, no hard-stop or suppressed contact is in the list, and the Answer Card section appears exactly once. A second draft reused the same campaign and list. All 3 recorded drafts are still intact.
- **Credits:** about **212 per draft**, from graph8's own ledger (`GET /usage/transactions`). The same pattern followed each of the 3 drafts:
  - 7 Studio LLM calls at 20 credits each (140)
  - 4 image generations at 5 each (20)
  - 3 Studio Global LLM calls, arriving up to 14 minutes later (52)
- **Why Studio "fails" 7 of 9 documents** (the same on all 3 drafts): it's a graph8 bug in saving, not in generation.
  - The ledger shows graph8 **did generate and bill** each of the 7 documents (up to about 6k output tokens each). Every one was marked `failed` within 0.1 s of being charged, and its content was discarded.
  - `GET /campaigns/{id}/generation-progress` reports "Generation failed before starting - task may have crashed".
  - `GET /campaigns/{id}/status` crashes with a 500: `'CBCampaignMetadata' object has no attribute 'generation_duration_seconds'`. That looks like the same save step breaking.
  - Only the 2 template documents (sequence, step catalog) survive. They are generated without an LLM call and without that save step.
- **Findings:**
  - One `[DEMO]` thread (Demo Contact 05) keeps an older "Needs review" tag next to its current "Out of office". graph8's only removal endpoint returns 404 for seeded threads.
  - The `[Hackathon copy]` replies are anonymised placeholders ("Original private reply omitted"), so all 9 correctly land in Needs review. Seeding real reply text needs no code change.
  - Both sender mailboxes are `disconnected`. Studio also didn't generate the `emails` document, so a launch would still be blocked after connecting a mailbox.
  - **Spurious 401:** when 6 live test files started together, graph8 answered two reads with 401 "Invalid API key", though the same key worked right before and after. Two fixes:
    - `lib/g8.ts` now retries a read once after a 401; writes are never retried, and a key that is really invalid still fails.
    - Live test files run one at a time.
- **All layers after the fixes:**
  - lint, typecheck and build are clean
  - 169 offline tests pass (new: credit balance, 401 retry for reads including the POST email search, no retry for writes)
  - 21/21 live tests pass
  - 22/22 spike checks pass

## M5 results (26 Sep, verified live in graph8)
- **Draft a follow-up campaign for one group of a saved run** (`lib/pipeline/draftCampaign.ts`, `npm run draft`). It runs on demand only, because Studio's document generation spends credits. **Nothing is sent or launched.**
  1. **Audience:** the group's eligible contacts. For **referrals, the named people** are looked up in the CRM with a free search: exact full-name match at the same company, and ambiguous matches are skipped. The person who left is never targeted. Roles ("their team leaders") and bare emails are reported, not guessed.
  2. **Re-check right before adding anyone:** hard stops (a no in any thread) and suppression are verified again. It fails closed, and there's a minimum audience (`MIN_GROUP_SIZE`).
  3. **List:** `POST /lists` with an idempotency key, then add contacts. On a 409 conflict it retries with `skip_all`: warned contacts are left out, never forced in.
  4. **Campaign:** `POST /campaigns` with `auto_generate_documents`. Name, category and field lengths follow the API limits. The hook, concept, goal and persona come from `gpt-6-sol`, with a deterministic fallback. **The brief is assembled by code from grounded data**: verbatim quotes (deduped), verified proof with sources, the proof gap as a "do NOT claim" rule, themes, referral note, timing advice.
  5. **Documents:** it waits until Studio finishes each one. Observed statuses are `generating`, `completed` and `failed`, and both completed and failed count as finished. Then:
     - completed Messaging & Objections / Reply Templates get the Answer Card appended
     - documents **Studio failed to generate** get ReplyIQ's grounded section written into them, including a failed Campaign Brief
     - documents still generating are left alone and reported; `--patch-only` patches them later
     - sections carry a marker so re-runs never duplicate; `--refresh-docs` replaces only ReplyIQ's own section
  6. Every stage is saved on the run. Re-runs reuse the list and campaign (saved IDs plus idempotency keys); `--force` makes a new campaign.
- **graph8 finding:** for new campaigns in this org, **Studio's generator marks 7 of 9 documents `failed`**: brief, messaging & objections, targeting, email prompt, emails, reply templates, snippets. It still charges credits for them (8,997 available; the company profile is set). This is graph8-side; ReplyIQ fills the documents it owns so the drafts stay useful.
- **Live acceptance:**
  - `[DEMO]` pricing request: list 2 (the right 2 contacts) and campaign `affb690d…`. Messaging & Objections now holds the Answer Card with 4 verified proof points and the proof gap; Reply Templates and the brief are filled too. Read back from graph8.
  - SMB out of office: list 3 (9 contacts) and campaign `a1d334db…`, with timing advice listing every return date.
  - SMB referral: **stopped before any write.** None of the 6 named people are in the CRM (an enrichment lookup would cost credits and needs approval); the 2 replies that didn't name a person are reported.
- **Tests:**
  - 164 offline: happy path; failed, generating and completed documents; patch-only reuse; no duplicates; hard-stop and suppression re-check; minimum audience with no writes; refusals and unsafe writes; referral targeting; 409 `skip_all`; idempotency keys; section upsert and refresh; brief grounding; field fallback and limits
  - 21 live, including a read-only check of every recorded draft against graph8 (campaign exists, list attached with the audience, no hard-stop contact in the list, documents carry ReplyIQ's section)

## M4 results (26 Sep, verified live)
- **Answer Cards** (`lib/pipeline/cards.ts`, `gpt-6-sol`): one per objection or interest group (interested, pricing, price objection, not now, competitor, no need). Hard stops never get a card. Each card has:
  - summary and verbatim quotes
  - **proof we have** (each item names its source document)
  - **proof gap**
  - how to answer and email angle
  - a note for each theme
- **Retrieval, nothing hardcoded** (`lib/pipeline/retrieve.ts`): all Studio Global docs plus the campaign's own docs (Messaging & Objections, Reply Templates, …) are split at headings and paragraphs and ranked against the group's replies, reasons and themes with a small TF-IDF, within a 40k-character budget and at most 5 passages per doc. Proof-like and campaign docs get a mild boost, and the opening of the Proof Catalog is always included (it states what proof exists and what doesn't).
- **Grounding:**
  - every proof point must quote its document verbatim (at least 6 words); the code checks the excerpt against the **full document**, ignoring markdown formatting (`normLoose`)
  - wrong or unknown doc IDs and invented excerpts go to `unverifiedClaims` and into the proof gap
  - quotes must be verbatim from the group's replies, otherwise the classifier's verified quotes are used
  - a card with no verified proof must state a gap
  - a failed card is a warning; the run continues
- **Live results:**
  - `[DEMO]` pricing card: 4 verified proof points (Team Plan $99 unlimited users, 10k credits, $0.05 overage, free entry tier, custom enterprise). Gap: no credit-consumption breakdown or cost estimator.
  - Price objection (per-seat vs contract lock-in): 4 verified ("no seat fees, ever", month-to-month, free search in parallel with an existing contract). Gap: no case study quantifying cost for a 40-person team.
  - Competitor (ZoomInfo / Outreach / Apollo): 3 verified. Gap: no win/loss or displacement stories.
  - **0 claims dropped** as unverified in these runs, about 10k tokens per card.
- **The SMB campaign has no objection groups** (only referral, out of office, meeting booked, hard no, needs review), so its cards step is `skipped`. The richer replies the team will seed will produce cards with no code change.
- **Tests:**
  - 149 offline: retrieval ranking, budget and cap, passages verbatim; card grounding including markdown, invented excerpts, wrong or unknown docs, short or duplicate excerpts, forced gap, quote fallback, theme notes; only objection groups get cards; failures non-fatal; no documents
  - 20 live: price and competitor cards on real Studio docs, every excerpt re-verified independently, 3 out of 3

## M3 results (26 Sep, verified live and in graph8's UI)
- **Tagging** (`lib/pipeline/tagThreads.ts`): each reply gets its category tag in graph8 (`ReplyIQ · Referral`, …).
  - Only the categories present are created. Existing tags are reused by name; the create response has no ID, so the list is re-read.
  - Tagging is idempotent on graph8's side (verified), and threads that already carry the tag are skipped.
  - Tags are created with `ai_can_apply: false`, so graph8's auto-tagger never applies them.
  - Per-thread failures are recorded and never stop the others.
  - Writes check the write policy first.
  - The pipeline only tags when asked (`writeTags`). The CLI tags by default; `--no-tag` makes it read-only.
- **graph8 limitation found:** `/inbox/channels/*` (the only tag-removal endpoint) returns 404 for these threads; it can't see them. If a re-run moves a reply to another category, the old ReplyIQ tag is kept and reported (`staleKept`); removal is attempted in case it works on real threads. The probe tag was renamed into the real "ReplyIQ · Out of office" tag on the matching demo thread, so nothing was deleted.
- **Audience** (`lib/pipeline/resolveContacts.ts`) fails closed. Precedence:
  1. hard no / unsubscribe in this thread
  2. **hard stop elsewhere** (the same contact, by ID or email, said no in any thread of the run)
  3. not found
  4. **suppression unknown** (the check failed, so never contact)
  5. suppressed (on any channel)
  6. no follow-up category (meeting booked, meeting request, needs review)
  
  Everyone else is eligible, deduped per group. Suppression is checked once per contact.
- **Acceptance run on the graph8 Tech SMB Sales campaign:** 19 of 19 threads tagged (0 failed); created "Meeting booked" and "Referral". Audience: 16 eligible, excluded hard no 1 and no-follow-up 2.
- **Verified in graph8's own Inbox:** all 9 ReplyIQ tags appear in the tag filter, and filtering by "ReplyIQ · Referral" shows exactly the 7 SMB referral threads, each with the badge.
- **Inbox Analytics stays at 0 replies.** It doesn't count the seeded threads at all, tagged or not; its event rollup is unavailable (`rollup_available: false` in campaign metrics). **The demo beat uses the Inbox tag filter instead.**
- **Classifier definitions sharpened** after live flakes:
  - out of office = any away notice, return date optional (a bare "Out of office" was sometimes "other")
  - a dead-address notice listing only generic support or sales inboxes is "needs review", not a referral
  
  The SMB campaign is identical across 4 runs; the classifier live tests pass 4 out of 4.
- **Referral note for M5:** referral contacts are eligible, but the follow-up should go to the **named person** (`referredName`, looked up on approval), not to the person who left.
- **Tests:** 130 offline (tagging, resolve rules including hard-stop-everywhere and fail-closed suppression, pipeline with and without writes) and 19 live, including a **write test** on the synthetic `[DEMO]` sequence: tag it, read every thread back from graph8, then re-run to prove idempotency.

## Themes inside groups (26 Sep)
- **The 13 categories still decide every action.** A new **themes** step (`lib/pipeline/themes.ts`, `gpt-6-sol`) finds the finer patterns inside each group with 2 or more replies. The AI names them itself; nothing is hardcoded. Example: "per-seat cost too high" vs "locked into an annual contract" inside a price objection.
- **Grounded and non-critical:**
  - every reply of a group is in exactly one theme; anything the model skipped goes into "Other"
  - unknown or duplicate IDs are ignored, empty themes dropped, at most 5 themes (the smallest are merged)
  - each theme's quote must be verbatim in one of **its own** members; otherwise a member's text is used and marked `quoteVerified: false`
  - items use short aliases
  - a failed call leaves that group without themes and adds a warning; the run never fails because of themes
  - each reply gets a `themeId`; groups get `themes[]`; the run has a `themes` step
- **Live on the graph8 Tech SMB Sales campaign:**
  - Referral (7): named replacement 3, manager or team leader 2, email address only 1, already auto-forwarded 1
  - Out of office (9): gave a backup contact for urgent needs 4, still reachable 3, new-business contact 1, office back Monday 1
  
  The "backup contact" theme is directly actionable: those people can be reached now instead of after the return date.
- **Tests:** 109 offline (validation edge cases, pipeline with a failing or skipped themes step) and 18 live (a synthetic price-objection group must keep per-seat and contract lock-in replies in separate themes, with verbatim quotes, 3 out of 3 runs; plus theme rules checked on every real source).


- **The classifier sees the entire conversation.** Every message, oldest first, with quoted history stripped. There's no message-count or per-message limit. This fixed a real loss: the 9-message SPARXiQ thread used to drop our original pitch.
- **Threads over 12,000 characters go through a composer** (`lib/pipeline/compose.ts`):
  - An LLM pass reads the whole thread, in 60k-character chunks if huge, and writes a digest of every intent-relevant event. Each event carries a verbatim quote.
  - The code keeps only events whose quote is really in the thread (at least 3 words), and drops an unsupported "current state".
  - The classifier then gets our first message verbatim + the verified digest + the latest messages verbatim, within 12k characters.
  - If nothing verifies, it falls back to the first message + the newest messages, and adds a warning.
  - Each reply records `context: full | composed | truncated`.
- **Batches are packed by count (20) and total size (120k characters).**
- **Fix: labels crossed between threads.** With longer contexts the model once swapped labels between three similar threads. The quote check caught it (all three were flagged for review), and now:
  - items use short per-batch aliases (R1, R2…) instead of look-alike UUIDs, with the company named and the latest reply first
  - a label whose quote belongs to another reply in the batch is treated as a swap, and those replies are re-classified one at a time
- **Fix: unstable borderline labels.** Tightened definitions:
  - referral = points to *anyone* (a name, a role like "their team leaders", or an address)
  - out of office = the person or the *office* is away
  - needs review = points to no one
  
  The SMB campaign is now identical across 3 runs (0 of 19 differ): meeting booked 1, referral 7, out of office 9, hard no 1, needs review 1.
- **Tests:** 95 offline and 17 live, including:
  - a live composer test with deciding events buried mid-thread (a booked meeting; an unsubscribe with the latest reply just "Ok, thanks.")
  - a live consistency test (two runs must agree on at least 90%, and hard stops can never flip)


- **What it does:** load the source (discovered at runtime) → fetch its replies → classify each into one of 13 categories → group them. It writes nothing to graph8.
- **Classifier** (`lib/pipeline/classify.ts`, `gpt-6-luna` via `lib/llm.ts`):
  - It reads the whole conversation plus graph8's summary, not just the last message.
  - It extracts `referredName` (the person to contact instead) and `revisitHint` (a return date).
  - Built so it can't silently break:
    - strict JSON schema, re-validated with zod
    - exactly one label per reply (missing ones are retried alone, then fall back to "needs review")
    - unknown or duplicate IDs are ignored
    - quotes must be verbatim (ignoring case, quote marks, dashes, broken `U+FFFD` characters), otherwise the confidence is capped at 0.5 and the reply is flagged for review
    - placeholder or empty replies never reach the model
    - phone numbers are stripped before sending
    - a model failure fails the step instead of leaving partial labels
- **Run state** (`lib/store.ts`): one JSON file per run in `data/runs/` (gitignored). Writes are atomic, the IDs are validated so no path can escape the folder, and corrupt files are skipped. The runner (`lib/pipeline/runPipeline.ts`) saves after every step and never throws; failures are recorded on the step.
- **Live result on the graph8 Tech SMB Sales campaign** (19 replies, 1 LLM call, about 8k in / 2.4k out tokens, 0 need review):

  | Group | Count | Notes |
  |---|---|---|
  | Meeting booked | 1 | caught from the thread even though the last message is a time correction |
  | Referral | 6 | named people extracted (Kurt Huegin, Jeff Evans, Rob Moore, Claudia Boehringer, Steve Pinchotti…) |
  | Out of office | 8–9 | return dates extracted |
  | Hard no | 1 | |
  | Needs review | 2 | dead address, generic auto-reply |

  The `[DEMO]` sequence gives: meeting request 1, interested 2, pricing 2, OOO 1, hard no 2, unsubscribe 2.
- **Tests:**
  - **77 offline:** taxonomy rules, every classifier edge case, the store, and pipeline integration with a fake org and fake LLM (success, graph8 failure, LLM failure, empty source, zero replies, `--limit`, warnings, and the step progression a polling UI sees).
  - **15 live:** 10 hand-written hard cases (booked-meeting thread, referral with name, OOO with date, unsubscribe, competitor, price objection, timing, pricing, hard no, bounce), the 6 demo reply types, and end to end on every discovered source, checking general rules plus "no writes". Stable across 3 consecutive runs (45/45).

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
- **Sources are discovered, never hardcoded** (`lib/pipeline/sources.ts`):
  - `discoverSources()` makes one inbox pass per mailbox and counts replies for every sequence, linking each to its Studio campaign.
  - `resolveSource({campaignId} | {sequenceId})` returns the campaign, its sequences, audience list, sender mailboxes and campaign docs (matched by `file_type`, then by name).
  - `pickDefaultSource()` chooses the source with the most replies.
  - The spike takes `--campaign <id>` or `--sequence <id>`.
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

**Expected groups on the demo campaign** (graph8 Tech SMB Sales, picked at runtime; 19 replies today; see REPLYIQ-PLAN §0b):
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
