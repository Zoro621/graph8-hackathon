"use client";
import { AnimatePresence, m } from "motion/react";
import { Coins, ListPlus, Mail, ShieldCheck, Sparkles, X } from "lucide-react";
import { useEffect } from "react";
import { createPortal } from "react-dom";
import { useHydrated } from "@/lib/client/hooks";
import { HoldButton } from "../ui/primitives";

/** graph8's own ledger showed about 212 credits per draft (IMPLEMENTATION.md, 27 Sep): Studio doc generation. */
export const DRAFT_CREDITS = 210;

/** Human approval before anything is created in graph8 or credits are spent. */
export default function ConfirmDraftModal({
  open,
  onClose,
  onConfirm,
  groupLabel,
  audience,
  referral,
  hasCard,
  returnDates = 0,
  balance,
  color,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  groupLabel: string;
  audience: number;
  referral: boolean;
  hasCard: boolean;
  returnDates?: number; // out of office: how many return dates the audience splits into (one Sequencer draft each)
  balance?: number | null;
  color: string;
}) {
  const mounted = useHydrated();
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [open, onClose]);
  if (!mounted) return null;

  const rows = [
    { icon: ListPlus, text: referral ? "An audience list of the people they named (looked up in the CRM now)" : `An audience list of up to ${audience} contacts, re-checked for hard stops and suppression first` },
    {
      icon: Sparkles,
      text: `A Studio campaign with ${hasCard ? "this group's Answer Card" : "these replies, quoted word for word,"} in its Messaging & Objections and Reply Templates docs`,
    },
    {
      icon: Mail,
      text:
        returnDates > 1
          ? `A two-step follow-up sequence per return date (${returnDates} in the Sequencer), fact-checked, step 1 waiting until each group is back, with no sender attached`
          : "A two-step follow-up sequence in the Sequencer, fact-checked, with no sender attached",
    },
    { icon: Coins, text: `About ${DRAFT_CREDITS} credits for Studio's document generation${balance != null ? ` · you have ${Math.round(balance).toLocaleString()}` : ""}` },
  ];

  return createPortal(
    <AnimatePresence>
      {open && (
        <m.div className="fixed inset-0 z-[78] grid place-items-center overflow-y-auto bg-ink/75 p-4 backdrop-blur-md" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
          <m.div
            role="dialog"
            aria-modal="true"
            aria-label="Draft in graph8"
            onClick={(e) => e.stopPropagation()}
            initial={{ opacity: 0, y: 30, scale: 0.95, rotateX: 12 }}
            animate={{ opacity: 1, y: 0, scale: 1, rotateX: 0 }}
            exit={{ opacity: 0, y: 20, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 260, damping: 26 }}
            style={{ transformPerspective: 1000 }}
            className="surface relative w-full max-w-lg overflow-hidden rounded-3xl bg-ink-2 p-6 sm:p-7"
          >
            <div className="absolute inset-x-0 top-0 h-32 opacity-50" style={{ background: `radial-gradient(60% 100% at 50% 0%, ${color}40, transparent)` }} />
            <button onClick={onClose} aria-label="Close" className="absolute right-4 top-4 z-10 grid size-8 place-items-center rounded-full border border-line text-muted hover:text-text">
              <X className="size-4" />
            </button>
            <div className="relative flex flex-col gap-5">
              <div>
                <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-lime">Human approval</p>
                <h3 className="mt-2 text-2xl font-semibold tracking-tight">Draft the {groupLabel.toLowerCase()} follow-up in graph8</h3>
              </div>
              <ul className="flex flex-col gap-3">
                {rows.map((r) => (
                  <li key={r.text} className="flex items-start gap-3 text-sm text-muted">
                    <r.icon className="mt-0.5 size-4 shrink-0 text-iris" /> {r.text}
                  </li>
                ))}
              </ul>
              <p className="flex items-start gap-2 rounded-xl border border-aqua/20 bg-aqua/[0.05] p-3 text-xs leading-relaxed text-aqua">
                <ShieldCheck className="mt-0.5 size-3.5 shrink-0" /> Nothing is sent. A person attaches a sender and launches it in graph8.
              </p>
              <HoldButton onConfirm={onConfirm} className="w-full">
                Hold to draft in graph8
              </HoldButton>
              <p className="-mt-2 text-center text-[11px] text-dim">Press and hold, or hold Space. Release to cancel.</p>
            </div>
          </m.div>
        </m.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
