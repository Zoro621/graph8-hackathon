import { describe, expect, it } from "vitest";
import type { CallResult, SequenceReport } from "../lib/g8";
import type { Llm, LlmRequest } from "../lib/llm";
import { callStops, evidenceLines, loadChannels, type ChannelsClient } from "../lib/pipeline/channels";
import { resolveContacts } from "../lib/pipeline/resolveContacts";
import { planStrategy, strategySection } from "../lib/pipeline/strategy";
import { emptyRun } from "../lib/pipeline/runPipeline";
import type { Classified, Group, Run } from "../lib/types";
import { reply } from "./helpers";

const cl = (id: string, contactId: number, category: Classified["category"] = "pricing_request"): Classified => ({
  ...reply(id, `reply ${id}`, { contactId, contactEmail: `${id}@example.com`, company: "Acme" }),
  category,
  confidence: 0.9,
  quote: `reply ${id}`,
  needsReview: false,
});

function makeRun(): Run {
  const run = emptyRun("abcdefghijkl", { sequenceId: "seqA" }, new Date("2026-09-27T10:00:00Z"));
  run.source = { ...run.source, name: "Demo", sequences: [{ id: "seqA", name: "[DEMO] Seq A", status: "completed" }] };
  run.counts = { threads: 3, prospectReplies: 3, needsReview: 0 };
  run.groups = [
    { key: "pricing_request", label: "Pricing request", replies: [cl("a", 1), cl("b", 2)], eligible: [], excluded: [] },
    { key: "hard_no", label: "Hard no", replies: [cl("c", 3, "hard_no")], eligible: [], excluded: [] },
  ];
  return run;
}

const calls: CallResult[] = [
  { contact_id: 1, disposition: "voicemail", summary: "[SYNTHETIC] Practice call history. No call was placed.", call_start_date: "2026-09-20T10:00:00Z" },
  { contact_id: 1, disposition: "not_interested", summary: "Said they renewed with their current vendor last month.", call_start_date: "2026-09-10T10:00:00Z" },
  { contact_id: 2, disposition: "booked", summary: "Booked a demo for Tuesday.", call_start_date: "2026-09-21T10:00:00Z" },
  { contact_id: 99, disposition: "dnc", summary: "", call_start_date: "2026-09-21T10:00:00Z" }, // not in this run
];

function fakeOrg(over: Partial<ChannelsClient> = {}): ChannelsClient {
  return {
    getSequenceReport: async (): Promise<SequenceReport> => ({
      overview: { total_contacts: 7531, reply_rate: 0.3, meetings_booked: 0 },
      step_breakdown: [
        { step_order: 1, status_counts: { completed: 2136, replied: 19, bounced: 4, unsubscribed: 1 } },
        { step_order: 2, status_counts: { completed: 300, replied: 2 } },
      ],
    }),
    searchCallResults: async (q = {}) => calls.filter((c) => !q.dispositions || q.dispositions.includes(c.disposition ?? "")).slice(((q.page ?? 1) - 1) * 100, (q.page ?? 1) * 100),
    listMeetings: async () => [{ id: 1, analysis: { objections: ["Too expensive for a team of five", "Too expensive for a team of five"] } }],
    listBookings: async () => [{ uid: "b1", sequence_id: "seqA", attendees: [{ email: "x@example.com", no_show: true }] }, { uid: "b2", sequence_id: "other" }],
    countNewsletters: async () => 0,
    countNurtures: async () => {
      throw new Error("502 bad gateway");
    },
    ...over,
  };
}

describe("loadChannels (graph8's other Engage channels, read-only)", () => {
  it("reads the sequence funnel, each replying contact's latest call, meetings and bookings; a failing channel is marked, not fatal", async () => {
    const ev = await loadChannels(fakeOrg(), makeRun());
    expect(ev.sequencer).toEqual([{ sequenceId: "seqA", name: "[DEMO] Seq A", contacts: 7531, reached: 2155, replied: 21, bounced: 4, unsubscribed: 1, meetingsBooked: 0, replyRate: 0.3 }]);
    // latest outcome per contact of THIS run; seeded practice calls carry no summary
    expect(ev.calls.contacts).toEqual([
      { contactId: 2, disposition: "booked", summary: "Booked a demo for Tuesday.", at: "2026-09-21T10:00:00Z" },
      { contactId: 1, disposition: "voicemail", at: "2026-09-20T10:00:00Z" },
    ]);
    expect(ev.calls.outcomes).toEqual({ booked: 1, voicemail: 1 });
    // an earlier "not interested" still wins, even though a later call went to voicemail
    expect(ev.calls.saidNo).toEqual([1]);
    expect(ev.calls.booked).toEqual([2]);
    expect(ev.meetings).toEqual({ status: "ok", total: 1, objections: ["Too expensive for a team of five"] });
    expect(ev.bookings).toEqual({ status: "ok", total: 2, fromSource: 1, noShows: 1 });
    expect(ev.newsletters.status).toBe("none");
    expect(ev.nurtures.status).toBe("unavailable");
    expect(ev.errors.join()).toMatch(/nurtures: .*502/);
  });

  it("callStops re-reads only hard-stop and booked calls, for the contacts asked about", async () => {
    const asked: (string[] | undefined)[] = [];
    const org = fakeOrg();
    const spy = { searchCallResults: async (q: { dispositions?: string[] } = {}) => (asked.push(q.dispositions), org.searchCallResults(q)) };
    const stops = await callStops(spy, [1, 2, 3]);
    expect([...stops.saidNo]).toEqual([1]);
    expect([...stops.booked]).toEqual([2]);
    expect(asked[0]).toEqual(["not_interested", "dnc", "booked"]);
  });

  it("a 'no' on a call is a hard stop in resolveContacts, after a 'no' in the inbox", async () => {
    const run = makeRun();
    const client = { findContactByEmail: async () => null, getSuppression: async (id: number) => ({ contact_id: id, is_suppressed: false, active_channels: [], suppressions: [] }) };
    const res = await resolveContacts(client, run.groups, { callStops: { saidNo: [1, 3], booked: [2] } });
    const pricing = res.groups.find((g) => g.key === "pricing_request")!;
    expect(pricing.eligible).toEqual([]);
    expect(pricing.excluded.map((x) => [x.contactId, x.reason])).toEqual([
      [1, "said_no_on_call"],
      [2, "booked_on_call"],
    ]);
    expect(res.groups.find((g) => g.key === "hard_no")!.excluded[0].reason).toBe("hard_no"); // the inbox "no" is named first
  });

  it("evidence lines carry the real numbers and the group's own call outcomes", async () => {
    const run = makeRun();
    run.channels = await loadChannels(fakeOrg(), run);
    const lines = evidenceLines(run, run.channels, "pricing_request");
    expect(lines[0]).toBe('Sequencer "[DEMO] Seq A": 7531 contacts, 2155 reached by step 1, 21 replied (1% of those reached), 4 bounced, 1 unsubscribed, 0 meetings booked.');
    expect(lines.join("\n")).toContain("Dialer, this group: 2 of 2 were called; outcomes: booked, voicemail.");
    expect(lines.join("\n")).toContain('Call summary (booked): "Booked a demo for Tuesday."');
    expect(lines.join("\n")).toContain("Recorded meetings raised these objections: Too expensive for a team of five.");
  });
});

describe("planStrategy (revised plan across channels)", () => {
  const group = (): Group => ({
    key: "pricing_request",
    label: "Pricing request",
    replies: [cl("a", 1), cl("b", 2)],
    eligible: [{ contactId: 1, email: "a@example.com", threadId: "a" }],
    excluded: [],
  });
  const facts = [{ claim: "Team plan price", excerpt: "The Team Plan is $99/month for unlimited users.", source: "Pricing Matrix" }];

  /** `unsupported`: the audit's findings, the same every time, or one list per audit call in order. */
  function llm(answer: unknown, unsupported: { sentence: string; reason: string }[] | { sentence: string; reason: string }[][] = []) {
    const calls: LlmRequest<unknown>[] = [];
    let audits = 0;
    const findings = () => (Array.isArray(unsupported[0]) ? ((unsupported as { sentence: string; reason: string }[][])[audits++] ?? []) : unsupported);
    const fake: Llm = {
      async parse<T>(req: LlmRequest<T>) {
        calls.push(req as LlmRequest<unknown>);
        const data = req.name === "email_audit" ? { unsupported: findings() } : answer;
        return { data: req.schema.parse(data), usage: { inputTokens: 1, outputTokens: 1 } };
      },
    } as Llm;
    return { fake, calls };
  }
  const answer = (over: Record<string, unknown> = {}) => ({
    diagnosis: ["Step 1 reached 2155 people but only 21 replied.", "Most asked for a 40% discount."],
    angle: "Lead with the published price.",
    targeting: { focus: "Contacts who asked for pricing twice.", avoid: "Anyone who said no on a call." },
    plan: [
      { day: 0, channel: "email", goal: "Send the price" },
      { day: 2, channel: "call", goal: "Walk through the plan" },
      { day: 9, channel: "email", goal: "moved email step" },
    ],
    call_script: {
      opener: "Hi {{first_name}}, you asked about pricing for {{company}}.",
      questions: ["How many seats do you need?"],
      objections: [{ objection: "Too expensive", answer: "The Team Plan is $99/month for unlimited users." }],
      close: "Can I send a short summary?",
      voicemail: "Hi {{first_name}}, calling about the pricing you asked for. I will follow up by email.",
    },
    ...over,
  });

  it("keeps only numbers from the evidence, pins the email steps, and fact-checks the call script", async () => {
    const run = makeRun();
    run.channels = await loadChannels(fakeOrg(), run);
    const { fake, calls } = llm(answer());
    const s = await planStrategy({ llm: fake, model: "m" }, run, group(), facts, ["No cost estimator."]);
    expect(s.diagnosis).toEqual(["Step 1 reached 2155 people but only 21 replied."]); // "40%" is in no evidence line: dropped
    expect(s.check.issues.join()).toMatch(/diagnosis line dropped/);
    expect(s.plan.map((p) => `${p.day}:${p.channel}`)).toEqual(["0:email", "2:call", "4:email"]); // the sequence's own email days
    expect(s.check.audited).toBe(true);
    const user = JSON.parse(calls[0].user);
    expect(user.EVIDENCE[0]).toMatch(/^Sequencer "\[DEMO\] Seq A": 7531 contacts/);
    expect(strategySection(s)).toContain("**Call script (fact-checked):**");
  });

  it("a call script that keeps failing the fact-check is shown with its issues but never written into Studio", async () => {
    const run = makeRun();
    const { fake, calls } = llm(answer(), [{ sentence: "The Team Plan is cheapest", reason: "not in FACTS" }]);
    const s = await planStrategy({ llm: fake, model: "m" }, run, group(), facts, []);
    expect(calls.filter((c) => c.name === "followup_strategy")).toHaveLength(2); // one rewrite with the problems
    expect(JSON.parse(calls.filter((c) => c.name === "followup_strategy")[1].user).CALL_SCRIPT_FAILED_FACT_CHECK[0]).toMatch(/The Team Plan is cheapest/);
    expect(s.check.ok).toBe(false);
    expect(s.callScript?.opener).toBeDefined();
    expect(strategySection(s)).not.toContain("Call script");
  });

  it("the rewrite is used when it passes", async () => {
    const { fake } = llm(answer(), [[{ sentence: "The Team Plan is cheapest", reason: "not in FACTS" }], []]);
    const s = await planStrategy({ llm: fake, model: "m" }, makeRun(), group(), facts, []);
    expect(s.check).toMatchObject({ ok: true, audited: true });
    expect(strategySection(s)).toContain("**Call script (fact-checked):**");
  });

  it("no call step, no script", async () => {
    const { fake } = llm(answer({ plan: [{ day: 0, channel: "email", goal: "Send the price" }] }));
    const s = await planStrategy({ llm: fake, model: "m" }, makeRun(), group(), facts, []);
    expect(s.callScript).toBeUndefined();
    expect(s.plan.every((p) => p.channel === "email")).toBe(true);
  });
});
