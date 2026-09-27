// LIVE: real OpenAI + the org's real Studio documents (and the top campaign's own docs, found at
// runtime). Every proof excerpt is re-verified independently against the document text.
import { beforeAll, describe, expect, it } from "vitest";
import { getEnv } from "../../lib/env";
import { g8 } from "../../lib/g8";
import { llm } from "../../lib/llm";
import { generateCards } from "../../lib/pipeline/cards";
import type { SourceDoc } from "../../lib/pipeline/retrieve";
import { discoverSources, pickDefaultSource, resolveSource } from "../../lib/pipeline/sources";
import { norm, normLoose, wordCount } from "../../lib/text";
import type { Category, Classified, Group } from "../../lib/types";

const cl = (id: string, text: string, category: Category): Classified => ({
  threadId: id,
  sequenceId: "live",
  contactEmail: `${id}@example.com`,
  replyText: text,
  conversation: [{ from: "prospect", text }],
  existingTags: [],
  category,
  confidence: 0.95,
  quote: text,
  needsReview: false,
});

let docs: SourceDoc[] = [];
beforeAll(async () => {
  const client = g8();
  const global = await client.listGlobalDocs();
  docs = global.filter((d) => d.content).map((d) => ({ id: d.id, name: d.displayName, kind: "global" as const, content: d.content }));
  const sel = pickDefaultSource(await discoverSources(client));
  if (sel) {
    const ctx = await resolveSource(client, sel);
    for (const d of Object.values(ctx.docs)) if (d) docs.push({ id: d.id, name: `Campaign: ${d.name}`, kind: "campaign", content: d.content });
  }
});

const PRICE: Group = {
  key: "price_objection",
  label: "Price objection",
  eligible: [],
  excluded: [],
  replies: [
    cl("seat1", "Honestly the per-seat price is way too high for a 40-person sales team.", "price_objection"),
    cl("seat2", "Paying per user doesn't work for us, our headcount changes every month.", "price_objection"),
    cl("contract1", "We're locked into an annual contract with our current provider until next March.", "price_objection"),
  ],
  themes: [
    { id: "price_objection:per-seat", label: "Per-seat cost too high", description: "Seat-based pricing is the blocker.", threadIds: ["seat1", "seat2"], quote: "the per-seat price is way too high", quoteThreadId: "seat1", quoteVerified: true },
    { id: "price_objection:contract", label: "Locked into a contract", description: "Tied to a current vendor contract.", threadIds: ["contract1"], quote: "locked into an annual contract", quoteThreadId: "contract1", quoteVerified: true },
  ],
};
const COMPETITOR: Group = {
  key: "competitor_locked_in",
  label: "Competitor",
  eligible: [],
  excluded: [],
  replies: [
    cl("c1", "We already use ZoomInfo for contact data and Outreach for sequences.", "competitor_locked_in"),
    cl("c2", "Apollo covers everything we need right now, thanks.", "competitor_locked_in"),
  ],
};

function assertGrounded(g: Group) {
  const card = g.card!;
  expect(card, "no card generated").toBeDefined();
  expect(card.summary.length).toBeGreaterThan(10);
  expect(card.howToAnswer.length).toBeGreaterThan(20);
  expect(card.emailAngle.length).toBeGreaterThan(10);
  // quotes verbatim from the group's replies
  for (const q of card.quotes) expect(g.replies.some((r) => norm(r.replyText).includes(norm(q))), q).toBe(true);
  // every proof item re-verified against the real document text
  for (const p of card.proofWeHave) {
    const doc = docs.find((d) => d.id === p.sourceDocId)!;
    expect(doc, `unknown doc ${p.sourceDocId}`).toBeDefined();
    expect(wordCount(p.excerpt)).toBeGreaterThanOrEqual(6);
    expect(normLoose(doc.content), `"${p.excerpt}" not in ${doc.name}`).toContain(normLoose(p.excerpt));
  }
  // either real proof, or an explicit gap
  expect(card.proofWeHave.length > 0 || Boolean(card.proofGap)).toBe(true);
}

describe("LIVE Answer Cards (OpenAI + real Studio docs)", () => {
  it("builds grounded cards for a price objection (with themes) and a competitor group", async () => {
    expect(docs.length).toBeGreaterThan(0);
    const env = getEnv();
    const res = await generateCards([PRICE, COMPETITOR], { llm: llm(), model: env.OPENAI_REASON_MODEL, docs });
    expect(res.failed, res.warnings.join("\n")).toBe(0);
    const [price, competitor] = res.groups;
    assertGrounded(price);
    assertGrounded(competitor);
    // price: usage-based pricing is well documented, so there must be verified proof
    expect(price.card!.proofWeHave.length).toBeGreaterThan(0);
    // each theme got its own note
    expect(price.card!.themeNotes.map((n) => n.themeId).sort()).toEqual(["price_objection:contract", "price_objection:per-seat"]);
    // the org's Proof Catalog says there are no verified case studies: a gap must be named
    expect(price.card!.proofGap ?? "").not.toBe("");
  });
});
