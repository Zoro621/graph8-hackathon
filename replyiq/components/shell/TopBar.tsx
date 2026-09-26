"use client";
import { m } from "motion/react";
import { ChevronRight, Command } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo } from "react";
import { TAXONOMY } from "@/lib/taxonomy";
import type { Category } from "@/lib/types";
import { sequenceOf } from "@/lib/demo/engine";
import { findRunMeta } from "@/lib/client/store";
import { useRuns } from "@/lib/client/hooks";
import { LogoMark } from "./Logo";
import { openPalette } from "./CommandPalette";
import { Dot, Kbd } from "../ui/primitives";
import { displayName } from "@/lib/ui/format";


export interface EnvFlags {
  g8Key: boolean;
  openaiKey: boolean;
  launchEnabled: boolean;
}

function useCrumbs() {
  const path = usePathname();
  const runs = useRuns();
  return useMemo(() => {
    const parts = path.split("/").filter(Boolean);
    const out: { href: string; label: string }[] = [];
    if (parts[0] === "runs" && parts[1]) {
      const meta = findRunMeta(runs, parts[1]);
      out.push({ href: `/runs/${parts[1]}`, label: displayName(sequenceOf(meta.sequenceId).name) });
      if (parts[2] === "groups" && parts[3]) {
        out.push({ href: path, label: TAXONOMY[parts[3] as Category]?.short ?? parts[3] });
      }
    }
    return out;
  }, [path, runs]);
}

export default function TopBar({ env }: { env: EnvFlags }) {
  const crumbs = useCrumbs();
  const live = env.g8Key && env.openaiKey;
  return (
    <header className="sticky top-0 z-50 border-b border-line/60 bg-ink/55 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-[1400px] items-center gap-3 px-4 sm:px-6">
        <Link href="/" className="group flex items-center gap-2.5" aria-label="ReplyIQ home">
          <m.span whileHover={{ rotate: -12, scale: 1.08 }}>
            <LogoMark />
          </m.span>
          <span className="text-[15px] font-semibold tracking-tight">
            Reply<span className="text-iris">IQ</span>
          </span>
          <span className="hidden rounded-md border border-line px-1.5 py-0.5 font-mono text-[10px] text-dim sm:inline">for graph8</span>
        </Link>

        <nav aria-label="Breadcrumb" className="no-scrollbar flex min-w-0 flex-1 items-center gap-1 overflow-x-auto text-sm">
          {crumbs.map((c, i) => (
            <m.span
              key={c.href}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.06 }}
              className="flex shrink-0 items-center gap-1"
            >
              <ChevronRight className="size-3.5 text-dim" />
              <Link
                href={c.href}
                className={`truncate rounded-md px-1.5 py-0.5 transition-colors hover:bg-white/5 ${i === crumbs.length - 1 ? "text-text" : "text-muted"}`}
              >
                {c.label}
              </Link>
            </m.span>
          ))}
        </nav>

        <div
          className="hidden items-center gap-2 rounded-full border border-line bg-white/[0.03] px-3 py-1.5 text-[11px] text-muted md:flex"
          title={`Runs on sample sandbox data until the live pipeline is connected${live ? "" : " (API keys not set)"}. Launch ${env.launchEnabled ? "enabled" : "needs ENABLE_LAUNCH"}.`}
        >
          <Dot color={live ? "#4fe3d1" : "#ffb547"} pulse />
          <span>graph8 sandbox</span>
        </div>

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
