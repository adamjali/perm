import { beforeEach, describe, expect, it, vi } from "vitest";

import { API_PLANS } from "@convex/lib/apiPlans";

const authenticate = vi.fn();
const takeMinute = vi.fn();
const checkAllowance = vi.fn();
const countCall = vi.fn();
const readQueue = vi.fn();
const readCase = vi.fn();
vi.mock("../auth", () => ({ authenticate: (...a: unknown[]) => authenticate(...a) }));
vi.mock("../usage", () => ({
  ANONYMOUS_ACCOUNT: "anonymous",
  takeMinute: (...a: unknown[]) => takeMinute(...a),
  checkAllowance: (...a: unknown[]) => checkAllowance(...a),
  countCall: (...a: unknown[]) => countCall(...a),
}));
vi.mock("../reads", () => ({
  readQueue: (...a: unknown[]) => readQueue(...a),
  readCase: (...a: unknown[]) => readCase(...a),
  readBulletin: vi.fn(),
  readEntity: vi.fn(),
  readEstimate: vi.fn(),
  searchEntities: vi.fn(),
}));

import { OPTIONS, POST } from "@/app/mcp/route";
import { MCP_TOOLS } from "../openapi";

const meta = { source: "DOL", asOf: "2026-09-22", url: "https://permtracker.app/perm-processing-times" };

let id = 0;
async function rpc(method: string, params: unknown = {}, headers: Record<string, string> = {}) {
  const res = await POST(
    new Request("https://permtracker.app/mcp", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
        "mcp-protocol-version": "2025-06-18",
        ...headers,
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: ++id, method, params }),
    }),
  );
  const text = await res.text();
  const line = text.split("\n").find((l) => l.startsWith("data: "));
  return { res, body: line ? JSON.parse(line.slice(6)) : text ? JSON.parse(text) : null };
}

beforeEach(() => {
  authenticate.mockReset().mockResolvedValue({ ok: true, caller: { kind: "anonymous" } });
  takeMinute.mockReset().mockReturnValue({ ok: true, remaining: 100, reset: 30 });
  checkAllowance.mockReset().mockResolvedValue({ ok: true, today: 0, month: 0 });
  countCall.mockReset();
  readQueue.mockReset().mockResolvedValue({ ok: true, data: { perm: { asOf: "2026-09-22" } }, meta });
  readCase.mockReset();
});

describe("the MCP server at /mcp", () => {
  it("lists the documented tools, every one read-only", async () => {
    const { body } = await rpc("tools/list");
    const tools = body.result.tools as { name: string; annotations?: { readOnlyHint?: boolean } }[];
    expect(tools.map((t) => t.name).sort()).toEqual(MCP_TOOLS.map((t) => t.name).sort());
    expect(tools.every((t) => t.annotations?.readOnlyHint === true)).toBe(true);
  });

  it("answers a tool call with the source and page first, and counts it to the shared pool", async () => {
    const { body } = await rpc("tools/call", { name: "queue_status", arguments: {} });
    const out = JSON.parse(body.result.content[0].text);
    expect(out).toMatchObject({ source: "DOL", asOf: "2026-09-22", page: meta.url });
    expect(countCall).toHaveBeenCalledWith("anonymous", "mcp");
  });

  it("tells the assistant when the shared pool is full, and reads nothing", async () => {
    takeMinute.mockReturnValue({ ok: false, remaining: 0, reset: 12 });
    const { body } = await rpc("tools/call", { name: "queue_status", arguments: {} });
    expect(body.result.isError).toBe(true);
    expect(body.result.content[0].text).toContain("12 seconds");
    expect(readQueue).not.toHaveBeenCalled();
  });

  it("holds a key to its own plan and counts the call to it", async () => {
    authenticate.mockResolvedValue({
      ok: true,
      caller: { kind: "key", keyId: "KEY00001", account: "acct_a", plan: API_PLANS.free, accountPlan: "free", paywall: true },
    });
    checkAllowance.mockResolvedValue({ ok: false, which: "month", today: 1, month: 3000, retryAfter: 99 });
    const { body } = await rpc("tools/call", { name: "queue_status", arguments: {} }, { authorization: "Bearer x" });
    expect(body.result.isError).toBe(true);
    expect(body.result.content[0].text).toContain("this month are used");
    expect(takeMinute).toHaveBeenCalledWith("KEY00001", API_PLANS.free.perMinute);
  });

  it("returns a not-found as an answer, not an error", async () => {
    readCase.mockResolvedValue({ ok: false, status: 404, code: "not_found", message: "No record of this case yet.", url: "u" });
    const { body } = await rpc("tools/call", { name: "lookup_case", arguments: { case_number: "G-100-26045-123456" } });
    expect(body.result.isError).toBeUndefined();
    expect(body.result.content[0].text).toContain("No record");
  });

  it("refuses a wrong key outright with 401", async () => {
    authenticate.mockResolvedValue({ ok: false, code: "invalid_key", message: "That isn't a key." });
    const { res } = await rpc("tools/list", {}, { authorization: "Bearer nope" });
    expect(res.status).toBe(401);
    expect(res.headers.get("WWW-Authenticate")).toContain('error="invalid_token"');
  });

  it("answers a browser's preflight", () => {
    const res = OPTIONS();
    expect(res.status).toBe(204);
    expect(res.headers.get("Access-Control-Allow-Headers")).toContain("Authorization");
  });
});
