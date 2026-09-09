import { describe, expect, it } from "vitest";

import {
  nationalShare,
  parseEmployerStagesDoc,
  rankByReview,
  rankByShare,
  type EmployerStageRow,
} from "../employerStages";

const row = (name: string, pending: number, byStatus: Record<string, number>, slug: string | null = null): EmployerStageRow => {
  const review = Object.entries(byStatus).filter(([s]) => s !== "ANALYST REVIEW").reduce((a, [, n]) => a + n, 0);
  return { name, slug, pending, review, share: pending ? review / pending : 0, byStatus };
};

const big = row("Cognizant", 1832, { "APPLICATION ON HOLD": 1831, "ANALYST REVIEW": 1 }, "cognizant");
const mid = row("Acme", 400, { "ANALYST REVIEW": 380, "RFI ISSUED": 20 }, "acme");
const tiny = row("Two Cases LLC", 2, { "APPLICATION ON HOLD": 2 });
const clean = row("Clean Co", 900, { "ANALYST REVIEW": 900 }, "clean-co");

const doc = (over: Record<string, unknown> = {}) =>
  JSON.stringify({
    asOf: "2026-09-08",
    pendingTotal: 3134,
    nationwide: { "ANALYST REVIEW": 1281, "APPLICATION ON HOLD": 1833, "RFI ISSUED": 20 },
    minPending: 5,
    employers: [big, mid, tiny, clean],
    ...over,
  });

describe("parseEmployerStagesDoc", () => {
  it("accepts a fresh, self-consistent document", () => {
    const d = parseEmployerStagesDoc(doc(), 1_000, 1_000 + 86_400_000);
    expect(d?.employers).toHaveLength(4);
    expect(d?.nationwide["APPLICATION ON HOLD"]).toBe(1833);
  });

  it("rejects a document older than eight days, one whose statuses do not sum to its total, and malformed rows", () => {
    expect(parseEmployerStagesDoc(doc(), 0, 9 * 86_400_000)).toBeNull();
    expect(parseEmployerStagesDoc(doc({ pendingTotal: 3000 }), 0, 1)).toBeNull();
    expect(parseEmployerStagesDoc(doc({ employers: [{ name: "x" }] }), 0, 1)).toBeNull();
    expect(parseEmployerStagesDoc("{not json", 0, 1)).toBeNull();
  });
});

describe("the two rankings", () => {
  it("ranks by cases pulled aside, dropping employers with nothing pulled aside", () => {
    expect(rankByReview([mid, big, clean, tiny]).map((r) => r.name)).toEqual(["Cognizant", "Acme", "Two Cases LLC"]);
  });

  it("ranks by share only above the floor, so two of two is not a signal", () => {
    expect(rankByShare([mid, big, clean, tiny]).map((r) => r.name)).toEqual(["Cognizant", "Acme"]);
    expect(rankByShare([mid, big, clean, tiny], 50, 2).map((r) => r.name)).toEqual(["Two Cases LLC", "Cognizant", "Acme"]);
  });

  it("gives an employer's share of the nationwide count at a status, and zero for an empty status", () => {
    expect(nationalShare(big, "APPLICATION ON HOLD", { "APPLICATION ON HOLD": 1833 })).toBeCloseTo(0.99891, 4);
    expect(nationalShare(big, "NORD ISSUED", { "APPLICATION ON HOLD": 1833 })).toBe(0);
  });
});
