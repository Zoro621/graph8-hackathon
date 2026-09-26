"use client";
import { AnimatePresence, m } from "motion/react";
import { Flag, Mail, ShieldCheck, X } from "lucide-react";
import { useEffect } from "react";
import { createPortal } from "react-dom";
import { useHydrated } from "@/lib/client/hooks";
import type { SequenceStep } from "@/lib/types";
import { Chip, HoldButton } from "../ui/primitives";

export interface LaunchSummary {
  steps: number;
  audience: { email: string; name: string; company: string }[];
  credits: number;
  firstStep: SequenceStep;
}

const fill = (s: string, c: { name: string; company: string }) =>
  s.replaceAll("{{first_name}}", c.name).replaceAll("{{company}}", c.company);

export default function LaunchModal({
  open,
  onClose,
  summary,
  launchEnabled,
  launched,
  onLaunch,
  color,
}: {
  open: boolean;
  onClose: () => void;
  summary: LaunchSummary;
  launchEnabled: boolean;
  launched: boolean;
  onLaunch: () => void;
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

  return createPortal(
    <AnimatePresence>
      {open && (
        <m.div
          className="fixed inset-0 z-[78] grid place-items-center overflow-y-auto bg-ink/75 p-4 backdrop-blur-md"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <m.div
            role="dialog"
            aria-modal="true"
            aria-label="Approve and launch"
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

            <AnimatePresence mode="wait">
              {!launched ? (
                <m.div key="confirm" exit={{ opacity: 0, y: -10 }} className="relative flex flex-col gap-5">
                  <div>
                    <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-lime">Human approval</p>
                    <h3 className="mt-2 text-2xl font-semibold tracking-tight">Approve & launch in the sandbox</h3>
                  </div>
                  <dl className="grid grid-cols-3 gap-2 text-center">
                    {[
                      { l: "contacts", v: summary.audience.length },
                      { l: "est. credits", v: `~${summary.credits}` },
                      { l: "email steps", v: summary.steps },
                    ].map((x) => (
                      <div key={x.l} className="rounded-xl border border-line bg-white/[0.02] p-3">
                        <dd className="text-xl font-semibold tabular-nums">{x.v}</dd>
                        <dt className="text-[11px] text-dim">{x.l}</dt>
                      </div>
                    ))}
                  </dl>
                  <ul className="flex flex-col gap-2 text-sm text-muted">
                    <li className="flex items-center gap-2">
                      <ShieldCheck className="size-4 text-aqua" /> Sandbox status is checked again right before the call
                    </li>
                    <li className="flex items-center gap-2">
                      <ShieldCheck className="size-4 text-aqua" /> Needs an active sender mailbox
                    </li>
                    <li className="flex items-center gap-2">
                      <Flag className={`size-4 ${launchEnabled ? "text-aqua" : "text-amber"}`} /> ENABLE_LAUNCH is{" "}
                      <span className={launchEnabled ? "text-aqua" : "text-amber"}>{launchEnabled ? "on" : "off"}</span>
                    </li>
                  </ul>
                  <HoldButton onConfirm={onLaunch} className="w-full">
                    Hold to approve & launch
                  </HoldButton>
                  <p className="-mt-2 text-center text-[11px] text-dim">Press and hold, or hold Space. Release to cancel.</p>
                </m.div>
              ) : (
                <m.div key="done" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="relative flex flex-col gap-5">
                  <div className="flex items-center gap-3">
                    <m.span
                      initial={{ scale: 0, rotate: -120 }}
                      animate={{ scale: 1, rotate: 0 }}
                      transition={{ type: "spring", stiffness: 300, damping: 14 }}
                      className={`grid size-11 place-items-center rounded-2xl ${launchEnabled ? "bg-lime text-ink" : "bg-amber/15 text-amber"}`}
                    >
                      {launchEnabled ? <ShieldCheck className="size-5" /> : <Flag className="size-5" />}
                    </m.span>
                    <div>
                      <h3 className="text-xl font-semibold tracking-tight">{launchEnabled ? "Approved · scheduling in sandbox" : "Approved · launch is flagged off"}</h3>
                      <p className="text-sm text-muted">
                        {launchEnabled
                          ? "Simulated sends land in /sandbox/outbox."
                          : "The campaign stays a draft in Studio until ENABLE_LAUNCH=true and a mailbox exists."}
                      </p>
                    </div>
                  </div>
                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-dim">Outbox preview · step 1</p>
                      <Chip>demo · not sent</Chip>
                    </div>
                    <ul className="thin-scroll flex max-h-64 flex-col gap-2 overflow-y-auto pr-1">
                      {summary.audience.map((c, i) => (
                        <m.li
                          key={c.email}
                          initial={{ opacity: 0, x: 30, rotate: 2 }}
                          animate={{ opacity: 1, x: 0, rotate: 0 }}
                          transition={{ delay: 0.15 + i * 0.12, type: "spring", stiffness: 260, damping: 22 }}
                          className="rounded-xl border border-line bg-white/[0.025] p-3"
                        >
                          <p className="flex items-center gap-2 font-mono text-[11px] text-dim">
                            <Mail className="size-3" /> to {c.email}
                          </p>
                          <p className="mt-1.5 text-sm font-medium text-text">{fill(summary.firstStep.subject, c)}</p>
                          <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-muted">{fill(summary.firstStep.body, c)}</p>
                        </m.li>
                      ))}
                    </ul>
                  </div>
                </m.div>
              )}
            </AnimatePresence>
          </m.div>
        </m.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
