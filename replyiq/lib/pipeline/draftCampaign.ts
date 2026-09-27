// M5: draft a follow-up campaign in graph8 Studio for ONE group of a saved run. Nothing is sent or
// launched. On demand only (Studio doc generation spends AI credits).
//
//   audience  -> eligible contacts; for referrals, the NAMED people found in the CRM (free search)
//   re-check  -> suppression + hard stops re-verified right before anyone is added (fail closed)
//   list      -> POST /lists, then add contacts (409 conflict -> skip_all: warned contacts left out)
//   campaign  -> POST /campaigns with auto_generate_documents; brief assembled by code from grounded
//                data (Answer Card, verbatim quotes, verified proof, proof gap = "do not claim")
//   docs      -> wait for generation, then append the Answer Card to Messaging & Objections and
//                Reply Templates (marker-guarded, so re-runs never duplicate)
//   sequence  -> the follow-up EMAILS as a graph8 Sequencer draft (followupSequence.ts): step 1 written
//                per contact by graph8's AI from grounded instructions, step 2 ReplyIQ's fact-checked text;
//                no sender attached, never run here
// Every stage is persisted; re-running reuses the existing list / campaign (idempotency keys + saved ids).
import { z } from "zod";
import type { CampaignDocument, G8Client } from "../g8";
import { describeError, docText } from "../g8";
import { docLabel, docList } from "../docLabels";
import type { Llm } from "../llm";
import type { RunStore } from "../store";
import { allowsFollowUpCampaign, categoryInfo, isHardStop } from "../taxonomy";
import type { CampaignDraft, Classified, Group, Run } from "../types";
import { callStops } from "./channels";
import { buildFollowupSequence, type SequenceClient } from "./followupSequence";
import { planStrategy, strategySection } from "./strategy";
import { findCampaignDoc } from "./sources";

export const LIMITS = { name: 255, category: 100, persona: 200, goal: 255 } as const;
const clip = (s: string, n: number) => (s.length <= n ? s : `${s.slice(0, n - 1).trimEnd()}…`);
/** Distinct reply quotes (identical replies are common in bulk campaigns). */
const distinctQuotes = (g: Group, max: number) =>
  [...new Map(g.replies.map((r) => [r.quote.replace(/\s+/g, " ").trim().toLowerCase(), r])).values()].slice(0, max);
const claimText = (c: string) => c.trim().replace(/[.;:,]+$/, "");

// ---------- referral targets ----------

const ROLE_WORDS = /\b(team|teams|leader|leaders|manager|department|sales|support|office|staff|colleague|someone|their|our|my|the)\b/i;

/** "Claudia Boehringer and Annie Nash" -> ["Claudia Boehringer", "Annie Nash"]; roles / emails dropped. */
export function parsePersonNames(referred: string | undefined): string[] {
  if (!referred) return [];
  return referred
    .split(/\s+(?:and|&)\s+|[,;/]/i)
    .map((s) => s.replace(/[“”"()]/g, "").trim())
    .filter((s) => !s.includes("@") && !ROLE_WORDS.test(s) && /^[A-Z][A-Za-z'’.-]+(?:\s+[A-Z][A-Za-z'’.-]+){1,3}$/.test(s));
}

/** How two person names are compared (case and spacing ignored). Also used by the API preflight. */
export const nameKey = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
const sameName = (a: string, b: string) => nameKey(a) === nameKey(b);

type DraftClient = SequenceClient &
  Pick<
  G8Client,
  | "assertWriteAllowed"
  | "searchContacts"
  | "getSuppression"
  | "createList"
  | "addContactsToList"
  | "createCampaign"
  | "getCampaign"
  | "listCampaignDocs"
  | "getCampaignDoc"
  | "updateCampaignDoc"
  | "getCampaignFull"
  | "searchCallResults"
  | "listContactsOfList"
  | "removeContactsFromList"
  | "updateCampaign"
>;

/** Referral group: find each named person in the CRM (exact full name, same company). */
export async function referralTargets(client: Pick<DraftClient, "searchContacts">, group: Group) {
  const found: CampaignDraft["audience"] = [];
  const notes: string[] = [];
  for (const r of group.replies) {
    const names = parsePersonNames(r.referredName);
    if (names.length === 0) {
      notes.push(`${r.company ?? r.contactEmail}: pointed to "${r.referredName ?? "no one named"}" (not a person we can look up)`);
      continue;
    }
    for (const name of names) {
      const last = name.split(" ").at(-1)!;
      let matches: Awaited<ReturnType<typeof client.searchContacts>> = [];
      try {
        matches = (await client.searchContacts({ name: last, company_name: r.company || undefined })).filter(
          (c) => c.id && sameName(`${c.first_name ?? ""} ${c.last_name ?? ""}`, name),
        );
      } catch (err) {
        notes.push(`${name}: CRM search failed (${err instanceof Error ? err.message : String(err)})`);
        continue;
      }
      if (matches.length === 1 && matches[0].work_email) {
        found.push({ contactId: matches[0].id!, email: matches[0].work_email, threadId: r.threadId, referredBy: r.contactName ?? r.contactEmail });
      } else if (matches.length > 1) {
        notes.push(`${name} (${r.company ?? "?"}): ${matches.length} CRM matches, ambiguous; skipped`);
      } else {
        notes.push(`${name} (${r.company ?? "?"}): not in the CRM yet (an enrichment lookup would cost credits; needs approval)`);
      }
    }
  }
  return { found, notes };
}

// ---------- brief + fields ----------

const hardStopContacts = (run: Run) => {
  const ids = new Set<number>();
  const emails = new Set<string>();
  for (const r of run.groups.flatMap((g) => g.replies)) {
    if (!isHardStop(r.category)) continue;
    if (r.contactId) ids.add(r.contactId);
    if (r.contactEmail) emails.add(r.contactEmail.toLowerCase());
  }
  return { ids, emails };
};

export function timingNote(group: Group): string | undefined {
  const info = categoryInfo(group.key);
  if (info.followUp !== "later") return undefined;
  const hints = [...new Set(group.replies.map((r) => r.revisitHint).filter((h): h is string => Boolean(h)))];
  return hints.length
    ? `Advisory: launch after the prospects are back. Return dates mentioned: ${hints.join("; ")}. graph8 has no delayed start, so hold the launch until then.`
    : "Advisory: these prospects asked for later contact; hold the launch until the timing is right.";
}

/** The Studio campaign brief, assembled from grounded data only (no free-form model text in facts). */
export function buildBrief(run: Run, group: Group, audienceSize: number): string {
  const info = categoryInfo(group.key);
  const card = group.card;
  const lines: string[] = [
    `# ReplyIQ follow-up: ${group.label}`,
    "",
    `Source campaign: **${run.source.name}**. This follow-up targets ${audienceSize} contact(s) whose replies ReplyIQ grouped as **${group.label}** (${info.definition})`,
    `Angle: ${card?.emailAngle ?? info.angle ?? "Follow up on what they told us."}`,
    "",
    "## What they said (verbatim)",
    ...distinctQuotes(group, 8).map((r) => `- "${r.quote.replace(/\s+/g, " ").slice(0, 220)}" (${r.company ?? r.contactEmail})`),
  ];
  if (group.themes?.length) lines.push("", "## Themes", ...group.themes.map((t) => `- ${t.label} (${t.threadIds.length}): ${t.description}`));
  if (card) {
    lines.push("", "## Answer Card", `**Summary:** ${card.summary}`, "", "**Proof we have (verbatim from company documents):**");
    lines.push(...(card.proofWeHave.length ? card.proofWeHave.map((p) => `- ${claimText(p.claim)}: "${p.excerpt.replace(/\s+/g, " ")}" (source: ${p.sourceDocName})`) : ["- None verified."]));
    lines.push("", `**Proof gap: do NOT claim this:** ${card.proofGap ?? "none"}`, "", `**How to answer:** ${card.howToAnswer}`);
    if (card.themeNotes.length) lines.push(...card.themeNotes.map((n) => `- ${n.label}: ${n.howToAnswer}`));
  }
  if (group.key === "referral_wrong_person") {
    lines.push("", "## Referral", "Each contact was named by a previous contact who left or pointed us onward. Open with the referral (\"<name> suggested I reach out\").");
  }
  const timing = timingNote(group);
  if (timing) lines.push("", "## Timing", timing);
  lines.push(
    "",
    "## Rules",
    "- Never contact anyone who said no or asked to be removed (already excluded from the audience).",
    "- Do not state any fact that is not in the proof above; anything under the proof gap must not be claimed.",
    `- Generated by ReplyIQ from run ${run.id}.`,
  );
  return lines.join("\n");
}

const FieldsSchema = z.object({ primary_hook: z.string(), core_concept: z.string(), goal: z.string(), target_persona: z.string() });

export async function campaignFields(llm: Llm | null, model: string, run: Run, group: Group, sourcePersona?: string | null) {
  const info = categoryInfo(group.key);
  const fallback = {
    primary_hook: group.card?.emailAngle ?? info.angle ?? `Following up on your reply`,
    core_concept: group.card?.summary ?? `Follow up with prospects who replied: ${info.label}`,
    goal: "Book meetings with prospects who replied to the original campaign",
    target_persona: sourcePersona ?? "Prospects who replied to the original campaign",
  };
  if (!llm) return { ...fallback, source: "fallback" as const };
  try {
    const { data } = await llm.parse({
      model,
      system:
        "You name a follow-up email campaign. Use only the facts given. primary_hook: one sentence (max 25 words). core_concept: one sentence. goal: max 20 words. target_persona: max 20 words. No invented numbers or customers.",
      user: JSON.stringify({
        group: info.label,
        what_they_said: group.replies.slice(0, 6).map((r) => r.quote),
        answer_card: group.card ? { summary: group.card.summary, email_angle: group.card.emailAngle, proof: group.card.proofWeHave.map((p) => p.claim), do_not_claim: group.card.proofGap } : null,
        original_campaign: run.source.name,
        original_persona: sourcePersona ?? null,
      }),
      schema: FieldsSchema,
      name: "campaign_fields",
    });
    return {
      primary_hook: data.primary_hook.trim() || fallback.primary_hook,
      core_concept: data.core_concept.trim() || fallback.core_concept,
      goal: clip(data.goal.trim() || fallback.goal, LIMITS.goal),
      target_persona: clip(data.target_persona.trim() || fallback.target_persona, LIMITS.persona),
      source: "model" as const,
    };
  } catch {
    return { ...fallback, source: "fallback" as const };
  }
}

// ---------- doc patching ----------

export const marker = (runId: string, key: string) => `<!-- replyiq:${runId}:${key} -->`;
/** This group's section written by ANY run: a campaign holds one Answer Card section per group, whichever run wrote it. */
export const anyRunMarker = (key: string) => new RegExp(`<!-- replyiq:[a-z0-9]{12}:${key.replace(/[^a-z_]/g, "")} -->`);

/**
 * Put ReplyIQ's section into a document: append it if absent; with `refresh`, replace ONLY our own
 * marked section (from its marker to the next ReplyIQ marker or the end), leaving other text alone.
 * The section is found by this run's marker, else by any run's marker for the same group (an adopted
 * draft), so a document never holds two sections for one group.
 */
export function upsertSection(content: string, section: string, mark: string, refresh: boolean): string | null {
  let at = content.indexOf(mark);
  let found = mark;
  const key = /^<!-- replyiq:[a-z0-9]+:([a-z_]+) -->$/.exec(mark)?.[1];
  if (at === -1 && key) {
    const m = anyRunMarker(key).exec(content);
    if (m) [at, found] = [m.index, m[0]];
  }
  if (at === -1) return content.trim() ? `${content.trimEnd()}\n\n${section}\n` : `${section}\n`;
  if (!refresh) return null; // already there
  const after = content.indexOf("<!-- replyiq:", at + found.length);
  const end = after === -1 ? content.length : after;
  return `${content.slice(0, at)}${section}\n${after === -1 ? "" : `\n${content.slice(end)}`}`;
}

export function cardSection(run: Run, group: Group, kind: "objections" | "replyTemplates"): string {
  const card = group.card;
  const head =
    kind === "objections"
      ? `## ReplyIQ Answer Card: ${group.label}`
      : `## ReplyIQ reply guidance: ${group.label}`;
  const lines = [marker(run.id, group.key), head, `_Added by ReplyIQ from ${group.replies.length} real replies to "${run.source.name}". Proof points are verbatim from company documents._`, ""];
  lines.push("**When prospects say:**", ...distinctQuotes(group, 4).map((r) => `> "${r.quote.replace(/\s+/g, " ").slice(0, 200)}"`), "");
  if (card) {
    if (kind === "objections") {
      lines.push("**Proof we have:**", ...(card.proofWeHave.length ? card.proofWeHave.map((p) => `- ${claimText(p.claim)}: "${p.excerpt.replace(/\s+/g, " ")}" (${p.sourceDocName})`) : ["- None verified."]), "");
      lines.push(`**Proof gap (do not claim):** ${card.proofGap ?? "none"}`, "");
    }
    lines.push(`**How to answer:** ${card.howToAnswer}`, "", `**Email angle:** ${card.emailAngle}`);
    for (const n of card.themeNotes) lines.push(`- *${n.label}:* ${n.howToAnswer}`);
  } else {
    lines.push(`**Angle:** ${categoryInfo(group.key).angle ?? "Follow up on what they told us."}`);
    for (const t of group.themes ?? []) lines.push(`- *${t.label}* (${t.threadIds.length}): ${t.description}`);
    const timing = timingNote(group);
    if (timing) lines.push("", timing);
  }
  return lines.join("\n");
}

const statusOf = (d: CampaignDocument) => (d.status ?? "").toLowerCase();
const isComplete = (d: CampaignDocument) => statusOf(d) === "completed";
const isFailed = (d: CampaignDocument) => statusOf(d) === "failed";
/** Studio is done with a doc when it completed or failed (observed statuses: generating, completed, failed). */
const isTerminal = (d: CampaignDocument) => isComplete(d) || isFailed(d);

// ---------- orchestration ----------

export interface DraftDeps {
  g8: DraftClient;
  llm: Llm | null;
  model: string;
  store: RunStore;
  minAudience?: number;
  pollMs?: number;
  timeoutMs?: number;
  now?: () => Date;
  sleep?: (ms: number) => Promise<void>;
  log?: (m: string) => void;
  auditModel?: string; // fact-checks the follow-up emails (defaults to model)
  ownerEmail?: string; // follow-up sequence owner (defaults to the original sequence's owner)
  agentName?: string; // graph8 textual agent used for previews
}

export interface DraftOptions {
  runId: string;
  groupKey: Group["key"];
  force?: boolean; // create a new campaign even if one exists for this group
  patchOnly?: boolean; // only (re)try patching docs of an existing draft
  refreshDocs?: boolean; // re-write ReplyIQ's own sections (e.g. after the card changed)
  sequenceOnly?: boolean; // only build (or preview) the follow-up sequence of an existing draft
  skipSequence?: boolean; // do not build the follow-up sequence
  rebuildSequence?: boolean; // create a new sequence even if one exists
  refreshSequence?: boolean; // re-write the existing sequence's steps in place
  previews?: number; // graph8 drafts of step 1 for up to N contacts (spends credits)
  /**
   * This run took over an earlier run's draft (already copied onto the group): re-check the audience and sync
   * the same list to it, replace the Answer Card section in the same campaign's documents, update the brief,
   * and rewrite the same follow-up sequence in place. No new list, campaign or sequence; no Studio generation.
   */
  adopt?: boolean;
  skipStrategy?: boolean; // do not (re)build the revised strategy
}

export class DraftError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DraftError";
  }
}

export async function draftCampaign(deps: DraftDeps, opts: DraftOptions): Promise<CampaignDraft> {
  const now = () => (deps.now ?? (() => new Date()))().toISOString();
  const sleep = deps.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)));
  const log = deps.log ?? (() => {});
  const run = await deps.store.load(opts.runId);
  if (!run) throw new DraftError(`run ${opts.runId} not found`);
  const group = run.groups.find((g) => g.key === opts.groupKey);
  if (!group) throw new DraftError(`run ${opts.runId} has no "${opts.groupKey}" group`);
  if (!allowsFollowUpCampaign(group.key)) throw new DraftError(`"${group.label}" never gets a follow-up campaign (${categoryInfo(group.key).followUp})`);
  if (run.steps.resolve !== "done") throw new DraftError("the run's audience was not resolved; re-run the pipeline first");

  const save = async (d: CampaignDraft) => {
    d.updatedAt = now();
    group.draft = d;
    run.updatedAt = d.updatedAt;
    await deps.store.save(run);
    return d;
  };

  await deps.g8.assertWriteAllowed();
  const existing = group.draft;
  const reuse = existing?.campaignId && !opts.force;
  const draft: CampaignDraft = reuse
    ? { ...existing!, status: "drafting", error: undefined, warnings: [], docsPatched: [...new Set(existing!.docsPatched)] }
    : { status: "drafting", audience: [], audienceNotes: [], docsPatched: [], docsPending: [], docsFailed: [], generation: "unknown", warnings: [], createdAt: now(), updatedAt: now() };
  draft.docsFailed ??= [];
  if (opts.patchOnly && !draft.campaignId) throw new DraftError("no existing draft to patch; create it first");
  if (opts.sequenceOnly && !draft.listId) throw new DraftError("no existing draft with a list; create the draft first");
  await save(draft);

  // 1-2) Audience, re-checked right before anyone is added: hard stops in any thread, a "no" on a call,
  // and suppression (fail closed). Deduped by contact.
  const buildAudience = async (): Promise<CampaignDraft["audience"]> => {
    draft.audienceNotes = [];
    const { ids: stopIds, emails: stopEmails } = hardStopContacts(run);
    let candidates: CampaignDraft["audience"];
    if (group.key === "referral_wrong_person") {
      const { found, notes } = await referralTargets(deps.g8, group);
      candidates = found;
      draft.audienceNotes.push(...notes);
    } else {
      candidates = group.eligible.map((e) => ({ ...e }));
    }
    const saidNo = new Set(run.channels?.calls.saidNo ?? []);
    const booked = new Set(run.channels?.calls.booked ?? []);
    try {
      const live = await callStops(deps.g8, candidates.map((c) => c.contactId));
      for (const id of live.saidNo) saidNo.add(id);
      for (const id of live.booked) booked.add(id);
    } catch (err) {
      draft.warnings.push(`call outcomes could not be re-read (${describeError(err)}); the run's own call check still applies`);
    }
    const audience: CampaignDraft["audience"] = [];
    for (const c of candidates) {
      if (audience.some((a) => a.contactId === c.contactId)) continue;
      if (stopIds.has(c.contactId) || stopEmails.has(c.email.toLowerCase())) {
        draft.audienceNotes.push(`${c.email}: said no / unsubscribed in another thread; excluded`);
        continue;
      }
      if (saidNo.has(c.contactId)) {
        draft.audienceNotes.push(`${c.email}: said not interested / do not call on a call; excluded`);
        continue;
      }
      if (booked.has(c.contactId)) {
        draft.audienceNotes.push(`${c.email}: booked a meeting on a call; no follow-up needed`);
        continue;
      }
      try {
        const s = await deps.g8.getSuppression(c.contactId);
        if (s.is_suppressed || (s.active_channels ?? []).length) {
          draft.audienceNotes.push(`${c.email}: suppressed; excluded`);
          continue;
        }
      } catch {
        draft.audienceNotes.push(`${c.email}: suppression check failed; excluded (fail closed)`);
        continue;
      }
      audience.push(c);
    }
    const min = deps.minAudience ?? 2;
    if (audience.length < min) {
      throw new DraftError(`only ${audience.length} contact(s) can be targeted for "${group.label}" (minimum ${min}). ${draft.audienceNotes.slice(0, 3).join(" | ")}`);
    }
    return audience;
  };

  // An adopted draft's documents carry the earlier run's section: always replace it with this run's.
  const refreshDocs = Boolean(opts.refreshDocs || opts.adopt);

  // Stages 1-5: audience, list, Studio campaign, documents.
  const studioStages = async () => {
    if (draft.campaignId && opts.adopt) {
      // Taking over an earlier run's draft: this run's audience replaces the list's members, and this run's
      // evidence replaces the brief. The campaign, its documents and the sequence stay the same objects.
      const audience = await buildAudience();
      const members = new Set((await deps.g8.listContactsOfList(draft.listId!)).map((m) => m.id).filter((x): x is number => typeof x === "number"));
      const wanted = new Set(audience.map((a) => a.contactId));
      const remove = [...members].filter((id) => !wanted.has(id));
      const add = [...wanted].filter((id) => !members.has(id));
      if (remove.length) await deps.g8.removeContactsFromList(draft.listId!, remove);
      if (add.length) {
        const added = await deps.g8.addContactsToList(draft.listId!, add);
        if (added.conflictSkipped) draft.audienceNotes.push("graph8 flagged some contacts (e.g. already in other outreach); they were skipped, not forced in");
      }
      draft.audience = audience;
      draft.timingNote = timingNote(group);
      await save(draft);
      log(`  list ${draft.listId} synced to this run's audience (+${add.length} / -${remove.length})`);
      try {
        await deps.g8.updateCampaign(draft.campaignId, { brief: buildBrief(run, group, audience.length) });
      } catch (err) {
        draft.warnings.push(`the campaign brief could not be updated (${describeError(err)})`);
      }
    } else if (!draft.campaignId) {
      const audience = await buildAudience();
      draft.audience = audience;
      draft.timingNote = timingNote(group);
      await save(draft);

      // 3) List.
      if (!draft.listId) {
        const title = clip(`ReplyIQ · ${group.label} · ${run.source.name}`, 120);
        const list = await deps.g8.createList(title, `ReplyIQ follow-up audience (run ${run.id}, group ${group.key}).`, `replyiq:${run.id}:${group.key}:list`);
        if (!list?.id) throw new Error("graph8 did not return a list id");
        draft.listId = list.id;
        draft.listTitle = list.title ?? title;
        await save(draft);
        log(`  list ${draft.listId} created`);
      }
      const added = await deps.g8.addContactsToList(draft.listId, audience.map((a) => a.contactId));
      if (added.conflictSkipped) draft.audienceNotes.push("graph8 flagged some contacts (e.g. already in other outreach); they were skipped, not forced in");
      await save(draft);

      // 4) Campaign.
      let persona: string | null = null;
      if (run.source.campaignId) {
        try {
          persona = (await deps.g8.getCampaignFull(run.source.campaignId)).target_persona ?? null;
        } catch {
          /* optional */
        }
      }
      const fields = await campaignFields(deps.llm, deps.model, run, group, persona);
      if (fields.source === "fallback" && deps.llm) draft.warnings.push("campaign hook/concept used fallback text (model unavailable)");
      const name = clip(`ReplyIQ · ${group.label} follow-up · ${run.source.name}`, LIMITS.name);
      const created = await deps.g8.createCampaign(
        {
          name,
          category: "Outbound",
          brief: buildBrief(run, group, audience.length),
          core_concept: fields.core_concept,
          primary_hook: fields.primary_hook,
          target_persona: fields.target_persona,
          goal: fields.goal,
          audience_list_id: String(draft.listId),
          target_channels: ["email"],
          auto_generate_documents: true,
        },
        `replyiq:${run.id}:${group.key}:campaign${opts.force ? `:${Date.now()}` : ""}`,
      );
      if (!created?.id) throw new Error("graph8 did not return a campaign id");
      draft.campaignId = created.id;
      draft.campaignName = created.name ?? name;
      if (created.generation_status === "failed_to_dispatch") draft.warnings.push("graph8 could not start document generation");
      await save(draft);
      log(`  campaign ${draft.campaignId} created (${created.status ?? "?"}, generation ${created.generation_status ?? "?"})`);
    }

    // 5) Wait for Studio to generate the documents, then patch.
    const timeoutMs = deps.timeoutMs ?? 240_000;
    const pollMs = deps.pollMs ?? 5_000;
    const started = Date.now();
    let docs: CampaignDocument[] = [];
    for (;;) {
      docs = await deps.g8.listCampaignDocs(draft.campaignId!);
      const done = docs.length > 0 && docs.every(isTerminal);
      draft.generation = done ? "complete" : "in_progress";
      if (done || Date.now() - started >= timeoutMs) break;
      log(`  waiting for Studio documents: ${docs.filter(isTerminal).length}/${docs.length} finished (${docs.filter(isFailed).length} failed)`);
      await sleep(pollMs);
    }
    draft.docsFailed = docs.filter(isFailed).map((d) => d.file_type ?? d.display_name ?? d.id);
    if (draft.docsFailed.length) draft.warnings.push(`graph8 Studio could not generate ${docList(draft.docsFailed)} (a known graph8 issue in this org)`);

    // Docs ReplyIQ owns content for. Completed -> append our section (marker-guarded).
    // Failed (empty) -> write our grounded section into it. Still generating -> leave alone, patch later.
    draft.docsPending = [];
    const targets: { kind: "objections" | "replyTemplates" | "brief"; render: () => string }[] = [
      { kind: "objections", render: () => cardSection(run, group, "objections") },
      { kind: "replyTemplates", render: () => cardSection(run, group, "replyTemplates") },
      { kind: "brief", render: () => `${marker(run.id, group.key)}\n${buildBrief(run, group, draft.audience.length)}` },
    ];
    for (const { kind, render } of targets) {
      const meta = findCampaignDoc(docs, kind);
      if (!meta) {
        if (kind !== "brief") draft.warnings.push(`campaign has no ${kind === "objections" ? "Messaging & Objections" : "Reply Templates"} document`);
        continue;
      }
      const label = meta.file_type ?? kind;
      if (draft.docsPatched.includes(label) && !refreshDocs) continue;
      if (kind === "brief" && !isFailed(meta)) continue; // a generated brief is Studio's; only fill a failed one
      if (!isTerminal(meta)) {
        draft.docsPending.push(label); // generation would overwrite our text: patch later
        continue;
      }
      const content = docText(await deps.g8.getCampaignDoc(draft.campaignId!, meta.id));
      const next = upsertSection(content, render(), marker(run.id, group.key), refreshDocs);
      if (next !== null && next !== content) {
        await deps.g8.updateCampaignDoc(draft.campaignId!, meta.id, next);
        if (!content.trim()) draft.warnings.push(`${docLabel(label)}: Studio left it empty; ReplyIQ wrote its grounded section into it`);
      }
      if (!draft.docsPatched.includes(label)) draft.docsPatched.push(label);
      await save(draft);
    }
    if (draft.docsPending.length)
      draft.warnings.push(`Studio is still writing ${docList(draft.docsPending)}; add the Answer Card once it finishes ("Add the card to late docs" in the app, --patch-only from the CLI)`);
  };

  try {
    if (!opts.sequenceOnly) await studioStages();
    // 6) The follow-up emails, as a Sequencer draft. Not critical for the Studio draft: failures are warnings.
    if (!opts.skipSequence) {
      try {
        draft.sequence = await buildFollowupSequence(
          { g8: deps.g8, llm: deps.llm, model: deps.model, auditModel: deps.auditModel, ownerEmail: deps.ownerEmail, agentName: deps.agentName, now: deps.now, log },
          run,
          group,
          draft,
          { previews: opts.previews, rebuild: opts.rebuildSequence, refresh: opts.refreshSequence || opts.adopt },
        );
        if (draft.sequence.status === "failed") draft.warnings.push(`follow-up sequence not created: ${draft.sequence.error}`);
      } catch (err) {
        draft.warnings.push(`follow-up sequence not created: ${describeError(err)}`);
      }
      await save(draft);
    }
    // 7) The revised strategy across channels, from every channel's evidence. Not critical: failures are warnings.
    // Previews and late-doc patches leave it alone; a new draft, a rewrite and a takeover (re)build it.
    const wantsStrategy = !opts.patchOnly && (!opts.sequenceOnly || opts.refreshSequence) && !opts.skipStrategy;
    if (wantsStrategy && deps.llm && draft.sequence?.status === "ready") {
      try {
        draft.strategy = await planStrategy({ llm: deps.llm, model: deps.model, auditModel: deps.auditModel }, run, group, draft.sequence.facts, draft.sequence.doNotClaim, new Date(now()));
        await save(draft);
        await deps.g8.updateCampaign(draft.campaignId!, { brief: `${buildBrief(run, group, draft.audience.length)}\n\n${strategySection(draft.strategy)}` });
      } catch (err) {
        draft.warnings.push(`revised strategy not added (${describeError(err)})`);
      }
    }
    draft.status = "ready";
    return await save(draft);
  } catch (err) {
    draft.status = "failed";
    draft.error = err instanceof DraftError ? err.message : describeError(err);
    await save(draft);
    return draft;
  }
}

/** Groups of a run that could be drafted, with how many contacts each would target (before re-checks). */
export function draftableGroups(run: Run): { key: Group["key"]; label: string; eligible: number; hasCard: boolean; referrals: number }[] {
  return run.groups
    .filter((g) => allowsFollowUpCampaign(g.key))
    .map((g) => ({
      key: g.key,
      label: g.label,
      eligible: g.eligible.length,
      hasCard: Boolean(g.card),
      referrals: g.key === "referral_wrong_person" ? g.replies.reduce((n, r: Classified) => n + parsePersonNames(r.referredName).length, 0) : 0,
    }));
}
