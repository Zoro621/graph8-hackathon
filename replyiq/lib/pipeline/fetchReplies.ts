import type { G8Client, Thread, ThreadMessage } from "../g8";
import type { Reply } from "../types";

const time = (m: ThreadMessage) => {
  const t = Date.parse(m.date ?? "");
  return Number.isNaN(t) ? 0 : t;
};

/** HTML email bodies → plain text for the classifier. */
export function toPlainText(html: string | null | undefined): string {
  if (!html) return "";
  return html
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|tr)>/gi, "\n")
    .replace(/<(style|script)[\s\S]*?<\/\1>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// Where the quoted earlier conversation starts in a reply.
const QUOTE_MARKERS = [
  /^On .{3,200}wrote:\s*$/m,
  /^-{2,}\s*Original Message\s*-{2,}/im,
  /^From:\s.+$/m,
  /^Sent from my \w+/m,
  /^_{5,}\s*$/m,
];

/** Keep only the prospect's new text: drop quoted history and ">" lines. */
export function stripQuoted(text: string): string {
  let cut = text.length;
  for (const re of QUOTE_MARKERS) {
    const m = re.exec(text);
    if (m && m.index > 0 && m.index < cut) cut = m.index;
  }
  return text
    .slice(0, cut)
    .split("\n")
    .filter((line) => !line.trimStart().startsWith(">"))
    .join("\n")
    .trim();
}

/**
 * One thread → a Reply, or null when the prospect never replied.
 * responder: OTHER = the contact, USER = a graph8 user, AI = an AI-sent reply (docs: developers/inbox).
 */
export function threadToReply(thread: Thread, sequenceId: string): Reply | null {
  const messages = thread.messages.filter((m) => !m.isDraft).sort((a, b) => time(a) - time(b));
  const latest = messages.filter((m) => m.responder === "OTHER").at(-1);
  if (!latest) return null;
  const outbound = messages.find((m) => m.responder === "USER" || m.responder === "AI");
  const full = toPlainText(latest.content);

  return {
    threadId: thread.id,
    sequenceId: thread.sequenceId ?? sequenceId,
    contactEmail: (thread.contact.email ?? latest.from ?? "").toLowerCase(),
    contactId: thread.contact.id,
    contactName: thread.contact.name,
    company: thread.contact.company,
    subject: thread.subject ?? undefined,
    outbound: outbound ? toPlainText(outbound.content) : undefined,
    replyText: stripQuoted(full) || full,
    repliedAt: latest.date ?? undefined,
    existingTags: thread.tags,
  };
}

export interface FetchRepliesResult {
  threads: number;
  replies: Reply[];
  sources: Record<Thread["source"], number>;
}

export async function fetchReplies(client: Pick<G8Client, "listThreads">, sequenceId: string): Promise<FetchRepliesResult> {
  const threads = await client.listThreads(sequenceId);
  const sources = { "emails.search": 0, inbox: 0 } as Record<Thread["source"], number>;
  for (const t of threads) sources[t.source]++;
  const replies = threads.map((t) => threadToReply(t, sequenceId)).filter((r): r is Reply => r !== null);
  return { threads: threads.length, replies, sources };
}
