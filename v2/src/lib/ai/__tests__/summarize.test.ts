import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * A long conversation compacted with fake models, so no free quota is spent: facts from the extraction model are
 * merged into the stored ones, the prose replaces the old summary, Gemini falling over hands the prose to the
 * fallback, and when every prose model fails nothing is saved and the lock is let go.
 */

const m = vi.hoisted(() => ({ extract: null as unknown, primary: null as unknown, fallback: null as unknown }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/sentry", () => ({ captureError: vi.fn() }));
vi.mock("@convex/conversationSummary", () => ({ RECENT_MESSAGES_TO_KEEP: 10 }));
vi.mock("./../providers", () => ({ groq: (id: string) => (id === "openai/gpt-oss-20b" ? m.extract : m.fallback) }));
vi.mock("@ai-sdk/google", () => ({ google: () => m.primary }));
const fetchMutation = vi.fn();
const fetchQuery = vi.fn();
vi.mock("convex/nextjs", () => ({ fetchMutation, fetchQuery }));

const { MockLanguageModelV4 } = await import("ai/test");

const usage = { inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 }, outputTokens: { total: 1, text: 1, reasoning: 0 } };
const says = (text: string) => ({ content: [{ type: "text" as const, text }], finishReason: { unified: "stop" as const, raw: "stop" }, usage, warnings: [] });
const fails = (message: string) => async () => {
  throw new Error(message);
};

// Sixty messages: a long conversation about two cases.
const messages = Array.from({ length: 60 }, (_, i) => ({
  role: i % 2 ? ("assistant" as const) : ("user" as const),
  content: i % 2 ? `Answer ${i} about Acme Corp's PWD.` : `Question ${i} about G-100-26045-123456.`,
}));
const stored = {
  messages,
  existingSummary: "Earlier: the person set up two cases.",
  existingFacts: JSON.stringify({ cases: [{ id: "G-100-24339-516453" }], preferences: ["concise answers"], openActions: ["Old: chase the employer"] }),
  totalMessageCount: 70,
};

function models({ extract, primary, fallback }: { extract: unknown; primary: unknown; fallback: unknown }) {
  m.extract = new MockLanguageModelV4({ doGenerate: extract as never });
  m.primary = new MockLanguageModelV4({ doGenerate: primary as never });
  m.fallback = new MockLanguageModelV4({ doGenerate: fallback as never });
}

async function run() {
  vi.resetModules();
  const { summarizeConversation } = await import("../summarize");
  await summarizeConversation("conv1" as never, "token");
}

const saved = () => fetchMutation.mock.calls.find(([, args]) => args && "content" in args)?.[1] as Record<string, unknown> | undefined;

describe("compacting a long conversation", () => {
  beforeEach(() => {
    fetchMutation.mockReset();
    fetchQuery.mockReset();
    // beginSummarizing hands back the lock's token; the rest answer nothing in particular.
    fetchMutation.mockImplementation(async (_fn, args: Record<string, unknown>) => ("content" in args ? null : Object.keys(args).length === 1 ? 1730000000000 : null));
    fetchQuery.mockResolvedValue(stored);
  });

  it("merges the new facts into the stored ones and replaces the prose", async () => {
    models({
      extract: says(JSON.stringify({ cases: [{ id: "G-100-26045-123456", status: "ANALYST REVIEW" }], openActions: ["Acme Corp: send the PWD"] })),
      primary: says("The person is tracking Acme Corp's PWD and a second case."),
      fallback: fails("not used"),
    });
    await run();
    const s = saved()!;
    expect(s.content).toBe("The person is tracking Acme Corp's PWD and a second case.");
    const facts = JSON.parse(String(s.facts));
    // Both cases kept, the old preference kept, the open actions replaced by the newest list.
    expect(facts.cases.map((c: { id: string }) => c.id)).toEqual(["G-100-24339-516453", "G-100-26045-123456"]);
    expect(facts.preferences).toEqual(["concise answers"]);
    expect(facts.openActions).toEqual(["Acme Corp: send the PWD"]);
    // The ten newest messages stay out of the summary; the lock's token travels with the save.
    expect(s.messageCountAtSummary).toBe(60);
    expect(s.lockToken).toBe(1730000000000);
    // The prose model saw the earlier summary and the conversation.
    const prompt = JSON.stringify((m.primary as { doGenerateCalls: { prompt: unknown }[] }).doGenerateCalls[0]!.prompt);
    expect(prompt).toContain("Earlier: the person set up two cases.");
    expect(prompt).toContain("Question 58 about G-100-26045-123456.");
  });

  it("hands the prose to the fallback when Gemini fails", async () => {
    models({ extract: says("{}"), primary: fails("429 quota"), fallback: says("Fallback summary.") });
    await run();
    expect(saved()?.content).toBe("Fallback summary.");
  });

  it("keeps the stored facts when extraction fails, and still saves the prose", async () => {
    models({ extract: fails("timeout"), primary: says("Prose only."), fallback: fails("not used") });
    await run();
    const facts = JSON.parse(String(saved()!.facts));
    expect(facts.cases).toEqual([{ id: "G-100-24339-516453" }]);
    expect(facts.openActions).toEqual(["Old: chase the employer"]);
  });

  it("saves nothing and lets go of the lock when every prose model fails", async () => {
    models({ extract: says("{}"), primary: fails("down"), fallback: fails("down too") });
    await run();
    expect(saved()).toBeUndefined();
    // begin, then finish: the release.
    expect(fetchMutation).toHaveBeenCalledTimes(2);
  });

  it("asks no model when another run holds the lock", async () => {
    fetchMutation.mockResolvedValue(false);
    models({ extract: says("{}"), primary: says("x"), fallback: says("y") });
    await run();
    expect(fetchQuery).not.toHaveBeenCalled();
    expect((m.primary as { doGenerateCalls: unknown[] }).doGenerateCalls).toHaveLength(0);
  });
});
