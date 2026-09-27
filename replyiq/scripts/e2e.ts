// End-to-end regression against the real graph8 org and OpenAI. For every sequence with replies it
// runs the whole pipeline twice (fresh, then again to prove re-runs are stable and idempotent) and
// verifies each result by reading graph8 back. With --draft it also drafts one follow-up campaign,
// verifies it in Studio and re-drafts it to prove nothing is duplicated.
// Writes: ReplyIQ inbox tags (idempotent); with --draft, one list + one draft campaign (Studio doc
// generation spends credits). Nothing is ever sent or launched.
// Usage: npm run e2e -- [--draft auto|<groupKey>] [--source <sequenceId>] [--once]
import "./load-env";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { envStatus, getEnv } from "../lib/env";
import { createG8Client, describeError, docText, g8, WriteNotAllowedError } from "../lib/g8";
import { llm } from "../lib/llm";
import { callStops } from "../lib/pipeline/channels";
import { draftCampaign, marker, referralTargets } from "../lib/pipeline/draftCampaign";
import { verifyRecordedSequence } from "../lib/pipeline/followupSequence";
import { blockStart, blockText } from "../lib/pipeline/studioLearnings";
import { runPipeline } from "../lib/pipeline/runPipeline";
import { discoverSources, findCampaignDoc, pickDefaultSource, resolveSource } from "../lib/pipeline/sources";
import { createFileStore } from "../lib/store";
import { allowsFollowUpCampaign, CATEGORY_KEYS, isHardStop, REVIEW_THRESHOLD, TAG_PREFIX, tagNameOf } from "../lib/taxonomy";
import { norm, normLoose, withoutOwnSections, wordCount } from "../lib/text";
import type { Category, Group, Run, SourceSummary } from "../lib/types";

const arg = (flag: string) => {
  const i = process.argv.indexOf(flag);
  return i > -1 ? process.argv[i + 1] : undefined;
};

// ---------- check bookkeeping ----------

type Status = "pass" | "fail" | "warn" | "info";
interface CheckResult {
  area: string;
  name: string;
  status: Status;
  detail: string;
  ms: number;
}
const results: CheckResult[] = [];
const ICON: Record<Status, string> = { pass: "✅", fail: "❌", warn: "⚠️ ", info: "ℹ️ " };

class Fail extends Error {}
function must(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Fail(msg);
}
const problems = (list: string[]) => {
  if (list.length) throw new Fail(`${list.length} problem(s): ${list.slice(0, 5).join(" | ")}`);
};

async function check<T = undefined>(area: string, name: string, fn: () => Promise<{ status?: Status; detail: string; value?: T }>): Promise<T | undefined> {
  const t0 = Date.now();
  let r: CheckResult;
  let value: T | undefined;
  try {
    const out = await fn();
    value = out.value;
    r = { area, name, status: out.status ?? "pass", detail: out.detail, ms: Date.now() - t0 };
  } catch (err) {
    r = { area, name, status: "fail", detail: err instanceof Fail ? err.message : describeError(err), ms: Date.now() - t0 };
  }
  results.push(r);
  console.log(`${ICON[r.status]} [${area}] ${name}: ${r.detail} (${(r.ms / 1000).toFixed(1)}s)`);
  return value;
}

// ---------- invariants (hold for ANY campaign) ----------

const allReplies = (run: Run) => run.groups.flatMap((g) => g.replies);

function classificationProblems(run: Run): string[] {
  const p: string[] = [];
  const all = allReplies(run);
  if (new Set(all.map((r) => r.threadId)).size !== all.length) p.push("a reply is in more than one group");
  if (all.length !== run.counts.prospectReplies) p.push(`${all.length} classified vs ${run.counts.prospectReplies} fetched`);
  for (const g of run.groups) {
    if (!CATEGORY_KEYS.includes(g.key)) p.push(`unknown group ${g.key}`);
    for (const r of g.replies) if (r.category !== g.key) p.push(`thread ${r.threadId} sits in ${g.key} but is labelled ${r.category}`);
  }
  for (const r of all) {
    if (!(r.confidence >= 0 && r.confidence <= 1)) p.push(`thread ${r.threadId}: confidence ${r.confidence}`);
    if (r.needsReview !== r.confidence < REVIEW_THRESHOLD) p.push(`thread ${r.threadId}: review flag disagrees with confidence`);
    if (typeof r.contactId !== "number") p.push(`thread ${r.threadId}: no graph8 contact id`);
    if (!r.needsReview && !norm(r.replyText).includes(norm(r.quote))) p.push(`thread ${r.threadId}: quote is not verbatim`);
  }
  if (run.counts.needsReview !== all.filter((r) => r.needsReview).length) p.push("needs-review count mismatch");
  return p;
}

function themeProblems(run: Run): string[] {
  const p: string[] = [];
  for (const g of run.groups) {
    if (!g.themes) continue;
    if (g.replies.length < 2) p.push(`${g.key}: themes on a group of ${g.replies.length}`);
    const ids = g.themes.flatMap((t) => t.threadIds);
    if (new Set(ids).size !== ids.length) p.push(`${g.key}: a reply is in two themes`);
    const own = new Set(g.replies.map((r) => r.threadId));
    if (ids.length !== own.size || ids.some((id) => !own.has(id))) p.push(`${g.key}: themes do not cover the group exactly`);
    for (const t of g.themes) {
      const src = g.replies.find((r) => r.threadId === t.quoteThreadId);
      if (t.quoteVerified && !(src && norm(src.replyText).includes(norm(t.quote)))) p.push(`${g.key}/${t.label}: quote marked verified but not verbatim`);
    }
  }
  return p;
}

function hardStops(run: Run) {
  const ids = new Set<number>();
  const emails = new Set<string>();
  for (const r of allReplies(run)) {
    if (!isHardStop(r.category)) continue;
    if (r.contactId) ids.add(r.contactId);
    if (r.contactEmail) emails.add(r.contactEmail.toLowerCase());
  }
  return { ids, emails };
}

function audienceProblems(run: Run): string[] {
  const p: string[] = [];
  const stop = hardStops(run);
  for (const g of run.groups) {
    const seen = new Set<number>();
    for (const e of g.eligible) {
      if (!allowsFollowUpCampaign(g.key)) p.push(`${g.key}: eligible contact in a no-follow-up group`);
      if (stop.ids.has(e.contactId) || stop.emails.has(e.email.toLowerCase())) p.push(`${g.key}: hard-stop contact ${e.contactId} is eligible`);
      if (seen.has(e.contactId)) p.push(`${g.key}: contact ${e.contactId} eligible twice`);
      seen.add(e.contactId);
    }
    for (const r of g.replies) {
      const inEligible = g.eligible.some((e) => e.threadId === r.threadId || e.contactId === r.contactId);
      const ex = g.excluded.find((x) => x.threadId === r.threadId);
      if (!inEligible && !ex) p.push(`${g.key}: thread ${r.threadId} is neither eligible nor excluded`);
      if (isHardStop(r.category) && ex?.reason !== r.category) p.push(`${g.key}: hard stop ${r.threadId} excluded as ${ex?.reason ?? "nothing"}`);
    }
  }
  return p;
}

async function cardProblems(run: Run, docs: Map<string, string>): Promise<{ problems: string[]; cards: number; proof: number; gaps: number }> {
  const p: string[] = [];
  let cards = 0;
  let proof = 0;
  let gaps = 0;
  for (const g of run.groups) {
    const c = g.card;
    if (!c) continue;
    cards++;
    for (const q of c.quotes) if (!g.replies.some((r) => norm(r.replyText).includes(norm(q)))) p.push(`${g.key}: card quote not verbatim "${q.slice(0, 40)}"`);
    for (const item of c.proofWeHave) {
      const text = docs.get(item.sourceDocId);
      if (text === undefined) p.push(`${g.key}: proof cites unknown document ${item.sourceDocId}`);
      else if (wordCount(item.excerpt) < 6 || !normLoose(text).includes(normLoose(item.excerpt))) p.push(`${g.key}: excerpt not found in "${item.sourceDocName}"`);
      proof++;
    }
    if (c.proofGap) gaps++;
    if (!c.proofWeHave.length && !c.proofGap) p.push(`${g.key}: card has neither proof nor a gap`);
  }
  return { problems: p, cards, proof, gaps };
}

/** The documents a run's cards were grounded on, re-read fresh from graph8, without ReplyIQ's own blocks. */
async function groundingDocs(run: Run): Promise<Map<string, string>> {
  const client = g8();
  const out = new Map<string, string>();
  const ctx = await resolveSource(client, run.source.selector);
  for (const d of Object.values(ctx.docs)) if (d) out.set(d.id, d.content);
  for (const d of await client.listGlobalDocs()) {
    const content = withoutOwnSections(d.content);
    if (content) out.set(d.id, content);
  }
  return out;
}

function snapshot(run: Run) {
  return {
    runId: run.id,
    source: run.source.name,
    selector: run.source.selector,
    status: run.status,
    steps: run.steps,
    counts: run.counts,
    usage: run.usage,
    tagging: run.tagging,
    audience: run.audience,
    cards: run.cards,
    groups: run.groups.map((g) => ({
      key: g.key,
      label: g.label,
      replies: g.replies.length,
      eligible: g.eligible.length,
      excluded: g.excluded.map((e) => e.reason),
      themes: (g.themes ?? []).map((t) => `${t.label} (${t.threadIds.length})`),
      card: g.card && { summary: g.card.summary, proof: g.card.proofWeHave.length, gap: g.card.proofGap, unverified: g.card.unverifiedClaims.length },
      draft: g.draft && { status: g.draft.status, campaignId: g.draft.campaignId, listId: g.draft.listId, audience: g.draft.audience.length, docsPatched: g.draft.docsPatched },
    })),
    errors: run.errors,
  };
}

// ---------- main ----------

async function main() {
  const env = getEnv();
  const client = g8();
  const store = createFileStore();
  const once = process.argv.includes("--once");
  const draftArg = arg("--draft");
  const sourceArg = arg("--source");
  const started = Date.now();
  console.log(`ReplyIQ end-to-end regression against graph8 (${new Date().toISOString()})\n`);

  // ----- A. Platform -----
  await check("platform", "keys and flags", async () => {
    const s = envStatus();
    must(s.g8Key && s.openaiKey, "a graph8 or OpenAI key is missing");
    return { detail: `graph8 + OpenAI keys set; models ${env.OPENAI_CLASSIFY_MODEL} / ${env.OPENAI_REASON_MODEL}; launch ${s.launchEnabled ? "ON" : "off"}` };
  });
  const policy = await check("platform", "write safety policy", async () => {
    const p = await client.writePolicy();
    must(p.allowed, `writes refused: ${"reason" in p ? p.reason : "?"}`);
    return { detail: `writes allowed via ${p.via} for ${p.orgId}`, value: p };
  });
  await check("platform", "write guard refuses a non-allowlisted org", async () => {
    const locked = createG8Client({ base: env.G8_API_BASE, apiKey: env.G8_API_KEY, writeOrgIds: [] });
    const p = await locked.writePolicy();
    must(!p.allowed, "an empty allowlist still allowed writes");
    try {
      await locked.createList("ReplyIQ e2e: must never exist", "guard check");
    } catch (err) {
      must(err instanceof WriteNotAllowedError, `unexpected error ${describeError(err)}`);
      return { detail: "blocked before any request was sent (fail closed)" };
    }
    throw new Fail("the write went through");
  });
  const creditsBefore = await check("platform", "credit balance", async () => {
    const u = await client.getUsage();
    return { status: "info", detail: `${u.available_credits ?? u.credits} available, ${u.held_credits ?? 0} held, ${u.total_used ?? "?"} used so far`, value: u.available_credits ?? u.credits };
  });
  await check("platform", "launch gate (mailboxes)", async () => {
    const boxes = (await client.listMailboxes()) ?? [];
    const active = boxes.filter((b) => b.connection_status === "active" && !b.is_archived);
    const states = boxes.map((b) => `${b.email ?? b.id}: ${b.connection_status ?? "?"}`).join(", ");
    return { status: "info", detail: `${boxes.length} sender mailbox(es), ${active.length} active (${states}); ENABLE_LAUNCH=${envStatus().launchEnabled}. Launch stays off.` };
  });
  if (!policy) return finish(started, [], undefined, undefined);

  // ----- B. Discovery -----
  const sources = (await check<SourceSummary[]>("discovery", "find campaigns and sequences at runtime", async () => {
    const all = await discoverSources(client);
    const withReplies = all.filter((s) => s.replyThreads > 0);
    must(withReplies.length > 0, "no sequence with replies");
    const def = pickDefaultSource(all);
    must(def, "no default source");
    const top = withReplies[0];
    return {
      detail: `${all.length} sequences, ${withReplies.length} with replies: ${withReplies.map((s) => `"${s.campaignName ?? s.sequenceName}" (${s.replyThreads})`).join(", ")}; default = "${top.campaignName ?? top.sequenceName}"`,
      value: withReplies,
    };
  })) ?? [];
  // One run per source; sequences linked to the same Studio campaign run together.
  const seen = new Set<string>();
  const targets = (sourceArg ? sources.filter((s) => s.sequenceId === sourceArg) : sources).filter((s) => {
    const k = s.campaignId ?? s.sequenceId;
    return seen.has(k) ? false : (seen.add(k), true);
  });
  if (sourceArg && targets.length === 0) console.log(`--source ${sourceArg} has no replies; nothing to run`);

  // ----- C/D. Pipeline per source, twice -----
  const firstRuns: Run[] = [];
  const secondRuns: Run[] = [];
  for (const s of targets) {
    const area = (s.campaignName ?? s.sequenceName).slice(0, 40);
    const selector = s.campaignId ? { campaignId: s.campaignId } : { sequenceId: s.sequenceId };
    const exec = () =>
      runPipeline(
        { g8: client, llm: llm(), store, classifyModel: env.OPENAI_CLASSIFY_MODEL, themeModel: env.OPENAI_REASON_MODEL, cardModel: env.OPENAI_REASON_MODEL },
        { selector, writeTags: true },
      );

    const run = await check<Run>(area, "run 1: full pipeline (fresh)", async () => {
      const r = await exec();
      must(r.status === "done", `status ${r.status}: ${r.errors.slice(0, 3).join(" | ")}`);
      const soft = (["themes", "tag", "cards"] as const).filter((k) => r.steps[k] === "failed");
      const modes = allReplies(r).reduce<Record<string, number>>((m, x) => ((m[x.context ?? "full"] = (m[x.context ?? "full"] ?? 0) + 1), m), {});
      return {
        status: soft.length || modes.truncated ? "warn" : "pass",
        detail: `run ${r.id}: ${r.counts.threads} threads → ${r.counts.prospectReplies} replies in ${r.groups.length} groups; steps ${Object.entries(r.steps).map(([k, v]) => `${k}=${v}`).join(" ")}; context ${JSON.stringify(modes)}; ${r.usage.llmCalls} LLM calls${soft.length ? `; non-critical failed: ${soft.join(", ")}` : ""}`,
        value: r,
      };
    });
    if (!run) continue;
    firstRuns.push(run);

    await check(area, "classification invariants", async () => {
      problems(classificationProblems(run));
      return { detail: `${run.counts.prospectReplies} replies, each in exactly one known group, quotes verbatim, ${run.counts.needsReview} flagged for review` };
    });
    await check(area, "themes grounded and complete", async () => {
      problems(themeProblems(run));
      const n = run.groups.reduce((k, g) => k + (g.themes?.length ?? 0), 0);
      return { status: run.steps.themes === "failed" ? "warn" : "pass", detail: `${n} theme(s) across ${run.groups.filter((g) => g.themes?.length).length} group(s); step ${run.steps.themes}` };
    });
    await check(area, "tags written and read back from graph8", async () => {
      must(run.steps.tag === "done", `tag step ${run.steps.tag}`);
      must(run.tagging?.failed === 0, `${run.tagging?.failed} tag write(s) failed`);
      const threads = (await Promise.all(run.source.sequences.map((q) => client.listThreads(q.id)))).flat();
      const byId = new Map(threads.map((t) => [t.id, t]));
      const p: string[] = [];
      let multi = 0;
      for (const r of allReplies(run)) {
        const names = (byId.get(r.threadId)?.tags ?? []).map((t) => t.name);
        if (!names.includes(tagNameOf(r.category))) p.push(`thread ${r.threadId} lacks "${tagNameOf(r.category)}"`);
        if (names.filter((x) => x.startsWith(TAG_PREFIX)).length > 1) multi++;
      }
      problems(p);
      const t = run.tagging!;
      return {
        status: multi ? "warn" : "pass",
        detail: `every thread carries its ReplyIQ tag in graph8 (tagged ${t.tagged}, already ${t.already}, created [${t.tagsCreated.join(", ")}])${multi ? `; ${multi} thread(s) also keep an older ReplyIQ tag graph8 won't let us remove` : ""}`,
      };
    });
    await check(area, "audience safety (hard stops, dedupe, accounting)", async () => {
      problems(audienceProblems(run));
      return { detail: `eligible ${run.audience?.eligible ?? 0}, excluded ${JSON.stringify(run.audience?.excluded ?? {})}; no hard-stop contact is eligible` };
    });
    await check(area, "suppression re-checked live for every eligible contact", async () => {
      const ids = [...new Set(run.groups.flatMap((g) => g.eligible.map((e) => e.contactId)))];
      const bad: number[] = [];
      for (const id of ids) {
        const sup = await client.getSuppression(id);
        if (sup.is_suppressed || (sup.active_channels ?? []).length) bad.push(id);
      }
      must(bad.length === 0, `suppressed but eligible: ${bad.join(", ")}`);
      return { detail: `${ids.length} contact(s) checked, none suppressed` };
    });
    await check(area, "no one who said no on a call is eligible (re-read live)", async () => {
      const ids = [...new Set(run.groups.flatMap((g) => g.eligible.map((e) => e.contactId)))];
      const stops = await callStops(client, ids);
      must(stops.saidNo.size === 0 && stops.booked.size === 0, `eligible but said no / booked on a call: ${[...stops.saidNo, ...stops.booked].join(", ")}`);
      const calls = run.channels?.calls;
      return { detail: `${ids.length} eligible contact(s) re-checked; dialer ${calls?.status ?? "not read"}${calls?.status === "ok" ? `, ${calls.contacts.length} replying contact(s) called, ${calls.saidNo.length} said no, ${calls.booked.length} booked` : ""}` };
    });
    await check(area, "Answer Cards grounded (re-verified against fresh documents)", async () => {
      if (run.steps.cards === "skipped") return { status: "info", detail: "no objection/interest groups, so no cards (expected)" };
      must(run.steps.cards === "done", `cards step ${run.steps.cards}`);
      const docs = await groundingDocs(run);
      const r = await cardProblems(run, docs);
      problems(r.problems);
      return { detail: `${r.cards} card(s), ${r.proof} proof excerpt(s) found verbatim in their documents, ${r.gaps} proof gap(s) named, ${run.cards?.unverifiedClaims ?? 0} unverified claim(s) dropped` };
    });
    const referral = run.groups.find((g) => g.key === "referral_wrong_person");
    if (referral) {
      await check(area, "referral targets looked up in the CRM (read-only)", async () => {
        const { found, notes } = await referralTargets(client, referral);
        return { status: "info", detail: `${referral.replies.length} referral repl(ies); ${found.length} named person(s) found in the CRM; ${notes.length} not found (enrichment would cost credits, needs approval)` };
      });
    }

    if (once) continue;
    const again = await check<Run>(area, "run 2: re-run is stable and idempotent", async () => {
      const r2 = await exec();
      must(r2.status === "done", `status ${r2.status}: ${r2.errors.slice(0, 3).join(" | ")}`);
      must(r2.tagging?.failed === 0, `${r2.tagging?.failed} tag write(s) failed`);
      const first = new Map(allReplies(run).map((x) => [x.threadId, x.category]));
      const second = allReplies(r2);
      const same = second.filter((x) => first.get(x.threadId) === x.category);
      const agree = second.length ? same.length / second.length : 1;
      const notAlready = same.filter((x) => x.tag?.status !== "already");
      must(agree >= 0.9, `only ${(agree * 100).toFixed(0)}% of labels agree`);
      must(notAlready.length === 0, `${notAlready.length} unchanged thread(s) were re-tagged`);
      const flips = second.filter((x) => first.get(x.threadId) !== x.category).map((x) => `${x.company ?? x.threadId.slice(0, 8)}: ${first.get(x.threadId)}→${x.category}`);
      return {
        status: flips.length ? "warn" : "pass",
        detail: `run ${r2.id}: ${same.length}/${second.length} labels identical (${(agree * 100).toFixed(0)}%); unchanged threads not re-tagged${flips.length ? `; flipped: ${flips.join(", ")}` : ""}`,
        value: r2,
      };
    });
    if (again) secondRuns.push(again);
  }

  await check("graph8 tags", "ReplyIQ tag catalogue is clean", async () => {
    const tags = (await client.listInboxTags()).filter((t) => t.name.startsWith(TAG_PREFIX));
    must(new Set(tags.map((t) => t.name)).size === tags.length, "duplicate ReplyIQ tag names");
    must(tags.every((t) => t.ai_can_apply !== true), "a ReplyIQ tag is auto-applied by graph8's AI");
    return { detail: `${tags.length} ReplyIQ tags, no duplicates, none auto-applied: ${tags.map((t) => t.name.slice(TAG_PREFIX.length)).join(", ")}` };
  });

  // ----- E. Draft (opt-in: spends Studio credits) -----
  let drafted: { run: Run; key: Category } | undefined;
  if (draftArg) {
    const pool = firstRuns.flatMap((r) => r.groups.map((g) => ({ run: r, g })));
    const pick =
      draftArg === "auto"
        ? pool
            .filter(({ g }) => allowsFollowUpCampaign(g.key) && g.key !== "referral_wrong_person" && g.eligible.length >= env.MIN_GROUP_SIZE)
            .sort((a, b) => Number(Boolean(b.g.card)) - Number(Boolean(a.g.card)) || b.g.eligible.length - a.g.eligible.length)[0]
        : pool.find(({ g }) => g.key === draftArg);
    if (!pick) {
      await check("draft", "pick a group to draft", async () => ({ status: "warn", detail: `no draftable group for --draft ${draftArg}` }));
    } else {
      const area = `draft: ${pick.g.label}`;
      const deps = { g8: client, llm: llm(), model: env.OPENAI_REASON_MODEL, store, minAudience: env.MIN_GROUP_SIZE };
      const ok = await check(area, "draft follow-up campaign in Studio (fresh run)", async () => {
        const d = await draftCampaign(deps, { runId: pick.run.id, groupKey: pick.g.key });
        must(d.status === "ready", `status ${d.status}: ${d.error ?? ""}`);
        return {
          status: d.docsPatched.length || !pick.g.card ? "pass" : "warn",
          detail: `campaign ${d.campaignId} "${d.campaignName}", list ${d.listId} (${d.audience.length} contacts); docs patched [${d.docsPatched.join(", ")}], pending [${d.docsPending.join(", ")}], Studio-failed [${(d.docsFailed ?? []).join(", ")}]`,
          value: true,
        };
      });
      if (ok) {
        drafted = { run: pick.run, key: pick.g.key };
        await check(area, "draft verified by reading graph8 back", async () => verifyDraft(pick.run.id, pick.g.key));
        await check(area, "re-draft is idempotent (no duplicate list, campaign or section)", async () => {
          const before = (await store.load(pick.run.id))!.groups.find((g) => g.key === pick.g.key)!.draft!;
          const members = (await client.listContactsOfList(before.listId!)).length;
          const d2 = await draftCampaign(deps, { runId: pick.run.id, groupKey: pick.g.key });
          must(d2.campaignId === before.campaignId && d2.listId === before.listId, "a second campaign or list was created");
          must((await client.listContactsOfList(before.listId!)).length === members, "the list size changed");
          const same = (await client.listCampaigns()).filter((c) => c.name === before.campaignName);
          must(same.length === 1, `${same.length} campaigns named "${before.campaignName}"`);
          await verifyDraft(pick.run.id, pick.g.key);
          return { detail: `same campaign ${d2.campaignId} and list ${d2.listId}; ${members} member(s); ReplyIQ section present exactly once` };
        });
      }
    }
  }

  // ----- F. Every draft recorded in local runs still exists in graph8 -----
  await check("drafts", "all recorded drafts still intact in graph8", async () => {
    const runs = (await Promise.all((await store.list()).map((r) => store.load(r.id)))).filter((r): r is Run => Boolean(r));
    // A draft a newer run took over is verified through that run (its current owner), not twice.
    const ready = runs.flatMap((r) => r.groups.filter((g) => g.draft?.status === "ready" && g.draft.campaignId && !g.draft.supersededBy).map((g) => ({ r, g })));
    for (const { r, g } of ready) await verifyDraft(r.id, g.key);
    return { status: ready.length ? "pass" : "info", detail: `${ready.length} draft(s) verified: ${ready.map(({ g }) => `${g.label} → ${g.draft!.campaignId!.slice(0, 8)}`).join(", ") || "none"}` };
  });

  // ----- F2. Applied company-wide Studio learnings are still in place, exactly once -----
  await check("studio", "applied company-wide learnings intact", async () => {
    const runs = (await Promise.all((await store.list()).map((r) => store.load(r.id)))).filter((r): r is Run => Boolean(r));
    const applied = runs.filter((r) => r.learnings?.status === "applied");
    const seen: string[] = [];
    const elsewhere: string[] = [];
    for (const r of applied) {
      for (const p of r.learnings!.proposals) {
        const doc = await client.getGlobalDoc(p.docId);
        const n = doc.content.split(blockStart(p.key)).length - 1;
        must(n === 1, `${p.docName}: ReplyIQ block appears ${n} time(s)`);
        // Apply verified its own text when it saved. Different text in the (single) block later means the block was
        // saved again by a run this store doesn't hold (e.g. the deployed app) or edited in Studio: this record is stale.
        if (normLoose(blockText(doc.content, p.key)).includes(normLoose(p.section))) seen.push(`${p.docName} (v${doc.version ?? "?"})`);
        else elsewhere.push(`${p.docName} (run ${r.id}; Studio v${doc.version ?? "?"}, saved ${doc.updatedAt ?? "?"})`);
      }
    }
    if (elsewhere.length)
      return { status: "warn", detail: `saved again since these local runs applied them (another ReplyIQ app such as the deployed one, or an edit in Studio); each block is still there once and "Take them out" on the stale run leaves it alone: ${elsewhere.join(", ")}` };
    return { status: seen.length ? "pass" : "info", detail: seen.length ? `approved blocks present once in: ${seen.join(", ")}` : "no learnings applied" };
  });

  // ----- G. Credits spent by this regression -----
  await check("platform", "credits spent by this regression", async () => {
    const after = await client.getUsage();
    const now = after.available_credits ?? after.credits;
    const spent = typeof creditsBefore === "number" && typeof now === "number" ? creditsBefore - now : undefined;
    // Studio bills a draft in stages: 7 document LLM calls + images now, then Studio Global calls up to ~15 min
    // later (about 212 credits in total per draft, from the ledger on 27 Sep).
    return { status: "info", detail: `${spent ?? "?"} credit(s) so far (${creditsBefore} → ${now})${drafted ? "; Studio keeps billing the draft for ~15 min (≈212 in total per draft)" : ""}` };
  });

  return finish(started, firstRuns, secondRuns, drafted);
}

/** Campaign exists with the ReplyIQ list as audience; list = drafted audience, no hard stops, none suppressed; sections present once. */
async function verifyDraft(runId: string, key: Category): Promise<{ detail: string }> {
  const client = g8();
  const run = (await createFileStore().load(runId))!;
  const g: Group = run.groups.find((x) => x.key === key)!;
  const d = g.draft!;
  const full = await client.getCampaignFull(d.campaignId!);
  must(full.id === d.campaignId, `campaign ${d.campaignId} not found`);
  must(String(full.audience_list_id) === String(d.listId), `campaign audience is list ${full.audience_list_id}, expected ${d.listId}`);
  must(!full.is_launched, "the draft was launched");
  const members = await client.listContactsOfList(d.listId!);
  const ids = new Set(members.map((m) => m.id));
  // Out of office: the campaign's own list holds the first return-date wave; each later date has its own list (checked below).
  const own = d.sequence?.waves?.find((w) => w.slot === 0)?.contacts ?? d.audience;
  for (const a of own) must(ids.has(a.contactId), `contact ${a.contactId} missing from list ${d.listId}`);
  const waves = (d.sequence?.waves ?? []).filter((w) => w.status !== "retired");
  const inWaves = new Set(waves.flatMap((w) => w.contacts.map((c) => c.contactId)));
  if (waves.length) for (const a of d.audience) must(inWaves.has(a.contactId), `contact ${a.contactId} is in no return-date wave`);
  const stop = hardStops(run);
  // Every list a follow-up can send to: the campaign's own, plus one per later return date.
  const lists = [{ id: d.listId!, members }];
  for (const w of waves) if (w.slot > 0 && w.listId) lists.push({ id: w.listId, members: await client.listContactsOfList(w.listId) });
  for (const list of lists) {
    for (const m of list.members) {
      must(!(m.id && stop.ids.has(m.id)) && !(m.work_email && stop.emails.has(m.work_email.toLowerCase())), `hard-stop contact ${m.id} is in list ${list.id}`);
      if (m.id) {
        const sup = await client.getSuppression(m.id);
        must(!sup.is_suppressed && !(sup.active_channels ?? []).length, `suppressed contact ${m.id} is in list ${list.id}`);
      }
    }
  }
  const mark = marker(run.id, g.key);
  const sections: string[] = [];
  for (const kind of ["objections", "replyTemplates"] as const) {
    const doc = findCampaignDoc(full.documents ?? [], kind);
    if (!doc || !d.docsPatched.includes(doc.file_type ?? "")) continue;
    const count = docText(doc).split(mark).length - 1;
    must(count === 1, `${doc.file_type}: ReplyIQ section appears ${count} time(s)`);
    sections.push(doc.file_type ?? kind);
  }
  if (g.card) must(sections.length > 0, "the Answer Card is in no campaign document");
  let seqNote = "no follow-up sequence";
  if (d.sequence?.status === "ready") {
    const problems = await verifyRecordedSequence(client, d);
    must(problems.length === 0, `follow-up sequence: ${problems.join("; ")}`);
    seqNote = `sequence ${d.sequence.sequenceId!.slice(0, 8)}: draft, no sender, ${d.sequence.steps.length} step(s) as recorded`;
    if (waves.length) seqNote += `; ${waves.length} return-date draft(s) (${waves.map((w) => `${w.key}: ${w.contacts.length}, waits ${w.delayDays}d`).join("; ")}), each list and wait as recorded`;
  }
  return { detail: `campaign ${d.campaignId!.slice(0, 8)} (not launched), audience list ${d.listId} = ${members.length} contact(s), no hard stops, none suppressed; ReplyIQ section in [${sections.join(", ") || "none"}]; ${seqNote}` };
}

async function finish(started: number, first: Run[], second: Run[] | undefined, drafted: { run: Run; key: Category } | undefined) {
  const count = (s: Status) => results.filter((r) => r.status === s).length;
  const secs = ((Date.now() - started) / 1000).toFixed(0);
  console.log(`\n${"=".repeat(72)}\nRESULT: ${count("pass")} passed, ${count("warn")} warning(s), ${count("fail")} failed, ${count("info")} info  (${secs}s)`);
  for (const r of results.filter((x) => x.status === "fail" || x.status === "warn")) console.log(`  ${ICON[r.status]} [${r.area}] ${r.name}: ${r.detail}`);

  const store = createFileStore();
  const reload = async (r: Run) => (await store.load(r.id)) ?? r;
  const report = {
    at: new Date().toISOString(),
    seconds: Number(secs),
    summary: { pass: count("pass"), warn: count("warn"), fail: count("fail"), info: count("info") },
    checks: results,
    runs: await Promise.all(first.map(async (r) => snapshot(await reload(r)))),
    reruns: (second ?? []).map(snapshot),
    drafted: drafted && { runId: drafted.run.id, group: drafted.key },
  };
  const dir = path.join(process.cwd(), "data", "e2e");
  await mkdir(dir, { recursive: true });
  const file = path.join(dir, `e2e-${report.at.replace(/[:.]/g, "-")}.json`);
  await writeFile(file, JSON.stringify(report, null, 2));
  console.log(`Report: ${path.relative(process.cwd(), file)}`);
  process.exit(count("fail") ? 1 : 0);
}

main().catch((err) => {
  console.error("E2E crashed:", describeError(err));
  process.exit(1);
});

