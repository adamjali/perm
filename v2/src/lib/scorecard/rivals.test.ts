import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/client", () => ({ rows: vi.fn(), one: vi.fn(), exec: vi.fn() }));

const { rivalPwdPredictions } = await import("./rivals");

/** Rival D's wage-request ranges: the middle recorded with the range as the band, one request a filing day. */

const answer = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });

describe("rivalPwdPredictions", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("records the middle of the range, asks once per filing day, and skips a request it won't date", async () => {
    vi.stubEnv("RIVAL_PWD_API", "https://rival.example/estimate");
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      const day = JSON.parse(String(init?.body)).filing_date as string;
      if (day === "2026-07-01") return answer({ estimate: null, at_or_before_focus: true });
      return answer({ estimate: { from: "2026-11-18", to: "2026-12-07" } });
    });
    vi.stubGlobal("fetch", fetchMock);
    const { preds, failures } = await rivalPwdPredictions(
      [
        { caseNumber: "P-100-26226-000001", filingDate: "2026-08-14", status: "IN PROCESS" },
        { caseNumber: "P-100-26226-000002", filingDate: "2026-08-14", status: "IN PROCESS" },
        { caseNumber: "P-100-26182-000003", filingDate: "2026-07-01", status: "IN PROCESS" },
      ],
      0,
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(failures).toEqual([]);
    expect(preds).toHaveLength(2);
    expect(preds[0]).toMatchObject({
      source: "rival-d",
      program: "pwd",
      model: "rival-pwd-range",
      predicted: "2026-11-27",
      bandEarly: "2026-11-18",
      bandLate: "2026-12-07",
    });
  });

  it("names an answer of another shape as a failure, never a silent gap", async () => {
    vi.stubEnv("RIVAL_PWD_API", "https://rival.example/estimate");
    vi.stubGlobal("fetch", vi.fn(async () => answer({ range: "soon" })));
    const { preds, failures } = await rivalPwdPredictions([{ caseNumber: "P-1", filingDate: "2026-08-14", status: "IN PROCESS" }], 0);
    expect(preds).toEqual([]);
    expect(failures).toEqual(["rival-d P-1: no estimate.from or estimate.to"]);
  });

  it("asks nothing when no endpoint is configured", async () => {
    vi.stubEnv("RIVAL_PWD_API", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { preds, failures } = await rivalPwdPredictions([{ caseNumber: "P-1", filingDate: "2026-08-14", status: "IN PROCESS" }], 0);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(preds).toEqual([]);
    expect(failures).toEqual([]);
  });
});
