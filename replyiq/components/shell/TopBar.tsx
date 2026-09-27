"use client";
import { m } from "motion/react";
import { ChevronRight, Command } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CATEGORY_KEYS } from "@/lib/taxonomy";
import type { Category } from "@/lib/types";
import type { RunView } from "@/lib/api-types";
import { keys, useResource, useStatus } from "@/lib/client/api";
import { meta } from "@/lib/ui/categories";
import { displayName } from "@/lib/ui/format";
import { connectionState } from "@/lib/ui/connection";
import { LogoMark } from "./Logo";
import { openPalette } from "./CommandPalette";
import { Dot, Kbd } from "../ui/primitives";

function useCrumbs() {
  const parts = usePathname().split("/").filter(Boolean);
  const runId = parts[0] === "runs" ? (parts[1] ?? null) : null;
  // Reads the run from the shared cache (the page polls it); no polling of its own here.
  const { data: run } = useResource<RunView>(runId ? keys.run(runId) : null);
  const out: { href: string; label: string }[] = [];
  if (runId) {
    out.push({ href: `/runs/${runId}`, label: run?.source.name ? displayName(run.source.name) : "Run" });
    const key = parts[2] === "groups" ? parts[3] : undefined;
    if (key && (CATEGORY_KEYS as string[]).includes(key)) out.push({ href: `/runs/${runId}/groups/${key}`, label: meta(key as Category).label });
  }
  return out;
}

function ConnectionPill() {
  const { data: s, error } = useStatus();
  const { state, message } = connectionState(s, error);
  const view = {
    loading: { color: "#5b6179", label: "Connecting…", title: "Checking the graph8 connection" },
    setup: { color: "#ff5d7a", label: "Not connected", title: message ?? "" },
    error: {
      color: "#ff5d7a",
      label: error ? "Server unreachable" : /\b401\b/.test(message ?? "") ? "graph8 key rejected" : "graph8 unreachable",
      title: message ?? "",
    },
    live: { color: "#4fe3d1", label: "graph8 · connected", title: `Writes allowed (${s?.write?.allowed ? s.write.via.replace("_", " ") : ""})${s?.credits != null ? ` · ${Math.round(s.credits).toLocaleString()} credits` : ""}` },
    readonly: { color: "#ffb547", label: "graph8 · read-only", title: message ?? "" },
  }[state];
  return (
    <div className="hidden items-center gap-2 rounded-full border border-line bg-white/[0.03] px-3 py-1.5 text-[11px] text-muted md:flex" title={view.title}>
      <Dot color={view.color} pulse={state === "live" || state === "loading"} />
      <span>{view.label}</span>
      {state === "live" && s?.credits != null && (
        <>
          <span className="text-dim">|</span>
          <span className="font-mono">{Math.round(s.credits).toLocaleString()} cr</span>
        </>
      )}
    </div>
  );
}

export default function TopBar() {
  const crumbs = useCrumbs();
  return (
    <header className="sticky top-0 z-50 border-b border-line/60 bg-ink/55 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-[1400px] items-center gap-3 px-4 sm:px-6">
        <Link href="/" className="group flex items-center gap-2.5" aria-label="ReplyIQ home">
          <m.span whileHover={{ rotate: -12, scale: 1.08 }}>
            <LogoMark />
          </m.span>
          <span className="text-[15px] font-semibold tracking-tight">
            Reply<span className="bg-gradient-to-r from-iris via-[#b9a9ff] to-aqua bg-clip-text text-transparent">IQ</span>
          </span>
          <span className="hidden rounded-md border border-line px-1.5 py-0.5 font-mono text-[10px] text-dim sm:inline">for graph8</span>
        </Link>

        <nav aria-label="Breadcrumb" className="no-scrollbar flex min-w-0 flex-1 items-center gap-1 overflow-x-auto text-sm">
          {crumbs.map((c, i) => (
            <m.span key={c.href} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.06 }} className="flex shrink-0 items-center gap-1">
              <ChevronRight className="size-3.5 text-dim" />
              <Link href={c.href} className={`truncate rounded-md px-1.5 py-0.5 transition-colors hover:bg-white/5 ${i === crumbs.length - 1 ? "text-text" : "text-muted"}`}>
                {c.label}
              </Link>
            </m.span>
          ))}
        </nav>

        <ConnectionPill />

        <button
          onClick={openPalette}
          className="flex items-center gap-2 rounded-full border border-line bg-white/[0.03] px-3 py-1.5 text-xs text-muted transition-colors hover:border-line-2 hover:text-text"
          aria-label="Open command palette"
        >
          <Command className="size-3.5" />
          <span className="hidden sm:inline">Jump to</span>
          <Kbd>⌘K</Kbd>
        </button>
      </div>
    </header>
  );
}
