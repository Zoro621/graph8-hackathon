"use client";
import { AnimatePresence, m } from "motion/react";
import { X } from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useHydrated, useMediaQuery } from "@/lib/client/hooks";

/** Right-hand sheet (bottom sheet on phones). Rendered in a portal; Esc closes it. */
export default function Sheet({ open, onClose, children, accent, title }: { open: boolean; onClose: () => void; children: ReactNode; accent: string; title: string }) {
  const mounted = useHydrated();
  const wide = useMediaQuery("(min-width: 640px)", true);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);
  if (!mounted) return null;
  return createPortal(
    <AnimatePresence>
      {open && (
        <m.div className="fixed inset-0 z-[75]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-ink/70 backdrop-blur-sm" onClick={onClose} />
          <m.aside
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className="thin-scroll absolute inset-x-0 bottom-0 max-h-[88svh] overflow-y-auto rounded-t-3xl border-t border-line-2 bg-ink-2 sm:inset-y-0 sm:left-auto sm:right-0 sm:max-h-none sm:w-[min(640px,92vw)] sm:rounded-none sm:rounded-l-3xl sm:border-l sm:border-t-0"
            initial={wide ? { x: "100%" } : { y: "100%" }}
            animate={{ x: 0, y: 0 }}
            exit={wide ? { x: "100%" } : { y: "100%" }}
            transition={{ type: "spring", stiffness: 280, damping: 32 }}
            style={{ boxShadow: `-30px 0 120px -40px ${accent}66` }}
          >
            <div className="absolute inset-x-0 top-0 h-40 opacity-40" style={{ background: `radial-gradient(60% 100% at 50% 0%, ${accent}33, transparent)` }} />
            <button
              onClick={onClose}
              className="absolute right-4 top-4 z-10 grid size-9 place-items-center rounded-full border border-line bg-white/5 text-muted transition-colors hover:text-text"
              aria-label="Close"
            >
              <X className="size-4" />
            </button>
            <div className="relative p-6 sm:p-8">{children}</div>
          </m.aside>
        </m.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
