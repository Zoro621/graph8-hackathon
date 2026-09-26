import type { Category, StepKey } from "../types";

/** Category hues, tuned for a near-black background. */
export const CATEGORY_COLOR: Record<Category, string> = {
  interested_no_meeting: "#4FE3D1",
  meeting_request: "#7CF29A",
  pricing_request: "#9B8CFF",
  price_objection: "#C78BFF",
  timing_not_now: "#6FB6FF",
  competitor_locked_in: "#FF9F6B",
  referral_wrong_person: "#F5D76E",
  no_need: "#8FA3BF",
  hard_no: "#FF5D7A",
  unsubscribe: "#FF3D6E",
  out_of_office: "#7A83A6",
  other: "#A0A0B8",
};

export const STEP_META: Record<StepKey, { title: string; agent: string; detail: string }> = {
  load: { title: "Load source", agent: "Scout", detail: "Sequence, steps and stats" },
  fetch: { title: "Fetch replies", agent: "Collector", detail: "Inbox threads, prospect messages" },
  classify: { title: "Classify", agent: "Analyst", detail: "Objection taxonomy with quotes" },
  tag: { title: "Tag threads", agent: "Scribe", detail: "Write tags back to graph8 Inbox" },
  resolve: { title: "Guard contacts", agent: "Warden", detail: "Suppression and hard-stop rules" },
  cards: { title: "Answer Cards", agent: "Strategist", detail: "Grounded proof and proof gaps" },
};

export const STEP_ORDER: StepKey[] = ["load", "fetch", "classify", "tag", "resolve", "cards"];
