const HIDDEN_TAGS = /^(demo|synthetic)$/i;

/**
 * Splits graph8's bracketed name prefixes from the name. "[DEMO]" / "[SYNTHETIC]" are dropped; other
 * prefixes ("[Full copy]", "[Hackathon copy]") are kept as tags because they tell look-alike sources apart.
 */
export function splitName(name: string): { title: string; tags: string[] } {
  const tags: string[] = [];
  const title = name.replace(/^(\s*\[([^\]]*)\]\s*)+/, (prefix) => {
    for (const m of prefix.matchAll(/\[([^\]]*)\]/g)) if (m[1].trim() && !HIDDEN_TAGS.test(m[1].trim())) tags.push(m[1].trim());
    return "";
  });
  // graph8 names sequences pushed from a Studio campaign "<campaign> - Sequence"; the suffix adds nothing.
  return { title: title.replace(/\s+-\s+Sequence$/i, "").trim() || name, tags };
}

/**
 * A one-line label: "[DEMO] Product introduction history" → "Product introduction history",
 * "[Full copy] Kill Your Tool Stack" → "Kill Your Tool Stack · Full copy" (look-alikes stay distinct).
 */
export function displayName(name: string) {
  const { title, tags } = splitName(name);
  return tags.length ? `${title} · ${tags.join(" · ")}` : title;
}

/** "just now", "4 min ago", "2 h ago", "3 d ago", then a date. */
export function timeAgo(ts: number, now: number) {
  const s = Math.max(0, Math.round((now - ts) / 1000));
  if (s < 45) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d} d ago`;
  return new Date(ts).toLocaleDateString([], { month: "short", day: "numeric" });
}

export const clockTime = (ts: number) => new Date(ts).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
