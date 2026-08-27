import { describe, expect, it } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";

import { I140Trends } from "../I140Trends";
import type { TrendRow } from "@/lib/i140Trends";

/**
 * The two things this page must never get wrong: it must not let a reader add
 * a preference to its own subtypes, and it must not present a quarter USCIS
 * has not reported as a quarter with no activity.
 */

function r(
  fy: number,
  q: number,
  category: string,
  label: string,
  received: number,
  approved: number,
  denied: number,
  pending: number,
): TrendRow {
  return {
    fiscalYear: fy,
    quarter: q,
    category,
    categoryLabel: label,
    received,
    approved,
    denied,
    pending,
  };
}

// EB2 = E21 + NIW, as USCIS reports it and as the live table reconciles.
const ROWS: TrendRow[] = [
  r(2025, 1, "EB2", "Second Preference", 28_437, 20_000, 5_000, 90_000),
  r(2025, 2, "EB2", "Second Preference", 28_701, 21_000, 5_200, 92_000),
  r(2025, 1, "E21", "Professionals with Advanced Degrees", 12_000, 11_000, 280, 30_000),
  r(2025, 2, "E21", "Professionals with Advanced Degrees", 12_500, 11_400, 300, 31_000),
  r(2025, 1, "NIW", "National Interest Waiver", 16_437, 9_000, 4_720, 60_000),
  r(2025, 2, "NIW", "National Interest Waiver", 16_201, 9_600, 4_900, 61_000),
  // Not yet published by USCIS. Arrives as zeros and must never be drawn.
  r(2026, 3, "E21", "Professionals with Advanced Degrees", 0, 0, 0, 0),
];

describe("I140Trends", () => {
  it("keeps preferences and subtypes in separate groups", () => {
    render(<I140Trends rows={ROWS} />);
    const select = screen.getByLabelText("Category");
    const groups = within(select).getAllByRole("group");
    expect(groups).toHaveLength(2);
    // A flat list invites adding EB2 to its own children.
    expect(groups[0]).toHaveAttribute("label", expect.stringContaining("Preference"));
  });

  it("uses USCIS's own label for E21 and never calls it a waiver", () => {
    render(<I140Trends rows={ROWS} />);
    const select = screen.getByLabelText("Category");
    expect(
      within(select).getByRole("option", {
        name: /E21 · Professionals with Advanced Degrees/,
      }),
    ).toBeInTheDocument();
    // NIW exists as its own option rather than as a relabelling of E21.
    expect(
      within(select).getByRole("option", { name: /NIW · National Interest Waiver/ }),
    ).toBeInTheDocument();
  });

  it("computes rates over decided petitions, not receipts", () => {
    render(<I140Trends rows={ROWS} />);
    fireEvent.change(screen.getByLabelText("Category"), { target: { value: "E21" } });
    // 580 denied of 23,000 decided = 2.52%. Over 24,500 receipts it would
    // read 2.37%, and that figure would move whenever USCIS decided less.
    expect(screen.getByText("2.52%")).toBeInTheDocument();
    expect(screen.getByText(/not over\s+receipts/)).toBeInTheDocument();
  });

  it("takes pending from the newest quarter and says so", () => {
    render(<I140Trends rows={ROWS} />);
    fireEvent.change(screen.getByLabelText("Category"), { target: { value: "E21" } });
    // 31,000, not 30,000 + 31,000.
    expect(screen.getByText("31,000")).toBeInTheDocument();
    expect(screen.getByText(/waiting at the newest quarter, not a sum/)).toBeInTheDocument();
  });

  it("omits a quarter USCIS has not reported rather than drawing it at zero", () => {
    render(<I140Trends rows={ROWS} />);
    fireEvent.change(screen.getByLabelText("Category"), { target: { value: "E21" } });
    expect(screen.getByText(/2 quarters reported/)).toBeInTheDocument();
    expect(screen.queryByLabelText(/FY2026 Q3/)).not.toBeInTheDocument();
  });

  it("gives each quarter a receipts row and an outcome row", () => {
    render(<I140Trends rows={ROWS} />);
    fireEvent.change(screen.getByLabelText("Category"), { target: { value: "E21" } });
    expect(screen.getByLabelText("FY2025 Q1: 12,000 received")).toBeInTheDocument();
    expect(
      screen.getByLabelText("FY2025 Q1: 11,000 approved, 280 denied"),
    ).toBeInTheDocument();
  });

  it("shows the denial rate as a line once there are two points", () => {
    render(<I140Trends rows={ROWS} />);
    fireEvent.change(screen.getByLabelText("Category"), { target: { value: "NIW" } });
    expect(screen.getByRole("img", { name: /Denial rate by quarter/ })).toBeInTheDocument();
  });

  it("says nothing rather than drawing an empty category", () => {
    render(<I140Trends rows={[r(2026, 3, "EB2", "Second Preference", 0, 0, 0, 0)]} />);
    expect(screen.getByText(/has not reported any quarter/)).toBeInTheDocument();
  });
});
