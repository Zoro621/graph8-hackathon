import type { StepName } from "../types";

export const STEP_META: Record<StepName, { title: string; agent: string; detail: string }> = {
  load: { title: "Load source", agent: "Scout", detail: "Campaign, sequences and docs" },
  fetch: { title: "Fetch replies", agent: "Collector", detail: "Every thread with a prospect reply" },
  classify: { title: "Classify", agent: "Analyst", detail: "13 reasons, each with a quote" },
  themes: { title: "Find themes", agent: "Weaver", detail: "Patterns inside each group" },
  tag: { title: "Tag threads", agent: "Scribe", detail: "ReplyIQ tags in the graph8 Inbox" },
  resolve: { title: "Guard contacts", agent: "Warden", detail: "Hard stops and suppression" },
  cards: { title: "Answer Cards", agent: "Strategist", detail: "Grounded proof and proof gaps" },
};

export const STEP_ORDER: StepName[] = ["load", "fetch", "classify", "themes", "tag", "resolve", "cards"];
