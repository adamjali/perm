import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { daysToAnchor, PREDICTIONS, scorePrediction, summarizeScores } from "../predictionLedger";

const ISO = /^\d{4}-\d{2}-\d{2}$/;

describe("predictionLedger", () => {
  it("records well-formed entries whose window contains the anchor", () => {
    expect(PREDICTIONS.length).toBeGreaterThan(0);
    for (const p of PREDICTIONS) {
      expect(p.caseNumber).toMatch(/^[A-Z]-\d{3}-\d{5}-\d{6}$/);
      for (const d of [p.recorded, p.filed, p.anchorIso, p.windowFrom, p.windowTo]) expect(d).toMatch(ISO);
      expect(p.windowFrom <= p.anchorIso && p.anchorIso <= p.windowTo, `${p.caseNumber} anchor outside window`).toBe(true);
      expect(p.filed < p.recorded).toBe(true);
    }
  });

  it("scores a decision in signed days against the anchor and against the window", () => {
    const p = PREDICTIONS[0]!;
    expect(scorePrediction(p, "2026-12-07")).toEqual({ errorDays: 10, absErrorDays: 10, inWindow: false });
    expect(scorePrediction(p, "2026-11-20")).toEqual({ errorDays: -7, absErrorDays: 7, inWindow: true });
    expect(scorePrediction(p, "2026-09-01").inWindow).toBe(true);
    expect(scorePrediction(p, "2026-08-31").inWindow).toBe(false);
  });

  it("summarises with a median that survives an even count, and reports nothing on nothing", () => {
    expect(summarizeScores([])).toEqual({ n: 0, medianAbsErrorDays: null, inWindowShare: null });
    const s = summarizeScores([
      { errorDays: 10, absErrorDays: 10, inWindow: true },
      { errorDays: -30, absErrorDays: 30, inWindow: false },
      { errorDays: 4, absErrorDays: 4, inWindow: true },
      { errorDays: 60, absErrorDays: 60, inWindow: false },
    ]);
    expect(s).toEqual({ n: 4, medianAbsErrorDays: 20, inWindowShare: 0.5 });
  });

  it("counts days to the anchor from a given day", () => {
    expect(daysToAnchor(PREDICTIONS[0]!, "2026-11-17")).toBe(10);
    expect(daysToAnchor(PREDICTIONS[0]!, "2026-12-01")).toBe(-4);
  });

  it("matches the prose ledger when it is present", () => {
    const md = join(process.cwd(), "..", ".planning", "prediction-ledger.md");
    if (!existsSync(md)) return;
    const text = readFileSync(md, "utf8");
    for (const p of PREDICTIONS) expect(text, `${p.caseNumber} missing from the markdown ledger`).toContain(p.caseNumber);
  });
});
