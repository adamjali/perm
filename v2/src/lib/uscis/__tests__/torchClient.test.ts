import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The Torch client against a mocked fetch and a mocked Turso client.
 *
 * What this file pins, and why each matters:
 *   - nothing happens without USCIS_ENV and both credentials (the flag flip);
 *   - the daily budget is CHARGED (exec) before USCIS is asked (fetch), and a
 *     refused attempt never reaches the network;
 *   - the token is fetched once and reused, and dropped on a 401;
 *   - sandbox and production talk to different hosts;
 *   - every documented USCIS status maps to one discriminated result.
 *
 * Env values here are fake strings. Nothing in this file reads a real secret.
 */

const execMock = vi.fn();
const oneMock = vi.fn();
vi.mock("@/lib/turso/client", () => ({
  exec: (...a: unknown[]) => execMock(...a),
  one: (...a: unknown[]) => oneMock(...a),
  rows: vi.fn(),
}));
// The client is server-only; the guard module throws outside a server
// bundle, so it is stubbed for the test environment.
vi.mock("server-only", () => ({}));

import {
  fetchCaseStatus,
  fetchProcessingTimesRaw,
  normaliseCaseStatus,
  resetTokenCache,
  resetTpsBucket,
  takeTpsToken,
  underUscisDailyBudget,
  uscisBudgetDay,
  uscisDateToIso,
  uscisEnabled,
  uscisLimits,
} from "../torchClient";

const CASE = {
  case_status: {
    receiptNumber: "EAC9999103403",
    formType: "I-140",
    submittedDate: "09-05-2023 14:28:46",
    modifiedDate: "09-06-2023 08:00:00",
    current_case_status_text_en: "Case Was Received",
    current_case_status_desc_en: "On September 5, 2023, we received your Form I-140.",
    current_case_status_text_es: "Caso recibido",
    current_case_status_desc_es: "…",
    hist_case_status: [{ date: "2023-09-05", completed_text_en: "Case Was Received", completed_text_es: "…" }],
  },
  message: "",
};

function jsonRes(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

/** A fetch that answers the token endpoint and then whatever `answer` says. */
function fakeFetch(answer: (url: string) => Response) {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const f = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    calls.push({ url, init });
    if (url.endsWith("/oauth/accesstoken")) return jsonRes(200, { access_token: "tok-1", expires_in: 3600 });
    return answer(url);
  }) as unknown as typeof fetch;
  return { f, calls };
}

const T0 = new Date("2026-09-22T18:00:00Z"); // 2:00 PM EDT

function setEnv(env: "sandbox" | "production") {
  process.env.USCIS_ENV = env;
  process.env.USCIS_CLIENT_ID = "test-client-id";
  process.env.USCIS_CLIENT_SECRET = "test-client-secret";
}

beforeEach(() => {
  execMock.mockReset().mockResolvedValue(1);
  oneMock.mockReset().mockResolvedValue({ n: 1 });
  resetTokenCache();
  resetTpsBucket();
});

afterEach(() => {
  delete process.env.USCIS_ENV;
  delete process.env.USCIS_CLIENT_ID;
  delete process.env.USCIS_CLIENT_SECRET;
});

describe("the flag", () => {
  it("is off without USCIS_ENV, and off with USCIS_ENV but no credentials", async () => {
    expect(uscisEnabled()).toBe(false);
    process.env.USCIS_ENV = "sandbox";
    expect(uscisEnabled()).toBe(false);
    process.env.USCIS_CLIENT_ID = "x";
    expect(uscisEnabled()).toBe(false);
    process.env.USCIS_CLIENT_SECRET = "y";
    expect(uscisEnabled()).toBe(true);
  });

  it("refuses an unknown USCIS_ENV value rather than guessing a host", () => {
    process.env.USCIS_ENV = "prod"; // not a value we accept
    process.env.USCIS_CLIENT_ID = "x";
    process.env.USCIS_CLIENT_SECRET = "y";
    expect(uscisEnabled()).toBe(false);
  });

  it("returns disabled and touches neither the network nor the database when off", async () => {
    const { f } = fakeFetch(() => jsonRes(200, CASE));
    const r = await fetchCaseStatus("EAC9999103403", { fetchImpl: f, now: () => T0 });
    expect(r).toEqual({ kind: "disabled" });
    expect(f).not.toHaveBeenCalled();
    expect(execMock).not.toHaveBeenCalled();
  });
});

describe("the daily budget", () => {
  it("is keyed on USCIS's day (midnight Eastern), not UTC", () => {
    // 11:30 PM EDT on Sep 22 is 03:30 UTC on Sep 23; USCIS's quota resets at
    // 04:00 UTC, so this call still belongs to Sep 22.
    expect(uscisBudgetDay(new Date("2026-09-23T03:30:00Z"))).toBe("2026-09-22");
    expect(uscisBudgetDay(new Date("2026-09-23T04:30:00Z"))).toBe("2026-09-23");
  });

  it("increments THEN checks, so a refused attempt is still counted", async () => {
    oneMock.mockResolvedValue({ n: 901 });
    expect(await underUscisDailyBudget(T0, 900)).toBe(false);
    expect(execMock).toHaveBeenCalledTimes(1);
    const [sql, args] = execMock.mock.calls[0] as [string, unknown[]];
    expect(sql).toMatch(/INSERT INTO perm_docs/);
    expect(sql).toMatch(/ON CONFLICT\(key\) DO UPDATE/);
    expect(args[0]).toBe("uscis_budget_2026-09-22");
  });

  it("treats a missing counter row as exhausted, never as free", async () => {
    oneMock.mockResolvedValue(null);
    expect(await underUscisDailyBudget(T0, 900)).toBe(false);
  });

  it("is charged BEFORE the call, and a refusal never reaches USCIS", async () => {
    setEnv("sandbox");
    oneMock.mockResolvedValue({ n: 901 }); // over the sandbox cap of 900
    const { f } = fakeFetch(() => jsonRes(200, CASE));
    const r = await fetchCaseStatus("EAC9999103403", { fetchImpl: f, now: () => T0 });
    expect(r).toEqual({ kind: "budget" });
    expect(execMock).toHaveBeenCalledTimes(1);
    expect(f).not.toHaveBeenCalled();
  });

  it("charges the budget before the first network call on a successful lookup", async () => {
    setEnv("sandbox");
    const order: string[] = [];
    execMock.mockImplementation(async () => {
      order.push("exec");
      return 1;
    });
    const { f } = fakeFetch(() => {
      order.push("fetch");
      return jsonRes(200, CASE);
    });
    const fWrapped = vi.fn(async (...a: Parameters<typeof fetch>) => {
      order.push("fetch");
      return (f as typeof fetch)(...a);
    }) as unknown as typeof fetch;
    await fetchCaseStatus("EAC9999103403", { fetchImpl: fWrapped, now: () => T0 });
    expect(order[0]).toBe("exec");
    expect(order.indexOf("fetch")).toBeGreaterThan(order.indexOf("exec"));
  });
});

describe("hosts", () => {
  it("sandbox talks to api-int.uscis.gov", async () => {
    setEnv("sandbox");
    const { f, calls } = fakeFetch(() => jsonRes(200, CASE));
    await fetchCaseStatus("EAC9999103403", { fetchImpl: f, now: () => T0 });
    expect(calls[0]?.url).toBe("https://api-int.uscis.gov/oauth/accesstoken");
    expect(calls[1]?.url).toBe("https://api-int.uscis.gov/case-status/EAC9999103403");
  });

  it("production talks to api.uscis.gov", async () => {
    setEnv("production");
    const { f, calls } = fakeFetch(() => jsonRes(200, CASE));
    await fetchCaseStatus("EAC9999103403", { fetchImpl: f, now: () => T0 });
    expect(calls[0]?.url).toBe("https://api.uscis.gov/oauth/accesstoken");
    expect(calls[1]?.url).toBe("https://api.uscis.gov/case-status/EAC9999103403");
  });

  it("enforces the documented caps: 5 TPS / 900 a day sandbox, 10 TPS / 350k production", () => {
    expect(uscisLimits("sandbox")).toEqual({ tps: 5, dailyCap: 900 });
    expect(uscisLimits("production")).toEqual({ tps: 10, dailyCap: 350_000 });
  });
});

describe("the token", () => {
  it("is fetched once and reused across calls", async () => {
    setEnv("sandbox");
    const { f, calls } = fakeFetch(() => jsonRes(200, CASE));
    await fetchCaseStatus("EAC9999103403", { fetchImpl: f, now: () => T0 });
    await fetchCaseStatus("EAC9999103404", { fetchImpl: f, now: () => new Date(T0.getTime() + 1000) });
    const tokenCalls = calls.filter((c) => c.url.endsWith("/oauth/accesstoken"));
    expect(tokenCalls).toHaveLength(1);
    // And the case call carries it.
    const h = new Headers(calls[1]?.init?.headers);
    expect(h.get("authorization")).toBe("Bearer tok-1");
  });

  it("is sent as form-urlencoded client credentials, never in a query string", async () => {
    setEnv("sandbox");
    const { f, calls } = fakeFetch(() => jsonRes(200, CASE));
    await fetchCaseStatus("EAC9999103403", { fetchImpl: f, now: () => T0 });
    const tok = calls[0]!;
    expect(tok.url).not.toContain("client_secret");
    expect(tok.init?.method).toBe("POST");
    const body = String(tok.init?.body);
    expect(body).toContain("grant_type=client_credentials");
    expect(body).toContain("client_id=test-client-id");
  });

  it("is refetched once it is within sixty seconds of expiry", async () => {
    setEnv("sandbox");
    const { f, calls } = fakeFetch(() => jsonRes(200, CASE));
    await fetchCaseStatus("EAC9999103403", { fetchImpl: f, now: () => T0 });
    // 3600 s ttl, refreshed at ttl - 60: 3541 s later is past that line.
    await fetchCaseStatus("EAC9999103403", { fetchImpl: f, now: () => new Date(T0.getTime() + 3541_000) });
    expect(calls.filter((c) => c.url.endsWith("/oauth/accesstoken"))).toHaveLength(2);
  });

  it("is dropped on a 401 so the next call refreshes it", async () => {
    setEnv("sandbox");
    let n = 0;
    const { f, calls } = fakeFetch(() => (n++ === 0 ? jsonRes(401, { message: "Invalid Access Token" }) : jsonRes(200, CASE)));
    const first = await fetchCaseStatus("EAC9999103403", { fetchImpl: f, now: () => T0 });
    expect(first).toEqual({ kind: "unauthorized" });
    const second = await fetchCaseStatus("EAC9999103403", { fetchImpl: f, now: () => new Date(T0.getTime() + 1000) });
    expect(second.kind).toBe("ok");
    expect(calls.filter((c) => c.url.endsWith("/oauth/accesstoken"))).toHaveLength(2);
  });

  it("reports unauthorized when the token endpoint itself refuses", async () => {
    setEnv("sandbox");
    const f = vi.fn(async () => jsonRes(401, { error: "invalid_client" })) as unknown as typeof fetch;
    const r = await fetchCaseStatus("EAC9999103403", { fetchImpl: f, now: () => T0 });
    expect(r).toEqual({ kind: "unauthorized" });
  });
});

describe("USCIS's answers", () => {
  it("maps 200 to ok with a normalised record and keeps the raw JSON", async () => {
    setEnv("sandbox");
    const { f } = fakeFetch(() => jsonRes(200, CASE));
    const r = await fetchCaseStatus("EAC9999103403", { fetchImpl: f, now: () => T0 });
    expect(r.kind).toBe("ok");
    if (r.kind !== "ok") return;
    expect(r.status).toEqual({
      receipt: "EAC9999103403",
      formType: "I-140",
      statusText: "Case Was Received",
      statusDesc: "On September 5, 2023, we received your Form I-140.",
      submittedAt: "2023-09-05T14:28:46",
      modifiedAt: "2023-09-06T08:00:00",
      history: [{ date: "2023-09-05", text: "Case Was Received" }],
    });
    expect(r.raw).toEqual(CASE);
  });

  it.each([
    [404, "not_found"],
    [422, "invalid"],
    [403, "unauthorized"],
    [500, "unavailable"],
    [503, "unavailable"],
  ])("maps %s to %s", async (status, kind) => {
    setEnv("sandbox");
    const { f } = fakeFetch(() => jsonRes(status, { message: "x" }));
    const r = await fetchCaseStatus("EAC9999103403", { fetchImpl: f, now: () => T0 });
    expect(r.kind).toBe(kind);
  });

  it("maps 429 (Spike Arrest) to rate_limited at USCIS, and does not retry", async () => {
    setEnv("sandbox");
    const { f, calls } = fakeFetch(() => jsonRes(429, { message: "Spike Arrest Violation" }));
    const r = await fetchCaseStatus("EAC9999103403", { fetchImpl: f, now: () => T0 });
    expect(r).toEqual({ kind: "rate_limited", where: "uscis" });
    expect(calls.filter((c) => c.url.includes("/case-status/"))).toHaveLength(1);
  });

  it("maps a network failure to unavailable with no HTTP status", async () => {
    setEnv("sandbox");
    let n = 0;
    const f = vi.fn(async () => {
      if (n++ === 0) return jsonRes(200, { access_token: "tok", expires_in: 3600 });
      throw new TypeError("fetch failed");
    }) as unknown as typeof fetch;
    const r = await fetchCaseStatus("EAC9999103403", { fetchImpl: f, now: () => T0 });
    expect(r).toEqual({ kind: "unavailable", httpStatus: null });
  });

  it("treats a 200 with no status text as unavailable rather than rendering an empty record", async () => {
    setEnv("sandbox");
    const { f } = fakeFetch(() => jsonRes(200, { case_status: { receiptNumber: "EAC9999103403" } }));
    const r = await fetchCaseStatus("EAC9999103403", { fetchImpl: f, now: () => T0 });
    expect(r).toEqual({ kind: "unavailable", httpStatus: 200 });
  });
});

describe("the local TPS bucket", () => {
  it("refuses the sixth call in one second at the sandbox rate, without touching USCIS", async () => {
    setEnv("sandbox");
    const { f, calls } = fakeFetch(() => jsonRes(200, CASE));
    const results = [];
    for (let i = 0; i < 6; i++) results.push(await fetchCaseStatus("EAC9999103403", { fetchImpl: f, now: () => T0 }));
    expect(results.slice(0, 5).every((r) => r.kind === "ok")).toBe(true);
    expect(results[5]).toEqual({ kind: "rate_limited", where: "local" });
    expect(calls.filter((c) => c.url.includes("/case-status/"))).toHaveLength(5);
    // And the sixth attempt was NOT charged to the daily budget: the cheap
    // guard runs first.
    expect(execMock).toHaveBeenCalledTimes(5);
  });

  it("refills with time", () => {
    for (let i = 0; i < 5; i++) expect(takeTpsToken("sandbox", T0)).toBe(true);
    expect(takeTpsToken("sandbox", T0)).toBe(false);
    expect(takeTpsToken("sandbox", new Date(T0.getTime() + 250))).toBe(true);
  });
});

describe("normalisation", () => {
  it("reads USCIS's MM-DD-YYYY HH:mm:ss as month-first and refuses anything else", () => {
    expect(uscisDateToIso("09-05-2023 14:28:46")).toBe("2023-09-05T14:28:46");
    expect(uscisDateToIso("09-05-2023")).toBe("2023-09-05T00:00:00");
    expect(uscisDateToIso("2023-09-05")).toBeNull();
    expect(uscisDateToIso("13-05-2023 00:00:00")).toBeNull();
    expect(uscisDateToIso(undefined)).toBeNull();
  });

  it("gives an IOE record (no dates) null dates rather than inventing them", () => {
    const s = normaliseCaseStatus(
      {
        receiptNumber: "IOE0912345678",
        formType: "I-765",
        current_case_status_text_en: "Case Was Approved",
        current_case_status_desc_en: "…",
      },
      "IOE0912345678",
    );
    expect(s?.submittedAt).toBeNull();
    expect(s?.modifiedAt).toBeNull();
    expect(s?.history).toEqual([]);
  });

  it("drops a history row whose date is not YYYY-MM-DD", () => {
    const s = normaliseCaseStatus(
      {
        current_case_status_text_en: "x",
        hist_case_status: [{ date: "bad", completed_text_en: "a" }, { date: "2024-01-02", completed_text_en: "b" }],
      },
      "EAC9999103403",
    );
    expect(s?.history).toEqual([{ date: "2024-01-02", text: "b" }]);
  });
});

describe("processing times (undocumented)", () => {
  it("is charged to the same budget and returns raw JSON", async () => {
    setEnv("production");
    const { f, calls } = fakeFetch(() => jsonRes(200, { anything: true }));
    const r = await fetchProcessingTimesRaw("/", { fetchImpl: f, now: () => T0 });
    expect(r).toEqual({ kind: "ok", raw: { anything: true } });
    expect(execMock).toHaveBeenCalledTimes(1);
    expect(calls[1]?.url).toBe("https://api.uscis.gov/processing-times/");
  });
});
