import type { Category } from "./types";

// Reply categories, in display order. `definition` is what the classifier is told.
// followUp: "yes" = may get a follow-up campaign; "rep" = hand to a rep, not a campaign;
// "later" = hold until the revisit date; "never" = never contacted again.

export type FollowUp = "yes" | "rep" | "later" | "never";

export interface CategoryInfo {
  key: Category;
  label: string; // also the graph8 inbox tag name, prefixed with TAG_PREFIX
  definition: string;
  followUp: FollowUp;
  answerCard: boolean; // is this an objection an Answer Card should address?
  angle?: string; // follow-up campaign angle
}

export const TAG_PREFIX = "ReplyIQ · ";

export const CATEGORIES: readonly CategoryInfo[] = [
  {
    key: "meeting_booked",
    label: "Meeting booked",
    definition: "A meeting or call is CONFIRMED somewhere in the conversation (time agreed, invite sent, booking confirmed), even if the latest message is about rescheduling or a detail.",
    followUp: "never",
    answerCard: false,
  },
  {
    key: "meeting_request",
    label: "Meeting request",
    definition: "The prospect asks to schedule a call/meeting or proposes times, but nothing is confirmed yet.",
    followUp: "rep",
    answerCard: false,
    angle: "Confirm a time",
  },
  {
    key: "interested_no_meeting",
    label: "Interested, no meeting",
    definition: "Positive interest or a request for information/materials (agenda, deck, details), without asking for a meeting and not about price.",
    followUp: "yes",
    answerCard: true,
    angle: "Send what they asked for and make booking easy",
  },
  {
    key: "pricing_request",
    label: "Pricing request",
    definition: "Asks what it costs or for pricing details, neutrally (not saying it is too expensive).",
    followUp: "yes",
    answerCard: true,
    angle: "Pricing plus ROI and proof",
  },
  {
    key: "price_objection",
    label: "Price objection",
    definition: "Says it is too expensive, there is no budget, or cost is the blocker.",
    followUp: "yes",
    answerCard: true,
    angle: "ROI and a cheaper path in",
  },
  {
    key: "timing_not_now",
    label: "Not now",
    definition: "A real person says not now / later / next quarter / too busy. Not an automatic out-of-office.",
    followUp: "later",
    answerCard: true,
    angle: "A new hook when the timing is right",
  },
  {
    key: "competitor_locked_in",
    label: "Competitor",
    definition: "Already uses or is contracted with another vendor or tool for this.",
    followUp: "yes",
    answerCard: true,
    angle: "Displacement: what they gain by switching",
  },
  {
    key: "referral_wrong_person",
    label: "Referral",
    definition: "Wrong person, or the contact has left/retired, AND the reply points to ANYONE else to contact instead: a named person, a role or team (\"my manager\", \"their team leaders\"), or a replacement email address for this person. Generic company inboxes (support@, sales@, info@) listed by a dead-address notice do NOT count. Put the person's name (or the role) in referred_name.",
    followUp: "yes",
    answerCard: false,
    angle: "Intro to the person they named",
  },
  {
    key: "no_need",
    label: "No need",
    definition: "Says they do not need it or already solved the problem another way (not a named competitor).",
    followUp: "yes",
    answerCard: true,
    angle: "A different pain they do have",
  },
  {
    key: "out_of_office",
    label: "Out of office",
    definition: "An out-of-office / away notice: the person OR the office is away or closed (vacation, PTO, travel, holiday, office closed), usually automatic. A bare \"out of office\" counts; a return date is optional. Put the return date or period, if any, in revisit_hint.",
    followUp: "later",
    answerCard: false,
  },
  {
    key: "hard_no",
    label: "Hard no",
    definition: "Explicitly not interested or says no, without asking to be removed.",
    followUp: "never",
    answerCard: false,
  },
  {
    key: "unsubscribe",
    label: "Unsubscribe",
    definition: "Asks to be removed, unsubscribed, taken off the list, or to stop emailing. Wins over hard_no when both apply.",
    followUp: "never",
    answerCard: false,
  },
  {
    key: "other",
    label: "Needs review",
    definition: "Anything else: bounce or invalid / no-longer-in-service address (even if it lists generic support or sales inboxes), left the company pointing to NO one (no name, role or address), a generic auto-acknowledgement that mentions no absence, placeholder text, or unclear.",
    followUp: "never",
    answerCard: false,
  },
];

// Compile-time guarantee that CATEGORIES covers every Category exactly (and nothing else).
type Missing = Exclude<Category, (typeof CATEGORIES)[number]["key"]>;
const _exhaustive: Missing extends never ? true : Missing = true;
void _exhaustive;

export const CATEGORY_KEYS = CATEGORIES.map((c) => c.key) as [Category, ...Category[]];

const BY_KEY = new Map(CATEGORIES.map((c) => [c.key, c]));

export function categoryInfo(key: Category): CategoryInfo {
  const info = BY_KEY.get(key);
  if (!info) throw new Error(`Unknown category: ${key}`);
  return info;
}

export const labelOf = (key: Category) => categoryInfo(key).label;
export const tagNameOf = (key: Category) => `${TAG_PREFIX}${labelOf(key)}`;
/** Never contacted again, whatever else happens. */
export const isHardStop = (key: Category) => key === "hard_no" || key === "unsubscribe";
/** May be put into a follow-up campaign audience. */
export const allowsFollowUpCampaign = (key: Category) => categoryInfo(key).followUp === "yes" || categoryInfo(key).followUp === "later";
export const sortIndex = (key: Category) => CATEGORIES.findIndex((c) => c.key === key);

/** Replies below this confidence are flagged for a human. */
export const REVIEW_THRESHOLD = 0.6;
