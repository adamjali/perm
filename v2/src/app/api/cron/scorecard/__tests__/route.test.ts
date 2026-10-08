import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const predictOurs = vi.fn();
const predictSeasonal = vi.fn();
const predictWatched = vi.fn();
const recordPredictions = vi.fn();
const ensurePredictionsTable = vi.fn();
const gradeOpenPredictions = vi.fn();
const writeScorecardDocs = vi.fn();
const rivalPredictions = vi.fn();

vi.mock("@/lib/turso/predictions", () => ({
  predictOurs: (...a: unknown[]) => predictOurs(...a),
  predictSeasonal: (...a: unknown[]) => predictSeasonal(...a),
  predictWatched: (...a: unknown[]) => predictWatched(...a),
  predictBulletinRelease: async () => [],
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
    for (const f of [predictOurs, predictSeasonal, predictWatched, recordPredictions, ensurePredictionsTable, gradeOpenPredictions, writeScorecardDocs, rivalPredictions]) f.mockReset();
    predictSeasonal.mockResolvedValue([{ id: "seasonal" }]);
    predictWatched.mockResolvedValue([{ id: "watched", caseNumber: "G-100-26009-000009" }]);
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

  it("a summaries-only run rewrites the docs and records, asks and grades nothing", async () => {
    const res = await call(`Bearer ${SECRET}`, "?docs=1");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ docs: true, recordedOn: "2026-09-27", rows: 1 });
    expect(writeScorecardDocs).toHaveBeenCalledTimes(1);
    expect(predictOurs).not.toHaveBeenCalled();
    expect(recordPredictions).not.toHaveBeenCalled();
    expect(rivalPredictions).not.toHaveBeenCalled();
    expect(gradeOpenPredictions).not.toHaveBeenCalled();
  });

  it("a dry run predicts and returns, writing nothing and calling no rival", async () => {
    const res = await call(`Bearer ${SECRET}`, "?dry=1");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.dry).toBe(true);
    // A subscriber's case is counted, never listed, in an answer read in a terminal.
    expect(body.watched).toBe(1);
    expect(JSON.stringify(body)).not.toContain("G-100-26009-000009");
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
    // Ours, H-2A, H-2B and CW-1 and subscribers' cases, in one write before any rival is asked.
    expect(recordPredictions.mock.calls[0]![1]).toEqual([
      { id: 1 }, { id: "seasonal" }, { id: "watched", caseNumber: "G-100-26009-000009" },
    ]);
    expect(body.watched).toBe(1);
    // No subscriber's case is ever put to a rival.
    expect(JSON.stringify(rivalPredictions.mock.calls)).not.toContain("G-100-26009-000009");
    expect(predictSeasonal).toHaveBeenCalledWith("2026-09-27");
    expect(body.seasonal).toBe(1);
    expect(rivalPredictions.mock.calls[0]![0]).toHaveLength(2);
    expect(gradeOpenPredictions).toHaveBeenCalledTimes(1);
    expect(writeScorecardDocs).toHaveBeenCalledWith("2026-09-27");
  });

  it("a failure recording subscribers' cases costs only those", async () => {
    predictWatched.mockRejectedValueOnce(new Error("doc unreadable"));
    const res = await call(`Bearer ${SECRET}`);
    expect(res.status).toBe(200);
    expect((await res.json()).watched).toBe(0);
    expect(recordPredictions.mock.calls[0]![1]).toEqual([{ id: 1 }, { id: "seasonal" }]);
  });

  it("reports a failed run as 500", async () => {
    predictOurs.mockRejectedValueOnce(new Error("turso down"));
    expect((await call(`Bearer ${SECRET}`)).status).toBe(500);
  });
});
