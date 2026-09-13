import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { daysToAnchor, PREDICTIONS, scorePrediction, summarizeScores,
  scoreAll,
} from "../predictionLedger";

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

describe("three-way scoring", () => {
  const p: Prediction = {
    recorded: "2026-09-13",
    caseNumber: "G-100-00000-000000",
    filed: "2025-12-15",
    statusAtPrediction: "ANALYST REVIEW",
    anchor: "Around 12 October 2026",
    anchorIso: "2026-10-12",
    windowFrom: "2026-10-07",
    windowTo: "2026-10-23",
    rivals: [
      { site: "permupdate", anchorIso: "2026-10-06", upperIso: "2026-10-09", lowerIso: null, model: "x" },
      { site: "permtrack", anchorIso: "2027-03-28", upperIso: null, lowerIso: null, model: "y" },
    ],
  };

  it("scores every site against the same outcome", () => {
    const all = scoreAll(p, "2026-10-15");
    expect(all.map((a) => a.site)).toEqual(["permtracker", "permupdate", "permtrack"]);
    expect(all[0]!.score.errorDays).toBe(3); // DOL decided 3 days after our anchor
    expect(all[1]!.score.errorDays).toBe(9);
    expect(all[2]!.score.absErrorDays).toBe(164);
  });

  it("puts OUR row first and labels it like the others", () => {
    // A comparison that renders our own row differently invites exactly the
    // reading it should not.
    expect(scoreAll(p, "2026-10-15")[0]!.site).toBe("permtracker");
  });

  it("treats a ONE-SIDED rival band as at-or-before, not between", () => {
    // permupdate publishes an upper bound and no lower one. Scoring it as
    // two-sided would flatter them on every early decision.
    const early = scoreAll(p, "2026-09-20");
    expect(early.find((a) => a.site === "permupdate")!.score.inWindow).toBe(true);
    const late = scoreAll(p, "2026-10-15");
    expect(late.find((a) => a.site === "permupdate")!.score.inWindow).toBe(false);
  });

  it("reports inWindow as NULL, not false, when a site publishes no bound", () => {
    // Absent is not a miss.
    const all = scoreAll(p, "2026-10-15");
    expect(all.find((a) => a.site === "permtrack")!.score.inWindow).toBeNull();
  });

  it("scores our own two-sided window as between, not at-or-before", () => {
    // Ours has both bounds, so a decision BEFORE windowFrom is a miss.
    expect(scoreAll(p, "2026-09-20")[0]!.score.inWindow).toBe(false);
    expect(scoreAll(p, "2026-10-15")[0]!.score.inWindow).toBe(true);
  });

  it("works for a prediction with no rivals recorded", () => {
    const bare = { ...p, rivals: undefined };
    expect(scoreAll(bare, "2026-10-15")).toHaveLength(1);
  });
});
