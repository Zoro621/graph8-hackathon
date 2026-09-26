import { describe, expect, it } from "vitest";
import { verifyProof, type StudioDoc } from "../lib/grounding";
import type { AnswerCard } from "../lib/types";

const docs: StudioDoc[] = [
  { id: "d1", displayName: "Pricing Matrix", content: "The Team plan is $99 per month and includes 10,000 credits for the whole team." },
];

const card = (excerpt: string, sourceDocId = "d1"): AnswerCard => ({
  summary: "s",
  quotes: ["q"],
  proofWeHave: [{ claim: "Clear price", sourceDocId, sourceDocName: "?", excerpt, verified: false }],
  proofGap: null,
  howToAnswer: "h",
  emailAngle: "e",
});

describe("verifyProof", () => {
  it("keeps a verbatim excerpt and names its doc", () => {
    const out = verifyProof(card("The Team plan is $99 per month"), docs);
    expect(out.proofWeHave).toHaveLength(1);
    expect(out.proofWeHave[0]).toMatchObject({ verified: true, sourceDocName: "Pricing Matrix" });
    expect(out.proofGap).toBeNull();
  });

  it("moves an altered excerpt to the proof gap", () => {
    const out = verifyProof(card("The Team plan is $49 per month"), docs);
    expect(out.proofWeHave).toHaveLength(0);
    expect(out.proofGap).toBe("Unverified: Clear price");
  });

  it("rejects excerpts under 6 words", () => {
    expect(verifyProof(card("Team plan is $99"), docs).proofWeHave).toHaveLength(0);
  });

  it("rejects an unknown doc id", () => {
    expect(verifyProof(card("The Team plan is $99 per month", "nope"), docs).proofWeHave).toHaveLength(0);
  });

  it("normalises whitespace, case and curly quotes", () => {
    const d: StudioDoc[] = [{ id: "d1", displayName: "X", content: "We don’t charge per   seat, ever, for any team." }];
    expect(verifyProof(card("we DON'T charge per seat, ever"), d).proofWeHave).toHaveLength(1);
  });
});
