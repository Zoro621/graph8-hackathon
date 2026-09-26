# New idea shortlist: built *around* graph8, not inside it

**The rule, as confirmed by Thomas in the Work room:** *"Build anything, but use our sandbox and backend where you can. Records need to be stored in graph8."*

So the test for each idea: our own app and logic on top, with graph8 as the system of record (contacts, companies, deals, lists, sequences, signals).

---

## Flywheel vs Usman's "SignalForge"
| | SignalForge (Usman, posted publicly) | Our Flywheel |
|---|---|---|
| Where in the funnel | **Top**: signals → find clients → personalise first outreach | **Bottom / after the campaign**: replies → groups → a follow-up campaign per group → learnings |
| User | Software agencies prospecting | Any team that already ran a campaign |
| "Learn from replies" | One feature among several | **The whole product**: objection breakdown, V2 campaigns, approval, write-back to Studio |
| Overlap risk | High on the words "learn from replies" | Differentiate on depth: follow-up campaigns per reply group, plus approval |

**Don't use the name "SignalForge".** Another participant has already used it in public. If we pursue this idea, it stays "Reply Flywheel".

---

## Ideas, ranked
Scored on: live-demoable · money story · real graph8 usage · buildable in about 1 day · not native to graph8.

### 1. Booth Capture: event lead capture straight into pipeline ⭐ best live demo
- **What:** a mobile web app. Scan a business card or LinkedIn QR code, or take a photo of a badge.
  - Claude vision reads the card.
  - graph8 looks the person up and enriches them, and the contact lands in the "Event: X" list with notes and interest level.
  - A personalised follow-up sequence is queued in the sandbox.
  - Afterwards: an "event ROI" view of pipeline sourced by the event.
- **Not native:** graph8 has no card scanner or on-site capture app. Events are a blind spot in its attribution.
- **graph8 usage:** `enrichment/lookup/person`, contacts assert, lists, custom fields (event, booth notes), Find People (other contacts at the same account), sequences (sandbox), tracked links, deals.
- **Money:** companies spend $10–50k per trade show, and most badge scans are never followed up. Capture plus same-day follow-up becomes meetings. graph8 earns on lookups, enrichment and sends.
- **Demo:** scan a judge's card live on stage and show it land in graph8 seconds later.
- **Risk:** low. OCR is easy, and the lookup uses real data.

### 2. Collections Agent: an AI that chases past-due invoices ⭐ strongest money story ("bills")
- **What:** watches for `quote.payment_failed` and past-due customers.
  - Runs a polite, escalating chase across email, WhatsApp and a voice-AI call.
  - Offers a payment plan or a new payment link.
  - Logs every promise to pay as a task, and escalates to the account owner.
- **Not native:** graph8 has quotes, Stripe and customer health, but no dunning or collections workflow. Its own CSM guide shows **7 past-due customers with ~$13.5K MRR at risk**, handled manually.
- **graph8 usage:** customers and lifecycle lists, quote webhooks, sequences (sandbox), voice agents, tasks and notes, deals.
- **Money:** directly recovered revenue, and 1:1 with the judging line "useful to a team that … **bills**". Few teams will build for billing.
- **Demo:** a past-due account, the agent's plan, messages visible in the sandbox outbox, a "promise to pay" task, and a dashboard of MRR recovered.
- **Risk:** the sandbox needs customer or quote fixtures. Check them at the spike.

### 3. Deal Room: a buyer-facing mutual action plan
- **What:** a shareable page per deal for the *buyer* showing:
  - the mutual action plan (steps, owners, dates)
  - the proposal or quote with e-sign
  - FAQs answered by AI from the Proof Catalog
  - stakeholder checklist

  Every view becomes a graph8 signal, and a stalled plan raises a task for the seller.
- **Not native:** graph8's "Deal Room" is internal. Nothing is buyer-facing apart from the quote signing page.
- **graph8 usage:** deals and stages, contacts and roles, quotes, tasks, the tracking snippet (visits count as signals), global context (proof).
- **Money:** faster close and fewer deals slipping at procurement. It maps to graph8's own "stalled deal" alerts.
- **Risk:** medium. Mostly UI work, and it's hard to show a real outcome on stage.

### 4. Warm Path: find warm intros to target accounts
- **What:** upload your team's and investors' connections, or pull a partner's account list. It maps them against target accounts in graph8 and suggests "ask Sara (ex-colleague of their VP Sales) for an intro", with a drafted intro request.
- **Not native:** graph8 does cold outbound and signals. Warm, referral-based paths aren't covered.
- **graph8 usage:** companies and contacts, lists, domain matching, custom fields, tasks, sequences.
- **Money:** referred deals typically close at much higher rates than cold ones.
- **Risk:** data. We'd need a CSV of connections (LinkedIn export).

### 5. WhatsApp Sales Desk for local SMBs
- **What:** an inbound WhatsApp agent that qualifies the lead, answers from the knowledge base, books a meeting or sends a quote, and logs the contact and deal in graph8.
- **Not native:** graph8 uses WhatsApp as an outbound sequence step and for copilot access, not as an inbound sales desk.
- **Money:** WhatsApp is where selling happens in Pakistan and MENA, which is new-market revenue for graph8.
- **Risk:** high. WhatsApp Business API access over one weekend. We'd have to simulate the channel.

### 6. Reply Flywheel (existing idea, see [PITCH.md](PITCH.md))
- Still valid, but it overlaps with SignalForge and graph8's own roadmap, and it's **blocked on reply data** in the sandbox.

---

## Recommendation
- **Booth Capture** if we want the safest live demo. It's real data end to end, and it can be shown on the judges themselves.
- **Collections Agent** if we want the sharpest money pitch and the least competition.
- Either one avoids Flywheel's blocker, since neither needs inbound replies to exist.

Note: the Work room says the hours are **noon to midnight**, while the brief page said 10 PM. Confirm in the room. Lock the idea within the next hour.
