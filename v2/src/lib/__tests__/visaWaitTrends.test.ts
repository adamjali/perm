import { describe, expect, it } from "vitest";

import { isQuickWork, postWaitMoved, quickMoved } from "@/lib/visaWaitTrends";
import type { WaitCell } from "@/lib/visaWaits";

const cell = (reading: string, post: string, days: number | null, bound: "under" | null = null): WaitCell & { reading: string } => ({
  reading, post, visaClass: "H,L,O,P,Q", measure: "next", waitText: "", kind: days === null ? "na" : "value",
  amount: days === null ? null : days / 30, unit: days === null ? null : "month", bound, days,
});

const history = [
  cell("2026-06-18", "Chennai", 210), cell("2026-06-18", "Mumbai", 15, "under"), cell("2026-06-18", "Delhi", 15),
  cell("2026-10-21", "Chennai", 180), cell("2026-10-21", "Mumbai", 15, "under"), cell("2026-10-21", "Delhi", 60),
];

describe("visa wait trends", () => {
  it("counts 0.5 Month and < 0.5 Month as quick, and nothing without a figure", () => {
    expect(isQuickWork(cell("x", "a", 15))).toBe(true);
    expect(isQuickWork(cell("x", "a", 15, "under"))).toBe(true);
    expect(isQuickWork(cell("x", "a", 30))).toBe(false);
    expect(isQuickWork(cell("x", "a", null))).toBe(false);
  });

  it("compares one consulate with the reading before, named by its date", () => {
    expect(postWaitMoved(history, "Chennai", cell("2026-10-21", "Chennai", 180), "2026-10-21")).toEqual({ text: "1 month shorter than Jun 18", dir: "down", tone: "good" });
    expect(postWaitMoved(history, "Delhi", cell("2026-10-21", "Delhi", 60), "2026-10-21")).toMatchObject({ text: "1.5 months longer than Jun 18", tone: "bad" });
    expect(postWaitMoved(history, "Kolkata", cell("2026-10-21", "Kolkata", 60), "2026-10-21")).toBeUndefined();
  });

  it("says at least when a < figure is one side, and level when both are", () => {
    const h = [cell("2026-06-18", "Mumbai", 30), cell("2026-10-21", "Mumbai", 15, "under")];
    expect(postWaitMoved(h, "Mumbai", h[1]!, "2026-10-21")).toMatchObject({ text: "At least 15 days shorter than Jun 18", tone: "good" });
    const g = [cell("2026-06-18", "Mumbai", 15, "under"), cell("2026-10-21", "Mumbai", 60)];
    expect(postWaitMoved(g, "Mumbai", g[1]!, "2026-10-21")).toMatchObject({ text: "At least 1.5 months longer than Jun 18", tone: "bad" });
    const k = [cell("2026-06-18", "Mumbai", 15, "under"), cell("2026-10-21", "Mumbai", 15, "under")];
    expect(postWaitMoved(k, "Mumbai", k[1]!, "2026-10-21")?.dir).toBe("level");
  });

  it("counts quick consulates against the reading before", () => {
    expect(quickMoved(history, 1, "2026-10-21")).toEqual({ text: "1 fewer than Jun 18", dir: "down", tone: "bad" });
    expect(quickMoved(history, 2, "2026-10-21")?.dir).toBe("level");
    expect(quickMoved(history.filter((c) => c.reading === "2026-10-21"), 1, "2026-10-21")).toBeUndefined();
  });
});
