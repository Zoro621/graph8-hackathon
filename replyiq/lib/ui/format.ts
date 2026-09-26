/** "[DEMO] Product introduction history" → "Product introduction history". Strips any leading [tags]. */
export const displayName = (name: string) => name.replace(/^(\s*\[[^\]]*\]\s*)+/, "").trim() || name;

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
