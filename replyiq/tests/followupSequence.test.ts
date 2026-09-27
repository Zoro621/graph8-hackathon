import { describe, expect, it } from "vitest";
import type { EmailDraftBody, SequenceCreateBody, SequenceDetail, SequenceStepConfig } from "../lib/g8";
import type { Llm, LlmRequest } from "../lib/llm";
import {
  buildFollowupSequence,
  checkEmail,
  goalFor,
  numbersIn,
  originalRules,
  publicDefinition,
  ruleChecks,
  stepInstructions,
  toHtml,
  verifyClaims,
  verifyRecordedSequence,
} from "../lib/pipeline/followupSequence";
import { emptyRun } from "../lib/pipeline/runPipeline";
import type { CampaignDraft, Category, Classified, EmailFact, Group, Run } from "../lib/types";
import { reply } from "./helpers";

const PRICE_TEXT = "# Pricing\n\nThe Team Plan is $99/month for unlimited users and includes 10,000 execution credits. Additional credits cost $0.05 each.";
const SRC_INSTRUCTIONS = [
  "Write a short reactivation email.",
  "",
  "Voice: conversational, direct, plain English. Like an old contact picking back up.",
  "",
  "Hard rules:",
  '- Never use the word "free" anywhere. Use "open" instead.',
  "- Never use em dashes or en dashes.",
  "- DO name the categories of tools we replace.",
  "Body length: 100 words.",
].join("\n");

const cl = (id: string, category: Category, extra: Partial<Classified> = {}): Classified => ({
  ...reply(id, `reply ${id}`, { contactId: Number(id.replace(/\D/g, "") || 1), contactEmail: `${id}@example.com`, company: "Acme" }),
  category,
  confidence: 0.9,
  quote: "Please send pricing details",
  needsReview: false,
  ...extra,
});

function makeRun(group: Group): Run {
  const run = emptyRun("abcdefghijkl", { campaignId: "c1" }, new Date("2026-09-27T10:00:00Z"));
  run.status = "done";
  run.source = { ...run.source, name: "SMB Campaign", campaignId: "c1", sequences: [{ id: "src-seq", name: "SMB sequence", status: "paused" }] };
  run.groups = [group];
  return run;
}

const pricing = (): Group => ({
  key: "pricing_request",
  label: "Pricing request",
  replies: [cl("p1", "pricing_request"), cl("p2", "pricing_request")],
  eligible: [],
  excluded: [],
  card: {
    summary: "They want prices.",
    quotes: [],
    proofWeHave: [{ claim: "Team plan price.", sourceDocId: "d1", sourceDocName: "Pricing Matrix", excerpt: "The Team Plan is $99/month for unlimited users and includes 10,000 execution credits.", verified: true }],
    proofGap: "No cost estimator.",
    howToAnswer: "Send the published pricing.",
    emailAngle: "Here are the prices you asked for.",
    themeNotes: [],
    unverifiedClaims: [],
    sources: [],
  },
});

const draftOf = (): CampaignDraft => ({
  status: "ready",
  listId: 77,
  campaignId: "camp-1",
  audience: [
    { contactId: 1, email: "p1@example.com", threadId: "p1" },
    { contactId: 2, email: "p2@example.com", threadId: "p2" },
  ],
  audienceNotes: [],
  docsPatched: [],
  docsPending: [],
  docsFailed: [],
  generation: "complete",
  warnings: [],
  createdAt: "",
  updatedAt: "",
});

const GOOD_EMAIL = {
  subject: "the pricing you asked for",
  body: "Hi {{first_name}},\n\nFollowing up on pricing: the Team Plan is $99/month for unlimited users and includes 10,000 execution credits.\n\nWould a short breakdown for {{company}} be useful before you decide?\n\n{{sender_name}}",
  claims: [{ source_id: "X1", claim: "Team plan price", excerpt: "The Team Plan is $99/month for unlimited users and includes 10,000 execution credits" }],
};

/** Fake LLM for the writer ("followup_email") and the fact-check ("email_audit"). */
type Src = { id: string; doc: string; text: string };
/** Default pick: the credits sentence from the Pricing Matrix passage (verbatim), found by content, not by id. */
const defaultFacts = (sources: Src[]) => {
  const p = sources.find((x) => x.text.includes("Additional credits cost"));
  return p ? [{ source_id: p.id, claim: "Extra credits price", excerpt: "includes 10,000 execution credits. Additional credits cost $0.05 each." }] : [];
};

function fakeLlm(opts: { emails?: (typeof GOOD_EMAIL)[]; audit?: (email: string) => { sentence: string; reason: string }[]; auditFails?: boolean; facts?: (sources: Src[]) => { source_id: string; claim: string; excerpt: string }[] } = {}) {
  const calls: LlmRequest<unknown>[] = [];
  let n = 0;
  const llm: Llm = {
    async parse<T>(req: LlmRequest<T>) {
      calls.push(req as LlmRequest<unknown>);
      if (req.name === "followup_facts") {
        const sources = JSON.parse(req.user).SOURCES as Src[];
        return { data: req.schema.parse({ facts: (opts.facts ?? defaultFacts)(sources) }), usage: { inputTokens: 1, outputTokens: 1 } };
      }
      if (req.name === "followup_email") {
        const e = opts.emails?.[Math.min(n++, (opts.emails?.length ?? 1) - 1)] ?? GOOD_EMAIL;
        return { data: req.schema.parse(e), usage: { inputTokens: 1, outputTokens: 1 } };
      }
      if (req.name === "email_audit") {
        if (opts.auditFails) throw new Error("audit model down");
        const email = JSON.parse(req.user).EMAIL.body as string;
        return { data: req.schema.parse({ unsupported: opts.audit?.(email) ?? [] }), usage: { inputTokens: 1, outputTokens: 1 } };
      }
      throw new Error(`unexpected ${req.name}`);
    },
  };
  return { llm, calls };
}

function fakeG8(opts: { notAllowed?: boolean; createFails?: boolean; owner?: string | null; readBackSubject?: string; preview?: (b: EmailDraftBody) => { subject: string; body: string } } = {}) {
  const log = { created: [] as { body: SequenceCreateBody; key?: string }[], previews: [] as EmailDraftBody[], estimates: 0, patches: [] as { stepId: string; patch: Record<string, unknown> }[], added: 0 };
  let stored: Record<string, unknown>[] = []; // what graph8 holds for the created sequence
  const detail = (id: string, listId: number | null, owner: string | null): SequenceDetail => ({
    id, name: "s", status: "draft", user_email: owner, step_count: null, contact_count: null, sequence_kind: "cold_outbound",
    associated_list_id: listId, created_at: null, updated_at: null, description: null, finish_on_reply: true, pinned_mailbox_id: null,
  });
  const g8 = {
    assertWriteAllowed: async () => {
      if (opts.notAllowed) throw new Error("writes not allowed");
      return { allowed: true as const, via: "sandbox" as const, orgId: "o" };
    },
    listGlobalDocs: async () => [
      { id: "d1", displayName: "Pricing Matrix", content: PRICE_TEXT },
      { id: "bv", displayName: "Brand Voice", content: "Write plainly and briefly. Avoid hype words." },
    ],
    getCampaignFull: async () => ({ id: "c1", name: "SMB Campaign", status: "paused", documents: [{ id: "e1", file_type: "emails", content: "One platform replaces three separate tools for SMB sales teams, with no card on file." }] }),
    getSequence: async (id: string) => detail(id, id === "src-seq" ? null : 77, id === "src-seq" ? (opts.owner === undefined ? "owner@example.com" : opts.owner) : "owner@example.com"),
    getSequenceSteps: async (id: string) => {
      if (id === "src-seq") return { sequence_id: id, steps: [{ step_order: 1, input_type: "ON_DEMAND", step_data: { instructions: SRC_INSTRUCTIONS } }] };
      const steps = stored.map((s) => ({ ...s, step_data: { ...(s.step_data as object), ...(s.step_order === 2 && opts.readBackSubject ? { subject: opts.readBackSubject } : {}) } }));
      return { sequence_id: id, steps };
    },
    createSequence: async (body: SequenceCreateBody, key?: string) => {
      if (opts.createFails) throw new Error("sequencer down");
      log.created.push({ body, key });
      stored = (body.steps ?? []).map((s) => ({ ...s, id: `step-${s.step_order}` }));
      return { id: `seq-${log.created.length}`, name: body.name, status: "draft" };
    },
    updateSequenceStep: async (_seq: string, stepId: string, patch: Record<string, unknown>) => {
      log.patches.push({ stepId, patch });
      stored = stored.map((s) => (s.id === stepId ? { ...s, ...patch } : s));
      return {};
    },
    addSequenceSteps: async (_seq: string, steps: SequenceStepConfig[]) => {
      log.added += steps.length;
      stored = [...stored, ...steps.map((s) => ({ ...s, id: `step-${s.step_order}` }))];
      return {};
    },
    updateSequence: async () => ({}),
    createList: async (title: string) => ({ id: 78, title }),
    addContactsToList: async () => ({ conflictSkipped: false }),
    listContactsOfList: async () => [] as { id: number | null; work_email: string | null }[],
    removeContactsFromList: async () => undefined,
    findContactByEmail: async (email: string) => ({ id: 1, first_name: "Pat", last_name: "Lee", work_email: email, job_title: "VP Sales", company_id: null }),
    estimateEmailDraft: async () => {
      log.estimates++;
      return { estimated_credits: 9 };
    },
    generateEmailDraft: async (b: EmailDraftBody) => {
      log.previews.push(b);
      if (b.contact_work_email === "boom@example.com") throw new Error("402 out of credits");
      return opts.preview?.(b) ?? { subject: "your pricing", body: "<p>Hi Pat,</p><p>The Team Plan is $99/month for unlimited users and includes 10,000 execution credits.</p><p>Which plan fits Acme best, do you think?</p>" };
    },
  };
  return { g8, log };
}

const deps = (g8: ReturnType<typeof fakeG8>["g8"], llm: Llm | null) => ({ g8, llm, model: "m" });

describe("rules from the original campaign", () => {
  it("keeps hard rules (never/don't lines) and the first sentence of the voice line; drops DO rules", () => {
    expect(originalRules([SRC_INSTRUCTIONS])).toEqual([
      "Voice: conversational, direct, plain English.",
      'Never use the word "free" anywhere. Use "open" instead.',
      "Never use em dashes or en dashes.",
    ]);
    expect(originalRules(["No rules here."])).toEqual([]);
  });

  it("turns a banned word and the no-dash rule into checks", () => {
    const checks = ruleChecks(originalRules([SRC_INSTRUCTIONS]));
    expect(checks.map((c) => c.message)).toHaveLength(2);
    expect(checks.some((c) => c.test("A free tier"))).toBe(true);
    expect(checks.some((c) => c.test("Freedom is fine")) ).toBe(false);
    expect(checks.some((c) => c.test("one tool — not three"))).toBe(true);
  });
});

describe("deterministic checks", () => {
  it("extracts numbers, ignoring list markers", () => {
    expect(numbersIn("1. Team Plan $99/month with 10,000 credits\n2) extra $0.05, 750M+ contacts, 20%")).toEqual(["$99", "10000", "$0.05", "750m+", "20%"]);
  });

  it("passes a clean template and flags merge fields, placeholders, stray numbers and rule breaks", () => {
    const facts = [pricing().card!.proofWeHave[0].excerpt];
    expect(checkEmail({ subject: GOOD_EMAIL.subject, body: GOOD_EMAIL.body }, facts, [], { mergeFields: true })).toEqual([]);
    const bad = { subject: "hi", body: "Hi {{firstname}}, [Company] saves 40% with our free plan — at $99/month. ".repeat(2) };
    const issues = checkEmail(bad, facts, originalRules([SRC_INSTRUCTIONS]), { mergeFields: true });
    expect(issues.join(" | ")).toMatch(/unknown merge field \{\{firstname\}\}/);
    expect(issues.join(" | ")).toMatch(/placeholder left in the text: "\[Company\]"/);
    expect(issues.join(" | ")).toMatch(/not found in any verified fact: 40%/);
    expect(issues.join(" | ")).toMatch(/uses "free"/);
    expect(issues.join(" | ")).toMatch(/em or en dash/);
  });

  it("a rendered preview must not keep merge fields", () => {
    const issues = checkEmail({ subject: "x", body: "Hi {{first_name}}, following up on your question about pricing for your team this quarter, thanks." }, [], [], { mergeFields: false, minWords: 5 });
    expect(issues).toContain("unfilled merge field(s): first_name");
  });

  it("verifyClaims keeps verbatim excerpts only", () => {
    const sources = [{ id: "F1", docId: "d1", docName: "Pricing Matrix", text: "The Team Plan is $99/month for unlimited users and includes 10,000 execution credits." }];
    const docs = new Map([["d1", PRICE_TEXT]]);
    const r = verifyClaims(
      [
        { source_id: "F1", claim: "price", excerpt: "Additional credits cost $0.05 each and more words" },
        { source_id: "F1", claim: "credits", excerpt: "includes 10,000 execution credits. Additional credits cost $0.05 each." },
        { source_id: "P9", claim: "made up", excerpt: "we have one hundred happy customers in total" },
        { source_id: "F1", claim: "short", excerpt: "$99/month" },
      ],
      sources,
      docs,
    );
    expect(r.facts.map((f) => f.claim)).toEqual(["credits"]);
    expect(r.issues).toHaveLength(3);
  });

  it("toHtml keeps merge fields, escapes HTML and makes paragraphs", () => {
    expect(toHtml("Hi {{first_name}},\n\nA < B & C\nline two")).toBe("<p>Hi {{first_name}},</p>\n<p>A &lt; B &amp; C<br>line two</p>");
  });
});

describe("step 1 instructions for graph8's AI", () => {
  it("are assembled from grounded data: quotes, verified facts, never-claim, rules", () => {
    const g = pricing();
    const facts: EmailFact[] = [{ claim: "Team plan price", excerpt: g.card!.proofWeHave[0].excerpt, source: "Pricing Matrix" }];
    const ins = stepInstructions(makeRun(g), g, facts, ["No cost estimator."], ["Never use em dashes."]);
    expect(ins).toContain('"SMB Campaign" campaign');
    expect(ins).toContain('- "Please send pricing details"'); // deduped verbatim quote
    expect(ins.match(/Please send pricing details/g)).toHaveLength(1);
    expect(ins).toContain('- Team plan price: "The Team Plan is $99/month for unlimited users and includes 10,000 execution credits." (Pricing Matrix)');
    expect(ins).toContain("Never claim (we have no proof for this):\n- No cost estimator.");
    expect(ins).toContain("Rules from the original campaign (keep them):\n- Never use em dashes.");
    expect(ins).toContain("How to answer: Send the published pricing.");
    // The proof gap is a description of missing proof, not a claim: its own section, never under "Never claim".
    const withGap = stepInstructions(makeRun(g), g, facts, [], [], "No plan-by-plan pricing table.");
    expect(withGap).toContain("Proof we do not have: No plan-by-plan pricing table.\nDo not fill that gap with a guess");
    expect(withGap).not.toContain("Never claim");
  });

  it("never leak the classifier's internal notes, and give card-less groups a real goal", () => {
    expect(publicDefinition("Away notice. A return date is optional. Put the date in revisit_hint.")).toBe("Away notice. A return date is optional.");
    const ooo: Group = { key: "out_of_office", label: "Out of office", replies: [cl("o1", "out_of_office", { quote: "away until June 9" })], eligible: [], excluded: [] };
    const ins = stepInstructions(makeRun(ooo), ooo, [], [], []);
    expect(ins).not.toMatch(/revisit_hint|referred_name/);
    expect(goalFor(ooo)).toMatch(/Re-open the conversation now that they are back/);
    expect(ins).toContain("Re-open the conversation briefly, then give one or two lines on the original offer");
    expect(goalFor(pricing())).toBe("Here are the prices you asked for.");
  });

  it("say so when there are no facts, and add referral / later guidance", () => {
    const ref: Group = { key: "referral_wrong_person", label: "Referral", replies: [cl("r1", "referral_wrong_person", { quote: "talk to Kurt" })], eligible: [], excluded: [] };
    const ins = stepInstructions(makeRun(ref), ref, [], [], []);
    expect(ins).toContain("- None. Do not state product facts");
    expect(ins).toContain("a colleague suggested reaching out; do not name the colleague");
    const ooo: Group = { key: "out_of_office", label: "Out of office", replies: [cl("o1", "out_of_office", { quote: "away until June 9" })], eligible: [], excluded: [] };
    expect(stepInstructions(makeRun(ooo), ooo, [], [], [])).toContain("do not mention specific dates");
  });
});

describe("buildFollowupSequence", () => {
  it("creates a draft sequence: step 1 on demand (instructions only), step 2 ReplyIQ's checked text; verified by read-back", async () => {
    const g = pricing();
    const run = makeRun(g);
    const { g8, log } = fakeG8();
    const { llm, calls } = fakeLlm();
    const seq = await buildFollowupSequence(deps(g8, llm), run, g, draftOf());
    expect(seq.status).toBe("ready");
    expect(seq.verified).toBe(true);
    expect(seq.senderAttached).toBe(false);
    const { body, key } = log.created[0];
    expect(key).toBe("replyiq:abcdefghijkl:pricing_request:sequence");
    expect(body).toMatchObject({ user_email: "owner@example.com", associated_list_id: 77, campaign_id: "camp-1", finish_on_reply: true });
    expect(body).not.toHaveProperty("channels");
    expect(body.steps![0]).toEqual({ step_order: 1, step_type: "EMAIL", input_type: "ON_DEMAND", time_interval: 0, step_data: { instructions: seq.instructions, email_type: "html" } });
    expect(body.steps![1]).toMatchObject({ step_order: 2, input_type: "MANUAL_TEMPLATE", time_interval: 4 * 86_400, step_data: { subject: GOOD_EMAIL.subject, email_type: "html" } });
    expect(body.steps![1].step_data.body).toContain("<p>Hi {{first_name}},</p>");
    expect(seq.manualEmail?.check).toEqual({ ok: true, issues: [], audited: true });
    expect(seq.instructions).toContain("No cost estimator.");
    expect(seq.originalRules).toContain("Never use em dashes or en dashes.");
    expect(seq.facts.map((f) => f.claim)).toEqual(["Team plan price", "Extra credits price"]); // card proof first, then a verified pick
    expect(seq.instructions).toContain('- Extra credits price: "includes 10,000 execution credits. Additional credits cost $0.05 each." (Pricing Matrix)');
    // fact selection sees the original sequence's copy and document passages, never the voice documents
    const selection = JSON.parse(calls.find((c) => c.name === "followup_facts")!.user);
    expect(selection.SOURCES[0]).toMatchObject({ id: "O1", doc: "Original sequence, step 1" });
    expect(selection.SOURCES.some((x: Src) => x.doc === "Brand Voice")).toBe(false);
    // the writer gets only the verified facts, plus voice, original rules and the never-claim list
    const writer = JSON.parse(calls.find((c) => c.name === "followup_email")!.user);
    expect(writer.FACTS.map((x: { id: string }) => x.id)).toEqual(["X1", "X2"]);
    expect(writer.VOICE).toContain("Brand Voice");
    expect(writer.ORIGINAL_RULES).toContain("Never use em dashes or en dashes.");
    // The proof gap is not a claim: it reaches the writer and the fact-checker as "never fill this gap", and the card's unproven claims (none here) as "never claim".
    expect(seq.doNotClaim).toEqual([]);
    expect(seq.proofGap).toBe("No cost estimator.");
    expect(writer.DO_NOT_CLAIM).toEqual(["Anything that would fill this proof gap (the company has no proof for it): No cost estimator."]);
    expect(seq.instructions).toContain("Proof we do not have: No cost estimator.");
    expect(seq.instructions).not.toContain("Never claim (we have no proof for this)");
    // the auditor knows where each email sits in the sequence
    const audit = JSON.parse(calls.find((c) => c.name === "email_audit")!.user);
    expect(audit.POSITION).toMatch(/^Step 2: sent 4 days after step 1/);
  });

  it("re-checks the Answer Card's proof: a point found only in ReplyIQ's own block of its document is left out", async () => {
    const g = pricing();
    const own = "Teams that switch see results within ninety days of moving over.";
    g.card!.proofWeHave.push({ claim: "Fast results.", sourceDocId: "mh", sourceDocName: "Messaging House", excerpt: own, verified: true });
    const { g8 } = fakeG8();
    const listed = await g8.listGlobalDocs();
    g8.listGlobalDocs = async () => [...listed, { id: "mh", displayName: "Messaging House", content: `Company text.\n<!-- replyiq:learnings:k -->\n${own}\n<!-- /replyiq:learnings:k -->` }];
    const seq = await buildFollowupSequence(deps(g8, fakeLlm().llm), makeRun(g), g, draftOf());
    expect(seq.facts.map((f) => f.claim)).not.toContain("Fast results");
    expect(seq.facts[0].claim).toBe("Team plan price"); // the real proof stays
    expect(seq.warnings.join(" ")).toMatch(/1 Answer Card proof point\(s\) left out/);
  });

  it("drops suggested facts that are not verbatim, and can take facts from the original sequence's own copy", async () => {
    const g = pricing();
    const { g8 } = fakeG8();
    const { llm } = fakeLlm({
      facts: () => [
        { source_id: "O1", claim: "Short reactivation email", excerpt: "Write a short reactivation email." }, // under 6 words: dropped
        { source_id: "O1", claim: "Voice", excerpt: "conversational, direct, plain English. Like an old contact picking back up." },
        { source_id: "P1", claim: "Invented", excerpt: "we have one hundred happy customers across the world" },
      ],
    });
    const seq = await buildFollowupSequence(deps(g8, llm), makeRun(g), g, draftOf());
    expect(seq.facts.map((f) => f.source)).toEqual(["Pricing Matrix", "Original sequence, step 1"]);
    expect(seq.warnings.join(" ")).toMatch(/2 suggested fact\(s\) dropped/);
  });

  it("rewrites once with the problems when the first draft fails the check", async () => {
    const g = pricing();
    const bad = { ...GOOD_EMAIL, body: GOOD_EMAIL.body.replace("$99/month", "$49/month") };
    const { g8, log } = fakeG8();
    const { llm, calls } = fakeLlm({ emails: [bad, GOOD_EMAIL] });
    const seq = await buildFollowupSequence(deps(g8, llm), makeRun(g), g, draftOf());
    expect(seq.manualEmail?.attempts).toBe(2);
    expect(seq.manualEmail?.check.ok).toBe(true);
    const second = JSON.parse(calls.filter((c) => c.name === "followup_email")[1].user);
    expect(second.FIX_THESE_PROBLEMS_FROM_YOUR_LAST_DRAFT.join(" ")).toMatch(/\$49/);
    expect(log.created[0].body.steps).toHaveLength(2);
  });

  it("leaves step 2 out when it fails twice (audit finds an unsupported claim), keeping step 1", async () => {
    const g = pricing();
    const { g8, log } = fakeG8();
    const { llm } = fakeLlm({ audit: () => [{ sentence: "We have a cost estimator.", reason: "in DO_NOT_CLAIM" }] });
    const seq = await buildFollowupSequence(deps(g8, llm), makeRun(g), g, draftOf());
    expect(seq.status).toBe("ready");
    expect(log.created[0].body.steps).toHaveLength(1);
    expect(seq.manualEmail?.check.ok).toBe(false);
    expect(seq.warnings.join(" ")).toMatch(/step 2 failed the fact-check twice/);
    expect(seq.facts.map((f) => f.claim)).toEqual(["Team plan price", "Extra credits price"]); // step 1 still gets the verified facts
  });

  it("fails closed when the audit model is down (not verified = not used)", async () => {
    const g = pricing();
    const { g8, log } = fakeG8();
    const seq = await buildFollowupSequence(deps(g8, fakeLlm({ auditFails: true }).llm), makeRun(g), g, draftOf());
    expect(seq.manualEmail?.check).toMatchObject({ ok: false, audited: false });
    expect(log.created[0].body.steps).toHaveLength(1);
  });

  it("previews step 1 with graph8's AI (CRM fields only, no reply text) and fact-checks each; failures are per contact", async () => {
    const g = pricing();
    g.replies[0].company = "Acme 2"; // a number in the recipient's own company name is not a claim
    const draft = draftOf();
    draft.audience.push({ contactId: 3, email: "boom@example.com", threadId: "p3" });
    const { g8, log } = fakeG8({
      preview: (b) =>
        b.contact_id === 2
          ? { subject: "pricing", body: "<p>Hi Pat,</p><p>Most teams save 40% in month one with the Team Plan at $99/month, which is great value.</p>" }
          : { subject: "your pricing", body: "<p>Hi Pat,</p><p>The Team Plan is $99/month for unlimited users and includes 10,000 execution credits.</p><p>Which plan fits the Acme 2 team best, do you think?</p>" },
    });
    const seq = await buildFollowupSequence(deps(g8, fakeLlm().llm), makeRun(g), g, draft, { previews: 3 });
    expect(log.previews).toHaveLength(3);
    expect(log.previews[0]).toMatchObject({ contact_id: 1, sequence_id: "seq-1", studio_campaign_id: "camp-1", step_order: 1, agent_name: "default", instructions: seq.instructions });
    expect(log.previews[0].lead_info).toBe("Pat Lee, VP Sales, at Acme 2");
    expect(log.previews[0].lead_info).not.toContain("reply");
    expect(seq.previews).toHaveLength(2);
    expect(seq.previews![0].check.ok).toBe(true);
    expect(seq.previews![0].body).not.toContain("<p>");
    expect(seq.previews![1].check.ok).toBe(false);
    expect(seq.previews![1].check.issues.join(" ")).toMatch(/40%/);
    expect(seq.previewCredits).toBe(27);
    expect(seq.warnings.join(" ")).toMatch(/preview for boom@example.com failed: .*402/);
  });

  it("reuses an existing sequence (no second create) and can add previews later", async () => {
    const g = pricing();
    const draft = draftOf();
    const { g8, log } = fakeG8();
    draft.sequence = await buildFollowupSequence(deps(g8, fakeLlm().llm), makeRun(g), g, draft);
    const again = await buildFollowupSequence(deps(g8, fakeLlm().llm), makeRun(g), g, draft, { previews: 1 });
    expect(log.created).toHaveLength(1);
    expect(again.sequenceId).toBe("seq-1");
    expect(again.previews).toHaveLength(1);
    // asking again refreshes the previews; not asking keeps what was there
    draft.sequence = again;
    expect((await buildFollowupSequence(deps(g8, fakeLlm().llm), makeRun(g), g, draft, { previews: 2 })).previews).toHaveLength(2);
    expect((await buildFollowupSequence(deps(g8, fakeLlm().llm), makeRun(g), g, draft)).previews).toHaveLength(1);
  });

  it("refresh re-writes the existing sequence's steps in place (no second sequence) and adds a missing step 2", async () => {
    const g = pricing();
    const draft = draftOf();
    const { g8, log } = fakeG8();
    // first build: step 2 fails its check twice, so the sequence has step 1 only
    draft.sequence = await buildFollowupSequence(deps(g8, fakeLlm({ audit: () => [{ sentence: "x", reason: "unsupported" }] }).llm), makeRun(g), g, draft);
    expect(log.created[0].body.steps).toHaveLength(1);
    g.card!.howToAnswer = "Lead with the Team Plan price.";
    const refreshed = await buildFollowupSequence(deps(g8, fakeLlm().llm), makeRun(g), g, draft, { refresh: true });
    expect(log.created).toHaveLength(1); // same sequence
    expect(refreshed).toMatchObject({ status: "ready", sequenceId: "seq-1", verified: true });
    expect(log.patches[0]).toMatchObject({ stepId: "step-1", patch: { input_type: "ON_DEMAND" } });
    expect(String((log.patches[0].patch.step_data as { instructions: string }).instructions)).toContain("Lead with the Team Plan price.");
    expect(log.added).toBe(1); // step 2 now passes: appended
    expect(refreshed.steps.map((s) => s.inputType)).toEqual(["ON_DEMAND", "MANUAL_TEMPLATE"]);

    // refresh again, but the new step 2 fails: step 1 is updated, the previous step 2 is kept
    draft.sequence = refreshed;
    const kept = await buildFollowupSequence(deps(g8, fakeLlm({ audit: (b) => (b.includes("$99") ? [{ sentence: "x", reason: "unsupported" }] : []) }).llm), makeRun(g), g, draft, { refresh: true });
    expect(kept.status).toBe("ready");
    expect(kept.warnings.join(" ")).toMatch(/previous step 2 was kept/);
    expect(kept.steps).toHaveLength(2);
    expect(kept.verified).toBe(true);
    expect(log.patches.filter((p) => p.stepId === "step-2")).toHaveLength(0);
  });

  it("records read-back mismatches, graph8 failures, a missing owner and refused writes without throwing", async () => {
    const g = pricing();
    const mismatch = await buildFollowupSequence(deps(fakeG8({ readBackSubject: "changed" }).g8, fakeLlm().llm), makeRun(g), g, draftOf());
    expect(mismatch).toMatchObject({ status: "ready", verified: false });
    expect(mismatch.warnings.join(" ")).toMatch(/step 2 subject differs/);

    const down = await buildFollowupSequence(deps(fakeG8({ createFails: true }).g8, fakeLlm().llm), makeRun(g), g, draftOf());
    expect(down).toMatchObject({ status: "failed", error: expect.stringMatching(/sequencer down/) });

    const noOwner = await buildFollowupSequence(deps(fakeG8({ owner: null }).g8, fakeLlm().llm), makeRun(g), g, draftOf());
    expect(noOwner.error).toMatch(/G8_SEQUENCE_OWNER_EMAIL/);

    const blocked = fakeG8({ notAllowed: true });
    const refused = await buildFollowupSequence(deps(blocked.g8, fakeLlm().llm), makeRun(g), g, draftOf());
    expect(refused.status).toBe("failed");
    expect(blocked.log.created).toHaveLength(0);

    const noList = draftOf();
    delete noList.listId;
    await expect(buildFollowupSequence(deps(fakeG8().g8, null), makeRun(g), g, noList)).rejects.toThrow(/no audience list/);
  });
});

describe("verifyRecordedSequence (read-only check used by live tests and e2e)", () => {
  it("passes a matching draft and names every difference", async () => {
    const g = pricing();
    const draft = draftOf();
    const { g8 } = fakeG8();
    draft.sequence = await buildFollowupSequence(deps(g8, fakeLlm().llm), makeRun(g), g, draft);
    const reader = { ...g8, getSequenceChannels: async () => [] };
    expect(await verifyRecordedSequence(reader, draft)).toEqual([]);
    const live = { ...reader, getSequence: async (id: string) => ({ ...(await g8.getSequence(id)), status: "live", associated_list_id: 5 }), getSequenceChannels: async () => [{ channel_type: "email" }] };
    const problems = await verifyRecordedSequence(live, draft);
    expect(problems.join(" | ")).toMatch(/list 5, expected 77/);
    expect(problems.join(" | ")).toMatch(/sequence is live/);
    expect(problems.join(" | ")).toMatch(/1 sender\(s\) attached/);
    expect(await verifyRecordedSequence(reader, draftOf())).toEqual(["no sequence recorded"]);
  });
});
