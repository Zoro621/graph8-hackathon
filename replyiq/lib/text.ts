// Shared text helpers (no dependencies).

/** Comparison form: case, quote marks, dashes, whitespace, and broken/invisible characters don't matter. */
export const norm = (s: string) =>
  s
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\uFFFD\u200B-\u200D\uFEFF]/g, "") // replacement char (bad encoding), zero-width chars
    .replace(/["'“”«»„‘’‚`]/g, "") // quote marks: bad encodings often turn them into U+FFFD
    .replace(/[‐‑‒–—−]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
