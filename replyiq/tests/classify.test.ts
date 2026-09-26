import { describe, expect, it } from "vitest";
import { applyLabel, classifyReplies, norm, preLabel, SYSTEM_PROMPT } from "../lib/pipeline/classify";
import { groupReplies } from "../lib/pipeline/group";
import { CATEGORY_KEYS } from "../lib/taxonomy";
import { fakeLlm, label, reply } from "./helpers";

const MODEL = "test-model";

describe("classifyReplies", () => {
  it("labels every reply exactly once and keeps input order", async () => {
    const replies = [reply("a", "I am out of office until June 9"), reply("b", "No thanks"), reply("c", "Send pricing please")];
    const byText = (t: string) => (/office/.test(t) ? "out_of_office" : /No thanks/.test(t) ? "hard_no" : "pricing_request");
    const { llm } = fakeLlm((items) => items.map((i) => label(i.id, byText(i.latest_prospect_reply), i.latest_prospect_reply)));
    const res = await classifyReplies(replies, { llm, model: MODEL });
    expect(res.classified.map((c) => [c.threadId, c.category])).toEqual([
      ["a", "out_of_office"],
      ["b", "hard_no"],
      ["c", "pricing_request"],
    ]);
    expect(res.usage.llmCalls).toBe(1);
    expect(res.warnings).toEqual([]);
  });

  it("batches by size and runs batches with limited concurrency", async () => {
    const replies = Array.from({ length: 45 }, (_, i) => reply(`r${i}`, `reply number ${i}`));
    let inFlight = 0;
    let maxInFlight = 0;
    const { llm, requests } = fakeLlm(async (items) => {
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((r) => setTimeout(r, 5));
      inFlight--;
      return items.map((i) => label(i.id, "other", i.latest_prospect_reply));
    });
    const res = await classifyReplies(replies, { llm, model: MODEL, batchSize: 20, concurrency: 2 });
    expect(requests.map((r) => JSON.parse(r.user).items.length)).toEqual([20, 20, 5]);
    expect(maxInFlight).toBeLessThanOrEqual(2);
    expect(res.classified).toHaveLength(45);
  });

  it("retries a reply the model skipped, alone", async () => {
    const replies = [reply("a", "hello there"), reply("b", "I left the company, contact Jane Doe")];
    const { llm, requests } = fakeLlm((items) =>
      items.length === 2
        ? [label(items[0].id, "interested_no_meeting", "hello there")] // skips the second
        : [label(items[0].id, "referral_wrong_person", items[0].latest_prospect_reply, { referred_name: "Jane Doe" })],
    );
    const res = await classifyReplies(replies, { llm, model: MODEL });
    expect(requests).toHaveLength(2);
    expect(res.classified.find((c) => c.threadId === "b")).toMatchObject({ category: "referral_wrong_person", referredName: "Jane Doe" });
  });

  it("falls back to 'needs review' when the model never labels a reply", async () => {
    const { llm } = fakeLlm(() => []);
    const res = await classifyReplies([reply("a", "something odd")], { llm, model: MODEL });
    expect(res.classified[0]).toMatchObject({ category: "other", confidence: 0, needsReview: true });
    expect(res.warnings.join()).toMatch(/no label/);
  });

  it("ignores unknown ids and duplicate labels", async () => {
    const { llm } = fakeLlm((items) => [
      label("ghost", "hard_no", "x"),
      label(items[0].id, "hard_no", items[0].latest_prospect_reply),
      label(items[0].id, "pricing_request", items[0].latest_prospect_reply),
    ]);
    const res = await classifyReplies([reply("a", "no thanks")], { llm, model: MODEL });
    expect(res.classified[0].category).toBe("hard_no");
    expect(res.warnings.join()).toMatch(/unknown id/);
  });

  it("dedupes replies with the same thread id", async () => {
    const { llm, requests } = fakeLlm((items) => items.map((i) => label(i.id, "other", i.latest_prospect_reply)));
    const res = await classifyReplies([reply("a", "one"), reply("a", "one")], { llm, model: MODEL });
    expect(res.classified).toHaveLength(1);
    expect(JSON.parse(requests[0].user).items).toHaveLength(1);
  });

  it("never sends placeholder or empty replies to the model", async () => {
    const { llm, requests } = fakeLlm((items) => items.map((i) => label(i.id, "hard_no", i.latest_prospect_reply)));
    const res = await classifyReplies(
      [reply("p", "[Anonymized history] This prospect replied to the campaign. Original private reply omitted."), reply("e", " "), reply("n", "no thanks")],
      { llm, model: MODEL },
    );
    expect(JSON.parse(requests[0].user).items.map((i: { latest_prospect_reply: string }) => i.latest_prospect_reply)).toEqual(["no thanks"]);
    expect(res.classified.map((c) => c.category)).toEqual(["other", "other", "hard_no"]);
  });

  it("makes no LLM call when every reply is a placeholder", async () => {
    const { llm, requests } = fakeLlm(() => []);
    await classifyReplies([reply("p", "Original private reply omitted.")], { llm, model: MODEL });
    expect(requests).toHaveLength(0);
  });

  it("a model failure fails the whole step (no partial labels)", async () => {
    const { llm } = fakeLlm(() => {
      throw new Error("OpenAI down");
    });
    await expect(classifyReplies([reply("a", "hi")], { llm, model: MODEL })).rejects.toThrow("OpenAI down");
  });

  it("rejects a category outside the taxonomy (schema)", async () => {
    const { llm } = fakeLlm((items) => [label(items[0].id, "made_up", "hi")]);
    await expect(classifyReplies([reply("a", "hi")], { llm, model: MODEL })).rejects.toThrow();
  });

  it("strips phone numbers before sending and includes the conversation", async () => {
    const { llm, requests } = fakeLlm((items) => items.map((i) => label(i.id, "out_of_office", i.latest_prospect_reply)));
    await classifyReplies([reply("a", "OOO, call 508-475-0600")], { llm, model: MODEL });
    const sent = requests[0].user;
    expect(sent).not.toContain("508-475-0600");
    expect(sent).toContain("[phone]");
    expect(sent).toContain("US: our pitch");
  });

  it("sends short per-batch aliases, never the long thread ids", async () => {
    const { llm, requests } = fakeLlm((items) => items.map((i) => label(i.id, "other", i.latest_prospect_reply)));
    const res = await classifyReplies([reply("thread-uuid-aaaa", "one"), reply("thread-uuid-bbbb", "two")], { llm, model: MODEL });
    const sent = JSON.parse(requests[0].user).items;
    expect(sent.map((i: { id: string }) => i.id)).toEqual(["R1", "R2"]);
    expect(requests[0].user).not.toContain("thread-uuid");
    expect(res.classified.map((c) => c.threadId)).toEqual(["thread-uuid-aaaa", "thread-uuid-bbbb"]); // mapped back
  });

  it("detects labels crossed between threads and re-classifies them one at a time", async () => {
    const replies = [
      reply("ooo", "Thanks for your e-mail, I'm out of the office on holiday until June 1."),
      reply("ref", "Mike is no longer employed here. Please contact Steve Pinchotti instead."),
      reply("no", "No thank you, not interested."),
    ];
    const { llm, requests } = fakeLlm((items) => {
      if (items.length > 1) {
        // The model crosses the first two items: each gets the other's label and quote.
        const [a, b, c] = items;
        return [
          label(a.id, "referral_wrong_person", b.latest_prospect_reply, { referred_name: "Steve Pinchotti" }),
          label(b.id, "out_of_office", a.latest_prospect_reply),
          label(c.id, "hard_no", c.latest_prospect_reply),
        ];
      }
      const t = items[0].latest_prospect_reply;
      return [label(items[0].id, /office/.test(t) ? "out_of_office" : "referral_wrong_person", t, /Steve/.test(t) ? { referred_name: "Steve Pinchotti" } : {})];
    });
    const res = await classifyReplies(replies, { llm, model: MODEL });
    const by = Object.fromEntries(res.classified.map((c) => [c.threadId, c]));
    expect(by.ooo).toMatchObject({ category: "out_of_office", needsReview: false });
    expect(by.ref).toMatchObject({ category: "referral_wrong_person", referredName: "Steve Pinchotti", needsReview: false });
    expect(by.no.category).toBe("hard_no");
    expect(requests).toHaveLength(3); // 1 batch + 2 single re-classifications
    expect(res.warnings.join()).toMatch(/crossed between threads/);
  });

  it("isSwapped only fires when the quote is verbatim in ANOTHER reply", async () => {
    const { isSwapped } = await import("../lib/pipeline/classify");
    const a = reply("a", "I am out of office until June 9");
    const b = reply("b", "Please contact Jane Doe instead");
    expect(isSwapped(a, "Please contact Jane Doe instead", [a, b])).toBe(true);
    expect(isSwapped(a, "out of office until June 9", [a, b])).toBe(false); // own quote
    expect(isSwapped(a, "something invented entirely", [a, b])).toBe(false); // invented, not a swap
    expect(isSwapped(a, "Jane", [a, b])).toBe(false); // too short to judge
  });

  it("the prompt defines every category", () => {
    for (const k of CATEGORY_KEYS) expect(SYSTEM_PROMPT).toContain(`- ${k}:`);
  });
});

describe("applyLabel invariants", () => {
  const base = { referred_name: null, revisit_hint: null, reason: "r" };

  it("keeps a verbatim quote (ignoring case, curly quotes, broken chars)", () => {
    const r = reply("a", "We regret to inform you that \uFFFDMike\uFFFD is no longer employed");
    const c = applyLabel(r, { ...base, category: "other", confidence: 0.9, quote: "that Mike is no longer employed" });
    expect(c.quote).toBe("that Mike is no longer employed");
    expect(c.confidence).toBe(0.9);
  });

  it("accepts a quote where the model restored quote marks that the email encoded as \uFFFD", () => {
    const r = reply("a", "Please direct any future correspondence to \uFFFDSteve Pinchotti\uFFFD at \uFFFDredacted@example.com\uFFFD.");
    const c = applyLabel(r, { ...base, category: "referral_wrong_person", confidence: 0.95, quote: 'direct any future correspondence to "Steve Pinchotti"' });
    expect(c.confidence).toBe(0.95);
    expect(c.needsReview).toBe(false);
  });

  it("replaces an invented quote and caps confidence so it gets reviewed", () => {
    const c = applyLabel(reply("a", "Out until June 9"), { ...base, category: "out_of_office", confidence: 0.99, quote: "I am on vacation" });
    expect(c.quote).toBe("Out until June 9");
    expect(c.confidence).toBe(0.5);
    expect(c.needsReview).toBe(true);
  });

  it("clamps confidence to 0..1 and flags low confidence", () => {
    expect(applyLabel(reply("a", "hi"), { ...base, category: "other", confidence: 7, quote: "hi" }).confidence).toBe(1);
    expect(applyLabel(reply("a", "hi"), { ...base, category: "other", confidence: -1, quote: "hi" }).needsReview).toBe(true);
    expect(applyLabel(reply("a", "hi"), { ...base, category: "other", confidence: Number.NaN, quote: "hi" }).confidence).toBe(0);
  });

  it("drops blank referred names and hints", () => {
    const c = applyLabel(reply("a", "hi"), { category: "other", confidence: 1, quote: "hi", referred_name: "  ", revisit_hint: "", reason: "" });
    expect(c.referredName).toBeUndefined();
    expect(c.revisitHint).toBeUndefined();
    expect(c.reason).toBeUndefined();
  });

  it("norm treats typographic variants as equal", () => {
    expect(norm("It’s  “fine” — ok")).toBe(norm("it's \"fine\" - ok"));
    expect(norm("\uFFFDMike\uFFFD")).toBe(norm('"Mike"'));
  });

  it("preLabel only catches placeholders and empties", () => {
    expect(preLabel(reply("a", "Thanks, not now"))).toBeNull();
    expect(preLabel(reply("a", "Original private reply omitted"))?.category).toBe("other");
  });
});

describe("groupReplies", () => {
  it("groups by category in taxonomy order, highest confidence first", async () => {
    const { llm } = fakeLlm((items) =>
      items.map((i, n) => label(i.id, n % 2 ? "out_of_office" : "meeting_booked", i.latest_prospect_reply, { confidence: n / 10 + 0.5 })),
    );
    const { classified } = await classifyReplies([reply("a", "one"), reply("b", "two"), reply("c", "three"), reply("d", "four")], {
      llm,
      model: MODEL,
    });
    const groups = groupReplies(classified);
    expect(groups.map((g) => [g.key, g.replies.map((r) => r.threadId)])).toEqual([
      ["meeting_booked", ["c", "a"]],
      ["out_of_office", ["d", "b"]],
    ]);
    expect(groups[0].label).toBe("Meeting booked");
    expect(groups.every((g) => g.eligible.length === 0 && g.excluded.length === 0)).toBe(true);
  });
});
