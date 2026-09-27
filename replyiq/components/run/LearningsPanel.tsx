"use client";
import { AnimatePresence, m } from "motion/react";
import { BookMarked, CheckCircle2, Loader2, Undo2 } from "lucide-react";
import { useState } from "react";
import type { RunView } from "@/lib/api-types";
import { api, keys, revalidate } from "@/lib/client/api";
import { Button, Chip, Eyebrow, HoldButton } from "../ui/primitives";

/**
 * Company-wide learnings: propose (read-only) → review the exact text → hold to save it into Studio's
 * Messaging House and Proof Catalog → undo. Only ReplyIQ's own marked block is ever touched.
 */
export default function LearningsPanel({ run }: { run: RunView }) {
  const [busy, setBusy] = useState<"propose" | "apply" | "remove" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const l = run.learnings;
  const act = async (action: "propose" | "apply" | "remove") => {
    setBusy(action);
    setError(null);
    try {
      await api.learnings(run.id, action);
      await revalidate(keys.run(run.id));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };
  const applied = l?.status === "applied";

  return (
    <section className="mt-16">
      <Eyebrow>Step 3</Eyebrow>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <h2 className="text-2xl font-semibold tracking-[-0.03em] sm:text-3xl">
          Teach Studio <span className="font-serif font-normal italic text-iris">what the field said</span>
        </h2>
        {l && (
          <Chip color={applied ? "#4fe3d1" : l.status === "failed" ? "#ff5d7a" : "#9b8cff"}>
            {applied ? "saved in Studio" : l.status === "removed" ? "removed" : l.status === "failed" ? "failed" : "proposed · not saved"}
          </Chip>
        )}
      </div>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
        Turns this run&apos;s Answer Cards into a block for the company-wide Messaging House (what prospects said and how to answer) and the Proof Catalog
        (proof you still need). Nothing is saved until you approve it, and only ReplyIQ&apos;s own block is ever changed.
      </p>

      <div className="surface mt-6 rounded-3xl p-5 sm:p-7">
        {!l || l.status === "removed" ? (
          <div className="flex flex-wrap items-center justify-between gap-4">
            <p className="text-sm text-muted">{l?.status === "removed" ? "The block was taken out of Studio. You can propose it again." : "Preview the exact text first. This only reads Studio."}</p>
            <Button variant="iris" onClick={() => act("propose")} disabled={!!busy || !!run.job}>
              {busy === "propose" ? <Loader2 className="size-4 animate-spin" /> : <BookMarked className="size-4" />} Preview the additions
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-5">
            {l.proposals.map((p) => (
              <m.div key={p.docId} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-line bg-white/[0.02]">
                <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3 text-sm">
                  <span className="font-medium text-text">{p.docName}</span>
                  <span className="font-mono text-[11px] text-dim">
                    {applied
                      ? `${p.action === "append" ? "added a new block" : p.action === "replace" ? "replaced ReplyIQ's block" : "already up to date"}${p.savedVersion != null ? ` · saved as version ${p.savedVersion}` : ""}`
                      : `${p.action === "append" ? "adds a new block" : p.action === "replace" ? "replaces ReplyIQ's block" : "no change"}${p.baseVersion != null ? ` · Studio has version ${p.baseVersion}` : ""}`}
                  </span>
                </div>
                <pre className="thin-scroll max-h-72 overflow-auto whitespace-pre-wrap p-4 font-sans text-[13px] leading-relaxed text-muted">{p.section}</pre>
              </m.div>
            ))}
            {l.error && <p className="text-sm text-rose">{l.error}</p>}
            <AnimatePresence mode="wait" initial={false}>
              {applied ? (
                <m.div key="applied" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-wrap items-center justify-between gap-4">
                  <p className="flex items-center gap-2 text-sm text-aqua">
                    <CheckCircle2 className="size-4" /> Saved to Studio and read back to verify.
                  </p>
                  <Button variant="ghost" onClick={() => act("remove")} disabled={!!busy || !!run.job}>
                    {busy === "remove" ? <Loader2 className="size-4 animate-spin" /> : <Undo2 className="size-4" />} Take it out again
                  </Button>
                </m.div>
              ) : (
                <m.div key="apply" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-wrap items-center justify-between gap-4">
                  <p className="text-sm text-muted">Reviewed the text? Saving writes it to company-wide Studio documents.</p>
                  {busy === "apply" ? (
                    <span className="flex items-center gap-2 text-sm text-lime">
                      <Loader2 className="size-4 animate-spin" /> Saving and verifying…
                    </span>
                  ) : (
                    <HoldButton onConfirm={() => act("apply")} disabled={!!busy || !!run.job}>
                      Hold to save to Studio
                    </HoldButton>
                  )}
                </m.div>
              )}
            </AnimatePresence>
          </div>
        )}
        {error && <p className="mt-4 text-sm text-rose">{error}</p>}
      </div>
    </section>
  );
}
