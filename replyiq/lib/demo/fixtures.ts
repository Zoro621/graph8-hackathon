// Demo fixtures shaped like the seeded graph8 sandbox (REPLYIQ-PLAN.md §0).
// Reply texts follow the 6 templated sandbox replies. Studio doc text is demo copy.
// The UI shows a "Demo data" badge whenever these are in use.
import type { AnswerCard, Category, SequenceStep, SequenceSummary } from "../types";
import type { StudioDoc } from "../grounding";

export const DEMO_ORG = "org_87325c23062e";

export const SEQUENCES: SequenceSummary[] = [
  {
    id: "90bda420-78bc-5634-9da0-51e4f46bdc4a",
    name: "[DEMO] Product introduction history",
    label: "OrbitDesk Demo Requests",
    status: "Completed",
    contactCount: 10,
    stepCount: 2,
    threads: 10,
    sequencerReplies: 5,
  },
  {
    id: "96118ffd-cde3-5a7c-b57a-3ea8a0a02296",
    name: "[DEMO] Follow-up outcome history",
    label: "MapleMetrics Trial Activation",
    status: "Completed",
    contactCount: 10,
    stepCount: 2,
    threads: 2,
    sequencerReplies: 2,
  },
];

export interface DemoThread {
  n: number;
  replyText: string;
  category: Category;
  confidence: number;
  quote: string;
  revisitHint?: string;
  suppressed?: boolean;
}

const t = (
  n: number,
  replyText: string,
  category: Category,
  confidence: number,
  quote: string,
  extra: Partial<DemoThread> = {},
): DemoThread => ({ n, replyText, category, confidence, quote, ...extra });

export const THREADS: Record<string, DemoThread[]> = {
  "90bda420-78bc-5634-9da0-51e4f46bdc4a": [
    t(1, "Interested in a demo, share the agenda.", "interested_no_meeting", 0.93, "Interested in a demo, share the agenda"),
    t(5, "Send pricing details.", "pricing_request", 0.95, "Send pricing details"),
    t(3, "Can we schedule a follow-up next week?", "meeting_request", 0.88, "schedule a follow-up next week", { revisitHint: "next week" }),
    t(9, "Please remove this contact.", "unsubscribe", 0.98, "Please remove this contact", { suppressed: true }),
    t(7, "Not interested at this time.", "hard_no", 0.72, "Not interested at this time"),
    t(2, "Interested in a demo, share the agenda.", "interested_no_meeting", 0.91, "Interested in a demo, share the agenda"),
    t(6, "Send pricing details.", "pricing_request", 0.94, "Send pricing details"),
    t(4, "Can we schedule a follow-up next week?", "meeting_request", 0.86, "schedule a follow-up next week", { revisitHint: "next week" }),
    t(10, "Please remove this contact.", "unsubscribe", 0.97, "Please remove this contact"),
    t(8, "Not interested at this time.", "hard_no", 0.7, "Not interested at this time"),
  ],
  "96118ffd-cde3-5a7c-b57a-3ea8a0a02296": [
    t(11, "Out of office until Monday. I will reply when I am back.", "out_of_office", 0.97, "Out of office until Monday", { revisitHint: "Monday" }),
    t(12, "Can we schedule a follow-up next week?", "meeting_request", 0.87, "schedule a follow-up next week", { revisitHint: "next week" }),
  ],
};

export const contactOf = (n: number) => {
  const nn = String(n).padStart(2, "0");
  return {
    contactId: 71000 + n,
    email: `demo.contact${nn}@example.com`,
    name: `Demo Contact ${nn}`,
    company: `Fictional Company ${n}`,
  };
};

export const V1_STEPS: Record<string, SequenceStep[]> = {
  "90bda420-78bc-5634-9da0-51e4f46bdc4a": [
    {
      day: 0,
      channel: "email",
      subject: "OrbitDesk for {{company}}?",
      body: "Hi {{first_name}}, teams like {{company}} use OrbitDesk to run outbound from one workspace. Worth a quick demo?",
    },
    {
      day: 3,
      channel: "email",
      subject: "Re: OrbitDesk for {{company}}?",
      body: "Bumping this in case it got buried. Happy to send a 2-minute overview instead.",
    },
  ],
  "96118ffd-cde3-5a7c-b57a-3ea8a0a02296": [
    {
      day: 0,
      channel: "email",
      subject: "Your MapleMetrics trial",
      body: "Hi {{first_name}}, you started a trial last week. Want a 15-minute setup call?",
    },
    {
      day: 4,
      channel: "email",
      subject: "Re: Your MapleMetrics trial",
      body: "Most teams activate in one session. Here is a link if you want to grab time.",
    },
  ],
};

export const STUDIO_DOCS: StudioDoc[] = [
  {
    id: "gdoc_proof_catalog",
    displayName: "Proof Catalog",
    content:
      "Proof points. One buyer graph connects your CRM, data, signals, content and outreach in a single workspace. Enrichment runs on a waterfall of 15+ providers and you only pay for the provider that returns a result. Studio turns your website into brand DNA documents that ground every AI output. Built on ten years of outbound campaigns run by CIENCE for B2B teams.",
  },
  {
    id: "gdoc_pricing_matrix",
    displayName: "Pricing Matrix",
    content:
      "Plans. The Team plan is $99 per month and includes 10,000 credits for the whole team. The Platform plan is $499 per month for teams that run agents and multi-channel sequences. Pricing is based on execution credits, not seats, so adding teammates never raises the bill. Pay as you go credits cost $0.05 each.",
  },
  {
    id: "gdoc_value_props",
    displayName: "Value Propositions",
    content:
      "Replace five point tools with one autonomous revenue system. Launch a researched, multi-step campaign in an afternoon instead of a week. Every AI output is grounded in your own Studio documents, so messaging stays on brand.",
  },
  {
    id: "gdoc_messaging_house",
    displayName: "Messaging House",
    content:
      "Umbrella: the autonomous revenue system. Pillar one: one buyer graph for every team. Pillar two: agents that perceive, decide and act, with a human approving what matters. Pillar three: pay for execution, not seats.",
  },
];

/** Raw model output before the grounding check. One claim per card is deliberately ungrounded. */
export const RAW_CARDS: Partial<Record<Category, AnswerCard>> = {
  pricing_request: {
    summary: "They want numbers before they give time: the price, and whether it pays back.",
    quotes: ["Send pricing details", "Send pricing details"],
    proofWeHave: [
      {
        claim: "A clear entry price the whole team can use",
        sourceDocId: "gdoc_pricing_matrix",
        sourceDocName: "Pricing Matrix",
        excerpt: "The Team plan is $99 per month and includes 10,000 credits for the whole team.",
        verified: false,
      },
      {
        claim: "The bill does not grow with headcount",
        sourceDocId: "gdoc_pricing_matrix",
        sourceDocName: "Pricing Matrix",
        excerpt: "Pricing is based on execution credits, not seats, so adding teammates never raises the bill.",
        verified: false,
      },
      {
        claim: "Enrichment spend only lands on hits",
        sourceDocId: "gdoc_proof_catalog",
        sourceDocName: "Proof Catalog",
        excerpt: "you only pay for the provider that returns a result",
        verified: false,
      },
      {
        claim: "Customers triple their reply rate in 30 days",
        sourceDocId: "gdoc_proof_catalog",
        sourceDocName: "Proof Catalog",
        excerpt: "customers triple their reply rates within 30 days of switching",
        verified: false,
      },
    ],
    proofGap: "No ROI case study for mid-market teams (50–500 employees).",
    howToAnswer:
      "Lead with the Team plan price in the first line, then explain credits vs seats in one sentence. Offer a 20-minute call that walks through their own expected credit use rather than a generic demo.",
    emailAngle: "Straight answer on price, then a payback estimate built from their own volume.",
  },
  interested_no_meeting: {
    summary: "Warm, but they won't book until they know what the demo covers.",
    quotes: ["Interested in a demo, share the agenda", "Interested in a demo, share the agenda"],
    proofWeHave: [
      {
        claim: "One workspace for the whole outbound motion",
        sourceDocId: "gdoc_proof_catalog",
        sourceDocName: "Proof Catalog",
        excerpt: "One buyer graph connects your CRM, data, signals, content and outreach in a single workspace.",
        verified: false,
      },
      {
        claim: "Campaigns in an afternoon, not a week",
        sourceDocId: "gdoc_value_props",
        sourceDocName: "Value Propositions",
        excerpt: "Launch a researched, multi-step campaign in an afternoon instead of a week.",
        verified: false,
      },
    ],
    proofGap: "No standard demo agenda exists in Studio. Add a 30-minute agenda to the Messaging House.",
    howToAnswer:
      "Reply with a three-point agenda tied to their outbound setup, the time it takes, and one booking link. Keep it under 80 words.",
    emailAngle: "Here is exactly what we'll cover in 30 minutes. Pick a slot.",
  },
};

/** V2 steps the draft campaign proposes, per follow-up group. */
export const V2_STEPS: Partial<Record<Category, SequenceStep[]>> = {
  pricing_request: [
    {
      day: 0,
      channel: "email",
      subject: "Pricing for {{company}}, straight answer",
      body: "Hi {{first_name}}, you asked for pricing. The Team plan is $99/month with 10,000 credits shared by the whole team, and you pay for execution, not seats.",
    },
    {
      day: 2,
      channel: "email",
      subject: "What {{company}} would actually spend",
      body: "Send me your monthly send volume and I'll map it to credits so you see the real number, not a range.",
    },
    {
      day: 5,
      channel: "email",
      subject: "20 minutes on payback?",
      body: "If it helps, I can walk through expected credit use on a short call. Here's my calendar.",
    },
  ],
  interested_no_meeting: [
    {
      day: 0,
      channel: "email",
      subject: "The agenda you asked for",
      body: "Hi {{first_name}}: 1) your current outbound stack, 2) one campaign built live from your site, 3) what it would cost. 30 minutes. Pick a slot below.",
    },
    {
      day: 3,
      channel: "email",
      subject: "Two slots held for {{company}}",
      body: "I've held Tuesday 11:00 and Thursday 15:00. Either works?",
    },
  ],
  meeting_request: [
    {
      day: 0,
      channel: "email",
      subject: "Next week works. Here are times",
      body: "Hi {{first_name}}, happy to. Here's my calendar for next week, or reply with a time and I'll send the invite.",
    },
  ],
};

export const CAMPAIGN_DOCS = [
  "Campaign Brief",
  "Targeting & Routing",
  "Messaging & Objections",
  "Email Copy",
  "LinkedIn Copy",
  "Phone Script",
  "Voicemail Script",
  "QA Rubric",
  "Snippets",
  "Reply Templates",
  "Cadence Calendar",
  "Performance Tracker",
  "Battlecard",
  "Meeting Prep",
  "Handoff",
  "Social Copy",
  "Voice-AI Script",
];
