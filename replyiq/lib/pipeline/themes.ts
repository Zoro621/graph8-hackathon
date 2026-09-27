// Themes inside each group. The 13 categories decide ACTIONS; themes add detail the AI discovers on
// its own ("per-seat cost too high" vs "locked into an annual contract" inside price_objection).
// Grounded and non-critical:
// - every reply of a group ends up in exactly one theme (missing ones go to "Other")
// - unknown / duplicate member ids are ignored; empty themes dropped; at most MAX_THEMES
// - each theme's quote must be verbatim in one of ITS OWN members' replies, else a fallback quote is
//   taken from a member and marked unverified
// - a failed call leaves that group without themes (warning), it never fails the run
import { z } from "zod";
import type { Llm, LlmUsage } from "../llm";
import { scrubPhones } from "../scrub";
import { categoryInfo } from "../taxonomy";
import { norm } from "../text";
import type { Classified, Group, Theme } from "../types";

export const MIN_GROUP_SIZE_FOR_THEMES = 2;
export const MAX_THEMES = 5;
const CONCURRENCY = 3;

const ThemeSchema = z.object({
  themes: z.array(
    z.object({
      label: z.string(),
      description: z.string(),
      members: z.array(z.string()),
      quote_member: z.string(),
      quote: z.string(),
    }),
  ),
});
type RawTheme = z.infer<typeof ThemeSchema>["themes"][number];

export const THEMES_PROMPT = [
  "You find the common THEMES inside one group of replies to a B2B sales campaign.",
  "All replies are already in the same category; your job is the finer pattern inside it that a sales team would act on differently",
  "(e.g. inside a price objection: \"per-seat cost too high\" vs \"locked into an annual contract\").",
  "",
  "Rules:",
  `- 1 to ${MAX_THEMES} themes. Use as few as the data supports; one theme is fine if they are all alike.`,
  "- label: 2-6 plain words. description: one sentence.",
  "- members: the item ids (R1, R2...) in the theme. Put EVERY item in exactly one theme.",
  "- quote_member + quote: one item from THIS theme and a short span (5-25 words) copied VERBATIM from its reply.",
  "- Only use what the replies say. Do not invent reasons.",
].join("\n");

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40) || "theme";

const verbatimIn = (reply: Classified, quote: string) => quote.trim().split(/\s+/).length >= 3 && norm(reply.replyText).includes(norm(quote));

/** Turn the model's themes into validated Theme objects covering every reply exactly once. */
export function validateThemes(group: Group, raw: RawTheme[], alias: Map<string, Classified>): { themes: Theme[]; warnings: string[] } {
  const warnings: string[] = [];
  const assigned = new Set<string>();
  const drafts: { label: string; description: string; members: Classified[]; quote: string; quoteMember?: string }[] = [];

  for (const t of raw) {
    const members: Classified[] = [];
    for (const a of t.members) {
      const r = alias.get(a.trim());
      if (!r) {
        warnings.push(`unknown member "${a}" ignored`);
        continue;
      }
      if (assigned.has(r.threadId)) continue; // already in an earlier theme
      assigned.add(r.threadId);
      members.push(r);
    }
    if (members.length && t.label.trim()) drafts.push({ label: t.label.trim(), description: t.description.trim(), members, quote: t.quote, quoteMember: t.quote_member.trim() });
  }

  // Replies the model left out -> "Other".
  const missing = group.replies.filter((r) => !assigned.has(r.threadId));
  if (missing.length && drafts.length) {
    warnings.push(`${missing.length} reply(ies) not assigned by the model; put in "Other"`);
    drafts.push({ label: "Other", description: "Replies that did not fit the themes above.", members: missing, quote: "" });
  }

  // Too many themes -> merge the smallest into "Other".
  drafts.sort((a, b) => b.members.length - a.members.length);
  if (drafts.length > MAX_THEMES) {
    const keep = drafts.slice(0, MAX_THEMES - 1);
    const rest = drafts.slice(MAX_THEMES - 1);
    const other = keep.find((d) => d.label === "Other");
    const merged = rest.flatMap((d) => d.members);
    if (other) other.members.push(...merged);
    else keep.push({ label: "Other", description: "Smaller patterns merged together.", members: merged, quote: "" });
    drafts.splice(0, drafts.length, ...keep);
    warnings.push(`more than ${MAX_THEMES} themes; smallest merged into "Other"`);
  }

  const usedIds = new Set<string>();
  const themes = drafts.map((d) => {
    // Quote: from the named member if verbatim, else from any member, else fallback (unverified).
    const named = d.quoteMember ? alias.get(d.quoteMember) : undefined;
    let quoteReply = named && d.members.includes(named) && verbatimIn(named, d.quote) ? named : d.members.find((m) => verbatimIn(m, d.quote));
    let quote = d.quote.trim();
    let quoteVerified = Boolean(quoteReply);
    if (!quoteReply) {
      quoteReply = d.members[0];
      quote = (quoteReply.quote || quoteReply.replyText).replace(/\s+/g, " ").trim().slice(0, 160);
      quoteVerified = false;
    }
    let id = `${group.key}:${slug(d.label)}`;
    for (let n = 2; usedIds.has(id); n++) id = `${group.key}:${slug(d.label)}-${n}`;
    usedIds.add(id);
    return {
      id,
      label: d.label,
      description: d.description,
      threadIds: d.members.map((m) => m.threadId),
      quote,
      quoteThreadId: quoteReply.threadId,
      quoteVerified,
    } satisfies Theme;
  });
  return { themes, warnings };
}

export interface ThemesOptions {
  llm: Llm;
  model: string;
  minGroupSize?: number;
  concurrency?: number;
}

export interface ThemesResult {
  groups: Group[]; // same groups, with themes (and themeId on each reply) where found
  usage: LlmUsage & { llmCalls: number };
  warnings: string[];
}

function toItem(alias: string, r: Classified) {
  return {
    id: alias,
    company: r.company ?? null,
    reply: scrubPhones(r.replyText.slice(0, 1500)),
    why_in_this_group: r.reason ?? null,
    referred_to: r.referredName ?? null,
    timing: r.revisitHint ?? null,
  };
}

export async function discoverThemes(groups: Group[], opts: ThemesOptions): Promise<ThemesResult> {
  const usage = { inputTokens: 0, outputTokens: 0, llmCalls: 0 };
  const warnings: string[] = [];
  const min = opts.minGroupSize ?? MIN_GROUP_SIZE_FOR_THEMES;
  const out = groups.map((g) => ({ ...g, replies: [...g.replies] }));
  const todo = out.filter((g) => g.replies.length >= min);

  let next = 0;
  const worker = async () => {
    while (next < todo.length) {
      const g = todo[next++];
      const alias = new Map(g.replies.map((r, i) => [`R${i + 1}`, r]));
      try {
        const info = categoryInfo(g.key);
        const { data, usage: u } = await opts.llm.parse({
          model: opts.model,
          system: THEMES_PROMPT,
          user: JSON.stringify({ group: { name: info.label, definition: info.definition }, items: [...alias].map(([a, r]) => toItem(a, r)) }),
          schema: ThemeSchema,
          name: "group_themes",
        });
        usage.inputTokens += u.inputTokens;
        usage.outputTokens += u.outputTokens;
        usage.llmCalls++;
        const { themes, warnings: w } = validateThemes(g, data.themes, alias);
        warnings.push(...w.map((x) => `${g.label}: ${x}`));
        if (themes.length === 0) {
          warnings.push(`${g.label}: no usable themes returned`);
          continue;
        }
        g.themes = themes;
        const themeOf = new Map(themes.flatMap((t) => t.threadIds.map((id) => [id, t.id] as const)));
        g.replies = g.replies.map((r) => ({ ...r, themeId: themeOf.get(r.threadId) }));
      } catch (err) {
        warnings.push(`${g.label}: theme discovery failed (${err instanceof Error ? err.message : String(err)}); group left without themes`);
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(opts.concurrency ?? CONCURRENCY, todo.length) }, worker));
  return { groups: out, usage, warnings };
}
