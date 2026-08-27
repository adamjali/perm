import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
  usePathname: () => "/tools/salary-explorer",
  useSearchParams: () => new URLSearchParams(),
}));

import { SalaryExplorer, type ExplorerPayload } from "../SalaryExplorer";

/**
 * The doctrine, not the layout.
 *
 * Two things must hold no matter how this page is restyled: a thin selection
 * reports nothing rather than something, and the reason is legible ABOVE the
 * figures rather than under them. A withheld number with no stated reason
 * reads as a broken page; a number computed from nine cases reads as a fact.
 */

const OCCUPATIONS = [
  { value: "15-1252.00", label: "Software Developers", n: 76_524 },
  { value: "51-3022.00", label: "Meat, Poultry, and Fish Cutters and Trimmers", n: 9_306 },
];
const STATES = [{ value: "CA", label: "CA", n: 61_569 }];

function payload(over: Partial<ExplorerPayload> = {}): ExplorerPayload {
  return {
    // The real all-certified figures, so a fixture cannot drift from the page.
    stats: {
      n: 343_211,
      avg: 102_919,
      p5: 24_960,
      p25: 45_178,
      p50: 103_272,
      p75: 141_357,
      p95: 199_597,
    },
    bins: [
      { from: 20_000, count: 35_134 },
      { from: 30_000, count: 38_543 },
      { from: 100_000, count: 15_000 },
    ],
    binWidth: 10_000,
    below: 2_471,
    above: 812,
    byState: [
      { state: "CA", n: 61_569, avg: 139_219, p5: 36_400, p25: 104_000, p50: 142_000, p75: 176_134, p95: 226_325 },
      { state: "VT", n: 44, avg: 71_000, p5: 30_000, p25: 55_000, p50: 68_000, p75: 88_000, p95: 120_000 },
    ],
    ...over,
  };
}

function renderExplorer(initial: ExplorerPayload) {
  render(
    <SalaryExplorer
      occupations={OCCUPATIONS}
      states={STATES}
      fiscalYears={["2026", "2025", "2024"]}
      initial={initial}
    />,
  );
}

describe("SalaryExplorer", () => {
  it("shows the four headline figures and the quartile band", () => {
    renderExplorer(payload());
    expect(screen.getByText("$103,272")).toBeInTheDocument();   // median
    expect(screen.getByText("$102,919")).toBeInTheDocument();   // average
    expect(screen.getByText("$24,960")).toBeInTheDocument();    // 5th
    expect(screen.getByText("$199,597")).toBeInTheDocument();   // 95th
    expect(screen.getByText(/25th and 75th percentiles/)).toBeInTheDocument();
    expect(screen.getByText(/343,211 cases with a usable wage/)).toBeInTheDocument();
  });

  it("reports nothing at all below the median floor, and says why first", () => {
    renderExplorer(payload({ stats: { n: 9, avg: 50_000, p5: null, p25: null, p50: 51_000, p75: null, p95: null } }));
    // The median is present in the data and must NOT be on the page.
    expect(screen.queryByText("$51,000")).not.toBeInTheDocument();
    expect(screen.getByText(/Only 9 cases match these filters/)).toBeInTheDocument();
  });

  it("shows the middle but withholds the tails between the floors", () => {
    renderExplorer(payload({
      stats: { n: 44, avg: 71_000, p5: 30_000, p25: 55_000, p50: 68_000, p75: 88_000, p95: 120_000 },
      // A 44-case selection has no state above the floor, so the table
      // is genuinely absent rather than suppressed for the test.
      byState: [],
    }));
    expect(screen.getByText("Median")).toBeInTheDocument();
    expect(screen.getByText("Average")).toBeInTheDocument();
    // Asserted on the CARD LABELS, not on the values: $30,000 is also a
    // legitimate histogram bin edge, so querying the number would fail for a
    // reason that has nothing to do with what is under test.
    expect(screen.queryByText("5th percentile")).not.toBeInTheDocument();
    expect(screen.queryByText("95th percentile")).not.toBeInTheDocument();
    expect(screen.getByText(/5th and 95th are withheld/)).toBeInTheDocument();
  });

  it("puts the warning above the figures, not below them", () => {
    renderExplorer(payload({
      stats: { n: 44, avg: 71_000, p5: 30_000, p25: 55_000, p50: 68_000, p75: 88_000, p95: 120_000 },
      // A 44-case selection has no state above the floor, so the table
      // is genuinely absent rather than suppressed for the test.
      byState: [],
    }));
    const warning = screen.getByText(/5th and 95th are withheld/);
    const median = screen.getByText("$68,000");
    // Node.DOCUMENT_POSITION_FOLLOWING: the median comes after the warning.
    expect(warning.compareDocumentPosition(median) & 4).toBeTruthy();
  });

  it("counts outliers rather than dropping them", () => {
    renderExplorer(payload());
    // 2,471 below plus 812 above, stated so the parts still add up to n.
    expect(screen.getByText(/3,283 cases sit outside this range/)).toBeInTheDocument();
  });

  it("draws one row per histogram bin and names the band width", () => {
    renderExplorer(payload());
    expect(screen.getByText(/Each bar is a \$10,000 band/)).toBeInTheDocument();
    expect(
      screen.getByLabelText("$20,000 to $30,000: 35,134 cases"),
    ).toBeInTheDocument();
  });

  it("withholds a state's tails when that state is thin, keeping its median", () => {
    renderExplorer(payload());
    const vt = screen.getByRole("row", { name: /^VT/ });
    expect(within(vt).getByText("$68,000")).toBeInTheDocument();
    // VT has 44 cases, so its 5th and 95th read n/a while CA's are printed.
    expect(within(vt).getAllByText("n/a")).toHaveLength(2);
    const ca = screen.getByRole("row", { name: /^CA/ });
    expect(within(ca).queryByText("n/a")).not.toBeInTheDocument();
  });

  it("names the selection so a figure cannot be read as describing everything", () => {
    renderExplorer(payload());
    expect(screen.getByText(/All occupations · every state · all years/)).toBeInTheDocument();
  });

  it("defaults the outcome filter to certified", () => {
    renderExplorer(payload());
    expect(screen.getByLabelText(/Outcome/)).toHaveValue("certified");
  });
});
