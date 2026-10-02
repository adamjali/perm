import { describe, expect, it } from "vitest";
import { formatDollars, formatInt, formatPercent, formatShare } from "./format";

describe("formatInt", () => {
  it("groups digits the US way", () => {
    expect(formatInt(14386)).toBe("14,386");
    expect(formatInt(1_234_567)).toBe("1,234,567");
    expect(formatInt(0)).toBe("0");
    expect(formatInt(11)).toBe("11");
  });

  it("matches toLocaleString('en-US') exactly, fractions included", () => {
    for (const n of [-1234, 0.5, 2.345, 999_999.9999, 1e21]) {
      expect(formatInt(n)).toBe(n.toLocaleString("en-US"));
    }
  });
});

describe("formatPercent", () => {
  it("prints a ratio to the asked number of places", () => {
    expect(formatPercent(0.4237, 1)).toBe("42.4%");
    expect(formatPercent(0.4237, 0)).toBe("42%");
    expect(formatPercent(1, 1)).toBe("100.0%");
  });
});

describe("formatShare", () => {
  it("drops the decimal from 10% up and keeps one below", () => {
    expect(formatShare(0.42)).toBe("42%");
    expect(formatShare(0.1)).toBe("10%");
    expect(formatShare(0.034)).toBe("3.4%");
    expect(formatShare(0)).toBe("0.0%");
  });
});

describe("formatDollars", () => {
  it("rounds to whole dollars and groups digits", () => {
    expect(formatDollars(139_026.51)).toBe("$139,027");
    expect(formatDollars(65)).toBe("$65");
  });
});
