// Categories, labels and follow-up rules (IMPLEMENTATION.md §6). Pure data, safe to import anywhere.
import type { Category } from "./types";

export interface CategoryRule {
  key: Category;
  label: string;
  short: string;
  followUp: boolean;
  answerCard: boolean;
  angle: string | null;
  note?: string;
}

export const TAXONOMY: Record<Category, CategoryRule> = {
  interested_no_meeting: {
    key: "interested_no_meeting",
    label: "ReplyIQ · Interested, no meeting",
    short: "Interested, no meeting",
    followUp: true,
    answerCard: true,
    angle: "Send the agenda, make booking easy",
  },
  meeting_request: {
    key: "meeting_request",
    label: "ReplyIQ · Meeting request",
    short: "Meeting request",
    followUp: true,
    answerCard: false,
    angle: "Confirm a time",
    note: "Flag for the rep first",
  },
  pricing_request: {
    key: "pricing_request",
    label: "ReplyIQ · Pricing request",
    short: "Pricing request",
    followUp: true,
    answerCard: true,
    angle: "Pricing plus ROI and proof",
  },
  price_objection: {
    key: "price_objection",
    label: "ReplyIQ · Price objection",
    short: "Price objection",
    followUp: true,
    answerCard: true,
    angle: "ROI and a cheaper path",
  },
  timing_not_now: {
    key: "timing_not_now",
    label: "ReplyIQ · Not now",
    short: "Not now",
    followUp: true,
    answerCard: true,
    angle: "New hook later",
    note: "Timing note is advisory",
  },
  competitor_locked_in: {
    key: "competitor_locked_in",
    label: "ReplyIQ · Competitor",
    short: "Competitor",
    followUp: true,
    answerCard: true,
    angle: "Displacement or comparison",
  },
  referral_wrong_person: {
    key: "referral_wrong_person",
    label: "ReplyIQ · Referral",
    short: "Referral",
    followUp: true,
    answerCard: false,
    angle: "Intro to the named person",
  },
  no_need: {
    key: "no_need",
    label: "ReplyIQ · No need",
    short: "No need",
    followUp: true,
    answerCard: true,
    angle: "A different pain",
  },
  out_of_office: {
    key: "out_of_office",
    label: "ReplyIQ · OOO",
    short: "Out of office",
    followUp: false,
    answerCard: false,
    angle: null,
    note: "Re-queue after return",
  },
  hard_no: {
    key: "hard_no",
    label: "ReplyIQ · Hard no",
    short: "Hard no",
    followUp: false,
    answerCard: false,
    angle: null,
    note: "Never re-contacted",
  },
  unsubscribe: {
    key: "unsubscribe",
    label: "ReplyIQ · Unsubscribe",
    short: "Unsubscribe",
    followUp: false,
    answerCard: false,
    angle: null,
    note: "Never re-contacted",
  },
  other: {
    key: "other",
    label: "ReplyIQ · Needs review",
    short: "Needs review",
    followUp: false,
    answerCard: false,
    angle: null,
  },
};

export const HARD_STOP: Category[] = ["hard_no", "unsubscribe"];

export const isHardStop = (c: Category) => HARD_STOP.includes(c);

/** A group gets a draft campaign only for follow-up categories with enough eligible contacts. */
export function canDraft(category: Category, eligibleCount: number, minGroupSize = 2) {
  return TAXONOMY[category].followUp && !isHardStop(category) && eligibleCount >= minGroupSize;
}
