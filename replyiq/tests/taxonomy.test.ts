import { describe, expect, it } from "vitest";
import { allowsFollowUpCampaign, CATEGORIES, CATEGORY_KEYS, categoryInfo, isHardStop, tagNameOf } from "../lib/taxonomy";

describe("taxonomy", () => {
  it("has unique keys and labels, each with a definition", () => {
    expect(new Set(CATEGORY_KEYS).size).toBe(CATEGORY_KEYS.length);
    expect(new Set(CATEGORIES.map((c) => c.label)).size).toBe(CATEGORIES.length);
    for (const c of CATEGORIES) expect(c.definition.length).toBeGreaterThan(20);
  });

  it("never allows a follow-up for hard no, unsubscribe, meeting booked or needs review", () => {
    for (const k of ["hard_no", "unsubscribe", "meeting_booked", "other"] as const) {
      expect(allowsFollowUpCampaign(k)).toBe(false);
      expect(categoryInfo(k).followUp).toBe("never");
    }
    expect(isHardStop("hard_no")).toBe(true);
    expect(isHardStop("unsubscribe")).toBe(true);
    expect(isHardStop("out_of_office")).toBe(false);
  });

  it("allows follow-ups for objections, referrals and timing", () => {
    for (const k of ["pricing_request", "price_objection", "competitor_locked_in", "referral_wrong_person", "no_need", "timing_not_now", "out_of_office", "interested_no_meeting"] as const) {
      expect(allowsFollowUpCampaign(k)).toBe(true);
    }
    expect(allowsFollowUpCampaign("meeting_request")).toBe(false); // goes to a rep, not a campaign
  });

  it("only objections get Answer Cards", () => {
    const withCards = CATEGORIES.filter((c) => c.answerCard).map((c) => c.key);
    expect(withCards).not.toContain("out_of_office");
    expect(withCards).not.toContain("unsubscribe");
    expect(withCards).toContain("price_objection");
  });

  it("tag names are prefixed and throw on unknown keys", () => {
    expect(tagNameOf("out_of_office")).toBe("ReplyIQ · Out of office");
    // @ts-expect-error testing a bad key at runtime
    expect(() => categoryInfo("nope")).toThrow();
  });
});
