# ReplyIQ: no reply is wasted

**Reply intelligence for graph8.** ReplyIQ reads every reply to a finished graph8 sequence, works out *why* each prospect didn't convert, and turns every reason into a fact-checked follow-up campaign drafted inside graph8, ready for a person to approve. It also learns from graph8's dialer, sequencer and meetings, and tells marketing which proof the company still doesn't have.

- **Live app:** https://replyiq-sigma.vercel.app
- **Built at:** the graph8 Hackathon, Lahore, 26–27 September 2026
- **Built on:** graph8's public API (inbox, contacts, dialer, Studio, Sequencer, lists), OpenAI for analysis and fact-checking, Next.js on Vercel

> Nothing is ever sent. ReplyIQ only creates **drafts** in graph8, with no sender attached. A person on the graph8 team reviews and launches them.

---

## Contents
1. [Why it's needed](#why-its-needed)
2. [The gaps in graph8 it closes](#the-gaps-in-graph8-it-closes)
3. [What ReplyIQ does](#what-replyiq-does)
4. [How it benefits graph8 and its customers](#how-it-benefits-graph8-and-its-customers)
5. [How to use it](#how-to-use-it)
6. [Where the results show up in graph8](#where-the-results-show-up-in-graph8)
7. [Safety and guardrails](#safety-and-guardrails)
8. [How it works](#how-it-works)
9. [Run it yourself](#run-it-yourself)
10. [Tests and verification](#tests-and-verification)
11. [About the data](#about-the-data)
12. [Repository map](#repository-map)

---

## Why it's needed

Meet Sara, a sales rep who uses graph8. Her campaign *Kill Your Tool Stack* reaches about **2,150 people**. About **20 reply**. **Zero book a meeting.** Those numbers come straight from graph8's own report for the sequence in the sandbox org.

But look at what the replies actually say:

- *"I have NO access to email or voicemail until I return Monday July 6."*
- *"Please reach out to Kurt Huegin with any questions."*
- *"It was 1 pm EDT."* (a meeting that was booked, which graph8's own counter shows as zero)

These aren't dead leads. Each reply tells Sara exactly what to do next: follow up after July 6, write to Kurt, hand the meeting to a rep. Today she has to read them one by one. A few get answered, the rest get lost, and her next campaign starts from zero and makes the same mistakes.

**Replies are the only moment in a campaign where prospects tell you why.** ReplyIQ makes sure that information turns into the next campaign.

## The gaps in graph8 it closes

| # | graph8 today | ReplyIQ |
|---|---|---|
| 1 | A reply gets one of a handful of labels (Interested, Not Interested, Out of Office, Referred Colleague…), with no quote, no finer reason and no next step. | Every reply gets one of **13 reasons** with a verbatim quote, a confidence score and themes inside the group. The reasons are written back to graph8's inbox as tags. |
| 2 | There's no path from a group of replies to a new campaign. graph8's AI drafts one reply per thread. | Every reason becomes its own **follow-up campaign drafted in graph8**: audience list, Studio campaign, two-step Sequencer draft, channel plan. |
| 3 | Email, calls, meetings and bookings live in separate places. In the sandbox, a contact who said "not interested" on a call is **not** on graph8's suppression list, so nothing stops the next email. | ReplyIQ joins the channels. A "not interested" or "do not call" on a call keeps that person out of every follow-up, and call and meeting outcomes feed the strategy. |
| 4 | Generated copy isn't checked against the company's own documents. In testing, graph8's AI promised a pricing prospect "a custom quote" that no document supports. | Every product claim must be found **word for word** in a company document. Anything else is rewritten or flagged. ReplyIQ ignores its own text, so it never cites itself. |
| 5 | Objections the company can't answer stay invisible to marketing. | Each **Answer Card** names the missing proof, and it can be added to the company-wide Proof Catalog in Studio. |
| 6 | "Learn and Improve" is part of graph8's promise, but the playbook flywheel isn't built yet. | A **V1 → V2** view of the original sequence next to the follow-up, and approved learnings written into Studio's Messaging House so the next campaign starts smarter. |

## What ReplyIQ does

### 1. Analysis (about 25 seconds, under one cent of OpenAI)
Pick a finished sequence and seven agents run in order:

| Agent | What it does |
|---|---|
| **Scout** | Loads the campaign, its sequences and its Studio documents |
| **Collector** | Fetches every thread with a prospect reply |
| **Analyst** | Gives each reply one of 13 reasons, a confidence score and a verbatim quote |
| **Weaver** | Finds themes inside each reason (for example referrals that name a person vs. a team) |
| **Scribe** | Writes "ReplyIQ · *reason*" tags back to the graph8 inbox |
| **Warden** | Reads the other channels and decides who may be contacted. Hard no, unsubscribe, suppressed contacts and a no on a call are excluded for good |
| **Strategist** | Writes an Answer Card for each objection group |

**The 13 reasons:** meeting booked, meeting request, interested (no meeting), pricing request, price objection, not now, competitor, referral, no need, out of office, hard no, unsubscribe, needs review. Nine of them can get a follow-up. A flat "no" or "remove me" never does, and meeting requests go to a rep instead of a campaign.

### 2. Every Engage channel, not just the inbox
During the analysis ReplyIQ also reads, without changing anything:

- **Sequencer:** the original sequence's funnel (reached, replied, bounced, meetings).
- **Dialer:** each replying contact's latest call outcome.
- **Meetings:** objections from graph8's meeting analysis.
- **Appointments:** bookings from the sequence, and no-shows.

Newsletters and nurtures are only counted: they reach opted-in audiences, so ReplyIQ never drafts cold follow-ups into them.

### 3. Answer Cards
One per objection or interest group (pricing, price, not now, competitor, no need, interested):

- **What they said:** verbatim quotes.
- **Proof we have:** excerpts quoted word for word from the company's Studio documents, each naming its source. Checked in code, not by another prompt.
- **Proof gap:** what the company can't prove yet, which the follow-up is told never to claim.
- **How to answer:** plus a tailored answer for each theme.

Reps get a ready answer, marketing gets a to-do list, and the follow-up campaign is built from it.

### 4. Follow-up drafted in graph8 (after a press-and-hold approval)
1. **Re-check the audience** right before adding anyone: hard stops, a no on a call, graph8's suppression list.
2. **Create the audience list** of the people who gave that reason.
3. **Create a Studio campaign** whose brief carries the evidence and the revised strategy.
4. **Add the Answer Card** to the campaign's Messaging & Objections and Reply Templates documents.
5. **Write the follow-up as a Sequencer draft:**
   - **Step 1 (day 0):** graph8's AI writes each person's email at send time, allowed only the verified facts.
   - **Step 2 (day 4):** ReplyIQ's own fact-checked email.
6. **Write a channel plan:** why the original didn't convert this group, the new angle, who to focus on, a day-by-day plan across email and calls, and a fact-checked call script and voicemail.

A draft takes about 2½ minutes, mostly waiting for Studio, and about 210 graph8 credits of Studio generation.

### 5. More on each draft
- **Referral lookup:** referral follow-ups go to the colleague the reply named ("talk to Kurt"). ReplyIQ first searches graph8's CRM for free. For people who aren't there, a hold-to-confirm button asks graph8 to look them up by name and company (about 2–4 credits each) and adds whoever it finds to the CRM.
- **Rewrite the follow-up emails:** rewrites the same Sequencer draft in place, fact-checked again, and rebuilds the channel plan. No Studio credits.
- **Take over an earlier draft:** when you re-analyse a sequence, a group that was already drafted by an earlier run is offered "update the existing draft". That reuses the same list, campaign and sequence with the new evidence, instead of paying for a second campaign. The earlier copy becomes read-only.
- **V1 → V2:** the original sequence, read live from graph8, next to the follow-up, with what changed.
- **Preview step 1:** graph8's AI writes a sample of step 1 for two contacts (about 18 credits). ReplyIQ fact-checks each preview; nothing is saved or sent.

### 6. Teach Studio (company-wide learnings)
With one approval, ReplyIQ adds a "Heard in the field" block to Studio's **Messaging House** and a "Proof we still need" block to the **Proof Catalog**. It only ever edits its own marked block, reads the result back to verify it, and can take it out again with one click.

## How it benefits graph8 and its customers

graph8 charges for **execution (credits)**, not seats. So anything that makes customers run more successful campaigns grows revenue in several ways at once.

**For graph8**
- **Retention and expansion.** Customers leave outbound tools when reply rates sink and meetings dry up. ReplyIQ gets more meetings out of lists customers already bought and replies they already earned. Better ROI keeps them on the platform and moves Team-plan customers ($99/month) up to bigger plans.
- **More billed execution per customer.** Every reason ReplyIQ finds becomes a campaign: about 210 credits of Studio generation per draft (measured from graph8's own ledger), then a send per step per contact, then credits for each meeting booked, plus paid lookups for referrals. The customer wins more meetings; graph8 bills more work.
- **A claim competitors can't make.** Apollo, Outreach and Clay report on replies. None turns replies into the next campaign, grounded in the company's own proof, with an approval step. It makes graph8's "Learn, Improve" message something you can demo in two minutes.
- **Agencies scale.** Growth managers who optimise client campaigns by hand can run many more client orgs, and every one of them runs more execution on graph8.

**For graph8's users**
- **More meetings from the same list.** The "not now", "send pricing" and "talk to Kurt" replies become campaigns that answer exactly that.
- **Safe by design.** People who said no, asked to be removed, are suppressed, or said no on a call are never contacted again. Nothing is sent without a person.
- **Copy you can trust.** Every claim traces back to a company document.
- **Hours back.** The analysis a growth manager does by hand takes about 25 seconds.
- **A to-do list for marketing.** Proof gaps show which case study or pricing page is costing deals.

**What it could be worth (illustrative).** 200 active customers finishing 4 campaigns a month, with 3 follow-ups each, is about 2,400 drafts × 210 credits ≈ 504,000 credits a month. At graph8's $0.05 per extra credit that's about $25,000 a month in Studio generation alone, before sends and meetings. Only the 210 credits per draft and the $0.05 rate are real figures; the customer and campaign counts are assumptions to show the shape of the revenue.

## How to use it

On the live app, https://replyiq-sigma.vercel.app (or http://localhost:3000 locally):

1. **Check the connection.** The pill in the top right should be green: "graph8 · connected" with the credit balance. "Read-only" means the key's org isn't allowed to write.
2. **Pick a sequence.** Scroll to "Step 1 · Pick a finished sequence". Only sequences with replies are listed, found live from graph8. Click **Analyse replies**.
3. **Watch the run.** The seven agents work in order (about 25 seconds). Hover the orbs to read individual replies; the Agent Log narrates each step with real counts.
4. **Read the results.**
   - **"Across graph8"** shows what the other channels contributed.
   - **"Step 2"** shows one card per reason: counts, a quote, themes, eligible and excluded contacts.
   - Click **Answer Card** on an objection group to see the proof and the proof gap.
5. **Draft a follow-up.** Click **Draft** on a group (or **Review …**), check the tabs (Answer Card, Follow-up emails, Channel plan, V1 → V2, Audience), then click **Draft follow-up in graph8** and **hold** the confirm button for about 1.5 seconds. Wait about 2½ minutes for "ready".
6. **Check it in graph8.** Click **Open the campaign in Studio**, and look for the draft sequence in the Sequencer (see below). Optionally rewrite the emails or preview step 1.
7. **Teach Studio (optional).** On the run page, **Preview the additions** (read-only), then hold **Save to Studio**. **Take it out again** undoes it.
8. **Launch stays with a person.** A graph8 team member attaches a sender to the sequence and launches it in graph8. ReplyIQ never does.

**Good to know**
- Answer Cards only appear for objection or interest groups. Out-of-office and referral groups still get a full follow-up, just without a card.
- Groups need at least 2 eligible contacts to draft (referrals need 1 named person found in the CRM).
- The home page's orbs always show the newest finished run's real replies. With no runs yet, they show the 13 reasons ReplyIQ listens for.

## Where the results show up in graph8

Everything ReplyIQ creates starts with **"ReplyIQ ·"**.

| What | Where in graph8 |
|---|---|
| Reply reasons | **Engage → Inbox**: threads tagged "ReplyIQ · Pricing request" etc. Filter by the tag; it also feeds Inbox Analytics. |
| Audience lists | **Lists**: "ReplyIQ · *reason* · *campaign*" |
| Follow-up campaigns | **Studio → Campaigns**: "ReplyIQ · *reason* follow-up · *campaign*", with the Answer Card in its documents and the strategy in its brief |
| Follow-up emails | **Engage → Sequencer**: a draft sequence with the same name, linked to the list and campaign, no sender |
| Referral contacts found by lookup | **Contacts** (CRM) |
| Company learnings | **Studio → Global**: blocks in Messaging House and Proof Catalog |

The analysis itself (groups, Answer Cards, channel plan, V1 → V2) lives in ReplyIQ. Dialer, meetings, appointments and sequence reports are only read.

## Safety and guardrails

- **Drafts only.** No sender is ever attached, and ReplyIQ never launches anything. Launching is behind `ENABLE_LAUNCH` (off) and a person.
- **Writes fail closed.** Every write to graph8 first checks that the key's org is the sandbox or allowlisted; any other org is refused before a request leaves.
- **Never re-contacted:** hard no, unsubscribe, graph8's suppression list, and "not interested" or "do not call" on a call. The audience is re-checked live right before anyone is added.
- **No invented claims.**
  - Proof excerpts and email facts must be found word for word in their documents.
  - Numbers in the strategy must come from graph8's own data.
  - Emails and call scripts pass a deterministic check plus a model audit.
- **Paid actions need a hold-to-confirm:** drafting (Studio credits), referral lookups and previews all show their approximate credit cost first.
- **Company documents** change only inside ReplyIQ's own marked block, after approval, with undo.
- **Runs from another org** (after switching API keys) are read-only.
- **Keys stay on the server.** They're never sent to the browser or committed.

## How it works

```
graph8 inbox ─┐
dialer ───────┤
meetings ─────┼─▶ ReplyIQ pipeline ─▶ reasons + tags ─▶ Answer Cards ─▶ (approval) ─▶ drafts in graph8
sequence report┘   (7 agents)          (graph8 inbox)                                  list · Studio campaign ·
Studio docs ───────────────────────────────────────▶ proof checks                     Sequencer draft · channel plan
                                                                                        │
                                                    (approval) ◀── learnings ◀──────────┘
                                                    Studio Messaging House / Proof Catalog
```

**What runs where**
- **graph8's APIs** for everything inside graph8: inbox, sequences, contacts, suppression, dialer, meetings, Studio, Sequencer, lists, enrichment. graph8's own AI writes each step-1 email.
- **OpenAI (`gpt-6-luna`)** for judgement: reasons, themes, Answer Cards, strategy and fact-checks. Structured outputs only.
- **The app** is Next.js 16 (App Router) and TypeScript. The API routes (`app/api/*`) are thin wrappers over a tested service layer (`replyiq/lib/server/service.ts`). Background jobs run after the response, with one job per run at a time.
- **Storage:** run files in `replyiq/data/runs/` locally; **Upstash Redis** on Vercel, which also holds the one-job-per-run lock across instances.

The full build notes, API routes and every verified finding are in [IMPLEMENTATION.md](IMPLEMENTATION.md).

## Run it yourself

### Locally
Requires Node 20.9+.

```bash
cd replyiq
npm install
```

Create `replyiq/.env.local` (gitignored):

```
G8_API_KEY=            # graph8 personal key (Profile → Developer)
OPENAI_API_KEY=        # OpenAI platform key
OPENAI_CLASSIFY_MODEL=gpt-6-luna
OPENAI_REASON_MODEL=gpt-6-luna
```

```bash
npm run check-env
npm run build
npm start              # http://localhost:3000   (or `npm run dev` while editing)
```

Writes only work for the graph8 sandbox org, or an org you add with `G8_WRITE_ORG_ID`. Run one server process: locally, the job lock lives in that process.

### On Vercel
1. Import the repo and set the **Root Directory** to `replyiq`.
2. In the project's **Storage** tab, add **Upstash for Redis** (free) and connect it to the project with the prefix `KV`. That creates `KV_REST_API_URL` and `KV_REST_API_TOKEN`, which ReplyIQ uses for runs and job locks.
3. Add `G8_API_KEY`, `OPENAI_API_KEY`, `OPENAI_CLASSIFY_MODEL` and `OPENAI_REASON_MODEL` under **Settings → Environment Variables**.
4. Deploy. Every push to `main` redeploys. Functions run up to 300 seconds, which fits a draft. `.vercelignore` keeps `.env*` and local run data out of uploads.

Developer commands (tests, the CLI pipeline, drafting from the terminal, the end-to-end regression) are in [replyiq/README.md](replyiq/README.md).

## Tests and verification

- **266 offline tests** (fake graph8 and fake model, no keys needed): `npm test`.
- **Typecheck, lint and production build** on every change.
- **End-to-end regression against the real org:** `npm run e2e`. It runs the whole pipeline on every sequence with replies, then reads every result back from graph8:
  - every thread carries its tag;
  - no hard stop, suppressed contact or no-on-a-call is eligible;
  - every proof excerpt is found in fresh documents;
  - every draft exists, isn't launched, and has exactly one ReplyIQ section;
  - re-running gives the same labels (100% identical in testing).

## About the data

All data comes from graph8's hackathon sandbox org, read live through graph8's API.

- **Kill Your Tool Stack** (Full copy) is the real-data sequence: 7,531 contacts and 19 real reply threads (out of office, referrals, a booked meeting, a hard no, a bounce).
- **OrbitDesk Demo Requests** ("Product introduction history") is graph8's seeded demo sequence, with fictional contacts ("Demo Contact 01, Fictional Company 1"). It's the one with pricing and interest replies, so it shows Answer Cards.
- The sandbox's dialer calls are practice records. Meetings, appointments, newsletters and nurtures are empty in this org; ReplyIQ says so instead of inventing data.

## Repository map

| Path | What it is |
|---|---|
| [`replyiq/`](replyiq/) | The app: Next.js, pipeline, API, UI, tests, scripts ([developer README](replyiq/README.md)) |
| [IMPLEMENTATION.md](IMPLEMENTATION.md) | Build guide and verified findings: API routes, integration status, end-to-end results |
| [REPLYIQ-PLAN.md](REPLYIQ-PLAN.md) | Product plan: graph8 API surface, sandbox findings, pipeline, roadmap |
| [PITCH.md](PITCH.md) | Pitch notes: revenue levers, gaps, demo, Q&A |
| [FLYWHEEL-RESEARCH.md](FLYWHEEL-RESEARCH.md) | Does this already exist in graph8? Gaps and feasibility |
| [GRAPH8-PLATFORM-GUIDE.md](GRAPH8-PLATFORM-GUIDE.md) | A synthesis of graph8's documentation |
| [research/graph8-notes/](research/graph8-notes/) | Per-module notes from graph8's docs, including the API endpoint list |
| [PLAN.md](PLAN.md), [IDEAS.md](IDEAS.md) | The earlier idea and the idea shortlist |

**Team:** Saad Saleem and Emad Hasan.
