/**
 * The timing panel says the measured window in words, dates its "Today"
 * label (it is held at the bar's edge when today falls off either end), and
 * names the 30-day rule only for an H-2A case counted from its first day.
 */
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { SeasonalTimingPanel } from "../SeasonalTimingPanel";
import { parseSeasonalTiming, timingView, type SeasonalTiming } from "@/lib/seasonalTiming";

const timing = parseSeasonalTiming(
  JSON.stringify({
    asOf: "2026-10-03T21:09:04Z",
    "H-2A": {
      daysToDecision: { n: 43601, p10: 11, p25: 17, p50: 26, p75: 35, p90: 44 },
      leadDays: { n: 43600, p10: 13, p25: 25, p50: 33, p75: 42, p90: 52 },
      decidedFrom: "2024-10-01",
      decidedTo: "2026-06-30",
      files: 2,
      onTime: { n: 43600, share: 0.6545, deadlineDays: 30 },
    },
    "CW-1": {
      daysToDecision: { n: 2211, p10: 42, p25: 49, p50: 58, p75: 72, p90: 91 },
      leadDays: null,
      decidedFrom: "2024-10-01",
      decidedTo: "2026-06-30",
      files: 2,
    },
  }),
) as SeasonalTiming;

describe("SeasonalTimingPanel", () => {
  it("counts an H-2A case back from its first day and names the rule's date", () => {
    const view = timingView({ caseNumber: "H-300-26276-277918", filingDate: "2026-10-03", firstDay: "2026-12-01", today: "2026-10-03", timing })!;
    render(<SeasonalTimingPanel view={view} firstDay="2026-12-01" filingDate="2026-10-03" />);
    expect(screen.getByText(/were decided 25 to 42 days before the work began/)).toBeTruthy();
    expect(screen.getByText(/The rule has DOL decide by November 1, 2026/)).toBeTruthy();
    expect(screen.getByText(/65% of the certifications met it/)).toBeTruthy();
    expect(screen.getByText("Today, Oct 3")).toBeTruthy();
  });

  it("counts a CW-1 case from filing, says when it's past most, and names no rule", () => {
    const view = timingView({ caseNumber: "C-500-26189-084701", filingDate: "2026-07-08", firstDay: null, today: "2026-10-03", timing })!;
    render(<SeasonalTimingPanel view={view} firstDay={null} filingDate="2026-07-08" />);
    expect(screen.getByText(/were decided 49 to 72 days after filing/)).toBeTruthy();
    expect(screen.getByText(/this one is taking longer than most/)).toBeTruthy();
    expect(screen.queryByText(/The rule has DOL decide/)).toBeNull();
    expect(screen.getByText(/From 2,211 certifications in DOL's published CW-1 files/)).toBeTruthy();
  });

  it("says which season an H-2B estimate comes from, and how the method did when tested", () => {
    const seasoned = parseSeasonalTiming(
      JSON.stringify({
        asOf: "2026-10-07T22:11:33Z",
        "H-2B": {
          daysToDecision: { n: 26359, p10: 28, p25: 39, p50: 58, p75: 90, p90: 110 },
          leadDays: null,
          decidedFrom: "2024-10-01",
          decidedTo: "2026-06-30",
          files: 2,
          useSeason: true,
          seasons: { "2025-Q1": { daysToDecision: { n: 9436, p10: 40, p25: 54, p50: 72, p75: 90, p90: 104 } } },
        },
      }),
    ) as SeasonalTiming;
    const view = timingView({ caseNumber: "H-400-26010-000001", filingDate: "2026-01-10", firstDay: null, today: "2026-02-01", timing: seasoned })!;
    render(<SeasonalTimingPanel view={view} firstDay={null} filingDate="2026-01-10" checked={{ share: 0.427, cases: 15225 }} />);
    expect(screen.getByText(/certified that were filed January to March 2025 were decided 54 to 90 days after filing/)).toBeTruthy();
    expect(screen.getByText(/Tested on 15,225 later H-2B decisions, 43% landed inside the middle half/)).toBeTruthy();
    expect(screen.getByText(/the same months a year before this case, because H-2B decisions run on a seasonal clock/)).toBeTruthy();
  });

  it("prints no tested line without a backtest", () => {
    const view = timingView({ caseNumber: "C-500-26276-277918", filingDate: "2026-10-03", firstDay: null, today: "2026-10-03", timing })!;
    render(<SeasonalTimingPanel view={view} firstDay={null} filingDate="2026-10-03" />);
    expect(screen.queryByText(/Tested on/)).toBeNull();
  });
});

