import { describe, expect, it } from "vitest";
import { HARD_STOP, TAXONOMY, canDraft } from "../lib/taxonomy";
import { RUN_DURATION, snapshot } from "../lib/demo/engine";

describe("taxonomy rules", () => {
  it("never drafts for hard-stop categories", () => {
    for (const c of HARD_STOP) expect(canDraft(c, 50)).toBe(false);
  });

  it("respects follow-up flags and the minimum group size", () => {
    expect(canDraft("pricing_request", 2)).toBe(true);
    expect(canDraft("pricing_request", 1)).toBe(false);
    expect(canDraft("out_of_office", 10)).toBe(false);
    expect(canDraft("pricing_request", 2, 3)).toBe(false);
  });

  it("labels every category with the ReplyIQ tag prefix", () => {
    for (const r of Object.values(TAXONOMY)) expect(r.label.startsWith("ReplyIQ · ")).toBe(true);
  });
});

describe("demo run", () => {
  const meta = { id: "90bda420-test", sequenceId: "90bda420-78bc-5634-9da0-51e4f46bdc4a", createdAt: 0 };
  const done = snapshot(meta, RUN_DURATION + 1);

  it("classifies all 10 seeded threads", () => {
    expect(done.done).toBe(true);
    expect(done.run.groups.reduce((a, g) => a + g.replies.length, 0)).toBe(10);
  });

  it("never puts hard-no, unsubscribe or suppressed contacts on a list", () => {
    const eligible = done.run.groups.flatMap((g) => g.eligible.map((e) => e.email));
    const stopped = done.run.groups
      .filter((g) => HARD_STOP.includes(g.key))
      .flatMap((g) => g.replies.map((r) => r.contactEmail));
    expect(stopped.length).toBeGreaterThan(0);
    for (const e of stopped) expect(eligible).not.toContain(e);
  });

  it("runs the grounding check on Answer Cards", () => {
    const pricing = done.run.groups.find((g) => g.key === "pricing_request");
    expect(pricing?.card?.proofWeHave.every((p) => p.verified)).toBe(true);
    expect(pricing?.card?.proofGap).toMatch(/Unverified: /);
  });
});
