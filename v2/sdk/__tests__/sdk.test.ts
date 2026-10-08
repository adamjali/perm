import { describe, expect, it, vi } from "vitest";

import { PermTracker, PermTrackerError, usageFrom } from "../src/index";
import { configPath, parseArgs, render } from "../src/cli";

const KEY = "pt_live_" + "A".repeat(32) + "BBBBBB";

function fakeFetch(status: number, body: unknown, headers: Record<string, string> = {}) {
  return vi.fn(async (_url: URL | string, _init?: RequestInit) =>
    new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } }),
  );
}

describe("PermTracker", () => {
  it("sends the key in the header, never the address, and reads the usage headers", async () => {
    const f = fakeFetch(200, { data: { caseNumber: "G-100-26045-123456", status: "ANALYST REVIEW" }, meta: { source: "DOL", asOf: "2026-10-08" } }, {
      "RateLimit-Limit": "10", "RateLimit-Remaining": "9", "X-Calls-Today": "4/300", "X-Calls-Month": "40/3000",
    });
    const pt = new PermTracker({ apiKey: KEY, fetch: f as unknown as typeof fetch });
    const a = await pt.case(" g-100-26045-123456 ");
    const [url, init] = f.mock.calls[0]!;
    expect(String(url)).toBe("https://permtracker.app/v1/cases/G-100-26045-123456");
    expect(String(url)).not.toContain("pt_live_");
    expect((init!.headers as Record<string, string>).Authorization).toBe(`Bearer ${KEY}`);
    expect(a.data.status).toBe("ANALYST REVIEW");
    expect(a.usage).toEqual({ perMinute: 10, remainingThisMinute: 9, today: 4, perDay: 300, month: 40, perMonth: 3000 });
  });

  it("refuses a malformed case number without calling the API", async () => {
    const f = fakeFetch(200, {});
    const pt = new PermTracker({ apiKey: KEY, fetch: f as unknown as typeof fetch });
    await expect(pt.case("123")).rejects.toMatchObject({ code: "bad_case_number" });
    expect(f).not.toHaveBeenCalled();
  });

  it("says a key is needed before calling, except for the keyless lookup", async () => {
    const f = fakeFetch(200, { data: { match: "exact" }, meta: { source: "x", asOf: null } });
    const pt = new PermTracker({ fetch: f as unknown as typeof fetch });
    await expect(pt.queue()).rejects.toMatchObject({ code: "missing_key", status: 401 });
    const a = await pt.lookupEmployer("Acme");
    expect(a.data).toEqual({ match: "exact" });
    expect((f.mock.calls[0]![1]!.headers as Record<string, string>).Authorization).toBeUndefined();
  });

  it("turns the API's refusal into an error with its code, message and wait", async () => {
    const f = fakeFetch(429, { error: { code: "rate_limited", message: "The Free plan allows 10 calls a minute.", retryAfter: 42 } });
    const pt = new PermTracker({ apiKey: KEY, fetch: f as unknown as typeof fetch });
    const err = await pt.queue().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(PermTrackerError);
    expect(err).toMatchObject({ status: 429, code: "rate_limited", retryAfter: 42, message: "The Free plan allows 10 calls a minute." });
  });

  it("passes query parameters and leaves out the empty ones", async () => {
    const f = fakeFetch(200, { data: [], meta: { source: "", asOf: null } });
    const pt = new PermTracker({ apiKey: KEY, baseUrl: "http://localhost:3000/v1/", fetch: f as unknown as typeof fetch });
    await pt.employers("acme corp", 5);
    await pt.visaBulletin();
    expect(String(f.mock.calls[0]![0])).toBe("http://localhost:3000/v1/employers?q=acme+corp&limit=5");
    expect(String(f.mock.calls[1]![0])).toBe("http://localhost:3000/v1/visa-bulletin");
  });

  it("reads usage headers that are missing as unknown, not zero", () => {
    expect(usageFrom(new Headers())).toEqual({ perMinute: null, remainingThisMinute: null, today: null, perDay: null, month: null, perMonth: null });
  });
});

describe("the CLI", () => {
  it("reads the command, its arguments and the flags in any order", () => {
    expect(parseArgs(["estimate", "--json", "--filed", "2026-02-15"])).toMatchObject({ command: "estimate", json: true, filed: "2026-02-15", args: [] });
    expect(parseArgs(["employers", "acme", "corp", "--key=" + KEY])).toMatchObject({ command: "employers", args: ["acme", "corp"], key: KEY });
  });

  it("lists an answer plainly, nested objects indented", () => {
    expect(render({ status: "CERTIFIED", decision: { date: "2026-10-01" }, notes: [] })).toBe(
      "status: CERTIFIED\ndecision:\n  date: 2026-10-01\nnotes: none",
    );
  });

  it("keeps the saved key under XDG_CONFIG_HOME when it's set", () => {
    expect(configPath({ XDG_CONFIG_HOME: "/tmp/x" } as NodeJS.ProcessEnv)).toBe("/tmp/x/permtracker/config.json");
  });
});
