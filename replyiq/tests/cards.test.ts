import { describe, expect, it } from "vitest";
import { buildQuery, CARD_PROMPT, generateCards, validateCard, wantsCard } from "../lib/pipeline/cards";
import type { SourceDoc } from "../lib/pipeline/retrieve";
import type { Category, Classified, Group } from "../lib/types";
import { type CardAnswer, fakeLlm, reply } from "./helpers";

const cl = (id: string, text: string, category: Category = "price_objection"): Classified => ({
  ...reply(id, text),
  category,
  confidence: 0.9,
  quote: text,
  needsReview: false,
});
const PRICE: Group = {
  key: "price_objection",
  label: "Price objection",
  replies: [cl("p1", "Per-seat pricing is too high for our 40 reps."), cl("p2", "We are locked into an annual contract until March.")],
  eligible: [],
  excluded: [],
  themes: [
    { id: "price_objection:per-seat", label: "Per-seat cost", description: "d", threadIds: ["p1"], quote: "Per-seat pricing is too high", quoteThreadId: "p1", quoteVerified: true },
    { id: "price_objection:contract", label: "Contract lock-in", description: "d", threadIds: ["p2"], quote: "locked into an annual contract", quoteThreadId: "p2", quoteVerified: true },
  ],
};
const DOCS: SourceDoc[] = [
  {
    id: "d-price",
    name: "Pricing Matrix",
    kind: "global",
    content: "# Pricing\n\n**Pricing Model:** Usage-based execution pricing with **unlimited users**. graph8 charges for work performed, not for seat access.\n\nThe plan is month-to-month with no contracts, so teams can start any time.",
  },
  { id: "d-proof", name: "Proof Catalog", kind: "global", content: "# Proof Catalog\n\n**Has Verified Case Studies:** False" },
];
const sent = [{ docId: "d-price", docName: "Pricing Matrix", kind: "global" as const, index: 0, text: DOCS[0].content }];

const answer = (over: Partial<CardAnswer> = {}): CardAnswer => ({
  summary: "Prospects say the cost does not fit.",
  quotes: ["Per-seat pricing is too high for our 40 reps."],
  proof: [
    // markdown in the doc (**unlimited users**) must not break verification
    { claim: "No per-seat pricing", doc_id: "d-price", excerpt: "Usage-based execution pricing with unlimited users. graph8 charges for work performed, not for seat access." },
  ],
  proof_gap: "No case study with an ROI number.",
  how_to_answer: "Explain usage-based pricing.",
  email_angle: "Pay for work, not seats.",
  theme_notes: [
    { theme_id: "price_objection:per-seat", how_to_answer: "Lead with unlimited users." },
    { theme_id: "price_objection:contract", how_to_answer: "Offer to start when the contract ends." },
  ],
  ...over,
});

describe("validateCard (grounding)", () => {
  it("keeps proof whose excerpt is verbatim in the full document, ignoring markdown", () => {
    const { card, warnings } = validateCard(PRICE, answer(), DOCS, sent);
    expect(warnings).toEqual([]);
    expect(card.proofWeHave).toHaveLength(1);
    expect(card.proofWeHave[0]).toMatchObject({ sourceDocId: "d-price", sourceDocName: "Pricing Matrix", verified: true });
    expect(card.unverifiedClaims).toEqual([]);
    expect(card.proofGap).toBe("No case study with an ROI number.");
    expect(card.themeNotes.map((n) => n.label)).toEqual(["Per-seat cost", "Contract lock-in"]);
    expect(card.sources).toEqual([{ docId: "d-price", name: "Pricing Matrix", kind: "global" }]);
  });

  it("moves an invented excerpt to the proof gap as unverified", () => {
    const { card, warnings } = validateCard(
      PRICE,
      answer({ proof: [{ claim: "Customers save 40%", doc_id: "d-price", excerpt: "Our customers save 40% on average compared to seat-based tools." }] }),
      DOCS,
      sent,
    );
    expect(card.proofWeHave).toEqual([]);
    expect(card.unverifiedClaims).toEqual(["Customers save 40%"]);
    expect(card.proofGap).toMatch(/No case study.*Unverified \(not found in the documents\): Customers save 40%/);
    expect(warnings.join()).toMatch(/excerpt not found/);
  });

  it("rejects a real excerpt attributed to the wrong document, or an unknown doc id", () => {
    const wrongDoc = validateCard(PRICE, answer({ proof: [{ claim: "c", doc_id: "d-proof", excerpt: "graph8 charges for work performed, not for seat access." }] }), DOCS, sent);
    expect(wrongDoc.card.proofWeHave).toEqual([]);
    const unknown = validateCard(PRICE, answer({ proof: [{ claim: "c", doc_id: "nope", excerpt: "graph8 charges for work performed, not for seat access." }] }), DOCS, sent);
    expect(unknown.warnings.join()).toMatch(/unknown doc id/);
  });

  it("rejects too-short excerpts and dedupes repeated ones", () => {
    const { card } = validateCard(
      PRICE,
      answer({
        proof: [
          { claim: "short", doc_id: "d-price", excerpt: "unlimited users" },
          { claim: "a", doc_id: "d-price", excerpt: "The plan is month-to-month with no contracts, so teams can start any time." },
          { claim: "b", doc_id: "d-price", excerpt: "The plan is month-to-month with no contracts, so teams can start any time." },
        ],
      }),
      DOCS,
      sent,
    );
    expect(card.proofWeHave.map((p) => p.claim)).toEqual(["a"]);
    expect(card.unverifiedClaims).toEqual(["short"]);
  });

  it("a card with no verified proof and no gap is forced to state the gap", () => {
    const { card } = validateCard(PRICE, answer({ proof: [], proof_gap: null }), DOCS, sent);
    expect(card.proofGap).toMatch(/No supporting proof/);
  });

  it("keeps only verbatim quotes; falls back to the classifier's verified quotes", () => {
    const ok = validateCard(PRICE, answer({ quotes: ["Per-seat pricing is too high", "They said it costs a fortune"] }), DOCS, sent);
    expect(ok.card.quotes).toEqual(["Per-seat pricing is too high"]);
    const none = validateCard(PRICE, answer({ quotes: ["totally invented words here"] }), DOCS, sent);
    expect(none.card.quotes).toEqual(["Per-seat pricing is too high for our 40 reps.", "We are locked into an annual contract until March."]);
  });

  it("drops theme notes for unknown themes and duplicates", () => {
    const { card } = validateCard(
      PRICE,
      answer({ theme_notes: [{ theme_id: "ghost", how_to_answer: "x" }, { theme_id: "price_objection:per-seat", how_to_answer: "a" }, { theme_id: "price_objection:per-seat", how_to_answer: "b" }] }),
      DOCS,
      sent,
    );
    expect(card.themeNotes).toEqual([{ themeId: "price_objection:per-seat", label: "Per-seat cost", howToAnswer: "a" }]);
  });
});

describe("generateCards", () => {
  const groups: Group[] = [
    PRICE,
    { key: "out_of_office", label: "Out of office", replies: [cl("o", "OOO", "out_of_office")], eligible: [], excluded: [] },
    { key: "unsubscribe", label: "Unsubscribe", replies: [cl("u", "remove me", "unsubscribe")], eligible: [], excluded: [] },
  ];

  it("only objection/interest groups get cards; docs are sent with ids; input not mutated", async () => {
    const { llm, cardRequests } = fakeLlm(() => [], { card: () => answer() });
    const res = await generateCards(groups, { llm, model: "m", docs: DOCS });
    expect(cardRequests).toHaveLength(1);
    expect(cardRequests[0].user).toContain('<doc id="d-price"');
    expect(cardRequests[0].user).toContain("price_objection:per-seat"); // themes passed
    expect(res.generated).toBe(1);
    expect(res.groups[0].card?.proofWeHave).toHaveLength(1);
    expect(res.groups[1].card).toBeUndefined();
    expect(res.groups[2].card).toBeUndefined();
    expect(PRICE.card).toBeUndefined();
  });

  it("a failed card is a warning, not a crash", async () => {
    const { llm } = fakeLlm(() => [], {
      card: () => {
        throw new Error("model down");
      },
    });
    const res = await generateCards(groups, { llm, model: "m", docs: DOCS });
    expect(res).toMatchObject({ generated: 0, failed: 1 });
    expect(res.warnings.join()).toMatch(/Answer Card failed/);
  });

  it("works with no documents at all (card relies on the proof gap)", async () => {
    const { llm } = fakeLlm(() => [], { card: () => answer({ proof: [], proof_gap: null }) });
    const res = await generateCards([PRICE], { llm, model: "m", docs: [] });
    expect(res.groups[0].card?.proofGap).toMatch(/No supporting proof/);
    expect(res.warnings.join()).toMatch(/no company documents/);
  });

  it("wantsCard / buildQuery / prompt basics", () => {
    expect(wantsCard(PRICE)).toBe(true);
    expect(wantsCard(groups[1])).toBe(false);
    expect(buildQuery(PRICE)).toMatch(/Per-seat cost/);
    expect(CARD_PROMPT).toMatch(/VERBATIM/);
    expect(CARD_PROMPT).toMatch(/Never invent/);
  });
});
