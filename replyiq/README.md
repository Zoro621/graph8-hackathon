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
The hackathon key acts on the **sandbox organisation `org_87325c23062e`**, which the team confirmed on 26 Sep. Its `/sandbox/status` returns 404 (that endpoint exists only on graph8's separate sandbox environment), so the org is allowlisted in `lib/config.ts`. Every write (tags, lists, campaigns) checks, before sending, that:
1. `/sandbox/status` reports `sandbox: true`, or
2. the key's org (from `/roles/me/permissions`) is in the allowlist (`lib/config.ts` plus optional `G8_WRITE_ORG_ID`).

Any other org is refused and nothing is sent. `npm run spike` prints the current policy.

## Where the real data is
**Reference campaign:** the graph8 team's Tech SMB Sales campaign. The IDs are in `lib/config.ts` (`REFERENCE`): Studio campaign `6a5f3380…` → sequence `e470a095…` → list `1900262001` (7,531) → mailbox `campaign-saad@example.com`.

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
- Launching is behind `ENABLE_LAUNCH` and needs human approval.
- All data is graph8 sandbox `[DEMO]` / `[SYNTHETIC]` data.
