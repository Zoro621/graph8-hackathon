import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { Thread } from "../lib/g8";
import { stripQuoted, threadToReply, toPlainText } from "../lib/pipeline/fetchReplies";
import { scrubText } from "../lib/scrub";

const msg = (responder: string, content: string, date: string, isDraft = false) => ({
  messageId: null,
  from: responder === "OTHER" ? "p@example.com" : "me@example.com",
  to: [],
  content,
  responder,
  date,
  isDraft,
});

const thread = (messages: Thread["messages"]): Thread => ({
  id: "t1",
  subject: "Re: hi",
  sequenceId: "seq1",
  sequenceName: null,
  mailbox: null,
  contact: { id: 5, email: "P@Example.com", name: "Pat" },
  messages,
  tags: [],
  summary: null,
  source: "emails.search",
});

describe("threadToReply", () => {
  it("takes the latest prospect message and the first outbound", () => {
    const r = threadToReply(
      thread([
        msg("OTHER", "second reply", "2026-09-24T12:00:00Z"),
        msg("USER", "our pitch", "2026-09-24T10:00:00Z"),
        msg("OTHER", "first reply", "2026-09-24T11:00:00Z"),
      ]),
      "seq1",
    );
    expect(r).toMatchObject({ threadId: "t1", contactId: 5, contactEmail: "p@example.com", outbound: "our pitch", replyText: "second reply" });
  });

  it("returns null when the prospect never replied", () => {
    expect(threadToReply(thread([msg("USER", "pitch", "2026-09-24T10:00:00Z")]), "seq1")).toBeNull();
  });

  it("ignores draft messages", () => {
    const r = threadToReply(thread([msg("OTHER", "real", "2026-09-24T10:00:00Z"), msg("OTHER", "draft", "2026-09-24T11:00:00Z", true)]), "seq1");
    expect(r?.replyText).toBe("real");
  });
});

describe("text cleanup", () => {
  it("converts HTML to text", () => {
    expect(toPlainText("<p>Hi&nbsp;there</p><p>Thanks &amp; bye</p>")).toBe("Hi there\nThanks & bye");
  });

  it("strips quoted history", () => {
    expect(stripQuoted("No thank you.\n\nGale\n\nFrom: Daniel <d@example.com>\nSent: Monday\nOld pitch")).toBe("No thank you.\n\nGale");
    expect(stripQuoted("Sounds good.\nOn Mon, Sep 22, 2026 at 9:00 AM Dan wrote:\n> old")).toBe("Sounds good.");
    expect(stripQuoted("Only new text")).toBe("Only new text");
  });

  it("scrubs real emails and phone numbers but keeps example.com", () => {
    expect(scrubText("call 508-475-0600 or mail jo@acme.io / p@example.com")).toBe("call [phone] or mail redacted@example.com / p@example.com");
  });
});

// Real [DEMO] data captured by `npm run spike` (scrubbed, committed).
const demoFile = path.join(__dirname, "fixtures", "demo", "threads.json");
describe.skipIf(!existsSync(demoFile))("real [DEMO] threads from graph8", () => {
  const bySeq = JSON.parse(readFileSync(demoFile, "utf8")) as Record<string, Thread[]>;
  const all = Object.entries(bySeq).flatMap(([seq, ts]) => ts.map((t) => threadToReply(t, seq)));

  it("every demo thread yields a reply with thread id, contact id and text", () => {
    expect(all.length).toBeGreaterThanOrEqual(12);
    for (const r of all) {
      expect(r).not.toBeNull();
      expect(r!.threadId).toMatch(/[0-9a-f-]{36}/);
      expect(r!.contactId).toBeTypeOf("number");
      expect(r!.replyText.length).toBeGreaterThan(5);
    }
  });

  it("contains the 6 seeded reply types", () => {
    const texts = new Set(all.map((r) => r!.replyText));
    for (const kw of ["pricing", "remove", "follow-up", "demo", "Out of office", "Not interested"]) {
      expect([...texts].some((t) => t.toLowerCase().includes(kw.toLowerCase()))).toBe(true);
    }
  });
});
