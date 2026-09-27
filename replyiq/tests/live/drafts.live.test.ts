// LIVE (read-only): verifies every draft recorded in local runs (data/runs) against graph8's real
// state: the campaign exists, its audience is the ReplyIQ list with the right contacts, and the
// patched docs carry ReplyIQ's marked section; recorded follow-up sequences are drafts on that list with
// no sender attached and the recorded steps. Skips when no drafts exist. Creates nothing.
import { describe, expect, it } from "vitest";
import { docText, g8 } from "../../lib/g8";
import { marker } from "../../lib/pipeline/draftCampaign";
import { verifyRecordedSequence } from "../../lib/pipeline/followupSequence";
import { blockStart } from "../../lib/pipeline/studioLearnings";
import { normLoose } from "../../lib/text";
import { findCampaignDoc } from "../../lib/pipeline/sources";
import { createFileStore } from "../../lib/store";
import { isHardStop } from "../../lib/taxonomy";

describe("LIVE drafts in graph8 (read-only)", () => {
  it("every ready draft exists in Studio with its list, audience and ReplyIQ sections", async (ctx) => {
    const store = createFileStore();
    const runs = (await Promise.all((await store.list()).map((r) => store.load(r.id)))).filter(Boolean);
    const drafts = runs.flatMap((run) => run!.groups.filter((g) => g.draft?.status === "ready" && g.draft.campaignId && !g.draft.supersededBy).map((g) => ({ run: run!, g })));
    if (drafts.length === 0) return ctx.skip();

    for (const { run, g } of drafts) {
      const d = g.draft!;
      const full = await g8().getCampaignFull(d.campaignId!);
      expect(full.id).toBe(d.campaignId);
      expect(String(full.audience_list_id)).toBe(String(d.listId));

      // The list holds exactly the drafted audience, and no hard-stop contact.
      const members = await g8().listContactsOfList(d.listId!);
      const ids = new Set(members.map((m) => m.id));
      for (const a of d.audience) expect(ids.has(a.contactId), `contact ${a.contactId} missing from list ${d.listId}`).toBe(true);
      const stopped = new Set(run.groups.flatMap((x) => x.replies).filter((r) => isHardStop(r.category)).map((r) => r.contactId));
      for (const id of ids) expect(stopped.has(id ?? -1), `hard-stop contact ${id} is in list ${d.listId}`).toBe(false);

      // Patched docs carry ReplyIQ's section.
      for (const kind of ["objections", "replyTemplates"] as const) {
        const doc = findCampaignDoc(full.documents ?? [], kind);
        if (!doc || !d.docsPatched.includes(doc.file_type ?? "")) continue;
        expect(docText(doc), `${doc.file_type} of ${d.campaignId}`).toContain(marker(run.id, g.key));
      }

      // The follow-up sequence (when one was built): a draft on the same list, no sender, recorded steps.
      if (d.sequence?.status === "ready") expect(await verifyRecordedSequence(g8(), d), `sequence ${d.sequence.sequenceId}`).toEqual([]);
    }
  });

  it("applied company-wide Studio learnings are in their documents exactly once, as approved", async (ctx) => {
    const store = createFileStore();
    const runs = (await Promise.all((await store.list()).map((r) => store.load(r.id)))).filter(Boolean);
    const applied = runs.filter((r) => r!.learnings?.status === "applied");
    if (applied.length === 0) return ctx.skip();
    for (const run of applied) {
      for (const p of run!.learnings!.proposals) {
        const doc = await g8().getGlobalDoc(p.docId);
        expect(doc.content.split(blockStart(p.key)).length - 1, `${p.docName}: ReplyIQ blocks`).toBe(1);
        expect(normLoose(doc.content), `${p.docName}: approved text`).toContain(normLoose(p.section));
        if (p.backup !== undefined) expect(p.backup).not.toContain(blockStart(p.key)); // the backup is the pre-ReplyIQ text
      }
    }
  });
});
