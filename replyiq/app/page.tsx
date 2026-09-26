import { envStatus } from "@/lib/env";

export const dynamic = "force-dynamic";

const milestones = [
  ["M0", "Scaffold", true],
  ["M1", "graph8 client + spike", false],
  ["M2", "Fetch + classify replies", false],
  ["M3", "Tag threads + contact guards", false],
  ["M4", "Answer Cards (grounded)", false],
  ["M5", "Draft follow-up campaign", false],
  ["M6", "UI", false],
  ["M7", "Hardening + public repo", false],
] as const;

function Pill({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={`rounded-full px-3 py-1 text-sm font-medium ${
        ok ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" : "bg-zinc-500/15 text-zinc-600 dark:text-zinc-400"
      }`}
    >
      {ok ? "✓" : "○"} {label}
    </span>
  );
}

export default function Home() {
  const status = envStatus();
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-4 py-16 font-sans">
      <header className="flex flex-col gap-3">
        <h1 className="text-3xl font-semibold tracking-tight">ReplyIQ</h1>
        <p className="text-lg text-zinc-600 dark:text-zinc-400">
          Reply intelligence for graph8: group why prospects didn&apos;t convert, draft a follow-up campaign per reason
          for approval, and flag proof gaps with an Answer Card.
        </p>
      </header>

      <section className="flex flex-wrap gap-2" aria-label="Environment">
        <Pill ok={status.g8Key} label="graph8 key" />
        <Pill ok={status.openaiKey} label="OpenAI key" />
        <Pill ok={status.launchEnabled} label={status.launchEnabled ? "Launch on" : "Launch off (flagged)"} />
      </section>

      <section className="flex flex-col gap-2" aria-label="Build progress">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">Build progress</h2>
        <ol className="flex flex-col divide-y divide-zinc-200 rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
          {milestones.map(([id, name, done]) => (
            <li key={id} className="flex items-center justify-between px-4 py-2">
              <span>
                <span className="font-mono text-zinc-500">{id}</span> {name}
              </span>
              <span className={done ? "text-emerald-600 dark:text-emerald-400" : "text-zinc-400"}>{done ? "done" : "todo"}</span>
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
}
