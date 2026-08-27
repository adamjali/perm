/**
 * What the review-stage components must actually put on the page.
 *
 * Every assertion here corresponds to a way this page could quietly mislead
 * somebody: a withheld figure rendered as a zero, a rare stage summarised
 * instead of shown, one of the funnel's two denominators quoted alone, or a
 * marker label printed away from the line it names.
 */
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { ReviewStage, StageCohort, StageRecord } from "@/lib/turso/rfi";
import { OccupationRates } from "../OccupationRates";
import { RfiOutcomes } from "../RfiOutcomes";
import { StageCensus } from "../StageCensus";
import { StageCohortsChart, StageCohortsTable } from "../StageCohorts";
import { StageLadder, StageLadderTable } from "../StageLadder";
import { isReviewStage, stageMeta } from "../stageMeta";

function stage(over: Partial<ReviewStage> & { status: string }): ReviewStage {
  return {
    cases: 100,
    employerNames: 40,
    topEmployer: "An Employer, LLC",
    topEmployerCases: 5,
    seenFrom: "2026-08-26",
    seenTo: "2026-08-26",
    ageBand: { p10: 341, median: 372, p90: 424, n: 100 },
    ...over,
  };
}

describe("stageMeta", () => {
  it("puts an unrecognised status in the review group, not the queue", () => {
    // DOL added `DENIED - BALCA DISMISSED` to this feed with one case while
    // the live-backlog query was being written. A new string defaulted into
    // the ordinary queue disappears inside a 94,000-case row; defaulted into
    // review it lands on the chart where somebody sees it.
    const m = stageMeta("SOME BRAND NEW STATUS");
    expect(m.group).toBe("review");
    expect(isReviewStage("SOME BRAND NEW STATUS")).toBe(true);
    expect(m.label).toBe("Some brand new status");
    expect(m.phrase).toBeTruthy();
  });

  it("gives every known stage a noun phrase that is not the shouted label", () => {
    // The first version of this test asserted the phrase held no run of three
    // capitals, and "open RFIs" is the correct phrase for RFI ISSUED. An
    // acronym inside a sentence is not shouting. What actually matters is that
    // the phrase is not the raw status string and is not fully upper-case.
    for (const status of ["RFI ISSUED", "APPLICATION ON HOLD", "BALCA APPEALS"]) {
      const m = stageMeta(status);
      expect(m.phrase).not.toBe(status);
      expect(m.phrase).not.toBe(m.phrase.toUpperCase());
    }
    expect(stageMeta("RFI ISSUED").phrase).toBe("open RFIs");
    expect(stageMeta("APPLICATION ON HOLD").phrase).toBe("applications on hold");
  });
});

describe("StageLadder", () => {
  const stages = [
    stage({ status: "RFI ISSUED", cases: 905 }),
    stage({ status: "IN PROCESS", cases: 71, ageBand: null }),
  ];

  it("draws only the stages that have a publishable band", () => {
    const { container } = render(<StageLadder stages={stages} />);
    expect(screen.getByText("RFI issued")).toBeInTheDocument();
    expect(container.textContent).not.toContain("In process");
  });

  it("says a figure is absent rather than printing a zero or a dash", () => {
    render(<StageLadderTable stages={stages} />);
    // A dash reads as "nothing here" and a zero reads as a measurement of
    // zero. Both are claims; this is not.
    const withheld = screen.getAllByText("not shown");
    expect(withheld.length).toBe(2); // median and range, for IN PROCESS
    const row = screen.getByText("In process").closest("tr");
    expect(within(row as HTMLElement).getAllByText("not shown")).toHaveLength(2);
  });

  it("keeps every stage in the table even when its band is withheld", () => {
    render(<StageLadderTable stages={stages} />);
    expect(screen.getByText("In process")).toBeInTheDocument();
    expect(screen.getByText("71")).toBeInTheDocument();
  });

  it("puts the marker rule and its label at the same coordinate", () => {
    // The deadline diagram on this site drew a rail at one date and printed
    // its label at a fixed inset, so the label sat 204 units from the date it
    // named. A line and its label are one object.
    const { container } = render(
      <StageLadder stages={stages} marker={{ days: 372, label: "DOL: 372 days" }} />,
    );
    const label = screen.getByText("DOL: 372 days") as HTMLElement;
    const rule = container.querySelector(
      'div[class*="bg-[var(--primary-text)]"]',
    ) as HTMLElement | null;
    expect(rule).not.toBeNull();
    expect(label.style.left).toBe(rule?.style.left);
    expect(label.style.left).not.toBe("");
  });
});

describe("StageCensus", () => {
  it("prints the contents of a stage too small to summarise", () => {
    const records: StageRecord[] = [
      {
        status: "SUPERVISED RECRUITMENT",
        employer: "The White House",
        jobTitle: "Wisdom",
        filingMonth: "2026-07",
      },
    ];
    render(
      <StageCensus
        stages={[stage({ status: "SUPERVISED RECRUITMENT", cases: 2, ageBand: null })]}
        smallRecords={records}
        smallMax={20}
      />,
    );
    // Showing the rows beats a curated exclusion list: the reader gets the
    // same evidence, and it keeps working for the next odd record.
    expect(screen.getByText(/The White House/)).toBeInTheDocument();
    expect(screen.getByText(/Wisdom/)).toBeInTheDocument();
  });

  it("names the dominant employer beside a concentrated count", () => {
    render(
      <StageCensus
        stages={[
          stage({
            status: "APPLICATION ON HOLD",
            cases: 1789,
            employerNames: 7,
            topEmployer: "Cognizant Technology Solutions US Corporation",
            topEmployerCases: 1768,
          }),
        ]}
        smallRecords={[]}
        smallMax={20}
      />,
    );
    // "1,789 applications on hold" reads as a programme-wide pattern. It is
    // one company, and a reader who is not told that has been misled by a
    // true number.
    expect(
      screen.getByText(/Cognizant Technology Solutions US Corporation/),
    ).toBeInTheDocument();
    expect(screen.getByText(/1,768 of these/)).toBeInTheDocument();
  });

  it("never rounds a rare stage down to nothing", () => {
    const { container } = render(
      <StageCensus
        stages={[
          stage({ status: "ANALYST REVIEW", cases: 94_432 }),
          stage({ status: "REQUEST FOR REVIEW", cases: 2, ageBand: null }),
        ]}
        smallRecords={[]}
        smallMax={20}
      />,
    );
    // 2 in 94,434 is 0.002%, which `toFixed(1)` renders as "0.0%".
    expect(container.textContent).toContain("under 0.1%");
    expect(container.textContent).not.toMatch(/\b0\.0%/);
  });
});

describe("RfiOutcomes", () => {
  const funnel = {
    totalTracked: 211_719,
    everIssued: 3213,
    resolved: 2151,
    certified: 1799,
    denied: 210,
    withdrawn: 142,
    stillOpen: 1062,
    medianDaysToDecision: 33,
    observedAt: 1,
    source: "test",
  };

  it("states both denominators, because the flattering one is quotable alone", () => {
    const { container } = render(<RfiOutcomes funnel={funnel} />);
    const text = container.textContent ?? "";
    expect(text).toContain("84%"); // of the RFIs that reached a decision
    expect(text).toContain("56%"); // of every RFI ever issued
    expect(text).toContain("1,062"); // the ones with no decision yet
  });

  it("sizes every segment against the same denominator so the rows nest", () => {
    const { container } = render(<RfiOutcomes funnel={funnel} />);
    const widths = [...container.querySelectorAll<HTMLElement>("div[style*='width']")]
      .map((el) => parseFloat(el.style.width))
      .filter((n) => Number.isFinite(n));
    // Normalising the outcome row to its own 100% would put certified at 83.6
    // and turn the funnel into two unrelated bar charts.
    expect(widths).toContainEqual(expect.closeTo((1799 / 3213) * 100, 3));
    expect(widths).toContainEqual(expect.closeTo((2151 / 3213) * 100, 3));
  });

  it("gives the four outcomes four colours, not one at four opacities", () => {
    const { container } = render(<RfiOutcomes funnel={funnel} />);
    const fills = new Set(
      [...container.querySelectorAll<HTMLElement>("[style*='background-color']")]
        .map((el) => el.style.backgroundColor)
        .filter(Boolean),
    );
    expect(fills.size).toBeGreaterThanOrEqual(4);
  });
});

describe("OccupationRates", () => {
  const cut = {
    from: "2025-05",
    to: "2025-09",
    filed: 52_690,
    rfi: 894,
    baseline: 1.7,
    withheld: 4,
    rows: [
      {
        title: "NAIL TECHNICIAN / NAIL TECH ASSISTANT",
        rfi: 15,
        rfiEmployers: 10,
        filed: 51,
        filedEmployers: 22,
        rate: 29.41,
      },
      {
        title: "SOFTWARE ENGINEER",
        rfi: 14,
        rfiEmployers: 12,
        filed: 1848,
        filedEmployers: 656,
        rate: 0.76,
      },
    ],
  };

  it("puts the population on every row and the field rate above them", () => {
    const { container } = render(<OccupationRates cut={cut} />);
    const text = container.textContent ?? "";
    expect(text).toContain("1.70%");
    expect(text).toContain("15 of 51 filed");
    expect(text).toContain("10 employers");
  });

  it("says how many titles were withheld and why", () => {
    const { container } = render(<OccupationRates cut={cut} />);
    const text = container.textContent ?? "";
    expect(text).toContain("4 more");
    expect(text).toContain("five distinct");
  });

  it("keeps a below-baseline row visible instead of collapsing it to nothing", () => {
    const { container } = render(<OccupationRates cut={cut} />);
    // 0.76 against a 29.41 maximum is 2.6% of the track. Without a pixel
    // floor the bar is sub-pixel and reads as "no data".
    const bars = [...container.querySelectorAll<HTMLElement>("span[style*='width']")];
    expect(bars.every((b) => b.style.width.includes("max("))).toBe(true);
  });
});

describe("StageCohorts", () => {
  const cohorts: StageCohort[] = [
    { month: "2025-08", filed: 9677, stages: { "RFI ISSUED": 249 } },
    { month: "2025-09", filed: 13_629, stages: { "RFI ISSUED": 324 } },
    { month: "2025-10", filed: 1616, stages: { "RFI ISSUED": 4 } },
  ];

  it("labels the peak month and only the peak month", () => {
    const { container } = render(
      <StageCohortsChart cohorts={cohorts} statuses={["RFI ISSUED"]} />,
    );
    const visible = [...container.querySelectorAll("span")]
      .filter((s) => !s.className.includes("text-transparent"))
      .map((s) => s.textContent);
    expect(visible).toContain("324");
    expect(visible).not.toContain("249");
  });

  it("keeps every exact count in the table, which ships in the same HTML", () => {
    const { container } = render(
      <StageCohortsTable cohorts={cohorts} statuses={["RFI ISSUED"]} />,
    );
    const text = container.textContent ?? "";
    for (const n of ["249", "324", "4", "9,677", "13,629"]) {
      expect(text).toContain(n);
    }
  });
});
