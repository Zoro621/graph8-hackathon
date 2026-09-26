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
G8_WRITE_ORG_ID=                     # leave EMPTY until graph8 confirms writes are OK on this org (see below)
OPENAI_API_KEY=                      # OpenAI platform key
OPENAI_CLASSIFY_MODEL=gpt-6-luna
OPENAI_REASON_MODEL=gpt-6-sol
ENABLE_LAUNCH=false                  # stays off until a sandbox mailbox exists
MIN_GROUP_SIZE=2
```
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
| `npm test` | Unit tests (vitest) | M0 |
| `npm run typecheck` | TypeScript check | M0 |
| `npm run spike` | 20 read-only graph8 checks; saves samples (see below) | M1 |
| `npm run run:cli -- <sequenceId>` | Run the pipeline from the terminal | M2 (not written yet) |

## Layout
```
lib/env.ts          validated env (server-only)
lib/pipeline/       pipeline steps (M2 onwards)
components/         UI components (M6)
scripts/            check-env, spike, run
tests/              vitest tests and fixtures
data/runs/          run state as JSON (gitignored)
```

## Test data
- `tests/fixtures/demo/`: **committed**. The 12 synthetic `[DEMO]` threads from graph8, scrubbed. Person 2 can build classification and screens against `replies.json` without any keys.
- `tests/fixtures/live/`: **gitignored**. Everything `npm run spike` read, including anonymised real replies that still contain phone numbers. Never commit it.

## Writes to graph8 (fail closed)
`/sandbox/status` returns 404 for this key ("available only in the developer sandbox environment"). The key runs on production against the seeded hackathon org `org_87325c23062e`. So every write (tags, lists, campaigns) is **refused** unless:
1. `/sandbox/status` reports `sandbox: true`, or
2. `G8_WRITE_ORG_ID` in `.env.local` equals the key's org (read from `/roles/me/permissions`).

Only set option 2 after a graph8 engineer confirms writes are fine on this org. `npm run spike` prints the current policy.

## Safety
- Keys stay in server code only.
- Every graph8 write checks `GET /sandbox/status` first.
- Launching is behind `ENABLE_LAUNCH` and needs human approval.
- All data is graph8 sandbox `[DEMO]` / `[SYNTHETIC]` data.
