# graph8 Knowledge Base: Engage, Getting Started, Marketplace

Source: plain-text extracts of docs.graph8.com (33 files: 13 `engage__*`, 6 `getting-started*`, 14 `marketplace*`). Every file was read in full. Everything below comes from those pages. Notes marked **[VAGUE]** show where the docs are unclear, and **[NOT IN DOCS]** marks something these pages don't cover (it may be in the developer or API pages, which other notes cover).

Global caveat from the Feature Guide: "Available controls depend on your role, plan, organization configuration and product version." The Work page adds that "A link or older screenshot may refer to a view that is not offered in your menu."

---

## PART A — ENGAGE

Engage menu pages, in the docs' prev/next order: Sequencer → Inbox → Nurture → Meetings → Dialer → Newsletter → Web Chat → Appointments → Connections → LinkedIn Publishing → HeyReach Campaign Overview → Work → Work Routines.

### A1. Sequencer (`/engage/sequencer/`)

**What it is.** Multi-step, multi-channel outbound automation for cold prospects. You define steps and graph8 runs them on a schedule for each contact in a list.
**Location.** Engage → Sequencer → **Create Sequence**. Reusable schedules live at Engage → Schedules. Fallback settings live at Sequence Settings → Fallback. The HeyReach page calls the same area "Engage → Sequences" (naming is inconsistent).

**Channels and required resources**

| Channel | What it does | Required resource |
|---|---|---|
| Email | Gmail or SMTP mailboxes | Mailbox(es) |
| LinkedIn | Connection request, DM, InMail, follow, view profile, like post (via **HeyReach**) | LinkedIn account |
| Phone | Voice AI calls or manual dialer | Phone number |
| SMS | Text messages | Phone number |
| WhatsApp | WhatsApp Business messages | "etc." [VAGUE: the WhatsApp resource isn't named] |

**Mailboxes and volume (hard numbers)**
- A sequence can have any number of mailboxes. graph8 rotates sends across them automatically.
- A fully warmed mailbox can send up to **15 sequence emails per day**.
- Warm-up ramp, counted from when the mailbox was created in graph8:
  - Weeks 1–2: 0 per day (warm-up only)
  - Week 3: 5 per day
  - Week 4: 10 per day
  - Week 5 and later: 15 per day
- The ramp applies only to cold outbound sequences. It's on by default and "can be adjusted for your organization."
- Example from the docs: 4 warmed mailboxes send 60 per day.
- Nurture is different: one pinned mailbox, **500 per day**, no ramp.

**Building a sequence**
1. Name it and pick a contact list.
2. Add steps. Each step has a channel, timing and content.
3. Assign resources (mailboxes, phone numbers, LinkedIn accounts).
4. Set a schedule (sending windows).

**Step types:** Email, Phone (triggers a voice AI call), Manual Dialer (queues the contact for manual dialing), LinkedIn, SMS, WhatsApp.

**Content modes per step:** *On-demand* (you write it), *AI-generated template*, *Manual template* (a saved template).

**Timing:** a wait interval between steps, e.g. "wait 2 days after the previous step."

**LinkedIn actions**
- Connection request, with an optional message and a fallback message
- Message (existing connections only)
- InMail (subject and body)
- Follow
- View profile (creates a notification)
- Like post (you can pick the reaction type)

A HeyReach LinkedIn step needs at least one LinkedIn account assigned as a channel. If none is connected, the form prompts you to connect one. Accounts can be added or removed later on the Channels tab in Sequence Details.

**AI Instructions (LinkedIn steps).** Instead of static copy, you write instructions and graph8 generates a message for each contact **at send time**. Inputs are contact data (name, role, company), Global Context and campaign documents. The docs say this for LinkedIn and HeyReach steps. For email, the "AI-generated template" mode exists, but the docs don't say whether it generates per contact at send time. [VAGUE]

**Sequence settings**

| Setting | Effect |
|---|---|
| Finish on reply | Stops the sequence for a contact when they reply |
| Send in same thread | Keeps all emails in one thread |
| Wait for new contacts | Pauses the sequence and resumes it when contacts are added to the list |
| Shared | Makes the sequence visible to the whole team |

**Sequence statuses:** Drafted → Scheduling → Live → Paused / Waiting → Completed / Terminated. Terminated can't be resumed.
**Controls:** Start, Pause/Resume, Terminate, Duplicate.
**Pre-launch validation:** checks that every field the selected channels need is available. If something is missing, a warning lists what to fix.

**Per-contact states:** Queued, In progress, Paused (manual), Completed, Failed (a step failed), Bounced, Removed (manual), Replied ("sequence stopped if finish-on-reply is enabled"). Individual contacts can be paused or resumed.

**What stops or removes a contact from a sequence (as documented)**
- A reply, when Finish on reply is on
- A bounce (state Bounced)
- Manual removal or pause
- A step failure (state Failed)
- A condition with the fail action "Exit sequence"
- Terminating the whole sequence
- Suppressions and DNC. The Dialer skips DNC and No Phone contacts. Suppressions are a Data feature listed in the Feature Guide ("Exclude contacts from outreach across email, phone, and LinkedIn").
- Newsletter complaints: a complaint "suppress[es] the subscriber across newsletter, outbound, and every other graph8 module."

[VAGUE] The docs don't say whether an out-of-office reply counts as a reply for Finish on reply. They also don't say whether a reply on one channel (e.g. LinkedIn) stops steps on other channels, or how a reply is attributed to a step.

**Schedules:** sending windows (hours and days of week) and a timezone setting that "respect[s] each contact's timezone." Schedules are reusable.
**Templates:** sequence templates (whole structure: steps, timing, channels) and step templates (content).

**Step conditions**

Condition types, with the docs' examples:

| Type | Example |
|---|---|
| Field value | Job title contains "VP" |
| Previous step outcome | Step 1 email was opened |
| Engagement threshold | Opened ≥ 2 previous emails |
| Custom field | ICP score > 80 |
| List membership | Contact is in list "Enterprise ICP" |
| CRM field | HubSpot lifecycle stage = MQL |
| Time since event | Website visit within last 7 days |

To add one: open the step, click **Add Condition**, pick the type and value, then pick what happens when it fails:
- **Skip step**: the contact is marked Skipped and continues to the next step
- **Exit sequence**
- **Wait and retry** after N days

Example from the docs: "If contact opened email 1, send LinkedIn message; otherwise, send email 2."

**Branching**

Click **Add Branch** on any step. The split condition uses the same types as step conditions. Each path has its own steps, content and timing, and paths can re-converge or end independently.

Use cases from the docs:
- Persona (VP vs IC)
- Channel preference
- Replied vs non-replied contacts
- Escalating to phone after 2 ignored emails

**Branch analytics:** contacts per branch, per-branch conversion ("Reply rate, meeting-booked rate per path"), and a **Winning branch** view ("Side-by-side comparison for A/B test patterns").

Important: this is the only A/B mechanism documented. The docs describe no random-split A/B variant feature and no automatic winner selection. A/B is done by building condition-based branches and comparing them by hand.

**Provider fallback** (Sequence Settings → Fallback, set per sequence)

Modes:
- **Strict**: skip the step if the resource fails
- **Rotate**: try the next resource in the pool
- **Cross-channel**: fail over to another channel, e.g. email → LinkedIn

Documented cases:
- Mailbox at its send cap: rotate to another mailbox
- LinkedIn account rate-limited: wait 4 hours and retry on the same account
- Number on a DNC list: skip and continue
- WhatsApp template rejected: fall back to email with the same content

**Rate limits and caps (throttling)**
- Per mailbox: 15 per day once warmed
- Per LinkedIn account: **25 actions per day** ("Matches LinkedIn platform safety limits")
- Phone, SMS, WhatsApp: set per organization
- These are managed by graph8 and adjustable per organization.
- When a cap is hit, the step re-queues for the next available sending window.
- **Gotcha:** the HeyReach page gives different LinkedIn numbers: 50 connection requests per day, 50 messages per day, 300 profile views per day, 100 likes per day. The two pages conflict. Treat 25 actions per day as graph8's sequence-level default and the HeyReach figures as HeyReach's own per-action limits. [VAGUE/CONFLICT]

**Deliverability.** Configured in Settings, not Engage (see Email Warmup in Settings). The docs recommend:
- Warm up for 2–3 weeks.
- Set up SPF, DKIM and DMARC.
- Run placement tests weekly.

**Studio integration.** A Studio campaign can be launched directly into the Sequencer. The sequence inherits the campaign's messaging, personas and channel strategy. The campaign↔sequence link is kept "for end-to-end performance tracking."

Tips from the docs: use 3–5 steps; multi-channel sequences "typically outperform" single-channel ones; use the conversion funnel to find drop-off.

**Reports and analytics (per sequence)**

| Metric | What it shows |
|---|---|
| Overview | Total contacts, active, completed, **success rate**, overall progress |
| Step breakdown | Per step: queued, in progress, completed, failed, bounced, replied |
| Conversion funnel | Contacts entered vs completed at each step |
| Step performance | **Sent, delivered, replied, bounced** counts and rates per step |
| Response rates | Reply rates over 24h, 48h and 7 days |
| Engagement trends | Daily reply-rate and bounce-rate trends |
| Skipped | Contacts skipped because of missing data, dedup rules, or unmet conditions |

Notable gaps:
- The Sequencer page doesn't list opens or clicks as metrics. Open tracking is implied, though: the "email opened" condition exists, and the Nurture page lists "send, open, click, reply rates per step."
- "Success rate" isn't defined. [VAGUE]
- Nothing in the sequence analytics classifies replies by category or sentiment. There's no "positive reply" or "objection" metric at the sequence level. Meeting-booked rate is mentioned only in branch analytics.

**Campaign-link click tracking** (from the Connections page). A campaign link's URL carries a **campaign hash identifying the sequence step and contact**. The tracking script captures the visit, and the Campaign Visitor Trigger webhook ties it to the contact and step. This gives step-level click and visit attribution, as long as the tracking script is on the site.

### A2. Inbox / AI Inbox (`/engage/inbox/`)

**What it is.** A unified inbox covering:
- Email (Gmail/SMTP)
- LinkedIn (via HeyReach)
- SMS
- Chat (web widget plus internal support)
- Calls (results with transcripts and dispositions)
- Meetings (calendar events plus transcripts)

It also has a **Universal Activity Timeline** that shows every event for a contact (emails, calls, LinkedIn messages, meetings) in one chronological view.

**Setup and settings**
- Connect mailboxes at Settings → Channels → Mailboxes. **AI Inbox is always on for healthy mailboxes.** There's no per-mailbox sync or enable toggle.
- AI behavior lives at Settings → Channels → Inbox, which has these panes:
  - **AI Settings**: agent behavior, auto-tagging, access to the company knowledge base, and **business-hours-only processing** (timezone, start and end times)
  - **Mailbox Policy**: a per-mailbox **Auto-respond** toggle and a manual **Sync now** action
  - HeyReach, SMS, Tags, Team, Shared Inboxes
- Opening settings from the Inbox takes you to these "Studio Settings panes."

**Email filters:** mailbox, campaign, tags (include or exclude), status (sent / AI responded / draft), date range, assigned user, starred (per user). Emails show as threaded conversations.

**LinkedIn (HeyReach):**
- View history, send messages and InMails, and manage drafts.
- Mark as read.
- Filter by sequence, LinkedIn account or date.
- Add or remove tags.
- Manage LinkedIn accounts (view config, activate or deactivate, update).

**SMS:**
- Filter tabs: All, Unread, Drafts.
- Choose the sending number.
- AI composition via Copilot and draft management.
- Bounced numbers are excluded from future sends automatically.
- Threaded history.

**Chat:** per-user stars and a Starred filter. It uses the same composer as the public widget (auto-grow, attachments, voice notes, persisted drafts).

**Call results:** disposition (booked / positive / neutral / negative / voicemail), transcript, duration, tags (manual or AI-suggested), custom fields.
Note that this disposition list differs from the Dialer's own disposition list; the Inbox view looks like a sentiment-style roll-up. [VAGUE]

**Meetings:** executive summary, key topics, action items and linked tasks, participant and account context, transcript status and manual linking.

**AI message composition** costs **1 credit per transformation**. You can combine several operations in one request. Operations:
- **Change tone**: professional, friendly, casual, assertive, empathetic, urgent
- **Fix grammar**
- **Change objective**: book meeting, follow up, re-engage, provide value, **handle objection**, close deal
- **Expand**
- **Shorten**
- **Change persona**: SDR, growth manager, AE, customer success, founder
- **Generate from scratch**: writes a full reply from the conversation context

**Booking from the Inbox.** A calendar icon in the toolbar lets you pick a time and confirm. The meeting is then linked to the contact, added to your calendar and shown in the conversation history.

**AI-surfaced booking links in drafts**
- If the contact is in an active deal: the AE's calendar link.
- If it's inbound interest: the default routing form URL.
- If it's a follow-up: the booking link originally shared in the thread.
- Links come from the connected appointment configuration and are "not invented." You can edit them before sending.

**Auto-tagging (the closest thing to reply classification)**
- The AI suggests tags for emails, chats and call results based on content analysis.
- Tags with **confidence > 0.7** are recommended.
- Only tags marked **"AI-applicable"** are considered.
- A tip describes it as categorizing "interested, not interested, out of office, etc."
- So the taxonomy is whatever tags the user creates. The docs describe no fixed built-in intent or sentiment model.
- [VAGUE] "Suggests/recommended" could mean the tags are applied automatically or only proposed. The docs don't say.

**Auto-response**
- Mailboxes can be set to auto-respond with AI (per-mailbox toggle under Mailbox Policy).
- Each message records who responded: **User** (a teammate), **Other** (the contact or an external party) or **AI** (graph8 auto-responded).
- The status filter includes "AI responded."
- [VAGUE] The docs don't describe any guardrails, approval step, or which replies trigger an auto-response.

**Workspaces:** team workspaces with members, shared mailboxes and roles (admin, member).
**Tags:** name, color, description, and an AI-applicable flag. They apply to emails, LinkedIn conversations, chats and call results.
**Blocked senders:** block by address or from a conversation; their messages are filtered out during processing.

**API.** The Feature Guide lists an Inbox developer page: "Multi-channel inbox: list threads, generate AI drafts, send replies via email, SMS, or LinkedIn." The endpoint paths aren't in these files. [NOT IN DOCS here]

### A3. Nurture (`/engage/nurture/`)

**What it is.** Multi-step automation for opted-in audiences: newsletter subscribers, trials, customers, event attendees, closed-lost deals.
**Location.** Engage → Nurture → **Create Nurture Campaign**. Four tabs: **Meta → Contacts → Steps → Review**, then **Launch**.

**Sequencer vs Nurture**

| | Sequencer | Nurture |
|---|---|---|
| Audience | Cold prospects | Consented contacts |
| Pacing | Aggressive | Long-cycle drip |
| Channels | All | All (same step types) |
| Mailboxes | Rotation across many | One pinned brand mailbox |

**Meta tab fields:** Name, Description, Schedule, **Pinned mailbox** (exactly one, up to 500 per day, exempt from the warm-up ramp), Pinned phone number, optional **Studio campaign** link, Finish on reply, Send in same thread. The page also mentions a "Wait for new contacts" setting in Meta.

**Contacts tab:** one or more lists; attribute filters; **signals as enrollment gates** (e.g. "visited pricing page, opened last campaign"). Audience syncs keep the audience updated.

**Steps tab:** the same builder as the Sequencer, with all step types, content modes and conditions.
Patterns from the docs: 5–14 day waits, email-only cadence, branching on engagement (openers vs non-openers), and AI Instructions for personalization.

**Review tab:** total contacts, step count and total duration, mailbox and phone, schedule and timezone, validation warnings.

**Personal / Organization tabs** in the list view.

**Statuses:** same as Sequencer (Drafted, Scheduling, Live, Paused, Waiting, Completed, Terminated). Same controls.

**Adding contacts to a live nurture:** Add Contacts → pick a list or upload. New contacts start at step 1.

**Reports**
- Enrolled, Active, Completed, Replied
- **Per-step performance** (send, open, click and reply rates)
- Engagement trend (daily reply rate)
- Conversion funnel (drop-off per step)

**Compliance**
- An unsubscribe link is required on every email step.
- Unsubscribes, hard bounces and complaints are suppressed automatically.
- The source of consent is recorded on each contact.
- GDPR, CASL and CAN-SPAM rules apply.
- Configure at Settings → Compliance.

**Troubleshooting**
- Stuck in Scheduling: wait 5 minutes. If it's more than an hour, check whether the list is empty.
- Contacts not advancing: the wait interval and the sending window must both align.
- Replies not stopping the nurture: check that Finish on reply is enabled.
- Mailbox at its cap: split the audience across multiple nurtures.

### A4. Meetings (`/engage/meetings/`)

**What it is.** A calendar-driven meeting queue inside the Inbox, enriched with transcripts.

**Classification:**
- **Customer**: an external attendee matches an active account
- **Prospect**: external attendees, but not mapped to a customer account
- **Internal**: no external attendees
- **Unknown**

**Views:** External, Customers, Prospects, Internal, With Transcript, Missing Transcript.
**Scope tabs:** My Meetings, All Meetings, My Upcoming, All Upcoming.
**Filters:** timeframe (default **Past**), transcript status, audience, internal mode, search (title, attendees, transcript summary or text), sort.

**Detail view**
- Header: title, time, audience and transcript badges, organizer and participant chips, Open Meeting link.
- **Executive Summary:** summary, **Key Topics**, **Campaign Mentions**.
- **Tasks:**
  - Meeting tasks (tracked tasks already created from transcript action items)
  - Action items (extracted, still need review or an owner)
  - Each shows the assignee, the linked record, and whether assignee review is needed.
- Meeting context: linked account, organizer, transcript source.
- Participants: resolved to internal users, external contacts or accounts, with titles and RSVP.
- Transcript: the full body if imported; otherwise only the summary.

**Transcript management:** Find Transcript, Link Transcript, Mark No Transcript, Resume Transcript Search, Remove Manual Link.
Candidate matching shows match confidence, method, time delta, title overlap, attendee overlap and domain overlap.

**Config:** internal domains at Settings → Docs → Meetings, where meeting extraction rules are also set.

[VAGUE] Transcript sources aren't named (e.g. which recorders).
The Feature Guide lists a Meetings API: "List and retrieve meetings — including attendees, transcript, and AI analysis."

### A5. Dialer (`/engage/dialer/`)

**What it is.** A power and parallel dialer that calls up to 4 lines at once, with recording, transcription, voicemail detection and AI grading.

**Starting a session**
1. Go to Engage → Dialer → **New Session**.
2. Pick the Contact List (the contact count is shown).
3. Session Name auto-fills from the list name.
4. Optionally pick a Studio Campaign.
5. Click Create Session. Earlier sessions on the same list are offered for resuming.

**Sidebar settings**
- Dialing mode: 1 (Power) or 2/3/4 (Parallel)
- Select number
- **Select agent**: a Twin agent is required; "Every dialing session runs with a Twin agent"
- Studio campaign
- Priority

**During a call**
- The call drawer shows contact info, a live transcript and the outcome panel.
- After the call, set a disposition (plus optional **sentiment** and note), then **Log & Dial Next**.
- Other actions: Book Meeting, Dialpad (DTMF), Leave AI VM and Dial Next, Leave & Pause, End Call, Mute.

**Skipping rules:** No Phone and DNC contacts are never dialed. You can fix missing data by opening the list in a new tab from the sidebar and double-clicking a cell to edit it.

**Parallel logic**
- The first live answer wins; the other calls are hung up.
- Voicemail and IVR are detected, then skipped or given a voicemail drop.
- A contact is never called twice in the same session.
- Next Batch starts the next group, and unconnected contacts are retried on their next number.
- In 4-line mode, if two people answer at nearly the same moment, the second is dropped. Use Power mode for VIPs.
- Tips: start at 2 lines; peak hours are 10am–12pm and 2pm–4pm.

**Phone priority:** Direct → Mobile → Company by default. You can drag to reorder or exclude a type (at least one must stay). Retries move to the next number automatically.

**Redial by disposition:** Voicemail, No answer/Hangup, Callback, Gatekeeper, All dispositioned (can be combined with a date filter). Booked, DNC and Not interested are skipped. The filter state persists with the session.

**Manual dialer:** ad-hoc calls not tied to a sequence, still logged as activities.

**Session statuses:** Active, Paused, Completed, Failed.
**Call statuses:** Dialing, Ringing, Active, **Automation** (voice AI handling the call), Hangup, Failed.

**Numbers:** dialer numbers and AI voice agent numbers are managed separately (Settings → Phone Numbers).

**Inbound calls:** real-time notifications (showing contact name and company if the number matches), SDR online status, claim or decline, voicemail fallback, pending queue.

**Recording:** every call is recorded to cloud storage, transcribed, summarized by AI, and graded by AI for coaching.

**Voicemail:** detection, drops, greetings (org-level or per agent), transcription, read/unread tracking.

**Dispositions (SDR-selected), with sub-sentiments where listed**
- **Booked**
- **Callback**: has budget, interested, hesitant, not ready, interested but wrong person
- **Not interested**
- **DNC**: legal DNC, request DNC, harassed
- **Not ICP**
- **Has solution** (competitor in place)
- **Gatekeeper**: will pass through, callback scheduled, won't pass
- **Wrong number**
- **Left org**

**Dispositions (system-set):** Voicemail, Hangup, No voice, Not answered, Failed.

**Voice AI:** voice agents, TTS, voice cloning, call scripts, and an **SDR training agent** that simulates prospects.

**Analytics**
- Session Analytics, opened from the dials/talk-time chip:
  - Overview: dials, connections, connection rate, talk time, voicemails, success rate, redials, peak hour, booked, callbacks
  - Dispositions
  - Daily Breakdown
- SDR Performance Dashboard:
  - Dials
  - Connections (human-answered only)
  - Connection rate
  - Voicemail rate
  - Talk time
  - Average duration (voicemail excluded)
  - Disposition breakdown
  - **Success rate = meetings booked per connected call**
  - Redial metrics
  - Peak calling hours
- Score filtering (Min/Max score). Calls under 30 seconds and non-conversation dispositions are excluded from scoring.
- Team leaderboard (daily, weekly, monthly; ranked by calls, connections, meetings).
- Call targets (org or per SDR, daily calls and meetings).

**Campaign linkage:** a session linked to a campaign attributes every call to it. Dials, connections, dispositions and talk time roll up into the campaign performance view "alongside email and LinkedIn data."

**Sequencer integration:** Manual Dialer steps; call results linked back to the sequence step and contact; campaign attribution through the session link.

**API:** the Feature Guide lists a "Voice & Dialer" REST page (sessions, calls, transcripts, AI grading, agents, phone numbers).

### A6. Newsletter (`/engage/newsletter/`)

**What it is.** Native newsletters sent through **SES**. Opens and clicks feed lead scoring ("A subscriber who clicks your pricing link gets scored higher in your outbound campaigns").

**Flow**
1. Studio → Campaign → **Generate** → pick **Newsletter** type → choose a goal and direction.
2. AI produces **5 ideas**. Push one to a campaign, which auto-generates **9 docs**:
   - Newsletter Brief
   - Content Pillars (4–6)
   - Editorial Calendar (12 issues)
   - Tone & Voice Guide
   - Subject Line Bank (30+)
   - CTA Playbook
   - Subscriber Persona
   - Growth Playbook
   - Performance Benchmarks (including a "health score framework, SES thresholds")
3. In the campaign dashboard, click **Create New Issue**: subject, preview text, HTML, and an optional editorial calendar issue number. Then Save Draft or Send Now.

**Issue statuses:** Draft, Scheduled, Sending (via SES), Sent, Failed ("check SES configuration").

**Preflight checks before sending**
- Only confirmed subscribers are counted.
- Bounced and complained subscribers are suppressed.
- The domain must be Verified.
- Subject, preview text and HTML are required.
- If any check fails, the Send dialog blocks and lists the fixes.

**Metrics per issue:** Delivered, Opened (unique, pixel), Clicked (with URL tracking), Bounced, Unsubscribed, Complained.

**Subscriber statuses:** Pending (double opt-in), Subscribed, Unsubscribed, Bounced (hard bounce, excluded), Complained (excluded **across all graph8 modules**).

**Adding subscribers**
- Promote from an audience (sends a confirmation if double opt-in is on)
- Manual add or CSV
- Public signup form (triggers double opt-in)

**Setup checklist:** verified domain, at least 1 confirmed subscriber, from name and reply-to, drafted content. It checks the subscriber list, not the audience size.

**Compliance:** double opt-in, RFC 8058 one-click unsubscribe, HMAC-signed preference center (no login needed), bounce and complaint suppression, a NULL-email guard.

**Settings**
- Org level: Settings → Newsletter (sending domain, default sender, double opt-in, **warm-up daily limits for new domains**).
- Per newsletter (Settings tab): From Name, Reply-To, domain picker, subscribe and unsubscribe redirect URLs, footer.

**Domain verification:** Settings → Newsletter → Domains. Enter a subdomain, then add **1 TXT and 3 CNAME** records. Propagation takes 15–60 minutes. Records are checked one by one, and a subdomain is recommended.

**Dashboard:** a NEWSLETTER badge, a content card, an AI strategic assessment and **readiness score**, and a risk assessment. The sequencer and audience pipeline are hidden for newsletter campaigns.

### A7. Web Chat (`/engage/web-chat/`)

**What it is.** A website chat widget with AI agents, delivered through the Connections "Chat" tag destination.

**Chat agents**
- Settings: agent name, URL filter (paths), Active, Default.
- Routing: the page URL is matched against agent filters; if none matches, the default agent handles it.

**Chat buttons**
- Action types: Link (URL), Question (sends a preset question to the AI), Calendar (booking slug).
- Each button has a label, action and value, icon, category, and the paths where it shows.

**Preset questions:** set per category, filterable by URL path, and individually toggleable.

**Widget design defaults:** primary color #7E2DF3, secondary #f8fafc, font Inter, radius 0.5rem, width 350px, dark mode off. Message colors, header and floating-button settings are also configurable.

**Composer**
- Attachments: JPG, PNG, GIF, WebP, PDF and document formats, with server-side size limits and SSRF protection. They persist across history reloads.
- Voice notes are recorded, transcribed and fed to the AI.
- Emoji picker.

**Other:** support avatars (falling back to initials); visitors can collapse the widget.

**Where conversations go:** into the Inbox as the Chat channel. A tip in Appointments suggests connecting a routing form to a chat button ("Chat-to-form conversion is 2–3x higher") [marketing claim].

### A8. Appointments (`/engage/appointments/`)

**What it is.** The booking workflow plus CRM sync. It's separate from Meetings (review).

**Flow:** booking → the scheduling system sends an event → graph8 creates or updates contacts and syncs to the CRM.

**Events handled**

| Event | What happens |
|---|---|
| Booking created | Contact created/updated, meeting synced to CRM |
| Booking updated | CRM meeting updated |
| Booking canceled | CRM meeting marked canceled |
| Booking rescheduled | Handled per CRM (below) |

On reschedule, HubSpot and Pipedrive mark the original "rescheduled" and create a new meeting. Salesforce just creates a new meeting.

**Contact creation**
- Creates new contacts and updates existing fields (phone, name).
- Processes guests.
- Skips the host (the host becomes the owner).
- Dedupes.

**CRM sync:** HubSpot, Salesforce and Pipedrive (Pipedrive also associates attendees). Fields synced: title, description, times, location and URL, contacts, owner, **booking UID**.

**Owner assignment:** "Use host as owner" (no fallback) or "Use default owner" (host first, then a fallback). Set per CRM integration in Settings → Integrations, along with entity type (contacts, leads, companies or deals), field mappings and the default owner.

**Routing forms** (Engage → Appointments → Routing Forms → New Form)
- Question types: short text, email, phone, dropdown, multi-select, number, long text; each can be marked Required.
- Routing rules are evaluated in order; the **first match wins**, otherwise a fallback applies.
- Rule conditions: equals, contains, in range, All of, Any of.
- Actions: Show calendar, Assign rep, Round-robin, Redirect URL, Thank-you page, **Webhook** (sends the submission to your own endpoint).
- Publish produces a URL. Embed as Inline or Popup.
- **Form analytics:** views, completions, completion rate, per-rule breakdown, **meeting rate**, disqualified count.

**Availability rules** (Engage → Appointments → Availability): business hours, minimum notice, maximum lookahead, buffer, **daily and weekly booking caps per rep**, out-of-office (manual or synced from Google or Outlook).

**Confirmation emails:** sent via SES to the prospect with the host CC'd. They include the conferencing link, an .ics attachment and token-signed reschedule and cancel links. Reschedule and cancel emails go out automatically.

**Conferencing:** Google Meet (needs Google Calendar), Zoom (OAuth), Teams (Microsoft 365), or a custom URL.

**API:** the Feature Guide lists "Appointments Management" (event types, bookings, schedules, availability, routing forms, workflows, calendar integrations).

### A9. Connections (`/engage/connections/`)

**What it is.** graph8's event data pipeline: **Streams → Functions → Destinations**, connected by **Links**.

**Streams**
- Fields: name, allowed domains (CORS), **browser key** (public write key for the JS SDK), **server key** (private, server-side).
- A default "Website" stream is created automatically.
- Event types: `page`, `track`, `identify`, `group`, `form_submission`.

**Destinations**
- Types: Webhook (HTTP POST), Tag (injected JS), Warehouse (batch), Connector.
- Created by default:
  - Identify (tag; visitor→company resolution)
  - Chat (tag)
  - Form Tracker (tag)
  - **Campaign Visitor Trigger** (webhook)
  - Forms Sync (webhook)
  - **Tailor** (tag; website personalization)
  - Warehouse (optional)

**Functions:** custom JS to filter, enrich, transform or route events. Built-in functions exist for campaign visitor filtering and form processing.

**Links:** source, destination, functions, event filter, host filter. Sync-type links add a schedule, timezone and table prefix.

**Syncs:** bidirectional sync with external systems.
**Live Events:** a real-time event and payload debugger.

**Campaign tracking:** a campaign link carries a hash identifying the sequence step and contact. The tracking script captures the visit, the Campaign Visitor Trigger webhook fires, and graph8 links the visit to the contact and step automatically.

### A10. LinkedIn Publishing (`/engage/linkedin-publishing/`, in the product at Studio → Content → LinkedIn)

**What it is.** Organic LinkedIn posting plus capture of the people who engage as leads.

**Tabs:** Compose, Drafts, Scheduled (failed posts show the reason and a retry), Live, Queue slots, Analytics (impressions, reactions, comments, shares, per day and per post), Leads, Accounts.

**AI studio**
- *Write* mode is grounded on toggleable chips: brand voice, campaign brief, proof catalog, "what prospects actually ask in your inbox," recent content, top-performing posts.
- *Mine ideas* mode proposes ideas from:
  - Meeting and inbound-email themes
  - Trending posts on tracked keywords
  - Unused proof points
  - Content worth repurposing
- Ideas are graded for LinkedIn fit, "carry receipts back to their sources," and are shared with the content calendar Ideas feed.
- Generation always returns **3 variants** (e.g. story / contrarian / Q&A), each with a fold check. You can refine a variant.

**Post limits:** the fold is about 210 characters; posts cap at 3,000 characters. Media is images only for now; carousels and AI visuals are "coming."

**Scheduling:** "Publish now" still goes through the scheduler, so it takes up to about 30 seconds (Scheduled → Publishing → Live).

**Leads loop.** graph8 periodically reads reactors and commenters and matches them to the CDP by LinkedIn URL:
- **Known**: logged as an intent signal
- **New**: a contact can be created and added to an audience
- **Unresolved**: no usable URL

From the Leads tab you can add engagers to an audience or enroll them in a sequence in one click.

**Providers**
- **Unipile** (recommended; full features)
- Share on LinkedIn (official): coming soon
- Company Pages (official): pending LinkedIn approval

**Capacity:** a daily publishing budget per account, **shared with LinkedIn outreach steps on the same account**. Accounts show "Reconnect needed" when the session expires.

**Not built yet:** a calendar view, AI images and carousels, the two official providers.

### A11. HeyReach Campaign Overview (`/engage/heyreach-campaign-overview/`)

**What it is.** Each LinkedIn sequence step maps to a HeyReach campaign. Open it with **View Campaign** on the step card. The card shows "Campaign not created" if the sequence hasn't started or no LinkedIn account is connected.

**Lifecycle:** Not created, Scheduling, Active, Paused, Completed, Failed. When a sequence is paused or terminated, the HeyReach campaign pauses **within 5 minutes**.

**Overview tab**
- Lead counts: Total, In progress, Completed, **Exited** (replied, withdrawn, etc.)
- Engagement by action type:

| Action | Measured as |
|---|---|
| Connection | Accept rate = accepted ÷ sent |
| Message | Reply rate = replies ÷ sent |
| InMail | Reply rate = replies ÷ sent |
| Profile view, Like, Follow | Counts only |

There's a filter by action type.

**Leads tab** (paginated)
- Columns: Name, Title (at enrollment), Company, Status, **Action History**, **Reply Status**, Last Activity.
- Lead statuses: Queued, In Progress, Connection Pending, Connected, Messaged, Replied (stops if finish-on-reply is on), Rejected, Skipped.

**Caps (HeyReach)**
- 50 connection requests per day per account (LinkedIn's weekly limit is about 100)
- 50 messages per day
- InMails depend on plan (Sales Navigator: 50–150 per month)
- 300 profile views per day
- 100 likes per day
- When a cap is hit, the action pauses until the next day.

**Troubleshooting**
- Stuck in Scheduling: normal for the first 15 minutes; after an hour, check Settings → Integrations.
- Low accept rate: fix the profile photo and activity.
- A spike in rejected leads suggests targeting or AI Instructions quality.
- If the account is restricted, pause for 48 hours and lower the caps.

### A12. Work and Routines (`/engage/work/`, `/engage/work-routines/`)

**Work** (main navigation → Work) is a workspace for team and agent conversations. Views:
- **Inbox**: chat with teammates and agents (this is different from the Engage Inbox)
- **All Work**: units of agent work, including work still running
- **People**
- **Activity**: org-wide log
- **Routines**
- **Team HQ**: team performance and "moments"

Guidance from the docs:
- An agent may request **approval** before a consequential action; "A running task or an approval request is not a completed result."
- Artifacts may have versions or export.
- Fix access or connection errors before retrying consequential actions.

**Routines** (Work → Routines) run an instruction on selected days and deliver the result into a conversation. Required fields:
- Title
- Agent
- Instruction (expected result, context, action limits)
- At least one day of the week
- Time (24h HH:MM)
- Timezone
- "Deliver into" conversation

The docs warn: "A saved schedule does not prove that the agent completed its work."
**Relevance:** this is a built-in scheduler for recurring agent jobs that post results to a chat, which fits human-in-the-loop review.

---

## PART B — GETTING STARTED

**What is graph8** (`/getting-started/what-is-graph8/`). An "AI-powered revenue platform": a database of 200M+ contacts, enrichment, lists, sequences (email, phone, LinkedIn), AI campaigns, signals and pipeline, and AI agents. Setup takes 5–10 minutes and is mostly automated.

**Initial Setup** (`/getting-started/initial-setup/`)
1. Enter your domain. graph8 scans your site, products, competitors and audience.
2. **40+ intelligence documents** are generated in 3–5 minutes: Company Profile, Competitor Analysis, Market Overview, ICP Profiles, Buyer Personas (including **objections**), Messaging Frameworks (value props, pitches, email angles), Battle Cards. These power AI across the platform.
3. Home shows a Welcome card with two paths:
   - **Build a contact list**: prospecting with ICP-seeded filters, ending with a saved list ready for sequences. This is the recommended path.
   - **Create a campaign idea**: 5 campaign proposals; pick one and graph8 builds the documents.
   The card shows once; later logins land on a daily-briefing Home.
4. Review and edit the documents in **Studio → Global**, and add case studies or top emails. The AI uses all of Global Context.
5. Invite your team at Settings → Team → Invite. Roles: Admin, Manager, SDR. (The Feature Guide also mentions custom Roles.)

**Connect Website** (`/getting-started/connect-website/`)
- Settings → Website Tracking → copy the JS snippet (loads `https://cdn.graph8.com/tracking.js`, then `g8('init','YOUR_TRACKING_ID')`) → paste it into `<head>`.
- Install guides for GTM (Custom HTML tag on All Pages), WordPress and Next.js.
- A green "Connected" status confirms it; data can take up to about 10 minutes to appear.
- Captures real-time visitors, form submissions, page views and visitor identification.

**Connect Calendar** (`/getting-started/connect-calendar/`)
- Providers: Google, Microsoft (365 and Exchange), Apple iCloud. You can connect several.
- Settings → Calendar → Connect (OAuth). Choose which calendars to check for conflicts (busy times are aggregated) and a destination calendar.
- Availability: Settings → Calendar → Availability (hours per day, timezone, multiple schedules, buffers).
- **Event types** (Settings → Calendar → Event Types): title, duration, location, description, availability, buffer, booking window (e.g. 2–30 days), minimum notice (e.g. 4 hours). Each has a booking link.
- Merge tag **`{{booking_link}}`** inserts the default booking link into any email step. The booking is then logged to the contact's graph8 record.
- Team event types: **Round-robin** or **Collective**. People on PTO or fully booked are skipped.
- Privacy: reads free/busy only, creates events only in the destination calendar, never modifies or deletes existing events. Only "Busy" events block time.
- Calendars also feed the Meetings channel.

**Feature Guide** (`/getting-started/feature-guide/`). An index of every doc page. Useful pointers for the hackathon (details are in other notes):
- **Data:** Staging Workbench and **Workbench Pipelines** ("chain AI extraction, waterfall enrichment, formulas, and branching into reusable pipelines"), Import & Export, Managing Lists, Prospecting, Enrichment & Formulas, Suppressions, Custom objects.
- **Signals:** Buying Committees, Forms, Hiring Signals, Intent Tracking, Social Listener (X), Trends, Website Visitors.
- **Studio:** Campaigns ("ideation through document generation to launching into your outreach sequences"), Copilot, Skills, Global Context, Intelligence (scrape websites), Custom Records.
- **Agents:** Workflows ("chain skills, triggers, and actions"), Agents & Actions, Voice Agents, AI Lead Scoring, Sales Coach.
- **Analytics:** SDR Analytics ("execution health, outcomes, next-best actions, and your reply rate vs the team"), Marketing Intelligence (campaign attribution, pipeline impact), Dialer Analytics.
- **Developer Platform:**
  - **API Keys: Live & Test Mode** (`g8_live_` / `g8_test_` key prefixes)
  - **Sequence Lifecycle** ("Create, preview, update, archive, and read analytics for sequences")
  - Sequences ("List, run, pause, and resume")
  - **Launch Helpers** (pre-launch fields for launching campaigns and updating sequences)
  - GTM Campaigns (campaigns, documents, "sequence step catalogs")
  - GTM Context
  - Lists
  - Inbox API
  - Meetings API
  - **Webhooks**
  - Workflows
  - Skills
  - Search (global B2B database)
  - OpenSearch raw access
  - ClickHouse
  - Idempotency, Assert/Upsert
  - Agency Keys
  - MCP server and MCP tool reference
  - SDK `@graph8/sdk` (modules include sequences, campaigns, workflows, skills, voice, intent, studio)
  - `g8` CLI
  - Pricing and credits, Usage & Metering

**`getting-started.md`** (index) links to Quick Start, Account Setup, Training Programs and Troubleshooting. The Training index includes Growth Manager "Mission 5: Monitor and Optimize" (campaign dashboard, document health scores, sequence analytics).

**No g8_\* MCP tool names, endpoint paths or webhook event names appear in any of these 33 files.** They are only referenced through Feature Guide titles.

---

## PART C — MARKETPLACE

**What it is.** A two-sided talent marketplace. Clients hire vetted, AI-scored **SDRs, AEs and GTM Engineers** (the Role filter also lists **Campaign Manager**). Talent earn by booking meetings and closing deals.

**How it works**
- Talent are scored by AI from an uploaded resume. This produces **dimension scores**, a **certification score (0–100)** and a **tier**.
- New talent complete a **30-day (4-week) certification**. During certification they're commission-only and earn per booked meeting.
- After hire: monthly base plus a per-meeting rate, with an optional one-time hiring fee and commission.
- Payouts go through Stripe Connect (Express), Stripe Cross-Border or Wise, depending on country.
- The rate card is the talent's asking rate. The client sets the actual rates on each offer.

**Client side** (Marketplace icon in the top nav). Six tabs: Browse, My Talent, Meetings, Messages, Contracts, Statements.

- **Browse**
  - Search by name, bio, role, tools or industry.
  - Sort: Top rated (default), Most deals closed, Most meetings booked, Lowest or highest monthly rate, Newest, Lowest rated.
  - Views: Cards or Table.
  - Quick filters: Available now, Top tier, Has video intro, Americas, EMEA, APAC, Favorites.
  - Filter rail: Role, Quality (score range and tiers), Availability, Geography and country, Rates (monthly and per-meeting sliders), Experience (minimum meetings and deals, video, LinkedIn), Industries, Tools, Languages.
  - Saved searches (need at least 1 filter) and Favorites (star).
- **Profiles:** each card shows name (or role only, if anonymous), tier badge, **Match** (e.g. "78 match"), country and availability, $/month, $/meeting, Score N/100.
  - Tiers: Strategic, Data-Driven, Independent, Disciplined, Top Performer, Leadership-track, Senior, Solid, Transition.
  - The match radar groups dimensions into:
    - **Fit**: Industry, Tool, Persona, Deal Size, Motion
    - **Role strengths**: Prospecting Style, Meeting Quality, Cycle Length, Negotiation Complexity, Quota Band
    - **Edge**: Competitive Displacement
  - Match rolls these up against your business. Score is the overall rating.
- **Hiring:** the Hire dialog takes Monthly Base, Per Meeting Rate, One-Time Hiring Fee, Commission % ("Set by talent after meetings — 0 if not in the contract") and Start Date. Send Offer generates an **order form**.
  - Contract statuses: Pending Acceptance, Active, Terminated.
- **Managing:**
  - My Talent: **Manage list access** (which contact lists the talent can work) and Terminate (final prorated invoice; you can re-hire later).
  - Messages; Meetings (all meetings the talent booked).
  - Statements, with statuses Draft, Submitted, Approved, Rejected, Changes Requested, Expired. Actions: Approve & Pay, Request Changes, Reject, Pay Now.

**Talent side**
- **Join** at `app.graph8.com/marketplace/join`: first and last name, email, role (SDR, AE or GTM Engineer), country. Then confirm the profile and start certification.
  - An optional **Commission-Only Track** gives a dedicated target list and weekly payouts. Declining keeps the profile visible.
- **AI Twin** tab, with sub-tabs Profile Completion, Career, About Me and Voice.
  - Profile Completion is a weighted checklist; **"AI Ready" at ≥80%**. Items: title, company, LinkedIn import, short bio, voice and tone, ≥3 expertise areas, writing samples, photo, full bio, X connection.
  - LinkedIn import works through the desktop app or Chrome extension.
- **Listing** (Marketplace tab)
  - **Upload Resume (PDF)** triggers AI scoring and activates the listing.
  - Rate card: Monthly Base, Per Meeting, Availability (Available / Limited / Fully Booked / **Hidden**).
  - Edit Profile: headshot, tagline (140 characters), summary (1,200 characters), video intro, industries.
  - Delete by typing DELETE.
- **Offers:** client, order number, status (pending acceptance / active / rejected / terminated), rates, start date. Actions: View Order Form, Accept, Decline.
- **Meetings:** filter by client, status, date and search. Meeting statuses: Scheduled, Taken, Rescheduled, Missed, Cancelled. These feed earnings and statements.
- **Payouts and Invoices:** statements (engagement, period, amount, summary; same statuses as the client side). Payout history shows date, type (payout or chargeback), amount and status (pending, processing, paid, failed), plus a net balance.
- **Switching accounts:** user menu → Switch organization. A talent org shows Profile, AI Twin, Marketplace, Offers and Payouts; a client org shows Browse, My Talent, Contracts and Statements.

**Integration with the platform:** hired talent get access to a client's **contact lists** ("Manage list access") and book meetings, which appear on the client's Meetings tab. Talent AI Twins "write and act on your behalf in outreach."
[VAGUE] The docs don't say which Engage tools talent use (sequences, dialer) or how meetings are verified or attributed for billing.

---

## PART D — GOTCHAS AND CAVEATS (consolidated)

1. **LinkedIn caps conflict.** The Sequencer says 25 actions per day per account. HeyReach says 50 connections, 50 messages, 300 views and 100 likes per day. LinkedIn Publishing shares its budget with outreach steps on the same account.
2. **Warm-up ramp.** New mailboxes send **0 sequence emails for 2 weeks**. A demo or hackathon on a freshly connected mailbox won't send cold sequence emails unless the org's ramp is adjusted by graph8. Nurture's pinned mailbox skips the ramp (up to 500 per day).
3. Caps re-queue work silently to the next window. Throughput is (number of mailboxes × 15) per day.
4. **No true random A/B testing and no auto-optimization is documented.** "Winning branch" is a side-by-side view of condition-based branches. LinkedIn Publishing generates 3 variants, but for posts, not sequences.
5. **Reply classification is tag-based.** User-defined tags flagged AI-applicable, applied at confidence > 0.7. There's no fixed sentiment or intent taxonomy in these docs. Structured outcome taxonomies exist only for **calls**: dispositions and sub-sentiments.
6. Auto-respond is a per-mailbox toggle, and "AI" is tracked as the responder. Guardrails aren't documented.
7. Pausing or terminating a sequence pauses the HeyReach campaign **within 5 minutes**, so there can be lag.
8. HeyReach Scheduling can take up to 15 minutes.
9. Nurture Scheduling takes about 5 minutes; if it's still stuck after an hour, the list may be empty.
10. "Engage → Sequencer" and "Engage → Sequences" are both used. LinkedIn Publishing is documented under Engage but lives in Studio → Content. Inbox settings open "Studio Settings panes."
11. Unfinished items:
    - LinkedIn official providers (coming soon or pending approval)
    - LinkedIn carousels and AI images
    - Content calendar view
    - Menu views may differ from the docs (Work)
12. There's no documented "sandbox" or test-send mode in any Engage page. See the Hackathon section.
13. The 1-credit-per-transformation Inbox AI cost is the only credit cost in these pages. Enrichment, AI Instructions per send, call grading and similar costs aren't stated here.

---

## PART E — HACKATHON RELEVANCE

### E1. Source Scout (discover and evaluate external B2B data sources → acquire into lists → sequences)

**Where acquired data lands.** Contact lists are the enrollment unit for:
- Sequences ("select a contact list")
- Nurture (one or more lists, attribute filters, signal gates)
- Dialer sessions (a list)
- Marketplace talent (list access)

Lists sync via Audience Syncs, and the Wait for new contacts setting lets a live sequence or nurture **automatically absorb new list members**. That lets a Scout keep appending to a list feeding a running sequence (status Waiting → resumes). Live nurtures also support Add Contacts; new contacts start at step 1.

**Ingestion paths referenced here**
- Import & Export (CSV, CRM)
- Staging Workbench and **Workbench Pipelines** (AI extraction → waterfall enrichment → formulas → branching)
- Prospecting and Search of the 200M+ database
- OpenSearch and ClickHouse raw access
- Studio Intelligence ("scrape websites")
- Connections streams (`identify`, `track`, `form_submission` via browser or server keys; server-side ingestion is possible)
- Webhook destinations
- LinkedIn Publishing Leads (engagers → new contacts → audience or sequence)
- Signals (hiring, intent, social listener, trends, website visitors)
- Routing-form webhooks

**Evaluating a source.** Pre-launch validation and "Skipped" counts expose data-quality gaps:
- Missing email or phone
- Dedup
- Unmet conditions
- Dialer "No Phone" skips
- Bounced contact state
- Newsletter bounce and complaint suppression

A Scout could use per-source bounce rate, skip rate, connection rate (Dialer) and reply rate as source quality KPIs, **if** each source goes into its own list or sequence, or is tagged with a custom field.
Nothing in these docs attributes outcomes to a data source natively. You'd need a custom field per source plus step conditions or branches ("Custom field", "List membership"), or separate lists per source.

**Gating and personalization.** Step conditions such as "ICP score > 80" and "List membership," and signal-gated enrollment in Nurture, let acquired contacts be routed by quality. AI Instructions use contact data, Global Context and campaign docs, so richer source fields directly improve personalization.

**Automation hooks:** Studio campaign → launch into Sequencer; `{{booking_link}}`; Work Routines for scheduled agent runs (e.g. a nightly scout that posts findings to a conversation for approval). The Developer pages (Lists, Sequence Lifecycle, Launch Helpers, MCP, SDK) are the programmatic route; see the other notes.

**Compliance.** Cold sources must go to the **Sequencer**, not Nurture. Nurture is reserved for consented contacts, and the consent source is recorded per contact. Suppressions and complaints apply across modules.

### E2. Flywheel (analyze completed campaign outcomes → playbook V2 for human approval)

**Outcome data Engage demonstrably records**

- **Per sequence:**
  - Totals: contacts, active, completed, success rate [undefined]
  - Per-contact state (Replied, Bounced, Failed, Removed, Completed, Skipped)
  - Response rates over 24h, 48h and 7 days
  - Daily reply and bounce trends
  - Conversion funnel per step
- **Per step:**
  - Queued, in progress, completed, failed, bounced, replied, skipped
  - Sent, delivered, replied, bounced counts and rates
  - Nurture adds open and click rates per step
  - Email opens exist as condition inputs
  - Link clicks are attributed to **step + contact** via the campaign hash
- **Per branch** (the only "variant" concept): contacts per branch, reply rate, **meeting-booked rate**, winning-branch comparison. There's no random-split variant entity.
- **Per LinkedIn (HeyReach) step:**
  - Accept rate (connections)
  - Reply rate (messages and InMail)
  - Per-lead action history and reply status
  - Exited, Rejected and Skipped counts
- **Per call:**
  - Disposition with sub-sentiments, which are the richest structured objection data: Not interested, **Has solution** (competitor), Not ICP, Gatekeeper, Callback (has budget / interested / hesitant / not ready / wrong person), DNC, Left org, Wrong number
  - Optional sentiment and note
  - Transcript, AI summary, AI quality grade (score)
  - Session and campaign roll-ups
- **Per reply (email, chat, calls):**
  - AI-suggested **tags** from a user-defined taxonomy (e.g. interested / not interested / OOO), confidence > 0.7
  - Responder type: User, Other or AI
  - Inbox call-result view: booked, positive, neutral, negative, voicemail
  - To get objection categories for email replies, the team must **create AI-applicable tags** (e.g. "objection-price", "objection-timing", "has-competitor").
- **Per meeting:**
  - Classification (customer, prospect, internal)
  - Executive summary, key topics, **Campaign Mentions**, action items and tasks
  - Transcript, participants
  - Appointment events (created, rescheduled, canceled) with booking UID
  - Routing form meeting rate and per-rule breakdown
- **Per campaign (Studio link):** dialer calls, email and LinkedIn data aggregated in the campaign performance view. The Studio↔Sequencer link is kept "for end-to-end performance tracking." Newsletter campaigns get an AI "strategic assessment and readiness score" and a risk assessment.
- **Per issue (newsletter):** delivered, opened, clicked, bounced, unsubscribed, complained. Opens and clicks feed the lead-scoring engine.

**Is there existing automated learning or optimization? Essentially no, per these docs.**

The closest pieces:
1. **Lead scoring** takes newsletter engagement as a signal.
2. **AI Instructions** regenerate messages at send time from the latest data, but don't learn from outcomes.
3. **LinkedIn Publishing** grounds generation on "top-performing posts" and "what prospects actually ask in your inbox," and mines themes from meetings and inbound emails. This is the only place where outcome data feeds generation, and it's for posts only.
4. **Growth Manager Mission 5** ("Monitor and Optimize") is a manual human workflow.
5. **Winning branch** is a manual comparison.

Nothing documented automatically:
- Rewrites sequences from reply outcomes
- Picks A/B winners
- Clusters objections from email replies
- Produces a "V2 playbook"

**That gap is exactly the Flywheel's opening.**

**Suggested Flywheel inputs and outputs, grounded in the docs**

Pull from these sources:
- Sequence analytics (step performance, response rates, funnel, branch conversion)
- HeyReach per-action rates
- Inbox threads and tags (define objection and intent tags in advance)
- Dialer dispositions and transcripts and AI grades
- Meetings summaries, Campaign Mentions and action items
- Appointment bookings
- Buyer Persona objections and Battle Cards from Global Context (the baseline to compare against)

Output V2 as:
- Updated Studio campaign documents and Global Context edits (Studio → Global accepts user-added "top-performing emails")
- A new sequence built via Duplicate or sequence templates, with revised steps, conditions and branches

Deliver it for human approval through **Work → Routines** (agent runs on a schedule and posts into a conversation; the approval-request pattern is documented) or a Work conversation.

**Measurement caveat:** email open and click metrics aren't listed in Sequencer analytics, only in Nurture and Newsletter. Reply categorization for email depends entirely on tags.

### E3. Sandbox, test mode and sends

- **No Engage page documents a sandbox, dry-run or test-send mode for sequences, nurtures, the dialer or newsletters.**
- The only test-mode reference is the Feature Guide title "API Keys: Live & Test Mode — Mint live and test API keys with g8_live_/g8_test_ prefixes." Whether `g8_test_` keys suppress real sends isn't stated in these files; check the developer notes.
- The "Sequence Lifecycle" API mentions **preview**, which could act as a non-sending check.
- Practical safety levers documented in Engage:
  - Keep sequences in **Drafted** status. Pre-launch validation runs before launch.
  - Pause or Terminate. HeyReach follows within 5 minutes.
  - Pause individual contacts.
  - New mailboxes send 0 cold sequence emails for their first 2 weeks. This works as a natural "sandbox" but also blocks demos.
  - The Newsletter preflight blocks sends without a verified domain or confirmed subscribers.
  - LinkedIn "Publish now" still goes through the scheduler (about 30 seconds).
  - The Auto-respond toggle is per mailbox, so keep it **off** during testing, because AI Inbox is always on for healthy mailboxes.
  - Business-hours-only processing is available.
