import { describe, expect, it } from "vitest";

import { monthAfter, releaseEstimate } from "../bulletinReleaseEstimate";

describe("releaseEstimate", () => {
  // Eight bulletins first captured on the 4th, 8th, 10th, 12th, 14th, 16th,
  // 18th and 20th of the month before.
  const captures = [4, 8, 10, 12, 14, 16, 18, 20].map((d, i) => ({
    month: `2025-${String(i + 2).padStart(2, "0")}`,
    captured: `2025-${String(i + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
  }));

  it("names the typical day and the middle half in the month before the bulletin", () => {
    expect(releaseEstimate("2026-11", captures)).toEqual({
      bulletin: "2026-11",
      early: "2026-10-08",
      typical: "2026-10-12",
      late: "2026-10-16",
    });
  });

  it("says nothing over too few bulletins", () => {
    expect(releaseEstimate("2026-11", captures.slice(0, 5))).toBeNull();
  });

  it("steps across a year", () => {
    expect(monthAfter("2026-12")).toBe("2027-01");
    expect(monthAfter("2026-10")).toBe("2026-11");
  });
});
