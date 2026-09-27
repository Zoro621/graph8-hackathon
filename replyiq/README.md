# ReplyIQ (app)

This is a Next.js 16 and TypeScript app built on graph8's API and sandbox, with **OpenAI** as the AI model.

- The build guide is [../IMPLEMENTATION.md](../IMPLEMENTATION.md).
- The product plan is [../REPLYIQ-PLAN.md](../REPLYIQ-PLAN.md).

## Setup
```bash
npm install
```
Create `.env.local` in this folder. It is gitignored, so never commit it:
```
G8_API_BASE=https://be.graph8.com/api/v1
G8_API_KEY=                          # graph8 personal key (Profile -> Developer)
G8_WRITE_ORG_ID=                     # optional: allow writes on one more org (the sandbox org is already allowed)
OPENAI_API_KEY=                      # OpenAI platform key
OPENAI_CLASSIFY_MODEL=gpt-6-luna
OPENAI_REASON_MODEL=gpt-6-luna
ENABLE_LAUNCH=false                  # stays off until a sandbox mailbox exists
MIN_GROUP_SIZE=2
G8_SEQUENCE_OWNER_EMAIL=              # optional: owner of follow-up sequences (default: the original sequence's owner)
# Serverless hosts only (Vercel): runs and the job lock live in Upstash Redis. Locally, leave these out.
KV_REST_API_URL=                     # set by Vercel's Upstash integration (prefix KV)
KV_REST_API_TOKEN=
```
On Vercel, set the project's Root Directory to `replyiq`, connect Upstash Redis from the Storage tab, and add the keys above as environment variables. The repo's [README](../README.md) has the full steps.
Then:
```bash
npm run check-env
```
```bash
npm run dev
```

## Scripts
| Command | What it does | Milestone |
|---|---|---|
| `npm run dev` | Start the app at http://localhost:3000 | M0 |
| `npm run check-env` | Show which keys are set and validate the env | M0 |
| `npm test` | Offline unit + integration tests (fake graph8 + fake LLM), no keys needed | M0+ |
| `npm run e2e -- [--draft auto\|<group>] [--source <sequenceId>] [--once]` | **End-to-end regression against the real org:** discovers every source with replies, runs the full pipeline twice on each (fresh, then again to prove labels are stable and tags idempotent) and verifies every result by reading graph8 back: tags on the threads, audience safety, live suppression, Answer Card excerpts against fresh documents. `--draft` also drafts one campaign, verifies it in Studio and re-drafts it to prove nothing is duplicated (spends Studio credits). Writes a report to `data/e2e/` (gitignored). Nothing is sent. | M7 |
| `npm run draft -- [--run <id>] [--group <key>] [--patch-only] [--refresh-docs] [--force]` | Draft a follow-up campaign in graph8 Studio for one group (list + campaign + Answer Card in its docs) **and its follow-up emails as a Sequencer draft** (see below). No `--group` lists the draftable groups. Nothing is sent. | M5 |
| `npm run draft -- --group <key> --sequence-only [--refresh-sequence] [--previews <n>]` | Only the follow-up sequence of an existing draft. `--refresh-sequence` re-writes its steps in place (no second sequence). `--previews n`: graph8's AI drafts step 1 for n contacts now (about 9 credits each; nothing saved or sent) and ReplyIQ fact-checks each. | M5b |
| `npm run learn -- [--run <id>] [--apply \| --remove]` | Company-wide Studio learnings from the run's Answer Cards. Without a flag it only **shows** what it would add to the Messaging House and Proof Catalog (read-only). `--apply` saves exactly that text, touching only ReplyIQ's own marked block, and keeps a local backup of each document first. `--remove` takes the block out again. | M5b |
| `npm run test:live` | Live integration tests with real graph8 + OpenAI. Read-only, except `tag.live` which tags the synthetic `[DEMO]` sequence in the sandbox org | M2–M3 |
| `npm run typecheck` | TypeScript check | M0 |
| `npm run spike` | 22 read-only graph8 checks; saves samples (see below) | M1 |
| `npm run run:cli -- [--campaign <id> \| --sequence <id>] [--limit n] [--no-tag]` | Run the pipeline: load → fetch → classify → themes → **tag in graph8** → resolve the audience → **Answer Cards**. Prints the groups and saves `data/runs/<id>.json`. No selector = the source with the most replies. `--no-tag` = read-only. | M2–M3 |

## Follow-up emails (M5b)
graph8 Studio's campaign generator marks 7 of 9 documents `failed` in this org, including the **Emails** document, and discards the text it already billed for (evidence in `../IMPLEMENTATION.md`). So ReplyIQ writes the follow-up emails through graph8's **Sequencer**, the way the graph8 team's own SMB sequence is built (`lib/pipeline/followupSequence.ts`):
- **Step 1, written on demand:** graph8's AI writes each person's email when it sends. It works from ReplyIQ's instructions: what the group said (verbatim), the goal, verified facts, a never-claim list, and the original campaign's own rules (for example a banned word, no dashes).
- **Step 2, fixed text:** ReplyIQ's short follow-up, 4 days later, written only from the verified facts.
- **Facts:** the Answer Card's proof plus a few picked from the company's documents and the original sequence's own copy. Each is kept only if its excerpt is verbatim in its source.
- **Fact-check** on step 2 and on every preview of step 1:
  - every number must appear in a verified fact
  - merge fields come from a fixed list; no placeholders
  - the original campaign's hard rules
  - a second model lists any statement about the company that the facts don't support
  - A step 2 that fails twice is left out; a sequence is never created with unchecked text.
- **Draft only:** the sequence is created on the draft's list, linked to the Studio campaign, with **no sender attached**. ReplyIQ never runs it. graph8's docs warn that launch sends real email.

## The app (M6)
`npm run dev`, then open http://localhost:3000. Every screen shows live data from the graph8 org behind `G8_API_KEY`. Without keys it shows how to connect; there is no sample data.
1. **Home:** the sequences discovered in the org, with reply counts, and recent runs. The 3D core shows real replies from the latest finished run.
2. **Run:** the pipeline runs in the background (tags are written to the graph8 Inbox); the page follows each step, the replies settling into their groups, themes, exclusions and Answer Cards.
3. **Follow-up:** after a press-and-hold approval, drafts the group's follow-up in graph8 (list, Studio campaign, fact-checked Sequencer draft). Launching stays with a person in graph8.
4. **Teach Studio:** proposes the run's learnings for the Messaging House and Proof Catalog; saves them only after approval, with undo.

The API routes (`app/api/*`) are listed in `../IMPLEMENTATION.md` (Integration status).

## Layout
```
lib/env.ts          validated env (server-only)
lib/pipeline/       pipeline steps (M2 onwards)
lib/server/         API service layer + job lock (routes in app/api/)
lib/client/         browser data layer (fetch cache, polling)
lib/ui/             category colours, step names, agent log
components/         UI components (M6)
scripts/            check-env, spike, run, draft, learn, e2e
tests/              vitest tests and fixtures
data/runs/          run state as JSON (gitignored)
```

## Test data
- `tests/fixtures/demo/`: **committed**. The 12 synthetic `[DEMO]` threads from graph8, scrubbed. Person 2 can build classification and screens against `replies.json` without any keys.
- `tests/fixtures/live/`: **gitignored**. Everything `npm run spike` read, including anonymised real replies that still contain phone numbers. Never commit it.

## Writes to graph8 (fail closed)
The hackathon key acts on the **sandbox organisation `org_87325c23062e`**, which the team confirmed on 26 Sep. Its `/sandbox/status` returns 404 (that endpoint exists only on graph8's separate sandbox environment), so the org is allowlisted in `lib/config.ts`. Every write (tags, lists, campaigns) checks, before sending, that:
1. `/sandbox/status` reports `sandbox: true`, or
2. the key's org (from `/roles/me/permissions`) is in the allowlist (`lib/config.ts` plus optional `G8_WRITE_ORG_ID`).

Any other org is refused and nothing is sent. `npm run spike` prints the current policy.

## Where the real data is
**Nothing is hardcoded.** `lib/pipeline/sources.ts` discovers every sequence, its reply count and its Studio campaign at runtime, and resolves your choice into campaign → sequences → audience list → mailboxes → campaign docs. The default is the source with the most replies. Pick one explicitly with `npm run spike -- --campaign <id>` or `--sequence <id>`.

What discovery finds today (26 Sep); the demo uses the first row:

| Sequence | Inbox | Replies | What they are |
|---|---|---|---|
| `[Full copy] Kill Your Tool Stack — Tech SMB Sales v2` (`e470a095…`) | `campaign-saad@example.com`, workspace "Graph8 Tech SMB Sales — full campaign" | 19 | **The graph8 team's real SMB campaign** (7,111 contacts, 2,136 sent). Out of office, "left the company, contact X", not interested, bounces, and one full conversation ending in a booked meeting. |
| `[DEMO] Product introduction history` (`90bda420…`) | `hackathon-saad@example.com` | 10 | Synthetic: pricing, remove me, demo, follow-up, OOO, not interested |
| `[DEMO] Follow-up outcome history` (`96118ffd…`) | same | 2 | Synthetic |
| `[Hackathon copy] … v2` (`90145145…`) | same | 9 | Placeholders ("original reply omitted") |

No graph8 Workflows exist in the org yet (`GET /workflows` returns 0). SMS: 0 threads. LinkedIn: HeyReach not configured.

## Safety
- Keys stay in server code only.
- Every graph8 write checks `GET /sandbox/status` first.
- Launching is behind `ENABLE_LAUNCH` and needs human approval. Follow-up sequences are created with no sender attached and are never run by ReplyIQ.
- Company-wide Studio documents change only after `npm run learn -- --apply`, and only inside ReplyIQ's own marked block.
- All data is graph8 sandbox `[DEMO]` / `[SYNTHETIC]` data.
