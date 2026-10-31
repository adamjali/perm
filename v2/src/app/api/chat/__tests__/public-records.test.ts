import { generateText, stepCountIs } from "ai";
import { MockLanguageModelV4 } from "ai/test";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The chat answers from the same public records as the /v1 API and the MCP server, through the same reads, and a
 * conversation with a fake model shows each step: the model asks for a record, the tool reads it, and the next step
 * sees the source, the date and the page to cite. No model quota is spent.
 */

vi.mock("server-only", () => ({}));
vi.mock("convex/nextjs", () => ({ fetchQuery: vi.fn(), fetchAction: vi.fn(), fetchMutation: vi.fn() }));
vi.mock("@/lib/sentry", () => ({ captureError: vi.fn() }));
const readCase = vi.fn();
const readEstimate = vi.fn();
const readQueue = vi.fn();
const readBulletin = vi.fn();
const readEntity = vi.fn();
const searchEntities = vi.fn();
vi.mock("@/lib/api/reads", () => ({ readCase, readEstimate, readQueue, readBulletin, readEntity, searchEntities }));
const lookupSoc = vi.fn();
vi.mock("@/lib/api/socLookup", () => ({ lookupSoc }));

const { createTools, PUBLIC_RECORD_TOOLS } = await import("../create-tools");
const { MCP_TOOLS } = await import("@/lib/api/openapi");
const { chatTools } = await import("@/lib/ai/tools");
const { getToolPermission } = await import("@/lib/ai/tool-permissions");

const usage = {
  inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: 5, text: 5, reasoning: 0 },
};
const call = (toolName: string, input: object) => ({
  content: [{ type: "tool-call" as const, toolCallId: "call-1", toolName, input: JSON.stringify(input) }],
  finishReason: { unified: "tool-calls" as const, raw: "tool_calls" },
  usage,
  warnings: [],
});
const say = (text: string) => ({
  content: [{ type: "text" as const, text }],
  finishReason: { unified: "stop" as const, raw: "stop" },
  usage,
  warnings: [],
});

describe("the chat's public-record tools", () => {
  beforeEach(() => {
    for (const f of [readCase, readEstimate, readQueue, readBulletin, readEntity, searchEntities, lookupSoc]) f.mockReset();
  });

  it("covers every MCP tool, read-only, under the chat's own name", () => {
    expect(Object.keys(PUBLIC_RECORD_TOOLS).sort()).toEqual(MCP_TOOLS.map((t) => t.name).sort());
    const tools = createTools("token");
    for (const name of Object.values(PUBLIC_RECORD_TOOLS)) {
      expect(Object.keys(chatTools), name).toContain(name);
      expect(tools[name], name).toBeDefined();
      expect(getToolPermission(name), name).toBe("autonomous");
    }
  });

  it("runs a conversation: the model asks for a case, reads DOL's record, and answers citing it", async () => {
    readCase.mockResolvedValue({
      ok: true,
      data: { caseNumber: "G-100-26045-123456", status: "ANALYST REVIEW", isFinal: false },
      meta: { source: "U.S. Department of Labor, FLAG case status", asOf: "2026-10-31", url: "https://permtracker.app/perm-case-status?case=G-100-26045-123456" },
    });
    const model = new MockLanguageModelV4({
      doGenerate: [call("lookupDolCase", { caseNumber: "G-100-26045-123456" }), say("DOL's record shows it in analyst review as of October 31, 2026.")],
    });
    const result = await generateText({ model, tools: createTools("token"), prompt: "Where is G-100-26045-123456?", stopWhen: stepCountIs(4) });
    expect(readCase).toHaveBeenCalledWith("G-100-26045-123456");
    expect(result.text).toBe("DOL's record shows it in analyst review as of October 31, 2026.");
    // The second step saw the record with its source, date and page.
    const second = JSON.stringify(model.doGenerateCalls[1]!.prompt);
    expect(second).toContain("U.S. Department of Labor, FLAG case status");
    expect(second).toContain("2026-10-31");
    expect(second).toContain("perm-case-status?case=G-100-26045-123456");
  });

  it("passes a refusal on in words, with the page, instead of a record", async () => {
    readEstimate.mockResolvedValue({ ok: false, status: 404, code: "not_found", message: "No record of this case yet, so no estimate.", url: "https://permtracker.app/perm-case-status?case=G-100-26300-000001" });
    const model = new MockLanguageModelV4({ doGenerate: [call("estimateDecision", { caseNumber: "G-100-26300-000001" }), say("Not found yet.")] });
    await generateText({ model, tools: createTools("token"), prompt: "When will it be decided?", stopWhen: stepCountIs(4) });
    expect(readEstimate).toHaveBeenCalledWith({ caseNumber: "G-100-26300-000001", filed: null });
    const second = JSON.stringify(model.doGenerateCalls[1]!.prompt);
    expect(second).toContain("No record of this case yet");
    expect(second).toContain("Tell the person what was not found");
  });

  it("says a failed read plainly and never invents a record", async () => {
    readQueue.mockRejectedValue(new Error("SQLITE_BUSY"));
    const model = new MockLanguageModelV4({ doGenerate: [call("dolQueue", {}), say("The records couldn't be read just now.")] });
    await generateText({ model, tools: createTools("token"), prompt: "Processing times?", stopWhen: stepCountIs(4) });
    expect(JSON.stringify(model.doGenerateCalls[1]!.prompt)).toContain("couldn't be read just now");
  });

  it("maps the sponsor kinds to the API's", async () => {
    searchEntities.mockResolvedValue({ ok: true, data: [], meta: { source: "DOL", asOf: null, url: "https://permtracker.app/perm-attorneys" } });
    const model = new MockLanguageModelV4({ doGenerate: [call("searchSponsors", { kind: "law firm", name: "Fragomen" }), say("Done.")] });
    await generateText({ model, tools: createTools("token"), prompt: "Find Fragomen", stopWhen: stepCountIs(4) });
    expect(searchEntities).toHaveBeenCalledWith("attorney", "Fragomen", 10);
  });
});
