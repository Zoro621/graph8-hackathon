import { describe, expect, it } from "vitest";
import { chunkDoc, retrieve, tokenize, type SourceDoc } from "../lib/pipeline/retrieve";
import { normLoose } from "../lib/text";

const doc = (id: string, name: string, content: string, kind: SourceDoc["kind"] = "global"): SourceDoc => ({ id, name, kind, content });

const PRICING = doc(
  "d-price",
  "Pricing Matrix",
  "# Pricing Matrix\n\n**Pricing Model:** Usage-based execution pricing with unlimited users.\n\n## Team Plan\n\nThe Team Plan is $99/month for the whole organization with 10,000 execution credits included.\n\n## Enterprise\n\nEnterprise pricing is custom and agreed in contract terms.",
);
const PROOF = doc(
  "d-proof",
  "Proof Catalog",
  "# Proof Catalog\n\n**Has Verified Case Studies:** False\n\n## Statistics\n\n700M+ verified B2B contacts in the buyer graph.",
);
const STYLE = doc("d-style", "Writing Style Guide", "# Style\n\nUse short sentences. Avoid jargon. Prefer active voice in every email and landing page.");

describe("retrieve", () => {
  it("ranks the passage that answers the query first", () => {
    const got = retrieve([STYLE, PRICING, PROOF], "how much does the team plan cost per month, pricing for our team");
    expect(got.find((p) => p.docId === "d-price")?.text).toMatch(/\$99\/month/);
    expect(got.some((p) => p.docId === "d-style")).toBe(false); // irrelevant doc not retrieved
  });

  it("always includes the opening passage of proof-like documents", () => {
    const got = retrieve([STYLE, PRICING, PROOF], "team plan price");
    expect(got.some((p) => p.docId === "d-proof" && p.index === 0)).toBe(true);
  });

  it("respects the budget and the per-document cap", () => {
    const big = doc("d-big", "Pricing Notes", Array.from({ length: 60 }, (_, i) => `Pricing paragraph ${i} about seat cost and pricing tiers for teams.`).join("\n\n"));
    const got = retrieve([big], "pricing seat cost tiers", { budgetChars: 3_000, perDocCap: 3 });
    expect(got.length).toBeLessThanOrEqual(3);
    expect(got.reduce((n, p) => n + p.text.length, 0)).toBeLessThanOrEqual(3_000);
  });

  it("returns nothing for empty documents or no overlap", () => {
    expect(retrieve([doc("e", "Empty", "   ")], "pricing")).toEqual([]);
    expect(retrieve([STYLE], "zzzz qqqq")).toEqual([]);
  });

  it("every passage is verbatim from its document (so excerpts can be verified)", () => {
    for (const p of chunkDoc(PRICING)) expect(normLoose(PRICING.content)).toContain(normLoose(p.text));
  });
});

describe("chunkDoc", () => {
  it("splits at headings and blank lines, never exceeding the max", () => {
    const long = doc("l", "Long", Array.from({ length: 30 }, (_, i) => `## H${i}\n\n${"word ".repeat(80)}`).join("\n\n"));
    const parts = chunkDoc(long, 800);
    expect(parts.length).toBeGreaterThan(5);
    expect(parts.every((p) => p.text.length <= 800)).toBe(true);
    expect(parts.map((p) => p.index)).toEqual(parts.map((_, i) => i));
  });

  it("hard-splits a single huge paragraph", () => {
    const parts = chunkDoc(doc("h", "Huge", "x".repeat(5_000)), 1_000);
    expect(parts.every((p) => p.text.length <= 1_000)).toBe(true);
    expect(parts.map((p) => p.text).join("").length).toBe(5_000);
  });
});

describe("tokenize", () => {
  it("drops stopwords and short tokens, keeps prices and percents", () => {
    expect(tokenize("The Team Plan is $99/month and 85.6% positive")).toEqual(expect.arrayContaining(["team", "plan", "$99", "85.6%", "positive"]));
    expect(tokenize("the and for")).toEqual([]);
  });
});
