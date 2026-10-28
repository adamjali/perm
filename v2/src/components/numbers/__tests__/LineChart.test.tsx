import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LineChart } from "../LineChart";

const points = [
  { date: "2026-10-25", value: 81727 },
  { date: "2026-10-26", value: 81257 },
  { date: "2026-10-27", value: 80793 },
  { date: "2026-10-28", value: 80776 },
];

describe("LineChart", () => {
  it("names its ends, marks the live point and lists every day for a screen reader", () => {
    const { container } = render(<LineChart points={points} label="Cases in analyst review" noun="cases" nowLabel="Now" />);
    expect(screen.getByRole("group").getAttribute("aria-label")).toBe("Cases in analyst review: 81,727 on Oct 25, 2026, 80,776 now.");
    expect(container.querySelectorAll("circle")).toHaveLength(1);
    const rows = [...container.querySelectorAll("tbody tr")].map((r) => r.textContent?.trim());
    expect(rows).toEqual(["Oct 25, 2026 81,727", "Oct 26, 2026 81,257", "Oct 27, 2026 80,793", "Now 80,776"]);
  });

  it("draws no live mark when every point is a day's end, and nothing for a single point", () => {
    const { container } = render(<LineChart points={points} label="L" noun="cases" />);
    expect(container.querySelectorAll("circle")).toHaveLength(0);
    const one = render(<LineChart points={points.slice(0, 1)} label="L" noun="cases" />);
    expect(one.container.innerHTML).toBe("");
  });
});
