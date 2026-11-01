import { describe, expect, it } from "vitest";

import { approvalMoved, countMoved, medianMoved } from "@/lib/uscisTrends";
import type { FormTotal, LinePoint } from "@/lib/uscisForms";

const slot = (fy: number, quarter: number, gap = false) => ({ fy, quarter, gap });
const point = (fy: number, q: number, m: number | null): LinePoint =>
  ({ slot: slot(fy, q), row: m === null ? null : ({ medianMonths: m } as LinePoint["row"]) }) as LinePoint;
const total = (fy: number, q: number, t: Partial<FormTotal>, gap = false): FormTotal => ({
  slot: slot(fy, q, gap), received: null, approved: null, denied: null, completed: null, pending: null, ...t,
});

describe("medianMoved", () => {
  it("compares with the quarter before that has a median, and says which", () => {
    expect(medianMoved([point(2026, 1, 7.2), point(2026, 2, null), point(2026, 3, 6.5)])).toEqual({
      text: "0.7 months quicker than FY26 Q1", dir: "down", tone: "good",
    });
    expect(medianMoved([point(2026, 2, 6), point(2026, 3, 7)])).toMatchObject({ text: "1 month slower than FY26 Q2", tone: "bad" });
    expect(medianMoved([point(2026, 2, 6.0), point(2026, 3, 6.1)])?.dir).toBe("level");
    expect(medianMoved([point(2026, 3, 6)])).toBeUndefined();
  });
});

describe("countMoved", () => {
  const totals = [total(2026, 1, { pending: 1000, received: 400 }), total(2026, 2, {}, true), total(2026, 3, { pending: 900, received: 500 })];
  it("calls fewer waiting good and more received information, past a quarter not held", () => {
    expect(countMoved(totals, totals[2]!, "pending")).toEqual({ text: "10% fewer than FY26 Q1", dir: "down", tone: "good" });
    expect(countMoved(totals, totals[2]!, "received")).toEqual({ text: "25% more than FY26 Q1", dir: "up", tone: "info" });
    expect(countMoved([total(2026, 2, { pending: 1000 }), total(2026, 3, { pending: 1010 })], total(2026, 3, { pending: 1010 }), "pending")).toBeUndefined();
  });
  it("says level within 2%", () => {
    const t = [total(2026, 2, { pending: 1000 }), total(2026, 3, { pending: 1010 })];
    expect(countMoved(t, t[1]!, "pending")?.dir).toBe("level");
  });
});

describe("approvalMoved", () => {
  it("compares shares in points", () => {
    const t = [total(2026, 2, { approved: 90, denied: 10 }), total(2026, 3, { approved: 93, denied: 7 })];
    expect(approvalMoved(t, t[1]!)).toEqual({ text: "3 points above FY26 Q2", dir: "up", tone: "good" });
    const u = [total(2026, 2, { approved: 93, denied: 7 }), total(2026, 3, { approved: 92, denied: 8 })];
    expect(approvalMoved(u, u[1]!)).toEqual({ text: "1 point below FY26 Q2", dir: "down", tone: "bad" });
  });
});
