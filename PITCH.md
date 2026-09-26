# Pitch: ReplyIQ. "No reply is wasted."

**One-liner for judges:**
> ReplyIQ is a reply-intelligence layer for graph8. It analyses campaign replies to find why prospects didn't convert, turns each reason into a tailored follow-up campaign for approval, and flags proof gaps: objections the company can't yet answer. For each gap, it shows an Answer Card that explains what's missing and how to respond. The same list and the same data get more meetings, and graph8 gets more usage.

**Selling point for graph8's marketing:**
> "The only outbound platform where your replies write your next campaign, and tell you which proof you're missing."

This delivers on graph8's own promise ("Perceive. Decide. Act. **Learn. Improve.**") and fills the item its AE guide lists as unshipped: the *"playbook editor / flywheel"*.

---

## 1. Why it makes money (lead with this)

graph8 is **priced by execution** (credits), not by seats. Anything that makes customers run more *successful* campaigns grows revenue in three ways:

| Lever | How ReplyIQ moves it | Evidence from graph8's own docs |
|---|---|---|
| **1. Retention and expansion (the biggest lever)** | Customers churn from outbound tools when reply rates sink. Getting more meetings from lists they've already paid for raises ROI, which keeps them on the platform and moves Team ($99) customers up to Platform ($499). | graph8's own showcase tenant averages a **0.6% reply rate**; its best sequence is 0.41% (5 replies from 1,215 sends). Low results are the norm, so every point of lift is visible. |
| **2. More execution per customer** | Each reply group becomes a new campaign. That's AI generation (charged per token), sends (1 credit per step), and bookings (20 credits each). The customer gets more meetings, and graph8 bills more credits. Both sides win. | Pricing: sends are 1 credit per step, meetings booked 20 credits, LLM work ~1 credit per 1k tokens. |
| **3. Something competitors can't claim** | Apollo, Outreach and Clay report replies. None of them turns replies into the next campaign automatically, with an approval step. It also makes graph8's "Learn → Improve" marketing claim demoable. | graph8 already publishes /vs/apollo pages; this gives them a new comparison row. |
| **Bonus: agencies (CIENCE)** | Growth Managers optimise campaigns by hand today (graph8's "Mission 5", 32 manual steps in its training). Automating that lets one manager run more client orgs. | Training claims "20+ hrs/week/client" of Growth Manager work. |

**Fill-in-the-blanks ROI math.** Use real numbers if the sandbox has any. Otherwise label it illustrative.
```
Non-positive replies per week (not now + objections + referrals)   = N
Share recovered into meetings by a tailored follow-up              = r   (assumption, e.g. 5–10%)
Extra meetings per week, with no new data bought                   = N × r
graph8 credits per extra cycle ≈ (steps × contacts × 1) + (meetings × 20) + generation tokens
```
Example with graph8's showcase week of **235 replies and 72 meetings**:
- If 60% of those replies are non-positive and 8% of them are recovered, that's about **11 extra meetings a week, roughly +15%**, from the same list.
- *Say out loud that 60% and 8% are assumptions, not measurements.*

---

## 2. Gaps: what we build vs what we only pitch

| # | Gap in graph8 today | What we build | Revenue angle | Build this weekend? |
|---|---|---|---|---|
| 6 | Replies are handled one thread at a time. No follow-up campaign per reply group. | **Reply groups → a draft follow-up campaign for each group**: <br>• "Not now" gets a new angle and a later date<br>• Price objections get an ROI/proof angle<br>• Competitor objections get a displacement angle<br>• Referrals go to the named colleague<br>• Interested-but-no-meeting gets a meeting push<br>• Silent contacts get a new hook | Meetings recovered from existing replies. More campaigns means more credits. | ✅ **Core. Build it.** |
| 2 | Reply types are shallow: interested / not interested / out of office | **Objection taxonomy** for email replies (price, timing, competitor, wrong person, no need, referral), each with a quoted example | Makes the recovery possible. Also coaching data for managers. | ✅ **Core. Build it** (an LLM classifier over inbox threads, written back as inbox tags). |
| 5 | No V1→V2, no approval step | **Draft campaign plus a "why" summary**, approved by a human, then launched in the sandbox. Mirrors graph8's own approval patterns (My Desk approve lane, draft documents). | Trust. Agencies can show clients what changed and why. | ✅ Build it: campaigns created as drafts, with an approval screen. |
| new | Nobody sees which objections the company *can't* answer | **Answer Card per objection group**: representative quotes, proof we already have (cited from Studio docs such as the Proof Catalog, with a substring grounding check), a ⚠ proof-gap line, and how to respond. It is written into the follow-up campaign's "Messaging & Objections" and "Reply Templates" docs. | Marketing gets a concrete asset backlog; reps get an answer they can use today. | ✅ **Core. Build it.** |
| 7 | Learnings aren't kept | **Proposed edits to Studio docs** (Messaging & Objections, Reply Templates) for approval, so the *next* campaign starts smarter | Each campaign learns from the last, which makes switching away harder. | 🟡 A light version: write one "Learnings" doc and propose one Studio edit. |
| 1 | No "why": outcomes aren't linked to opener, CTA, step or segment | Break reply groups down by step, persona and industry, where the data allows | Better targeting means fewer wasted sends. | 🟡 Only if the sequence data has enough replies. Show counts, not claims. |
| 3 | Audience and message results aren't joined | Pitch only | | ❌ Needs volume and time. |
| – | Proving that V2 beats V1 | Pitch only ("measure V2 against V1 after 14 days") | | ❌ Impossible in a weekend. Say so. |

**Rule for the demo:** only show numbers we computed from real graph8 data. If the replies are seeded, say "seeded replies" out loud.

---

## 3. Five-minute live demo

| Time | Beat |
|---|---|
| 0:00 | **Hook:** "graph8's own tenant averages a 0.6% reply rate. Of the few replies that do come in, most are 'not now', 'too expensive' or 'talk to Sarah', and they die in the inbox." Show Inbox → Analytics: *graph8 knows the share of interested replies, but nothing happens next.* |
| 0:40 | Run ReplyIQ on the finished campaign. Replies get classified into groups, each with counts and a quoted example ("we're locked into Apollo until Q1"). |
| 1:40 | Open the price group's **Answer Card**: the proof we have (cited from the Proof Catalog), the ⚠ proof gap ("no ROI case study for mid-market"), and how to answer. The matching **draft follow-up campaign** is already in Studio → Campaigns with its own audience list. |
| 2:40 | **Approval screen:** what changed, why, which replies it's based on, and the credit cost estimate. Click approve, and it launches in the sandbox (the sequence and its simulated sends are visible). |
| 3:30 | **Learning:** the Answer Card now lives in the campaign's *Messaging & Objections* doc, so the next generation uses it. Stretch: a proposed, approved edit to the Global Proof Catalog. |
| 4:15 | **Close on money:** "Same list, same data. More meetings for the customer, more execution for graph8, and it's the flywheel on your roadmap, built on your APIs." |

---

## 4. Judge Q&A

- **"We already tag replies and rank sequences."** "Yes, and we build on that. Your analytics say *what share* of replies were interested. We act on everything else: every group gets its own next campaign, and the learnings go back into Studio."
- **"Where does the proof come from? Won't the AI make it up?"** "Every proof point cites a Studio document, and we check that the quoted excerpt really is in that document. Anything that fails the check becomes a proof gap instead of a claim."
- **"Isn't this just AI drafting a reply?"** "AI Inbox drafts one reply per thread. We work at the level of the whole campaign: group the replies, build a follow-up campaign with its own audience, get it approved, and feed the learnings back."
- **"How do you know it works?"** "Today we can prove the pipeline end to end on graph8. Proving lift needs about 14 days of V2 sends, so we'd measure V2 against V1 with your campaign metrics. We won't claim lift we haven't measured."
- **"Won't this spam people who said no?"** "'Not interested' and unsubscribes are never re-contacted. We respect graph8's suppression list and DNC. 'Not now' waits a set number of days. Nothing launches without human approval."
- **"Where does the money come from?"** "Retention first: better ROI on lists customers already bought. Then execution: each follow-up campaign is generation, sends and bookings, all billed in credits."

---

## 5. Honest risks to manage
- **Reply data:** if the sandbox has no replies, seed them and **disclose** it. The 35-point "works end to end" score then depends on everything *after* the classification running for real on graph8: the draft campaigns, the lists, the approval, and the sandbox launch.
- **The roadmap overlap** is a strength ("you want this"), but ask the engineers first whether building it is OK.
- Keep the scope to gaps 6, 2 and 5, plus Answer Cards and the light version of 7. The full build plan and weekend roadmap are in `REPLYIQ-PLAN.md`. Everything else goes in the "next steps" slide.
