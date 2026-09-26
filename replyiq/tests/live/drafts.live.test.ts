// LIVE (read-only): verifies every draft recorded in local runs (data/runs) against graph8's real
// state: the campaign exists, its audience is the ReplyIQ list with the right contacts, and the
// patched docs carry ReplyIQ's marked section. Skips when no drafts exist. Creates nothing.
import { describe, expect, it } from "vitest";
import { docText, g8 } from "../../lib/g8";
import { marker } from "../../lib/pipeline/draftCampaign";
import { findCampaignDoc } from "../../lib/pipeline/sources";
import { createFileStore } from "../../lib/store";
import { isHardStop } from "../../lib/taxonomy";

describe("LIVE drafts in graph8 (read-only)", () => {
  it("every ready draft exists in Studio with its list, audience and ReplyIQ sections", async (ctx) => {
    const store = createFileStore();
    const runs = (await Promise.all((await store.list()).map((r) => store.load(r.id)))).filter(Boolean);
    const drafts = runs.flatMap((run) => run!.groups.filter((g) => g.draft?.status === "ready" && g.draft.campaignId).map((g) => ({ run: run!, g })));
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
    }
  });
});
