// M1 spike: READ-ONLY checks against graph8. Writes nothing to graph8.
// (POST /inbox/emails/search is a search; it changes nothing.)
// Usage: npm run spike [-- --campaign <id> | --sequence <id>]   (default: the source with most replies)
//        npm run spike            (saves live samples to tests/fixtures/live/, gitignored,
//                                  plus a scrubbed [DEMO]-only sample to tests/fixtures/demo/)
//        npm run spike -- --no-save
import "./load-env";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { describeError, docText, g8, type Thread, type WritePolicy } from "../lib/g8";
import { fetchReplies } from "../lib/pipeline/fetchReplies";
import { discoverSources, fetchSourceReplies, pickDefaultSource, resolveSource, type SourceSelector } from "../lib/pipeline/sources";
import { scrub } from "../lib/scrub";
import type { Reply, StudioDoc } from "../lib/types";

const SAVE = !process.argv.includes("--no-save");
const LIVE = path.join(process.cwd(), "tests", "fixtures", "live"); // gitignored: may hold real contact data
const DEMO = path.join(process.cwd(), "tests", "fixtures", "demo"); // committed: synthetic [DEMO] data, scrubbed
const KEY_DOCS = ["Proof Catalog", "Pricing Matrix", "Value Props", "Messaging House", "Positioning Matrix", "Offer Brief"];

type Result = { name: string; ok: boolean; critical: boolean; ms: number; info: string };
const results: Result[] = [];
const oneLine = (s: string, n: number) => s.replace(/\s+/g, " ").slice(0, n);

async function check<T>(name: string, critical: boolean, fn: () => Promise<{ value: T; info: string; ok?: boolean }>) {
  const t0 = Date.now();
  try {
    const { value, info, ok = true } = await fn();
    const ms = Date.now() - t0;
    results.push({ name, ok, critical, ms, info });
    console.log(`${ok ? "✅" : "⚠️ "} ${name}  (${ms} ms)\n   ${info.split("\n").join("\n   ")}`);
    return value;
  } catch (err) {
    const ms = Date.now() - t0;
    results.push({ name, ok: false, critical, ms, info: describeError(err) });
    console.log(`❌ ${name}  (${ms} ms)\n   ${describeError(err)}`);
    return undefined;
  }
}

async function save(file: string, data: unknown, dir = LIVE) {
  if (!SAVE) return;
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, file), JSON.stringify(data, null, 2) + "\n", "utf8");
}

function argSelector(): SourceSelector | null {
  const val = (flag: string) => {
    const i = process.argv.indexOf(flag);
    return i > -1 ? process.argv[i + 1] : undefined;
  };
  const campaignId = val("--campaign");
  const sequenceId = val("--sequence");
  return campaignId ? { campaignId } : sequenceId ? { sequenceId } : null;
}

async function main() {
  const client = g8();
  console.log("ReplyIQ M1 spike: read-only checks against graph8\n");

  // 1. Identity + write policy (writes stay refused unless sandbox or explicit G8_WRITE_ORG_ID)
  const policy: WritePolicy | undefined = await check("1. Identity + write policy", true, async () => {
    const me = await client.whoAmI();
    const p = await client.writePolicy();
    const how = p.allowed ? `ALLOWED via ${p.via}` : `REFUSED: ${p.reason}`;
    return { value: p, info: `org=${me.org_id} role=${me.role_name ?? me.role ?? "?"}\nwrites: ${how}` };
  });

  // 1b. Discover every campaign/sequence with replies (nothing hardcoded)
  const sources = await check("1b. Discover sources (sequences + campaigns + reply counts)", true, async () => {
    const list = await discoverSources(client);
    const lines = list.map(
      (s) =>
        `${String(s.replyThreads).padStart(3)} replies  ${s.sequenceName}${s.campaignName ? `  [campaign: ${s.campaignName}]` : ""}  ${s.mailboxes.join(",")}`,
    );
    await save("sources.json", list);
    return { value: list, ok: list.some((s) => s.replyThreads > 0), info: [`${list.length} sequence(s)`, ...lines].join("\n") };
  });

  // 1c. Resolve the chosen source into its chain: --campaign <id> | --sequence <id> | default = most replies
  const selector = argSelector() ?? pickDefaultSource(sources ?? []);
  if (selector) {
    await check(`1c. Resolve source ${JSON.stringify(selector)}`, true, async () => {
      const ctx = await resolveSource(client, selector);
      const { threads, replies } = await fetchSourceReplies(client, ctx);
      const docLines = (["objections", "replyTemplates", "emails", "brief"] as const).map(
        (k) => `${k.padEnd(15)} ${ctx.docs[k] ? `${ctx.docs[k]!.name} (${ctx.docs[k]!.content.length} chars)` : "not found"}`,
      );
      const metrics = ctx.campaign ? await client.getCampaignMetrics(ctx.campaign.id, 365).catch(() => null) : null;
      await save("source-context.json", {
        selector,
        campaign: ctx.campaign ? { id: ctx.campaign.id, name: ctx.campaign.name, goal: ctx.campaign.goal, docs: (ctx.campaign.documents ?? []).map((d) => ({ id: d.id, file_type: d.file_type, display_name: d.display_name, chars: docText(d).length })) } : null,
        sequences: ctx.sequences.map((q) => ({ id: q.id, name: q.name, status: q.status, list: q.associated_list_id })),
        audienceListId: ctx.audienceListId,
        mailboxes: ctx.mailboxes,
        warnings: ctx.warnings,
        metrics,
      });
      return {
        value: null,
        ok: replies.length > 0,
        info: [
          `campaign: ${ctx.campaign ? `${ctx.campaign.name} (goal: ${ctx.campaign.goal ?? "-"})` : "(none: standalone sequence)"}`,
          `sequences: ${ctx.sequences.map((q) => `${q.name} [${q.status}]`).join(" | ") || "-"}`,
          `audience list: ${ctx.audienceListId ?? "-"}   sender mailboxes: ${ctx.mailboxes.join(", ") || "-"}`,
          `reply threads: ${threads}, prospect replies: ${replies.length}`,
          `metrics: ${metrics ? `status=${metrics.metric_status} sent=${metrics.send_receipts?.succeeded ?? "?"}` : "-"}`,
          ...docLines,
          ...ctx.warnings.map((w) => `warning: ${w}`),
        ].join("\n"),
      };
    });
  }

  // 2. Sequences (+ detail, steps, stats)
  const sequences = await check("2. Sequences", true, async () => {
    const list = await client.listSequences();
    const lines = list.map((s) => `${s.id}  ${s.name}  status=${s.status} contacts=${s.contact_count} steps=${s.step_count}`);
    return { value: list, ok: list.length > 0, info: `${list.length} sequence(s)\n${lines.join("\n")}` };
  });
  await save("sequences.json", sequences ?? []);

  const detail: Record<string, unknown> = {};
  for (const seq of sequences ?? []) {
    await check(`2b. Sequence detail/steps/stats: ${seq.name}`, false, async () => {
      const [d, steps, stats] = await Promise.all([
        client.getSequence(seq.id),
        client.getSequenceSteps(seq.id),
        client.getSequenceStats(seq.id),
      ]);
      detail[seq.id] = { detail: d, steps, stats };
      return {
        value: null,
        info: `status=${d.status} steps=${steps.steps?.length ?? 0} total_contacts=${stats.total_contacts} step_stats=${stats.step_stats?.length ?? 0}`,
      };
    });
  }
  await save("sequence-details.json", detail);

  // 3. Inbox threads -> replies, per sequence (emails/search + GET /inbox, merged by thread id)
  const allReplies: Reply[] = [];
  const rawThreads: Record<string, Thread[]> = {};
  for (const seq of sequences ?? []) {
    await check(`3. Inbox replies: ${seq.name}`, false, async () => {
      const threads = await client.listThreads(seq.id);
      rawThreads[seq.id] = threads;
      const { replies, sources } = await fetchReplies({ listThreads: async () => threads }, seq.id);
      allReplies.push(...replies);
      const sample = replies.slice(0, 20).map((r) => `${r.contactEmail.slice(0, 30).padEnd(30)} "${oneLine(r.replyText, 70)}"`);
      const head = `${threads.length} thread(s) [search=${sources["emails.search"]}, inbox=${sources.inbox}], ${replies.length} with a prospect reply`;
      return { value: null, info: [head, ...sample].join("\n") };
    });
  }
  await check("3a. At least one sequence has replies", true, async () => ({
    value: null,
    ok: allReplies.length > 0,
    info: `${allReplies.length} prospect replies across ${Object.values(rawThreads).filter((t) => t.length).length} sequence(s)`,
  }));
  await save("threads.json", rawThreads);
  await save("replies.json", allReplies);
  const demoIds = new Set((sequences ?? []).filter((s) => s.name?.startsWith("[DEMO]")).map((s) => s.id));
  await save("threads.json", scrub(Object.fromEntries(Object.entries(rawThreads).filter(([id]) => demoIds.has(id)))), DEMO);
  await save("replies.json", scrub(allReplies.filter((r) => demoIds.has(r.sequenceId))), DEMO);

  // 3b. Single-thread endpoint
  const first = Object.values(rawThreads).flat()[0];
  if (first) {
    await check("3b. Get single thread", false, async () => {
      const t = await client.getThread(first.id);
      return { value: null, ok: t.id === first.id, info: `id=${t.id} messages=${t.messages.length}` };
    });
  }

  // 4. Inbox tags
  await check("4. Inbox tags", false, async () => {
    const tags = await client.listInboxTags();
    await save("inbox-tags.json", tags.map((t) => ({ id: t.id, name: t.name })));
    return { value: null, info: `${tags.length} tag(s): ${tags.map((t) => t.name).join(", ") || "(none)"}` };
  });

  // 5. Contacts + suppression for every replying contact
  await check("5. Contact resolve + suppression", true, async () => {
    const byEmail = new Map<string, Reply>();
    for (const r of allReplies) if (r.contactEmail && !byEmail.has(r.contactEmail)) byEmail.set(r.contactEmail, r);
    const rows: { email: string; contactId: number | null; via: string; suppressed: boolean | null; channels: string[] }[] = [];
    for (const [email, r] of byEmail) {
      let id = r.contactId ?? null;
      let via = id ? "inbox" : "lookup";
      if (!id) id = (await client.findContactByEmail(email))?.id ?? null;
      if (!id) {
        rows.push({ email, contactId: null, via: "not found", suppressed: null, channels: [] });
        continue;
      }
      const s = await client.getSuppression(id);
      if (s.contact_id !== id) via += " (suppression id mismatch!)";
      rows.push({ email, contactId: id, via, suppressed: s.is_suppressed, channels: s.active_channels ?? [] });
    }
    await save("contacts.json", rows);
    const found = rows.filter((r) => r.contactId != null).length;
    const lines = rows.map(
      (r) => `${r.email.slice(0, 30).padEnd(30)} id=${r.contactId ?? "NOT FOUND"} via=${r.via} suppressed=${r.suppressed ?? "-"}`,
    );
    return {
      value: null,
      ok: rows.length > 0 && found / rows.length >= 0.8,
      info: [`${found}/${rows.length} contacts resolved (unresolved ones are excluded as not_found later)`, ...lines].join("\n"),
    };
  });

  // 6. Studio Global Context docs
  await check("6. Studio Global docs", true, async () => {
    const docs: StudioDoc[] = await client.listGlobalDocs();
    const index = docs.map((d) => ({ id: d.id, displayName: d.displayName, fileType: d.fileType, category: d.category, chars: d.content.length }));
    await save("studio-docs.index.json", index);
    const find = (k: string) => docs.find((d) => d.displayName.toLowerCase() === k.toLowerCase());
    const missing = KEY_DOCS.filter((k) => !(find(k)?.content.length));
    const keyLines = KEY_DOCS.map((k) => {
      const d = find(k);
      return `${k.padEnd(20)} ${d ? `${d.content.length} chars (id ${d.id})` : "MISSING"}`;
    });
    return {
      value: null,
      ok: missing.length === 0,
      info: [`${docs.length} doc(s), ${docs.filter((d) => d.content.length > 0).length} with content`, ...keyLines].join("\n"),
    };
  });

  // 7. Mailboxes (setup deferred: informational only)
  await check("7. Mailboxes (launch gate, deferred)", false, async () => {
    const boxes = (await client.listMailboxes()) ?? [];
    const active = boxes.filter((b) => b.connection_status === "active" && !b.is_archived);
    return {
      value: null,
      info: `${boxes.length} mailbox(es), ${active.length} active${active.length ? "" : "; launch stays off until one is connected"}`,
    };
  });

  // Summary
  const failedCritical = results.filter((r) => r.critical && !r.ok);
  const warnings = results.filter((r) => !r.critical && !r.ok);
  console.log("\n────────── Summary ──────────");
  console.log(`org: ${policy?.orgId ?? "?"}   writes: ${policy?.allowed ? `allowed (${policy.via})` : "refused"}`);
  console.log(`checks: ${results.length}   passed: ${results.filter((r) => r.ok).length}   critical failures: ${failedCritical.length}   warnings: ${warnings.length}`);
  for (const r of [...failedCritical, ...warnings]) console.log(`   ${r.critical ? "❌" : "⚠️ "} ${r.name}`);
  if (SAVE) console.log("samples saved: tests/fixtures/live/ (local only) and tests/fixtures/demo/ (scrubbed, committed)");
  process.exit(failedCritical.length ? 1 : 0);
}

main().catch((err) => {
  console.error("Spike crashed:", describeError(err));
  process.exit(1);
});
