# ReplyIQ (app)

This is a Next.js 16 and TypeScript app built on graph8's API and sandbox, with **Gemini** as the AI model.

- The build guide is [../IMPLEMENTATION.md](../IMPLEMENTATION.md).
- The product plan is [../REPLYIQ-PLAN.md](../REPLYIQ-PLAN.md).

## Setup
```bash
npm install
```
Create `.env.local` in this folder. It is gitignored, so never commit it:
```
G8_API_BASE=https://be.graph8.com/api/v1
G8_API_KEY=                          # graph8 SANDBOX PERSONAL key (Profile -> Developer)
GEMINI_API_KEY=                      # Google AI Studio key
GEMINI_CLASSIFY_MODEL=gemini-3.5-flash-lite
GEMINI_REASON_MODEL=gemini-3.8-flash
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
| `npm run spike` | Read-only graph8 sandbox checks | M1 (not written yet) |
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

## Safety
- Keys stay in server code only.
- Every graph8 write checks `GET /sandbox/status` first.
- Launching is behind `ENABLE_LAUNCH` and needs human approval.
- All data is graph8 sandbox `[DEMO]` / `[SYNTHETIC]` data.
