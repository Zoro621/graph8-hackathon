// LIVE: real OpenAI. Checks the classifier's judgement on the committed [DEMO] replies and on
// hand-written hard cases. Allowed sets reflect genuine ambiguity, not leniency.
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { getEnv } from "../../lib/env";
import { llm } from "../../lib/llm";
import { classifyReplies, norm } from "../../lib/pipeline/classify";
import type { Category, Classified, Reply } from "../../lib/types";

const convo = (...turns: [("us" | "prospect"), string][]) => turns.map(([from, text]) => ({ from, text }));
const mk = (id: string, replyText: string, conversation = convo(["us", "Quick intro to our data platform. Worth a look?"], ["prospect", replyText])): Reply => ({
  threadId: id,
  sequenceId: "live",
  contactEmail: `${id}@example.com`,
  replyText,
  conversation,
  existingTags: [],
});

const HARD: { reply: Reply; allowed: Category[]; check?: (c: Classified) => void }[] = [
  {
    reply: mk(
      "booked",
      "Except the time I picked wasn't 9 am. It was 1 pm EDT.",
      convo(
        ["us", "Would a quick chat help?"],
        ["prospect", "Sure, happy to talk."],
        ["us", "Here are some times: Tue 9am, 10am."],
        ["prospect", "Booked Tuesday via your link."],
        ["us", "Your meeting for Tuesday 9:00 AM is confirmed. Invite on its way."],
        ["prospect", "Except the time I picked wasn't 9 am. It was 1 pm EDT."],
      ),
    ),
    allowed: ["meeting_booked"],
  },
  {
    reply: mk("referral", "I have left Acme. Please reach out to Jane Doe, our new Head of Sales, going forward."),
    allowed: ["referral_wrong_person"],
    check: (c) => expect(c.referredName ?? "").toMatch(/Jane/),
  },
  {
    reply: mk("ooo", "I am out of the office until Monday, June 9 with limited access to email."),
    allowed: ["out_of_office"],
    check: (c) => expect(c.revisitHint ?? "").toMatch(/June|9/),
  },
  { reply: mk("unsub", "Please take me off your mailing list. Thanks."), allowed: ["unsubscribe"] },
  { reply: mk("competitor", "We just signed a two-year contract with ZoomInfo, so we're set."), allowed: ["competitor_locked_in"] },
  { reply: mk("price", "Looks interesting but it's way too expensive for a team our size."), allowed: ["price_objection"] },
  { reply: mk("timing", "Not a priority this quarter. Ping me again in January."), allowed: ["timing_not_now"] },
  { reply: mk("pricing", "What does this cost for 10 seats?"), allowed: ["pricing_request"] },
  { reply: mk("hardno", "Not interested. Please don't follow up."), allowed: ["hard_no", "unsubscribe"] },
  { reply: mk("bounce", "Delivery failed: the address you sent to does not exist."), allowed: ["other"] },
];

describe("LIVE classifier (OpenAI)", () => {
  let results: Map<string, Classified>;

  beforeAll(async () => {
    const env = getEnv();
    const demoFile = path.join(__dirname, "..", "fixtures", "demo", "replies.json");
    const demo: Reply[] = existsSync(demoFile) ? JSON.parse(readFileSync(demoFile, "utf8")) : [];
    const res = await classifyReplies([...HARD.map((h) => h.reply), ...demo], { llm: llm(), model: env.OPENAI_CLASSIFY_MODEL });
    results = new Map(res.classified.map((c) => [c.threadId, c]));
    expect(res.warnings).toEqual([]);
  });

  for (const h of HARD) {
    it(`hard case "${h.reply.threadId}" → ${h.allowed.join(" | ")}`, () => {
      const c = results.get(h.reply.threadId)!;
      expect(h.allowed, `got ${c.category}: ${c.reason}`).toContain(c.category);
      expect(norm(c.replyText)).toContain(norm(c.quote)); // quote is verbatim
      h.check?.(c);
    });
  }

  it("labels the 6 seeded [DEMO] reply types sensibly", () => {
    const demo = [...results.values()].filter((c) => c.sequenceId !== "live");
    if (demo.length === 0) return; // demo fixture not present
    const expectFor = (kw: RegExp, allowed: Category[]) => {
      const hits = demo.filter((c) => kw.test(c.replyText));
      expect(hits.length).toBeGreaterThan(0);
      for (const c of hits) expect(allowed, `"${c.replyText}" → ${c.category}`).toContain(c.category);
    };
    expectFor(/pricing/i, ["pricing_request"]);
    expectFor(/remove/i, ["unsubscribe"]);
    expectFor(/out of office/i, ["out_of_office"]);
    expectFor(/not interested/i, ["hard_no", "timing_not_now"]);
    expectFor(/demo.*agenda/i, ["interested_no_meeting", "meeting_request"]);
    expectFor(/schedule.*follow-up/i, ["meeting_request", "interested_no_meeting"]);
  });
});
