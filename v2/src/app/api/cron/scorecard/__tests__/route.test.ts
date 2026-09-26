import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const predictOurs = vi.fn();
const recordPredictions = vi.fn();
const ensurePredictionsTable = vi.fn();
const gradeOpenPredictions = vi.fn();
const writeScorecardDocs = vi.fn();
const rivalPredictions = vi.fn();

vi.mock("@/lib/turso/predictions", () => ({
  predictOurs: (...a: unknown[]) => predictOurs(...a),
  recordPredictions: (...a: unknown[]) => recordPredictions(...a),
  ensurePredictionsTable: () => ensurePredictionsTable(),
  gradeOpenPredictions: () => gradeOpenPredictions(),
  writeScorecardDocs: (...a: unknown[]) => writeScorecardDocs(...a),
  easternDate: () => "2026-09-27",
  RIVAL_SAMPLE: 2,
}));
vi.mock("@/lib/scorecard/rivals", () => ({
  rivalPredictions: (...a: unknown[]) => rivalPredictions(...a),
}));

const { GET } = await import("../route");
const SECRET = "cron-secret-for-tests";

const call = (auth?: string, query = ""): Promise<Response> =>
  GET(
    new Request(`https://permtracker.app/api/cron/scorecard${query}`, {
      headers: auth === undefined ? {} : { authorization: auth },
    }),
  );

const SAMPLE = [
  { caseNumber: "G-100-26001-000001", filingDate: "2026-01-01", employerName: "A", status: "ANALYST REVIEW" },
  { caseNumber: "G-100-26002-000002", filingDate: "2026-01-02", employerName: "B", status: "ANALYST REVIEW" },
  { caseNumber: "G-100-26003-000003", filingDate: "2026-01-03", employerName: "C", status: "ANALYST REVIEW" },
];

describe("GET /api/cron/scorecard", () => {
  beforeEach(() => {
    for (const f of [predictOurs, recordPredictions, ensurePredictionsTable, gradeOpenPredictions, writeScorecardDocs, rivalPredictions]) f.mockReset();
    predictOurs.mockResolvedValue({ perm: [{ id: 1 }], pwd: [], sample: SAMPLE, pendingBefore: () => 0 });
    recordPredictions.mockResolvedValue(1);
    rivalPredictions.mockResolvedValue({ preds: [], failures: ["rival-a x: HTTP 500"] });
    gradeOpenPredictions.mockResolvedValue({ graded: 0, open: 1 });
    writeScorecardDocs.mockResolvedValue({ rows: 1 });
    vi.stubEnv("CRON_SECRET", SECRET);
  });
  afterEach(() => vi.unstubAllEnvs());

  it("refuses without the secret and writes nothing", async () => {
    expect((await call()).status).toBe(401);
    expect((await call("Bearer nope")).status).toBe(401);
    expect(recordPredictions).not.toHaveBeenCalled();
    expect(predictOurs).not.toHaveBeenCalled();
  });

  it("a dry run predicts and returns, writing nothing and calling no rival", async () => {
    const res = await call(`Bearer ${SECRET}`, "?dry=1");
    expect(res.status).toBe(200);
    expect((await res.json()).dry).toBe(true);
    expect(recordPredictions).not.toHaveBeenCalled();
    expect(ensurePredictionsTable).not.toHaveBeenCalled();
    expect(rivalPredictions).not.toHaveBeenCalled();
  });

  it("records, puts a seeded subset to the rivals, grades, and reports failures by name", async () => {
    const res = await call(`Bearer ${SECRET}`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.failures).toEqual(["rival-a x: HTTP 500"]);
    expect(recordPredictions).toHaveBeenCalledTimes(2);
    expect(rivalPredictions.mock.calls[0]![0]).toHaveLength(2);
    expect(gradeOpenPredictions).toHaveBeenCalledTimes(1);
    expect(writeScorecardDocs).toHaveBeenCalledWith("2026-09-27");
  });

  it("reports a failed run as 500", async () => {
    predictOurs.mockRejectedValueOnce(new Error("turso down"));
    expect((await call(`Bearer ${SECRET}`)).status).toBe(500);
  });
});
