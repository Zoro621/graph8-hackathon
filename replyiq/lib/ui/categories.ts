// UI metadata for the reply categories, derived from the shared taxonomy (lib/taxonomy.ts).
import { CATEGORIES, allowsFollowUpCampaign, categoryInfo, isHardStop, tagNameOf } from "../taxonomy";
import type { Category } from "../types";

/** Category hues, tuned for a near-black background. */
export const CATEGORY_COLOR: Record<Category, string> = {
  meeting_booked: "#3DDC97",
  meeting_request: "#8BF0B4",
  interested_no_meeting: "#4FE3D1",
  pricing_request: "#9B8CFF",
  price_objection: "#C78BFF",
  timing_not_now: "#6FB6FF",
  competitor_locked_in: "#FF9F6B",
  referral_wrong_person: "#F5D76E",
  no_need: "#8FA3BF",
  out_of_office: "#7A83A6",
  hard_no: "#FF5D7A",
  unsubscribe: "#FF3D6E",
  other: "#A0A0B8",
};

export interface CategoryMeta {
  key: Category;
  label: string;
  tag: string;
  definition: string;
  angle?: string;
  answerCard: boolean;
  hardStop: boolean;
  followUp: boolean; // may get a follow-up campaign
  note: string; // what happens to these replies, in a few words
  color: string;
}

function note(key: Category): string {
  if (isHardStop(key)) return "Never re-contacted";
  switch (categoryInfo(key).followUp) {
    case "yes":
      return "Gets a follow-up campaign";
    case "later":
      return "Follow up after they're back";
    case "rep":
      return "Hand to a rep";
    default:
      return key === "meeting_booked" ? "Already booked · no follow-up" : "No follow-up";
  }
}

export function meta(key: Category): CategoryMeta {
  const i = categoryInfo(key);
  return {
    key,
    label: i.label,
    tag: tagNameOf(key),
    definition: i.definition,
    angle: i.angle,
    answerCard: i.answerCard,
    hardStop: isHardStop(key),
    followUp: allowsFollowUpCampaign(key),
    note: note(key),
    color: CATEGORY_COLOR[key],
  };
}

export const ALL_CATEGORIES = CATEGORIES.map((c) => c.key);

export const hexToRgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)).join(",");
