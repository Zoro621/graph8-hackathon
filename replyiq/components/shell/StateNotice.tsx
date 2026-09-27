"use client";
import { m } from "motion/react";
import { AlertTriangle, KeyRound, SearchX } from "lucide-react";
import Link from "next/link";
import { Button } from "../ui/primitives";

const ENV_LINES = [
  "G8_API_KEY=            # graph8 personal key (Profile → Developer)",
  "OPENAI_API_KEY=        # OpenAI platform key",
];

/** Full-page notice for the states where there is no real data to show. Never falls back to sample data. */
export default function StateNotice({
  kind,
  title,
  detail,
  compact = false,
}: {
  kind: "setup" | "not-found" | "error";
  title?: string;
  detail?: string;
  compact?: boolean;
}) {
  const Icon = kind === "setup" ? KeyRound : kind === "not-found" ? SearchX : AlertTriangle;
  const color = kind === "error" ? "text-rose" : kind === "setup" ? "text-amber" : "text-iris";
  return (
    <m.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className={`mx-auto flex w-full max-w-xl flex-col items-center gap-4 px-6 text-center ${compact ? "py-10" : "flex-1 justify-center py-24"}`}
    >
      <span className={`grid size-12 place-items-center rounded-2xl border border-line-2 bg-white/[0.03] ${color}`}>
        <Icon className="size-5" />
      </span>
      <h2 className="text-2xl font-semibold tracking-tight">{title ?? (kind === "setup" ? "Connect graph8 and OpenAI" : "Nothing here")}</h2>
      {kind === "setup" ? (
        <>
          <p className="text-sm leading-relaxed text-muted">
            ReplyIQ only shows real data from your graph8 org. Add these keys to <code className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-xs text-text">replyiq/.env.local</code>{" "}
            and restart the server.
          </p>
          <pre className="w-full overflow-x-auto rounded-xl border border-line bg-ink-2 p-4 text-left font-mono text-xs leading-relaxed text-muted">{ENV_LINES.join("\n")}</pre>
          <p className="text-xs text-dim">The full list of variables is in replyiq/README.md. Keys stay on the server and never reach the browser.</p>
        </>
      ) : (
        detail && <p className="text-sm leading-relaxed text-muted">{detail}</p>
      )}
      {kind !== "setup" && !compact && (
        <Link href="/">
          <Button variant="ghost">Back to the command center</Button>
        </Link>
      )}
    </m.div>
  );
}
