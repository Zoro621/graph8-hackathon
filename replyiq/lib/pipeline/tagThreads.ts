// M3a: write each reply's category back to graph8 as an inbox tag ("ReplyIQ · Referral"), so the
// groups show up in graph8's own Inbox filter and Inbox Analytics.
// - Only the categories present are created; existing tags are reused by name (idempotent).
// - Tagging a thread twice is a no-op on graph8's side; threads already carrying the tag are skipped.
// - If a re-run moved a reply to another category, the old ReplyIQ tag is removed when graph8 allows
//   it; otherwise it is kept and reported (the /inbox/channels API can't see seeded threads).
// - Per-thread failures are recorded and never stop the other threads.
import type { G8Client } from "../g8";
import { WriteNotAllowedError } from "../g8";
import { categoryInfo, TAG_PREFIX, tagNameOf } from "../taxonomy";
import type { Category, Classified, Group } from "../types";

const CONCURRENCY = 4;

type TagClient = Pick<G8Client, "listInboxTags" | "createInboxTag" | "tagThread" | "untagThread" | "assertWriteAllowed">;

const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** Tag ids for the given categories, creating the missing tags. */
export async function ensureTags(client: TagClient, keys: Category[]): Promise<{ ids: Map<Category, string>; created: string[] }> {
  const wanted = [...new Set(keys)];
  let existing = await client.listInboxTags();
  const created: string[] = [];
  for (const key of wanted) {
    const name = tagNameOf(key);
    if (existing.some((t) => sameName(t.name, name))) continue;
    await client.createInboxTag(name, `Applied by ReplyIQ. ${categoryInfo(key).definition}`);
    created.push(name);
  }
  if (created.length) existing = await client.listInboxTags(); // the create response has no id
  const ids = new Map<Category, string>();
  for (const key of wanted) {
    const t = existing.find((x) => sameName(x.name, tagNameOf(key)));
    if (!t) throw new Error(`tag "${tagNameOf(key)}" was not found after creating it`);
    ids.set(key, t.id);
  }
  return { ids, created };
}

export interface TagOutcome {
  groups: Group[]; // replies carry `tag`
  tagged: number;
  already: number;
  failed: number;
  staleRemoved: number;
  staleKept: number;
  tagsCreated: string[];
  warnings: string[];
}

export async function tagThreads(client: TagClient, groups: Group[], opts: { concurrency?: number } = {}): Promise<TagOutcome> {
  await client.assertWriteAllowed(); // throws WriteNotAllowedError before any write
  const { ids, created } = await ensureTags(client, groups.map((g) => g.key));
  const ourIds = new Set(ids.values());
  const out = groups.map((g) => ({ ...g, replies: [...g.replies] }));
  const jobs = out.flatMap((g) => g.replies.map((r, i) => ({ g, i, r })));
  const res: TagOutcome = { groups: out, tagged: 0, already: 0, failed: 0, staleRemoved: 0, staleKept: 0, tagsCreated: created, warnings: [] };

  const one = async ({ g, i, r }: { g: Group; i: number; r: Classified }) => {
    const id = ids.get(r.category)!;
    const name = tagNameOf(r.category);
    const has = r.existingTags.some((t) => t.id === id || sameName(t.name, name));
    try {
      if (has) {
        res.already++;
        g.replies[i] = { ...r, tag: { id, name, status: "already" } };
      } else {
        await client.tagThread(r.threadId, [id]);
        res.tagged++;
        g.replies[i] = { ...r, tag: { id, name, status: "tagged" } };
      }
    } catch (err) {
      if (err instanceof WriteNotAllowedError) throw err;
      res.failed++;
      const error = err instanceof Error ? err.message : String(err);
      g.replies[i] = { ...r, tag: { id, name, status: "failed", error } };
      res.warnings.push(`could not tag thread ${r.threadId.slice(0, 12)}: ${error}`);
      return;
    }
    // Old ReplyIQ tags from an earlier run that no longer match.
    const stale = r.existingTags.filter((t) => t.id !== id && (ourIds.has(t.id) || t.name.startsWith(TAG_PREFIX)));
    for (const t of stale) {
      try {
        await client.untagThread(r.threadId, t.id);
        res.staleRemoved++;
      } catch {
        res.staleKept++;
        res.warnings.push(`thread ${r.threadId.slice(0, 12)} still carries old tag "${t.name}" (graph8 would not remove it)`);
      }
    }
  };

  let next = 0;
  const worker = async () => {
    while (next < jobs.length) await one(jobs[next++]);
  };
  await Promise.all(Array.from({ length: Math.min(opts.concurrency ?? CONCURRENCY, jobs.length) }, worker));
  return res;
}
