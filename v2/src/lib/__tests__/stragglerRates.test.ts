import { describe, expect, it } from "vitest";

import { MAX_AGE_DAYS, MIN_DECIDED, parseStragglerRates } from "../stragglerRates";

const good = {
  asOf: "2026-10-03", frontierMonth: "2025-12", windowDays: 14, pending: 1242, pool: 4408,
  decided: 2952, dailyRate: 0.08787, medianDays: 8, p80Days: 18,
};

describe("parseStragglerRates", () => {
  it("reads a fresh, well-founded measurement", () => {
    expect(parseStragglerRates(JSON.stringify(good), "2026-10-04")?.medianDays).toBe(8);
  });

  it("refuses one older than the sweep could leave it", () => {
    const old = { ...good, asOf: "2026-09-20" };
    expect(parseStragglerRates(JSON.stringify(old), "2026-10-04")).toBeNull();
    expect(MAX_AGE_DAYS).toBeLessThan(14);
  });

  it("refuses one standing on too few decisions", () => {
    expect(parseStragglerRates(JSON.stringify({ ...good, decided: MIN_DECIDED - 1 }), "2026-10-04")).toBeNull();
  });

  it("refuses an impossible rate or range, and unreadable text", () => {
    expect(parseStragglerRates(JSON.stringify({ ...good, dailyRate: 0 }), "2026-10-04")).toBeNull();
    expect(parseStragglerRates(JSON.stringify({ ...good, p80Days: 3 }), "2026-10-04")).toBeNull();
    expect(parseStragglerRates("{not json", "2026-10-04")).toBeNull();
    expect(parseStragglerRates(JSON.stringify({ ...good, asOf: "2026-10-09" }), "2026-10-04")).toBeNull();
  });
});
