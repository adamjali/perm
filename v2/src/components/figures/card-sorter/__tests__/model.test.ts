import { describe, expect, it } from "vitest";

import { BATCH, apportion, buildSorterRun, interleave, pocketOf } from "../model";

const STATUSES = [
  { status: "ANALYST REVIEW", count: 81690, isFinal: false },
  { status: "APPLICATION ON HOLD", count: 2880, isFinal: false },
  { status: "RFI ISSUED", count: 581, isFinal: false },
  { status: "NORD ISSUED", count: 90, isFinal: false },
  { status: "SUPERVISED RECRUITMENT", count: 7, isFinal: false },
  { status: "RECONSIDERATION APPEALS", count: 2658, isFinal: false },
  { status: "BALCA APPEALS", count: 906, isFinal: false },
  { status: "CERTIFIED", count: 300000, isFinal: true },
];

describe("pocketOf", () => {
  it("files each pending status in its pocket, an unknown one in other review", () => {
    expect(pocketOf("analyst review")).toBe("analyst");
    expect(pocketOf("APPLICATION ON HOLD")).toBe("hold");
    expect(pocketOf("RFI ISSUED")).toBe("rfi");
    expect(pocketOf("DENIED - BALCA DISMISSED")).toBe("appeal");
    expect(pocketOf("A STATUS DOL ADDS NEXT YEAR")).toBe("other");
  });
});

describe("apportion", () => {
  it("adds up to the batch exactly and gives the remainders to the largest fractions", () => {
    // Arrange: 91.2, 3.24, 4.0, 0.65, 0.11, 0.85 of 100
    const counts = [81690, 2880, 3564, 581, 97, 753];
    // Act
    const out = apportion(counts, 100);
    // Assert
    expect(out.reduce((a, b) => a + b, 0)).toBe(100);
    expect(out).toEqual([91, 3, 4, 1, 0, 1]);
  });

  it("never gives a card to an empty pocket", () => {
    expect(apportion([5, 0, 5], 3)).toEqual([2, 0, 1]);
    expect(apportion([0, 0], 10)).toEqual([0, 0]);
  });
});

describe("interleave", () => {
  it("keeps each pocket's count and spreads a rare pocket's cards through the run", () => {
    const seq = interleave([8, 2]);
    expect(seq).toHaveLength(10);
    expect(seq.filter((p) => p === 1)).toHaveLength(2);
    const at = seq.flatMap((p, i) => (p === 1 ? [i] : []));
    expect(at[1]! - at[0]!).toBeGreaterThanOrEqual(4);
  });
});

describe("buildSorterRun", () => {
  it("counts pending statuses into their pockets, the day's decisions last, and leaves final statuses out", () => {
    const run = buildSorterRun({ statuses: STATUSES, decided: 753, decidedOn: "2026-10-23" })!;
    expect(run.pockets.map((p) => [p.key, p.count])).toEqual([
      ["analyst", 81690],
      ["hold", 2880],
      ["rfi", 581],
      ["other", 97],
      ["appeal", 3564],
      ["decided", 753],
    ]);
    expect(run.sequence).toHaveLength(BATCH);
    expect(run.sequence.filter((p) => p === 0)).toHaveLength(91);
    expect(run.asked).toBe(81690 + 2880 + 581 + 97 + 3564 + 753);
    expect(run.decidedOn).toBe("2026-10-23");
  });

  it("draws nothing when no case is waiting", () => {
    expect(buildSorterRun({ statuses: [{ status: "CERTIFIED", count: 5, isFinal: true }], decided: 3, decidedOn: "2026-10-23" })).toBeNull();
  });
});
