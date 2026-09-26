// LIVE: real OpenAI theme discovery. A synthetic group with two obvious sub-patterns must be split
// along them, with every reply in exactly one theme and verbatim quotes.
import { describe, expect, it } from "vitest";
import { getEnv } from "../../lib/env";
import { llm } from "../../lib/llm";
import { discoverThemes } from "../../lib/pipeline/themes";
import { norm } from "../../lib/text";
import type { Classified, Group } from "../../lib/types";

const mk = (id: string, text: string): Classified => ({
  threadId: id,
  sequenceId: "live",
  contactEmail: `${id}@example.com`,
  replyText: text,
  conversation: [{ from: "prospect", text }],
  existingTags: [],
  category: "price_objection",
  confidence: 0.95,
  quote: text,
  needsReview: false,
});

const SEAT = ["seat1", "seat2", "seat3"];
const CONTRACT = ["contract1", "contract2", "contract3"];
const REPLIES = [
  mk("seat1", "Honestly the per-seat price is way too high for a 40-person sales team."),
  mk("contract1", "We're locked into an annual contract with our current provider until next March."),
  mk("seat2", "Paying per user doesn't work for us, our headcount changes every month."),
  mk("contract2", "Our contract with ZoomInfo auto-renews in Q2, so we can't switch before then."),
  mk("seat3", "At that price per seat we'd be paying double what we pay today."),
  mk("contract3", "We just signed a two-year agreement with another vendor, so the timing is bad."),
];

describe("LIVE themes (OpenAI)", () => {
  it("splits a price-objection group into per-seat vs contract lock-in", async () => {
    const env = getEnv();
    const group: Group = { key: "price_objection", label: "Price objection", replies: REPLIES, eligible: [], excluded: [] };
    const res = await discoverThemes([group], { llm: llm(), model: env.OPENAI_REASON_MODEL });
    const themes = res.groups[0].themes;
    expect(themes, res.warnings.join("\n")).toBeDefined();

    // every reply in exactly one theme
    const all = themes!.flatMap((t) => t.threadIds);
    expect(new Set(all).size).toBe(REPLIES.length);
    expect(all).toHaveLength(REPLIES.length);

    // The two patterns are never mixed. The model may split per-seat further (e.g. "headcount changes
    // monthly" as its own theme): that is a legitimate finer split, so only require separation.
    const themeOf = (id: string) => themes!.find((t) => t.threadIds.includes(id))!.id;
    const seatThemes = new Set(SEAT.map(themeOf));
    const contractThemes = new Set(CONTRACT.map(themeOf));
    const dump = JSON.stringify(themes!.map((t) => [t.label, t.threadIds]));
    for (const id of seatThemes) expect(contractThemes.has(id), dump).toBe(false);
    expect(contractThemes.size, dump).toBeLessThanOrEqual(2);
    expect(themes!.length, dump).toBeGreaterThanOrEqual(2);

    // quotes are verbatim from a member
    for (const t of themes!) {
      expect(t.quoteVerified, `${t.label}: "${t.quote}"`).toBe(true);
      const src = REPLIES.find((r) => r.threadId === t.quoteThreadId)!;
      expect(t.threadIds).toContain(src.threadId);
      expect(norm(src.replyText)).toContain(norm(t.quote));
    }
    // themeId set on each reply
    for (const r of res.groups[0].replies) expect(r.themeId).toBe(themeOf(r.threadId));
  });
});
