// Passage retrieval over the company's documents (Studio Global + the campaign's own docs).
// Fully dynamic: no document is named in code. Docs are split into passages, ranked against a query
// (the group's replies, reasons, themes) with a small TF-IDF, and the best passages are returned
// within a character budget. Proof-like and campaign documents get a mild boost.

export interface SourceDoc {
  id: string;
  name: string;
  kind: "global" | "campaign";
  content: string;
}

export interface Passage {
  docId: string;
  docName: string;
  kind: SourceDoc["kind"];
  index: number; // position inside the doc
  text: string;
}

const MAX_PASSAGE = 1_600;
const STOP = new Set(
  "the and for are but not you your with this that from have has had was were will would can could should our their they them its it's into about than then there here what when where which who why how all any each more most other some such only own same very just also over under again once per via out off too may might must shall being been does did done doing yes no nor both few if or as at by in of on to up we us is be an a i me my".split(" "),
);

export function tokenize(s: string): string[] {
  return (s.toLowerCase().normalize("NFKC").match(/[a-z0-9$%][a-z0-9$%.+-]*/g) ?? [])
    .map((t) => t.replace(/[.+-]+$/, ""))
    .filter((t) => t.length >= 3 && !STOP.has(t));
}

/** Split a document into passages at headings / blank lines, merging small pieces up to MAX_PASSAGE. */
export function chunkDoc(doc: SourceDoc, max = MAX_PASSAGE): Passage[] {
  const blocks = doc.content.split(/\n(?=#{1,6}\s)|\n\s*\n/).map((b) => b.trim()).filter(Boolean);
  const pieces: string[] = [];
  for (const b of blocks) {
    if (b.length <= max) {
      pieces.push(b);
      continue;
    }
    // Hard-split a long block at sentence ends.
    let cur = "";
    for (const s of b.split(/(?<=[.!?])\s+/)) {
      if (cur && cur.length + s.length + 1 > max) {
        pieces.push(cur);
        cur = "";
      }
      cur = cur ? `${cur} ${s}` : s;
      while (cur.length > max) {
        pieces.push(cur.slice(0, max));
        cur = cur.slice(max);
      }
    }
    if (cur) pieces.push(cur);
  }
  const out: Passage[] = [];
  let cur = "";
  const push = () => {
    if (cur.trim()) out.push({ docId: doc.id, docName: doc.name, kind: doc.kind, index: out.length, text: cur.trim() });
    cur = "";
  };
  for (const p of pieces) {
    if (cur && cur.length + p.length + 2 > max) push();
    cur = cur ? `${cur}\n\n${p}` : p;
  }
  push();
  return out;
}

export interface RetrieveOptions {
  budgetChars?: number; // total passage text returned
  perDocCap?: number; // max passages from one document
  boost?: (doc: SourceDoc) => number; // multiplier, default 1
}

const PROOF_LIKE = /proof|case|testimonial|customer|result|evidence/i;

/** Default boost: proof-like documents x1.3, the campaign's own documents x1.2. */
export const defaultBoost = (d: SourceDoc) => (PROOF_LIKE.test(d.name) ? 1.3 : 1) * (d.kind === "campaign" ? 1.2 : 1);

export function retrieve(docs: SourceDoc[], query: string, opts: RetrieveOptions = {}): Passage[] {
  const budget = opts.budgetChars ?? 40_000;
  const cap = opts.perDocCap ?? 5;
  const boost = opts.boost ?? defaultBoost;
  const passages = docs.filter((d) => d.content.trim()).flatMap((d) => chunkDoc(d));
  if (passages.length === 0) return [];

  const qTerms = new Map<string, number>();
  for (const t of tokenize(query)) qTerms.set(t, (qTerms.get(t) ?? 0) + 1);
  const tokens = passages.map((p) => tokenize(p.text));
  const df = new Map<string, number>();
  for (const ts of tokens) for (const t of new Set(ts)) df.set(t, (df.get(t) ?? 0) + 1);
  const N = passages.length;
  const docById = new Map(docs.map((d) => [d.id, d]));

  const scored = passages.map((p, i) => {
    const tf = new Map<string, number>();
    for (const t of tokens[i]) tf.set(t, (tf.get(t) ?? 0) + 1);
    let s = 0;
    for (const [t, qw] of qTerms) {
      const f = tf.get(t);
      if (!f) continue;
      s += Math.min(qw, 3) * (1 + Math.log(f)) * Math.log(1 + N / (df.get(t) ?? 1));
    }
    s /= 1 + tokens[i].length / 400;
    return { p, s: s * boost(docById.get(p.docId)!) };
  });

  // Always keep the opening passage of each proof-like document: it usually states what proof exists
  // (and what does not), which the proof-gap judgement needs.
  const chosen: Passage[] = [];
  const perDoc = new Map<string, number>();
  let used = 0;
  const take = (p: Passage) => {
    if (chosen.includes(p) || used + p.text.length > budget || (perDoc.get(p.docId) ?? 0) >= cap) return;
    chosen.push(p);
    used += p.text.length;
    perDoc.set(p.docId, (perDoc.get(p.docId) ?? 0) + 1);
  };
  for (const d of docs) if (PROOF_LIKE.test(d.name)) {
    const first = passages.find((p) => p.docId === d.id && p.index === 0);
    if (first) take(first);
  }
  for (const { p, s } of scored.sort((a, b) => b.s - a.s)) if (s > 0) take(p);
  return chosen;
}
