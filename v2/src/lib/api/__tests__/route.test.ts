import { beforeEach, describe, expect, it, vi } from "vitest";

import { API_PLANS } from "@convex/lib/apiPlans";

const authenticate = vi.fn();
const takeMinute = vi.fn();
const checkAllowance = vi.fn();
const countCall = vi.fn();
vi.mock("../auth", () => ({ authenticate: (...a: unknown[]) => authenticate(...a) }));
vi.mock("../usage", () => ({
  takeMinute: (...a: unknown[]) => takeMinute(...a),
  checkAllowance: (...a: unknown[]) => checkAllowance(...a),
  countCall: (...a: unknown[]) => countCall(...a),
}));

import { apiGet } from "../route";
import type { ReadResult } from "../reads";

const KEY_CALLER = {
  kind: "key" as const,
  keyId: "KEY00001",
  account: "acct_a",
  plan: API_PLANS.free,
  accountPlan: "free" as const,
  paywall: true,
  scopes: ["read" as const],
  sandbox: false,
  expiresAt: null,
};
const meta = { source: "DOL", asOf: "2026-10-01", url: "https://permtracker.app/x" };

function call(read: () => Promise<ReadResult<unknown>>) {
  const GET = apiGet(async () => read());
  return GET(new Request("https://permtracker.app/v1/queue"), { params: Promise.resolve({}) });
}

beforeEach(() => {
  authenticate.mockReset().mockResolvedValue({ ok: true, caller: KEY_CALLER });
  takeMinute.mockReset().mockReturnValue({ ok: true, remaining: 9, reset: 40 });
  checkAllowance.mockReset().mockResolvedValue({ ok: true, today: 3, month: 30 });
  countCall.mockReset();
});

describe("a /v1 call", () => {
  it("answers data with its source, the limits in headers, and counts once", async () => {
    const res = await call(async () => ({ ok: true, data: { a: 1 }, meta }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ data: { a: 1 }, meta });
    expect(res.headers.get("RateLimit-Remaining")).toBe("9");
    expect(res.headers.get("X-Calls-Today")).toBe(`4/${API_PLANS.free.perDay}`);
    expect(res.headers.get("X-Calls-Month")).toBe(`31/${API_PLANS.free.perMonth}`);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(countCall).toHaveBeenCalledExactlyOnceWith("acct_a", "KEY00001");
  });

  it("refuses a call with no key, naming where to get one, and runs nothing", async () => {
    authenticate.mockResolvedValue({ ok: true, caller: { kind: "anonymous" } });
    const read = vi.fn();
    const res = await call(read);
    expect(res.status).toBe(401);
    expect((await res.json()).error).toMatchObject({ code: "missing_key" });
    expect(read).not.toHaveBeenCalled();
    expect(countCall).not.toHaveBeenCalled();
  });

  it("refuses a bad key with 401 and an unchecked one with 503", async () => {
    authenticate.mockResolvedValueOnce({ ok: false, code: "invalid_key", message: "no" });
    expect((await call(vi.fn())).status).toBe(401);
    authenticate.mockResolvedValueOnce({ ok: false, code: "key_check_failed", message: "later" });
    const res = await call(vi.fn());
    expect(res.status).toBe(503);
    expect(res.headers.get("Retry-After")).toBe("60");
  });

  it("refuses past the minute limit with Retry-After, before reading", async () => {
    takeMinute.mockReturnValue({ ok: false, remaining: 0, reset: 17 });
    const read = vi.fn();
    const res = await call(read);
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("17");
    expect((await res.json()).error.code).toBe("rate_limited");
    expect(read).not.toHaveBeenCalled();
  });

  it("refuses past the day's allowance, saying when it resets", async () => {
    checkAllowance.mockResolvedValue({ ok: false, which: "day", today: 300, month: 900, retryAfter: 3600 });
    const res = await call(vi.fn());
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.error.code).toBe("daily_limit");
    expect(body.error.message).toContain("midnight UTC");
    expect(res.headers.get("Retry-After")).toBe("3600");
  });

  it("counts a not-found, because the lookup ran", async () => {
    const res = await call(async () => ({ ok: false, status: 404, code: "not_found", message: "none" }));
    expect(res.status).toBe(404);
    expect(countCall).toHaveBeenCalledTimes(1);
  });

  it("doesn't count a malformed request", async () => {
    const res = await call(async () => ({ ok: false, status: 400, code: "bad_request", message: "bad" }));
    expect(res.status).toBe(400);
    expect(countCall).not.toHaveBeenCalled();
  });

  it("answers our own failure as 500 and doesn't count it", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await call(async () => {
      throw new Error("db down");
    });
    expect(res.status).toBe(500);
    expect((await res.json()).error.message).toContain("Nothing was counted");
    expect(countCall).not.toHaveBeenCalled();
    err.mockRestore();
  });
});

describe("scopes and sandbox keys", () => {
  it("refuses a key without the scope a call needs, before reading or counting", async () => {
    const read = vi.fn();
    const GET = apiGet(read, { scope: "export" });
    const res = await GET(new Request("https://permtracker.app/v1/exports/employers"), { params: Promise.resolve({}) });
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error.code).toBe("missing_scope");
    expect(body.error.message).toContain('"export"');
    expect(read).not.toHaveBeenCalled();
    expect(takeMinute).not.toHaveBeenCalled();
  });

  it("answers a sandbox key from the samples, never the live read, and counts nothing", async () => {
    authenticate.mockResolvedValue({ ok: true, caller: { ...KEY_CALLER, sandbox: true } });
    const read = vi.fn();
    const GET = apiGet<{ caseNumber: string }>(read);
    const res = await GET(new Request("https://permtracker.app/v1/cases/G-100-26000-000101"), {
      params: Promise.resolve({ caseNumber: "G-100-26000-000101" }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.employer).toBe("Example Robotics LLC");
    expect(body.meta.source).toMatch(/sandbox/i);
    expect(res.headers.get("X-Sandbox")).toBe("true");
    expect(read).not.toHaveBeenCalled();
    expect(checkAllowance).not.toHaveBeenCalled();
    expect(countCall).not.toHaveBeenCalled();
  });

  it("still holds a sandbox key to the minute limit", async () => {
    authenticate.mockResolvedValue({ ok: true, caller: { ...KEY_CALLER, sandbox: true } });
    takeMinute.mockReturnValue({ ok: false, remaining: 0, reset: 9 });
    expect((await call(vi.fn())).status).toBe(429);
  });
});

