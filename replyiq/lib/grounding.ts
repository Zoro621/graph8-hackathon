// Grounding check (IMPLEMENTATION.md §8): a proof claim survives only if its excerpt
// is really inside the cited Studio doc. Failed claims move to the proof gap.
import type { AnswerCard } from "./types";

export interface StudioDoc {
  id: string;
  displayName: string;
  content: string;
}

export const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, " ")
    .trim();

export function verifyProof(card: AnswerCard, docs: StudioDoc[]): AnswerCard {
  const kept: AnswerCard["proofWeHave"] = [];
  const failed: string[] = [];
  for (const item of card.proofWeHave) {
    const doc = docs.find((d) => d.id === item.sourceDocId);
    const verified =
      !!doc && norm(doc.content).includes(norm(item.excerpt)) && item.excerpt.trim().split(/\s+/).length >= 6;
    if (verified) kept.push({ ...item, verified: true, sourceDocName: doc.displayName });
    else failed.push(`Unverified: ${item.claim}`);
  }
  const gap = [card.proofGap, ...failed].filter(Boolean).join("\n");
  return { ...card, proofWeHave: kept, proofGap: gap || null };
}
