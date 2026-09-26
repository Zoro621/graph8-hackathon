"use client";
import { AnimatePresence, m } from "motion/react";
import { ArrowRight, History, Home, Play, Search, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { SEQUENCES } from "@/lib/demo/fixtures";
import { sequenceOf } from "@/lib/demo/engine";
import { createRun } from "@/lib/client/store";
import { useRuns } from "@/lib/client/hooks";
import { Kbd } from "../ui/primitives";
import { displayName } from "@/lib/ui/format";


interface Item {
  id: string;
  group: string;
  title: string;
  hint?: string;
  icon: ReactNode;
  run: () => void;
}

export const openPalette = () => window.dispatchEvent(new Event("replyiq:palette"));

export default function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [idx, setIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const runs = useRuns();

  useEffect(() => {
    const reset = () => {
      setQ("");
      setIdx(0);
    };
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        reset();
        setOpen((o) => !o);
      }
      if (e.key === "Escape") setOpen(false);
    };
    const onOpen = () => {
      reset();
      setOpen(true);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("replyiq:palette", onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("replyiq:palette", onOpen);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => inputRef.current?.focus(), 30);
    return () => clearTimeout(t);
  }, [open]);

  const items: Item[] = useMemo(() => {
    const go = (href: string) => () => {
      setOpen(false);
      router.push(href);
    };
    const all: Item[] = [
      { id: "home", group: "Navigate", title: "Command center", icon: <Home className="size-4" />, run: go("/") },
      ...SEQUENCES.map((s) => ({
        id: `run-${s.id}`,
        group: "Run ReplyIQ on",
        title: displayName(s.name),
        hint: `${s.threads} threads`,
        icon: <Play className="size-4" />,
        run: () => {
          const meta = createRun(s.id);
          setOpen(false);
          router.push(`/runs/${meta.id}`);
        },
      })),
      ...runs.slice(0, 5).map((r) => ({
        id: `past-${r.id}`,
        group: "Recent runs",
        title: displayName(sequenceOf(r.sequenceId).name),
        hint: new Date(r.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        icon: <History className="size-4" />,
        run: go(`/runs/${r.id}`),
      })),
    ];
    if (runs[0]) {
      all.push({
        id: "latest-pricing",
        group: "Jump to",
        title: "Latest run → Pricing Answer Card",
        icon: <Sparkles className="size-4" />,
        run: go(`/runs/${runs[0].id}/groups/pricing_request`),
      });
    }
    const needle = q.trim().toLowerCase();
    return needle ? all.filter((i) => `${i.group} ${i.title}`.toLowerCase().includes(needle)) : all;
  }, [q, runs, router]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setIdx((i) => Math.min(items.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setIdx((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      items[idx]?.run();
    }
  };

  let lastGroup = "";
  return (
    <AnimatePresence>
      {open && (
        <m.div
          className="fixed inset-0 z-[80] flex items-start justify-center bg-ink/70 px-4 pt-[14vh] backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => setOpen(false)}
        >
          <m.div
            role="dialog"
            aria-label="Command palette"
            className="surface w-full max-w-xl overflow-hidden rounded-2xl bg-ink-2/95"
            initial={{ y: -16, scale: 0.97, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: -10, scale: 0.98, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 border-b border-line px-4 py-3.5">
              <Search className="size-4 text-muted" />
              <input
                ref={inputRef}
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setIdx(0);
                }}
                onKeyDown={onKeyDown}
                placeholder="Run a sequence, open a run, jump anywhere…"
                className="flex-1 bg-transparent text-sm text-text outline-none placeholder:text-dim"
              />
              <Kbd>esc</Kbd>
            </div>
            <ul className="thin-scroll max-h-[50vh] overflow-y-auto p-2">
              {items.length === 0 && <li className="px-3 py-8 text-center text-sm text-dim">Nothing matches “{q}”.</li>}
              {items.map((it, i) => {
                const header = it.group !== lastGroup ? it.group : null;
                lastGroup = it.group;
                return (
                  <li key={it.id}>
                    {header && <div className="px-3 pb-1 pt-3 font-mono text-[10px] uppercase tracking-[0.2em] text-dim">{header}</div>}
                    <button
                      onMouseEnter={() => setIdx(i)}
                      onClick={it.run}
                      className="relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm"
                    >
                      {i === idx && (
                        <m.span
                          layoutId="palette-hl"
                          className="absolute inset-0 rounded-xl border border-iris/30 bg-iris/10"
                          transition={{ type: "spring", stiffness: 500, damping: 38 }}
                        />
                      )}
                      <span className="relative text-iris">{it.icon}</span>
                      <span className="relative flex-1 truncate text-text">{it.title}</span>
                      {it.hint && <span className="relative font-mono text-[11px] text-dim">{it.hint}</span>}
                      {i === idx && <ArrowRight className="relative size-3.5 text-iris" />}
                    </button>
                  </li>
                );
              })}
            </ul>
          </m.div>
        </m.div>
      )}
    </AnimatePresence>
  );
}
