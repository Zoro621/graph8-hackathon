"use client";
import { m } from "motion/react";
import { CalendarCheck, Inbox, Mail, Newspaper, Phone, Repeat, Video } from "lucide-react";
import type { ChannelEvidence, ChannelStatus } from "@/lib/types";
import { splitName } from "@/lib/ui/format";
import { Eyebrow } from "../ui/primitives";

const ease = [0.16, 1, 0.3, 1] as const;
const pct = (n: number, d: number) => (d > 0 ? `${Math.round((n / d) * 1000) / 10}%` : "–");

function Tile({ icon: Icon, name, status, children, i }: { icon: typeof Mail; name: string; status: ChannelStatus; children: React.ReactNode; i: number }) {
  const tone = status === "ok" ? "text-text" : status === "unavailable" ? "text-amber" : "text-dim";
  return (
    <m.div
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: i * 0.05, duration: 0.45, ease }}
      className={`surface flex flex-col gap-2 rounded-2xl p-4 ${status === "ok" ? "" : "opacity-80"}`}
    >
      <p className={`flex items-center gap-2 text-sm font-medium ${tone}`}>
        <Icon className="size-4" /> {name}
        <span className="ml-auto font-mono text-[10px] uppercase tracking-[0.15em] text-dim">{status === "ok" ? "used" : status === "none" ? "no data" : "unreadable"}</span>
      </p>
      <div className="text-xs leading-relaxed text-muted">{children}</div>
    </m.div>
  );
}

/** What the run learned from graph8's other Engage channels, next to the inbox replies. */
export default function ChannelsPanel({ channels, replies, excludedOnCalls }: { channels: ChannelEvidence; replies: number; excludedOnCalls: number }) {
  const c = channels;
  const seq = c.sequencer;
  const calls = c.calls;
  return (
    <section className="mt-14">
      <Eyebrow>Across graph8</Eyebrow>
      <h2 className="mt-3 text-2xl font-semibold tracking-[-0.03em] sm:text-3xl">
        Every channel, <span className="font-serif font-normal italic text-iris">not just the inbox</span>
      </h2>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
        What happened on graph8&apos;s other Engage channels feeds each follow-up&apos;s channel plan, and a &ldquo;no&rdquo; on a call keeps that person out of every follow-up.
      </p>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Tile icon={Repeat} name="Sequencer" status={seq.length ? "ok" : "none"} i={0}>
          {seq.length
            ? seq.map((s) => (
                <p key={s.sequenceId}>
                  <span className="text-text">{splitName(s.name).title}</span>: {s.contacts.toLocaleString()} contacts, {s.reached.toLocaleString()} reached, {s.replied} replied ({pct(s.replied, s.reached)}), {s.meetingsBooked}{" "}
                  meetings booked.
                </p>
              ))
            : "No sequence report."}
        </Tile>
        <Tile icon={Inbox} name="AI Inbox" status={replies ? "ok" : "none"} i={1}>
          {replies} prospect repl{replies === 1 ? "y" : "ies"}, each labelled with a reason and a verbatim quote.
        </Tile>
        <Tile icon={Phone} name="Dialer" status={calls.status} i={2}>
          {calls.status === "ok" ? (
            <>
              <p>
                {calls.contacts.length} of the people who replied were also called. Latest outcomes:{" "}
                {Object.entries(calls.outcomes)
                  .sort((a, b) => b[1] - a[1])
                  .map(([d, n]) => `${d.replace(/_/g, " ")} ${n}`)
                  .join(", ")}
                .
              </p>
              {excludedOnCalls > 0 && <p className="mt-1 text-rose">{excludedOnCalls} kept out of follow-ups: they said no or already booked on a call.</p>}
            </>
          ) : calls.status === "none" ? (
            "None of the people who replied has been called."
          ) : (
            "Call outcomes couldn't be read; each draft re-checks them before adding anyone."
          )}
        </Tile>
        <Tile icon={Video} name="Meetings" status={c.meetings.status} i={3}>
          {c.meetings.status === "ok" ? (c.meetings.objections.length ? `Objections raised: ${c.meetings.objections.slice(0, 3).join("; ")}.` : `${c.meetings.total} recorded meeting(s), no objections noted.`) : "No recorded meetings in this org yet."}
        </Tile>
        <Tile icon={CalendarCheck} name="Appointments" status={c.bookings.status} i={4}>
          {c.bookings.status === "ok" ? `${c.bookings.fromSource} booked from this sequence, ${c.bookings.noShows} no-show(s).` : "No bookings in this org yet."}
        </Tile>
        <Tile icon={Newspaper} name="Newsletter & Nurture" status={c.newsletters.count || c.nurtures.count ? "ok" : "none"} i={5}>
          {c.newsletters.count} newsletter(s), {c.nurtures.count} nurture(s). They reach opted-in audiences, so ReplyIQ counts them but never drafts cold follow-ups into them.
        </Tile>
      </div>
      {c.errors.length > 0 && <p className="mt-3 text-xs text-amber">⚠ {c.errors.join(" · ")}</p>}
    </section>
  );
}
