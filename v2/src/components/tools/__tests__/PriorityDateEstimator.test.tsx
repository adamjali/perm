import { describe, expect, it } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { PriorityDateEstimator } from "../PriorityDateEstimator";
import type { BulletinMonth } from "@/lib/perm";

/**
 * These pin the four defects the 2026-08-25 audit found on the live page.
 *
 * The one worth naming is the future priority date: the tool used to accept
 * 2027-05-25 and answer as though it were real, returning "your date was not
 * yet current" and a days-later count in the thousands. Every number was
 * arithmetic and none of it meant anything, and nothing on the page suggested
 * doubt. A priority date is the day an application was RECEIVED, so a future
 * one describes nothing that has happened.
 *
 * `today` is a prop rather than a `new Date()` call so these tests pin a
 * moment instead of drifting into failure the year the fixtures age out.
 */

const TODAY = "2026-08-25";

/** Shaped like a real bulletin: lowercase country keys, `15JUL14` / `C` / `U`. */
function bulletin(
  month: string,
  eb2india: string,
  extra: Record<string, Record<string, string>> = {},
): BulletinMonth {
  return {
    bulletinMonth: month,
    finalAction: {
      EB2: { india: eb2india, worldwide: "C" },
      EB1: { india: "01JAN23", worldwide: "C" },
      ...extra,
    },
    datesForFiling: {
      EB2: { india: "01JAN15", worldwide: "C" },
      EB1: { india: "01JUN23", worldwide: "C" },
    },
  } as unknown as BulletinMonth;
}

/** EB-2 India as actually published: advance, retrogress, then close. */
const SERIES: BulletinMonth[] = [
  bulletin("2026-03", "01JAN14"),
  bulletin("2026-04", "15JUL14"),
  bulletin("2026-05", "15JUL14"),
  bulletin("2026-06", "01SEP13"),
  bulletin("2026-07", "U"),
];

function renderTool(props: Partial<React.ComponentProps<typeof PriorityDateEstimator>> = {}) {
  return render(
    <PriorityDateEstimator bulletins={SERIES} today={TODAY} {...props} />,
  );
}

function setPriorityDate(value: string) {
  const input = screen.getByLabelText(/your priority date/i) as HTMLInputElement;
  fireEvent.change(input, { target: { value } });
}

function selectByLabel(label: RegExp, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

/**
 * The figure itself, never the whole container.
 *
 * A bare `querySelectorAll("rect")` also collects the rects inside the Phosphor
 * icons in the header and the date field, so a bar count comes back inflated
 * by however many icons happen to be on screen. That reads as a product bug
 * and is not one.
 */
function chartBars(container: HTMLElement): SVGRectElement[] {
  const svg = container.querySelector('svg[role="img"]');
  expect(svg).not.toBeNull();
  return [...svg!.querySelectorAll("rect")];
}

describe("PriorityDateEstimator: a future priority date", () => {
  it("warns and withholds instead of answering", () => {
    renderTool();
    setPriorityDate("2027-05-25");

    const alert = screen.getByRole("alert");
    expect(within(alert).getByText(/is in the future/i)).toBeInTheDocument();

    // Withheld: no verdict at all, not a verdict with a caveat attached.
    expect(screen.queryByText(/your date was/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/this category was closed that month/i)).not.toBeInTheDocument();
  });

  it("answers normally for a date that is merely recent", () => {
    renderTool();
    // The boundary is today, not "before the newest bulletin". A priority date
    // from last month is ordinary and must not trip the warning.
    setPriorityDate(TODAY);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByText(/this category was closed that month/i)).toBeInTheDocument();
  });

  it("keeps a withheld date off the chart as well as out of the verdict", () => {
    const { container } = renderTool();
    setPriorityDate("2027-05-25");
    // A 2027 date left in the y domain stretches the axis by years and
    // squashes the real series flat, so the drawing would misreport the very
    // movement it exists to show.
    expect(container.querySelector("line[stroke-dasharray]")).toBeNull();
  });

  it("draws the priority-date line for a valid date", () => {
    const { container } = renderTool();
    setPriorityDate("2014-01-01");
    expect(container.querySelector("line[stroke-dasharray]")).not.toBeNull();
  });
});

describe("PriorityDateEstimator: staleness", () => {
  it("names the bulletin it is reading with no date entered", () => {
    renderTool();
    expect(screen.getByText(/reading the july 2026 visa bulletin/i)).toBeInTheDocument();
  });

  it("counts bulletins behind when USCIS supplies the current month", () => {
    renderTool({ currentBulletinMonth: "2026-09" });
    // Two, not one. The bulletin is forward-dated, so counting from the
    // calendar month alone understates the gap.
    expect(screen.getByText(/2 bulletins behind the current one/i)).toBeInTheDocument();
    expect(screen.getByText(/September 2026/)).toBeInTheDocument();
  });

  it("falls back to the calendar month when that read failed", () => {
    renderTool({ currentBulletinMonth: null });
    expect(screen.getByText(/one month behind August 2026/i)).toBeInTheDocument();
  });

  it("links the State Department's own current bulletin", () => {
    renderTool();
    const link = screen.getByRole("link", { name: /open the current visa bulletin/i });
    expect(link).toHaveAttribute(
      "href",
      "https://travel.state.gov/content/travel/en/legal/visa-law0/visa-bulletin.html",
    );
  });
});

describe("PriorityDateEstimator: USCIS chart guidance", () => {
  it("states which chart USCIS accepts, with dated provenance", () => {
    renderTool({ currentBulletinMonth: "2026-09", currentEmploymentChart: "Final Action Dates" });
    expect(
      screen.getByText(/employment-based adjustment of status filings must use the/i),
    ).toBeInTheDocument();
    expect(screen.getByText("Final Action Dates")).toBeInTheDocument();
    // Dated and attributed, or it is just an assertion.
    expect(screen.getByText(/read from uscis\.gov on August 25, 2026/i)).toBeInTheDocument();
    expect(
      screen.getByText(/publishes which chart controls, not the cutoff dates themselves/i),
    ).toBeInTheDocument();
  });

  it("flags when the selected chart is not the one USCIS accepts", () => {
    renderTool({ currentBulletinMonth: "2026-09", currentEmploymentChart: "Final Action Dates" });
    // Default selection is Final Action Dates, so nothing to flag yet.
    expect(screen.queryByText(/which is the other one/i)).not.toBeInTheDocument();

    selectByLabel(/^chart$/i, "datesForFiling");
    expect(screen.getByText(/which is the other one/i)).toBeInTheDocument();
  });

  it("says nothing at all when the USCIS read failed", () => {
    // Silence beats a stale or invented claim about what USCIS accepts.
    renderTool({ currentBulletinMonth: "2026-09", currentEmploymentChart: null });
    expect(screen.queryByText(/what uscis is accepting now/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/must use the/i)).not.toBeInTheDocument();
  });
});

describe("PriorityDateEstimator: notice ordering", () => {
  it("puts the staleness notice ABOVE the result, not in a footnote", () => {
    const { container } = renderTool({ currentBulletinMonth: "2026-09" });
    setPriorityDate("2013-06-01");

    const text = container.textContent!;
    const stalenessAt = text.indexOf("Reading the July 2026 visa bulletin");
    const verdictAt = text.indexOf("This category was closed that month");
    expect(stalenessAt).toBeGreaterThan(-1);
    expect(verdictAt).toBeGreaterThan(-1);
    // Document order is what a reader and a screen reader both follow.
    expect(stalenessAt).toBeLessThan(verdictAt);
  });

  it("puts an input warning above the staleness notice", () => {
    const { container } = renderTool({ currentBulletinMonth: "2026-09" });
    setPriorityDate("2027-05-25");
    const text = container.textContent!;
    expect(text.indexOf("is in the future")).toBeLessThan(
      text.indexOf("Reading the July 2026 visa bulletin"),
    );
  });
});

describe("PriorityDateEstimator: a closed category", () => {
  it("gives the reader their own position against the last published cutoff", () => {
    renderTool();
    setPriorityDate("2013-01-01");

    expect(screen.getByText(/this category was closed that month/i)).toBeInTheDocument();
    // "Closed" alone is a dead end. The last cutoff was 01SEP13 in the June
    // 2026 bulletin, and a 2013-01-01 date sits 243 days before it.
    // Scoped to the block under test: "June 2026" also appears in the
    // retrogression banner, so an unscoped getByText matches two nodes and
    // fails for a reason that has nothing to do with this behaviour.
    const heading = screen.getByText(/where your date stood before it closed/i);
    const block = heading.closest("div")!;
    expect(within(block).getByText(/September 1, 2013/)).toBeInTheDocument();
    expect(within(block).getByText(/June 2026/)).toBeInTheDocument();
    expect(within(block).getByText(/243 days earlier/)).toBeInTheDocument();
    expect(
      within(block).getByText(/would have been current in that month/i),
    ).toBeInTheDocument();
  });

  it("says how far short a later date fell", () => {
    renderTool();
    setPriorityDate("2014-01-01");
    expect(screen.getByText(/122 days later/)).toBeInTheDocument();
    expect(screen.getByText(/still had that much ground to cover/i)).toBeInTheDocument();
  });

  it("explains that October reopens the category", () => {
    renderTool();
    setPriorityDate("2013-01-01");
    expect(screen.getByText(/October starts a new fiscal year/i)).toBeInTheDocument();
    // And it must not promise the cutoff comes back to where it was.
    expect(screen.getByText(/(is(n’t| not)) obliged to return to where it stood/i)).toBeInTheDocument();
  });
});

describe("PriorityDateEstimator: chart and legend", () => {
  it("draws a bar for every month of an all-current category", () => {
    const { container } = renderTool();
    // EB-1 worldwide is C in every bulletin, so it has no dated points at all.
    // The figure used to be gated on having two DATED months, which meant the
    // one case the legend describes ("a green bar is a month the category was
    // current") was the one case that rendered nothing.
    selectByLabel(/category/i, "EB1");
    selectByLabel(/country of birth/i, "worldwide");

    const bars = chartBars(container);
    expect(bars.length).toBe(SERIES.length);
    bars.forEach((bar) => {
      expect(bar.getAttribute("fill")).toBe("var(--primary)");
    });
    expect(screen.getByText(/no bulletin in this range published a cutoff date/i)).toBeInTheDocument();
  });

  it("draws a red bar for a closed month and a green one for a current month", () => {
    const mixed = [
      bulletin("2026-03", "01JAN14"),
      bulletin("2026-04", "C"),
      bulletin("2026-05", "U"),
      bulletin("2026-06", "01SEP13"),
    ];
    const { container } = render(
      <PriorityDateEstimator bulletins={mixed} today={TODAY} />,
    );
    const fills = chartBars(container).map((r) => r.getAttribute("fill"));
    // Exactly the legend's claim: green for current, red for closed.
    expect(fills).toEqual(["var(--primary)", "var(--data-bad)"]);
  });

  it("breaks the line across a gap instead of interpolating through it", () => {
    // The gap has to sit INSIDE the series. The first version of this test
    // used a fixture whose only closed month was the LAST one, where joining
    // across the gap and breaking at it produce byte-identical output, so it
    // passed against a deliberately broken build.
    const gapped = [
      bulletin("2026-01", "01JAN14"),
      bulletin("2026-02", "01FEB14"),
      bulletin("2026-03", "U"),
      bulletin("2026-04", "01MAR14"),
      bulletin("2026-05", "01APR14"),
    ];
    const { container } = render(
      <PriorityDateEstimator bulletins={gapped} today={TODAY} />,
    );
    const svg = container.querySelector('svg[role="img"]')!;
    const polylines = [...svg.querySelectorAll("polyline")];
    // Two runs of two, not one run of four. A single polyline would draw a
    // smooth rise straight through the month the category was shut.
    expect(polylines.length).toBe(2);
    polylines.forEach((line) => {
      expect(line.getAttribute("points")!.trim().split(/\s+/).length).toBe(2);
    });
  });
});

describe("PriorityDateEstimator: selectors", () => {
  it("re-reads the series when the chart is switched", () => {
    renderTool();
    setPriorityDate("2014-01-01");
    // Final action for EB-2 India is U in the newest bulletin.
    expect(screen.getByText(/this category was closed that month/i)).toBeInTheDocument();

    selectByLabel(/^chart$/i, "datesForFiling");
    // Dates for filing is 01JAN15 throughout, so the same date is now current
    // and nothing of the closed-category answer may survive the switch.
    expect(screen.queryByText(/this category was closed that month/i)).not.toBeInTheDocument();
    expect(screen.getByText(/your date was current/i)).toBeInTheDocument();
    expect(screen.queryByText(/where your date stood before it closed/i)).not.toBeInTheDocument();
  });

  it("re-reads the series when the country is switched", () => {
    renderTool();
    setPriorityDate("2014-01-01");
    expect(screen.getByText(/this category was closed that month/i)).toBeInTheDocument();

    selectByLabel(/country of birth/i, "worldwide");
    expect(screen.getByText(/your date was current/i)).toBeInTheDocument();
  });

  it("keeps the retrogression banner accurate to the selected series", () => {
    renderTool();
    setPriorityDate("2014-01-01");
    // 2026-06 went backwards from 15JUL14 to 01SEP13, and 2026-07 went to U.
    expect(screen.getByText(/June 2026, July 2026/)).toBeInTheDocument();

    selectByLabel(/^chart$/i, "datesForFiling");
    expect(screen.queryByText(/this cutoff has gone backwards/i)).not.toBeInTheDocument();
  });
});
