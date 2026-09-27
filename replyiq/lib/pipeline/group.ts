import { labelOf, sortIndex } from "../taxonomy";
import type { Category, Classified, Group } from "../types";

/** Classified replies -> one group per category, in taxonomy order. eligible/excluded are filled in M3. */
export function groupReplies(classified: Classified[]): Group[] {
  const byKey = new Map<Category, Classified[]>();
  for (const c of classified) byKey.set(c.category, [...(byKey.get(c.category) ?? []), c]);
  return [...byKey.entries()]
    .sort(([a], [b]) => sortIndex(a) - sortIndex(b))
    .map(([key, replies]) => ({
      key,
      label: labelOf(key),
      replies: [...replies].sort((a, b) => b.confidence - a.confidence),
      eligible: [],
      excluded: [],
    }));
}
