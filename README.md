# ReplyIQ: reply intelligence for graph8

Built at the graph8 Hackathon in Lahore, 26–27 Sep 2026.

> ReplyIQ is a reply-intelligence layer for graph8. It analyses campaign replies to find why prospects didn't convert, turns each reason into a tailored follow-up campaign for approval, and flags proof gaps: objections the company can't yet answer. For each gap, it shows an Answer Card that explains what's missing and how to respond.

## Status
**M0 (scaffold) is done.** The app is in [`replyiq/`](replyiq/): Next.js 16 and TypeScript on graph8's API and sandbox, with **OpenAI** as the AI model. See [replyiq/README.md](replyiq/README.md) for setup.

## Documents
| File | What it is |
|---|---|
| [REPLYIQ-PLAN.md](REPLYIQ-PLAN.md) | Product plan: verified graph8 API surface, live sandbox findings, pipeline, weekend roadmap, demo, risks |
| [IMPLEMENTATION.md](IMPLEMENTATION.md) | Build guide: setup, folder structure, types, graph8 client, taxonomy, OpenAI prompts, grounding check, milestones M0–M7, tests |
| [PITCH.md](PITCH.md) | Pitch for the judges: revenue levers, gaps, 5-minute demo, Q&A |
| [FLYWHEEL-RESEARCH.md](FLYWHEEL-RESEARCH.md) | Does this already exist in graph8? Gaps and feasibility |
| [GRAPH8-PLATFORM-GUIDE.md](GRAPH8-PLATFORM-GUIDE.md) | Synthesis of all 307 graph8 docs pages |
| [PLAN.md](PLAN.md), [IDEAS.md](IDEAS.md) | Earlier idea (Source Scout) and the idea shortlist |
| [research/graph8-notes/](research/graph8-notes/) | Per-module notes from the graph8 docs, including the MCP tool catalog |

## Data and safety
- All data is graph8 sandbox data marked `[DEMO]` / `[SYNTHETIC]`.
- No real emails are sent.
- Launching a campaign is behind a feature flag and needs a human to approve it.
