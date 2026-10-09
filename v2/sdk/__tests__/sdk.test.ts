import { Webhook } from "svix";
import { describe, expect, it, vi } from "vitest";

import { PermTracker, PermTrackerError, usageFrom, verifyWebhook } from "../src/index";
import { configPath, exportParams, parseArgs, render } from "../src/cli";

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

describe("live lookups, exports and webhooks", () => {
  it("asks DOL live only when told to", async () => {
    const f = fakeFetch(200, { data: { caseNumber: "G-100-26045-123456" }, meta: { source: "DOL", asOf: null } });
    const pt = new PermTracker({ apiKey: KEY, fetch: f as unknown as typeof fetch });
    await pt.case("G-100-26045-123456");
    await pt.case("G-100-26045-123456", { live: true });
    expect(String(f.mock.calls[0]![0])).toBe("https://permtracker.app/v1/cases/G-100-26045-123456");
    expect(String(f.mock.calls[1]![0])).toBe("https://permtracker.app/v1/cases/G-100-26045-123456?live=1");
  });

  it("reads an export's rows, and a CSV export as text with its row count", async () => {
    const json = fakeFetch(200, { data: { kind: "cases", rows: [{ caseNumber: "x" }], count: 1, cap: 1000, truncated: false }, meta: { source: "DOL", asOf: null } });
    const pt = new PermTracker({ apiKey: KEY, fetch: json as unknown as typeof fetch });
    const a = await pt.export("cases", { q: "acme", state: "CA" });
    expect(String(json.mock.calls[0]![0])).toBe("https://permtracker.app/v1/exports/cases?q=acme&state=CA&format=json");
    expect(a.data.rows).toHaveLength(1);

    const csv = vi.fn(async () =>
      new Response("case_number\nG-1\n", {
        status: 200,
        headers: { "content-type": "text/csv; charset=utf-8", "X-Export-Rows": "1", "X-Export-Cap": "1000", "X-Export-Truncated": "true", "X-Calls-Today": "2/3000" },
      }),
    );
    const pt2 = new PermTracker({ apiKey: KEY, fetch: csv as unknown as typeof fetch });
    const c = await pt2.exportCsv("employers", { q: "acme" });
    expect(c).toMatchObject({ csv: "case_number\nG-1\n", rows: 1, cap: 1000, truncated: true });
    expect(c.usage.today).toBe(2);
    expect(String(csv.mock.calls[0]![0])).toContain("format=csv");
  });

  it("sends a webhook's address and events as JSON in a POST, and deletes by id", async () => {
    const f = fakeFetch(201, { data: { id: "abc123def456", secret: "whsec_x" } });
    const pt = new PermTracker({ apiKey: KEY, fetch: f as unknown as typeof fetch });
    const made = await pt.createWebhook({ url: "https://h.example.com/x", events: ["case.status_changed"] });
    expect(made.data.secret).toBe("whsec_x");
    const [url, init] = f.mock.calls[0]!;
    expect(String(url)).toBe("https://permtracker.app/v1/webhooks");
    expect(init!.method).toBe("POST");
    expect((init!.headers as Record<string, string>)["Content-Type"]).toBe("application/json");
    expect(JSON.parse(String(init!.body))).toEqual({ url: "https://h.example.com/x", events: ["case.status_changed"] });

    await pt.watch({ caseNumber: "G-100-26045-123456" });
    expect(JSON.parse(String(f.mock.calls[1]![1]!.body))).toEqual({ caseNumber: "G-100-26045-123456" });
    await pt.unwatch("google-llc", "employer");
    expect(String(f.mock.calls[2]![0])).toBe("https://permtracker.app/v1/watches/google-llc?kind=employer");
    expect(f.mock.calls[2]![1]!.method).toBe("DELETE");
    await pt.deleteWebhook("abc123def456");
    expect(f.mock.calls[3]![1]!.method).toBe("DELETE");
  });

  it("checks a delivery signed by an independent Standard Webhooks library", async () => {
    const secret = "whsec_" + Buffer.from("k".repeat(32)).toString("base64");
    const body = JSON.stringify({ type: "queue.moved", timestamp: "2026-10-09T16:00:00.000Z", data: { to: "2026-01" } });
    const at = new Date("2026-10-09T16:00:00Z");
    const signature = new Webhook(secret).sign("msg_abc", at, body);
    const headers = { "webhook-id": "msg_abc", "webhook-timestamp": String(at.getTime() / 1000), "webhook-signature": signature };
    const now = at.getTime() + 30_000;
    expect(await verifyWebhook(secret, headers, body, { now })).toBe(true);
    expect(await verifyWebhook(secret, new Headers(headers), body, { now })).toBe(true);
    expect(await verifyWebhook(secret, headers, body + " ", { now })).toBe(false);
    expect(await verifyWebhook(secret, { ...headers, "webhook-id": "msg_other" }, body, { now })).toBe(false);
    expect(await verifyWebhook(secret, headers, body, { now: at.getTime() + 10 * 60_000 })).toBe(false);
    expect(await verifyWebhook("whsec_" + Buffer.from("z".repeat(32)).toString("base64"), headers, body, { now })).toBe(false);
  });
});

describe("the CLI", () => {
  it("reads the command, its arguments and the flags in any order", () => {
    expect(parseArgs(["estimate", "--json", "--filed", "2026-02-15"])).toMatchObject({ command: "estimate", json: true, filed: "2026-02-15", args: [] });
    expect(parseArgs(["employers", "acme", "corp", "--key=" + KEY])).toMatchObject({ command: "employers", args: ["acme", "corp"], key: KEY });
  });

  it("reads the new flags, and an export's name=value parameters", () => {
    expect(parseArgs(["case", "G-100-26045-123456", "--live"])).toMatchObject({ command: "case", live: true });
    expect(parseArgs(["watch", "--employer", "google-llc"])).toMatchObject({ command: "watch", employer: "google-llc", args: [] });
    expect(parseArgs(["export", "cases", "q=acme", "state=CA", "--format", "json", "--out", "a.json"])).toMatchObject({
      command: "export",
      args: ["cases", "q=acme", "state=CA"],
      format: "json",
      out: "a.json",
    });
    expect(exportParams(["q=acme corp", "state=CA", "fy=2026"])).toEqual({ q: "acme corp", state: "CA", fy: "2026" });
    expect(() => exportParams(["acme"])).toThrow(/name=value/);
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
