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

/**
 * Like norm, but also ignores markdown formatting (**bold**, _italics_, # headings, | tables, > quotes,
 * list bullets), so a quote copied from rendered markdown still matches the source document.
 */
export const normLoose = (s: string) =>
  norm(
    s
      .replace(/[*_#|>~]/g, " ")
      .replace(/^\s*[-+]\s+/gm, " ")
      .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1"), // [text](url) -> text
  )
    .replace(/\s+([.,;:!?)])/g, "$1")
    .replace(/\s+/g, " ")
    .trim();

export const wordCount = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;

/**
 * A document as proof: without the text ReplyIQ itself wrote into it, so ReplyIQ never cites its own words.
 * Drops approved learnings blocks (<!-- replyiq:learnings:KEY --> ... <!-- /replyiq:learnings:KEY -->) and
 * campaign-doc sections (<!-- replyiq:RUN:GROUP --> up to the next ReplyIQ marker or the end, as they are written).
 */
export const withoutOwnSections = (content: string) =>
  content
    .replace(/<!-- replyiq:learnings:(\S+) -->[\s\S]*?<!-- \/replyiq:learnings:\1 -->/g, "")
    .replace(/<!-- replyiq:(?!learnings:)[^>]*-->[\s\S]*?(?=<!-- \/?replyiq:|$)/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
