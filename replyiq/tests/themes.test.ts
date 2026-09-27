import { describe, expect, it } from "vitest";
import { discoverThemes, MAX_THEMES, THEMES_PROMPT, validateThemes } from "../lib/pipeline/themes";
import type { Classified, Group } from "../lib/types";
import { fakeLlm, reply, type ThemesAnswer } from "./helpers";

const c = (id: string, text: string): Classified => ({ ...reply(id, text), category: "price_objection", confidence: 0.9, quote: text.slice(0, 20), needsReview: false });

const PRICE: Classified[] = [
  c("p1", "Per-seat pricing is too high for our 40 reps."),
  c("p2", "Paying per seat does not work for a team our size."),
  c("p3", "The per-seat cost is double what we pay today."),
  c("a1", "We are locked into an annual contract until March."),
  c("a2", "Our annual contract with the current vendor renews in Q2."),
];
const group = (replies: Classified[] = PRICE): Group => ({ key: "price_objection", label: "Price objection", replies, eligible: [], excluded: [] });
const aliasOf = (g: Group) => new Map(g.replies.map((r, i) => [`R${i + 1}`, r]));

const twoThemes: ThemesAnswer = {
  themes: [
    { label: "Per-seat cost too high", description: "Seat pricing is the blocker.", members: ["R1", "R2", "R3"], quote_member: "R1", quote: "Per-seat pricing is too high for our 40 reps." },
    { label: "Locked into annual contract", description: "Tied to an existing vendor contract.", members: ["R4", "R5"], quote_member: "R4", quote: "locked into an annual contract until March" },
  ],
};

describe("validateThemes", () => {
  it("accepts a clean answer: every reply in exactly one theme, quotes verified", () => {
    const g = group();
    const { themes, warnings } = validateThemes(g, twoThemes.themes, aliasOf(g));
    expect(warnings).toEqual([]);
    expect(themes.map((t) => [t.label, t.threadIds])).toEqual([
      ["Per-seat cost too high", ["p1", "p2", "p3"]],
      ["Locked into annual contract", ["a1", "a2"]],
    ]);
    expect(themes.every((t) => t.quoteVerified)).toBe(true);
    expect(themes[0].id).toBe("price_objection:per-seat-cost-too-high");
  });

  it("puts replies the model forgot into 'Other'", () => {
    const g = group();
    const { themes, warnings } = validateThemes(g, [{ ...twoThemes.themes[0] }], aliasOf(g));
    expect(themes.map((t) => t.label)).toEqual(["Per-seat cost too high", "Other"]);
    expect(themes[1].threadIds).toEqual(["a1", "a2"]);
    expect(warnings.join()).toMatch(/not assigned/);
  });

  it("ignores unknown members and keeps a reply only in its first theme", () => {
    const g = group();
    const raw = [
      { ...twoThemes.themes[0], members: ["R1", "R2", "R3", "R99"] },
      { ...twoThemes.themes[1], members: ["R3", "R4", "R5"] }, // R3 duplicated
    ];
    const { themes, warnings } = validateThemes(g, raw, aliasOf(g));
    expect(themes[1].threadIds).toEqual(["a1", "a2"]);
    expect(warnings.join()).toMatch(/unknown member "R99"/);
    const all = themes.flatMap((t) => t.threadIds);
    expect(new Set(all).size).toBe(all.length);
    expect(all).toHaveLength(5);
  });

  it("drops empty themes", () => {
    const g = group();
    const raw = [...twoThemes.themes, { label: "Ghost", description: "", members: ["R42"], quote_member: "R42", quote: "nothing" }];
    expect(validateThemes(g, raw, aliasOf(g)).themes.map((t) => t.label)).not.toContain("Ghost");
  });

  it("finds the quote in another member if quote_member is wrong, else falls back unverified", () => {
    const g = group();
    const wrongMember = [{ ...twoThemes.themes[0], quote_member: "R3" }, twoThemes.themes[1]];
    const t1 = validateThemes(g, wrongMember, aliasOf(g)).themes[0];
    expect(t1).toMatchObject({ quoteVerified: true, quoteThreadId: "p1" });

    const invented = [{ ...twoThemes.themes[0], quote: "Seats cost a fortune and we hate it" }, twoThemes.themes[1]];
    const t2 = validateThemes(g, invented, aliasOf(g)).themes[0];
    expect(t2.quoteVerified).toBe(false);
    expect(t2.quote).not.toContain("fortune");
    expect(t2.threadIds).toContain(t2.quoteThreadId);
  });

  it("never lets a theme quote a reply that is not its member", () => {
    const g = group();
    // Theme 1 quotes an annual-contract reply that belongs to theme 2.
    const raw = [{ ...twoThemes.themes[0], quote_member: "R4", quote: "locked into an annual contract until March" }, twoThemes.themes[1]];
    const t = validateThemes(g, raw, aliasOf(g)).themes[0];
    expect(["p1", "p2", "p3"]).toContain(t.quoteThreadId);
    expect(t.quoteVerified).toBe(false);
  });

  it(`caps at ${MAX_THEMES} themes by merging the smallest into 'Other'`, () => {
    const many = Array.from({ length: 8 }, (_, i) => c(`r${i}`, `distinct reply number ${i} about pricing`));
    const g = group(many);
    const raw = many.map((_, i) => ({ label: `Theme ${i}`, description: "", members: [`R${i + 1}`], quote_member: `R${i + 1}`, quote: `distinct reply number ${i} about pricing` }));
    const { themes, warnings } = validateThemes(g, raw, aliasOf(g));
    expect(themes).toHaveLength(MAX_THEMES);
    expect(themes.at(-1)?.label).toBe("Other");
    expect(themes.flatMap((t) => t.threadIds)).toHaveLength(8);
    expect(warnings.join()).toMatch(/merged/);
  });

  it("makes theme ids unique when labels collide", () => {
    const g = group();
    const raw = [
      { ...twoThemes.themes[0], label: "Cost", members: ["R1", "R2", "R3"] },
      { ...twoThemes.themes[1], label: "cost", members: ["R4", "R5"] },
    ];
    const ids = validateThemes(g, raw, aliasOf(g)).themes.map((t) => t.id);
    expect(new Set(ids).size).toBe(2);
  });
});

describe("discoverThemes", () => {
  it("one call per group with 2+ replies; aliases, not thread ids; themeId set on replies", async () => {
    const single: Group = { key: "hard_no", label: "Hard no", replies: [{ ...c("h1", "No thanks"), category: "hard_no" }], eligible: [], excluded: [] };
    const { llm, themeRequests } = fakeLlm(() => [], { themes: () => twoThemes });
    const res = await discoverThemes([group(), single], { llm, model: "m" });
    expect(themeRequests).toHaveLength(1);
    expect(themeRequests[0].user).not.toMatch(/"p1"|"a1"/);
    expect(JSON.parse(themeRequests[0].user).items.map((i: { id: string }) => i.id)).toEqual(["R1", "R2", "R3", "R4", "R5"]);
    const price = res.groups.find((g) => g.key === "price_objection")!;
    expect(price.themes).toHaveLength(2);
    expect(price.replies.find((r) => r.threadId === "a2")?.themeId).toBe("price_objection:locked-into-annual-contract");
    expect(res.groups.find((g) => g.key === "hard_no")!.themes).toBeUndefined();
    expect(res.usage.llmCalls).toBe(1);
  });

  it("a failing group gets no themes and a warning; other groups still get theirs", async () => {
    const other: Group = { ...group(), key: "no_need", label: "No need" };
    const { llm } = fakeLlm(() => [], {
      themes: (p) => {
        if (p.group.name === "No need") throw new Error("boom");
        return twoThemes;
      },
    });
    const res = await discoverThemes([group(), other], { llm, model: "m" });
    expect(res.groups[0].themes).toHaveLength(2);
    expect(res.groups[1].themes).toBeUndefined();
    expect(res.warnings.join()).toMatch(/No need: theme discovery failed/);
  });

  it("does not mutate the input groups", async () => {
    const g = group();
    const { llm } = fakeLlm(() => [], { themes: () => twoThemes });
    await discoverThemes([g], { llm, model: "m" });
    expect(g.themes).toBeUndefined();
    expect(g.replies[0].themeId).toBeUndefined();
  });

  it("the prompt requires full coverage and verbatim quotes", () => {
    expect(THEMES_PROMPT).toMatch(/EVERY item in exactly one theme/);
    expect(THEMES_PROMPT).toMatch(/VERBATIM/);
  });
});
