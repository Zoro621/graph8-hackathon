"use client";
import { m } from "motion/react";
import { ArrowDown, Ban, Play, ShieldCheck, Split, Tags } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import ReplyCore, { type Orb } from "../three/ReplyCore";
import ReplyTicker, { REPLY_SAMPLES, type TickerPhase } from "./ReplyTicker";
import AgentStrip from "./AgentStrip";
import SequenceCard from "./SequenceCard";
import RecentRuns from "./RecentRuns";
import { Button, Counter, Eyebrow, Kbd, SpotCard } from "../ui/primitives";
import { openPalette } from "../shell/CommandPalette";
import { SEQUENCES } from "@/lib/demo/fixtures";
import { createRun } from "@/lib/client/store";
import { useRuns } from "@/lib/client/hooks";
import { CATEGORY_COLOR } from "@/lib/ui/theme";
import { TAXONOMY } from "@/lib/taxonomy";
import type { EnvFlags } from "../shell/TopBar";

const ORB_COUNT = REPLY_SAMPLES.length * 2;
const sampleOf = (orb: number) => orb % REPLY_SAMPLES.length;
const ease = [0.16, 1, 0.3, 1] as const;
const REASONS = Object.keys(TAXONOMY).length;

export default function CommandCenter({ env }: { env: EnvFlags }) {
  const router = useRouter();
  const runs = useRuns();
  const [now] = useState(() => Date.now());
  const [tick, setTick] = useState(0); // the orb the Analyst is reading
  const [phase, setPhase] = useState<"reading" | "labelled">("reading");
  const [pinned, setPinned] = useState<number | null>(null); // the orb under the cursor
  const [pulse, setPulse] = useState(0);
  const [launching, setLaunching] = useState<string | null>(null);

  // reading → labelled → next orb; paused while an orb is hovered
  useEffect(() => {
    if (pinned != null) return;
    const t = setTimeout(
      () => {
        if (phase === "reading") {
          setPhase("labelled");
          setPulse((p) => p + 1);
        } else {
          setPhase("reading");
          setTick((i) => (i + 1) % ORB_COUNT);
        }
      },
      phase === "reading" ? 1300 : 2400,
    );
    return () => clearTimeout(t);
  }, [phase, tick, pinned]);

  const active = pinned ?? tick;
  const tickerPhase: TickerPhase = pinned != null ? "inspecting" : phase;

  const orbs: Orb[] = useMemo(
    () =>
      Array.from({ length: ORB_COUNT }, (_, i) => ({
        id: String(i),
        color: CATEGORY_COLOR[REPLY_SAMPLES[sampleOf(i)].category],
        state: i === tick && phase === "reading" && pinned == null ? "core" : "orbit",
        cluster: 0,
        clusters: 1,
        slot: 0,
        slots: 1,
      })),
    [tick, phase, pinned],
  );

  const launch = (sequenceId: string) => {
    setLaunching(sequenceId);
    setPulse((p) => p + 1);
    const meta = createRun(sequenceId);
    setTimeout(() => router.push(`/runs/${meta.id}`), 650);
  };

  return (
    <div className="relative">
      {/* ------------------------------ the core ------------------------------ */}
      <section className="relative">
        <m.div
          className="relative h-[56svh] min-h-[380px] w-full sm:h-[64svh] lg:h-[72svh] lg:max-h-[860px] [mask-image:linear-gradient(to_bottom,#000_78%,transparent)]"
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1.4, ease }}
        >
          <ReplyCore
            className="absolute inset-0"
            label="Reply Core: replies orbit the ReplyIQ agent. Hover to tilt it, sweep across to spin it, hover a reply to inspect it."
            orbs={orbs}
            focusId={pinned == null ? String(tick) : null}
            pulseKey={pulse}
            energy={phase === "reading" && pinned == null ? 0.35 : 0.1}
            onHover={(id) => {
              const next = id == null ? null : Number(id);
              if (next == null && pinned != null) {
                setTick(pinned); // resume the loop from the reply you were looking at
                setPhase("labelled");
              }
              setPinned(next);
            }}
            onCoreClick={() => {
              setPhase("labelled");
              setPulse((p) => p + 1);
            }}
          />
          <p className="pointer-events-none absolute left-1/2 top-5 -translate-x-1/2 whitespace-nowrap font-mono text-[10px] uppercase tracking-[0.25em] text-dim">
            hover to tilt · sweep to spin · hover a reply
          </p>
        </m.div>

        <m.div
          className="relative z-10 mx-auto -mt-24 w-[min(92vw,34rem)] sm:-mt-28"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.8, ease }}
        >
          <ReplyTicker index={sampleOf(active)} phase={tickerPhase} />
        </m.div>

        <div className="relative z-10 mx-auto flex max-w-4xl flex-col items-center gap-7 px-4 pb-20 pt-16 text-center">
          <m.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, duration: 0.7, ease }}>
            <Eyebrow>Reply intelligence for graph8</Eyebrow>
          </m.div>
          <h1 className="text-[clamp(2.8rem,7.5vw,6.8rem)] font-semibold leading-[0.92] tracking-[-0.045em]">
            {["No reply", "is"].map((w, i) => (
              <m.span
                key={w}
                className="mr-[0.22em] inline-block"
                initial={{ opacity: 0, y: 40, rotateX: -60 }}
                animate={{ opacity: 1, y: 0, rotateX: 0 }}
                transition={{ duration: 0.9, delay: 0.35 + i * 0.08, ease }}
              >
                {w}
              </m.span>
            ))}
            <m.span
              className="text-shine inline-block pr-2 font-serif text-[1.08em] font-normal italic tracking-[-0.02em]"
              initial={{ opacity: 0, y: 40, filter: "blur(12px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              transition={{ duration: 1.1, delay: 0.55, ease }}
            >
              wasted.
            </m.span>
          </h1>
          <m.p
            className="max-w-2xl text-[17px] leading-relaxed text-muted"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8, duration: 0.8 }}
          >
            ReplyIQ reads every reply to a finished graph8 sequence, works out <span className="text-text">why</span> prospects
            didn&apos;t convert, and turns each reason into a follow-up campaign for your approval. It also flags the{" "}
            <span className="text-amber">proof you don&apos;t have yet</span>.
          </m.p>
          <m.div
            className="flex flex-wrap items-center justify-center gap-3"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.95, duration: 0.6, ease }}
          >
            <Button variant="primary" magnetic onClick={() => document.getElementById("launch")?.scrollIntoView({ behavior: "smooth" })}>
              <Play className="size-4 fill-current" /> Analyse a sequence
            </Button>
            <Button variant="ghost" onClick={openPalette}>
              Jump anywhere <Kbd>⌘K</Kbd>
            </Button>
          </m.div>
          <m.dl
            className="mt-4 grid w-full max-w-2xl grid-cols-3 gap-4 border-t border-line pt-7"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.1 }}
          >
            {[
              { v: 3, l: "labels graph8 gives replies today" },
              { v: REASONS, l: "reasons ReplyIQ separates" },
              { v: 0, l: "emails sent without your approval" },
            ].map((s) => (
              <div key={s.l}>
                <dt className="sr-only">{s.l}</dt>
                <dd className="text-4xl font-semibold tracking-tight text-text">
                  <Counter value={s.v} />
                </dd>
                <p className="mx-auto mt-1 max-w-40 text-xs leading-snug text-dim">{s.l}</p>
              </div>
            ))}
          </m.dl>
          <button
            onClick={() => document.getElementById("how")?.scrollIntoView({ behavior: "smooth" })}
            className="mt-2 flex items-center gap-2 text-xs text-dim transition-colors hover:text-muted"
          >
            <ArrowDown className="size-3.5 animate-bounce" /> how it works
          </button>
        </div>
      </section>

      {/* ---------------------------------- how ---------------------------------- */}
      <section id="how" className="mx-auto max-w-[1400px] scroll-mt-20 px-4 py-20 sm:px-6">
        <m.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.8, ease }}
          className="mb-12 flex flex-col gap-4 md:flex-row md:items-end md:justify-between"
        >
          <div>
            <Eyebrow>The agent chain</Eyebrow>
            <h2 className="mt-4 max-w-2xl text-4xl font-semibold tracking-[-0.03em] sm:text-5xl">
              Six agents. One pass. <span className="font-serif font-normal italic text-iris">You approve</span> what ships.
            </h2>
          </div>
          <p className="max-w-sm text-sm leading-relaxed text-muted">
            graph8 tags a reply and stops. ReplyIQ keeps going: it groups replies by reason, guards who can be contacted,
            and grounds every claim in your Studio docs.
          </p>
        </m.div>
        <AgentStrip />

        <div className="mt-14 grid gap-4 md:grid-cols-4">
          {[
            { icon: Split, t: `${REASONS} reasons, not 3`, d: "Price, timing, competitor, referral and more, each with a verbatim quote.", c: "155,140,255" },
            { icon: ShieldCheck, t: "Grounded proof", d: "A claim survives only if its excerpt is really in a Studio doc. The rest becomes a proof gap.", c: "79,227,209" },
            { icon: Ban, t: "Hard stops", d: "Hard no, unsubscribe and suppressed contacts never land in a follow-up list.", c: "255,93,122" },
            { icon: Tags, t: "Native write-back", d: "Tags land in the graph8 Inbox, and drafts land in Studio. Nothing launches without you.", c: "212,255,79" },
          ].map((f, i) => (
            <SpotCard
              key={f.t}
              color={f.c}
              tilt
              className="p-5"
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ delay: i * 0.08, duration: 0.7, ease }}
            >
              <f.icon className="size-5" style={{ color: `rgb(${f.c})` }} strokeWidth={1.6} />
              <h3 className="mt-4 font-medium text-text">{f.t}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted">{f.d}</p>
            </SpotCard>
          ))}
        </div>
      </section>

      {/* --------------------------------- launch --------------------------------- */}
      <section id="launch" className="mx-auto w-full max-w-[1400px] scroll-mt-20 px-4 pb-24 sm:px-6">
        <div className="mb-8">
          <Eyebrow>Step 1</Eyebrow>
          <h2 className="mt-4 text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">Pick a finished sequence</h2>
        </div>
        <div className="grid gap-5 lg:grid-cols-2">
          {SEQUENCES.map((s, i) => (
            <SequenceCard
              key={s.id}
              seq={s}
              i={i}
              primary={i === 0}
              busy={launching === s.id}
              disabled={!!launching}
              lastRun={runs.find((r) => r.sequenceId === s.id)}
              now={now}
              onLaunch={() => launch(s.id)}
            />
          ))}
        </div>

        <RecentRuns runs={runs} />

        <div className="hairline-x mt-16" />
        <p className="mt-6 text-center font-mono text-[11px] leading-relaxed text-dim">
          Sandbox only · no real sends · sandbox checked before every write · hard stops never re-contacted · launch{" "}
          {env.launchEnabled ? "enabled" : "needs approval"}
        </p>
      </section>
    </div>
  );
}
