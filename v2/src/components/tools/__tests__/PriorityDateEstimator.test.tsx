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

/** What `categoriesIn` returns for the fixtures above. */
const CODES = ["EB1", "EB2"] as const;

/**
 * Note the spread. `Partial<ComponentProps<...>>` does NOT make TypeScript
 * demand the required props at this call site, because a spread of a
 * non-fresh variable is assumed to supply anything missing. That is the same
 * hole that lets an extra validator field typecheck against a Convex table,
 * and it is why adding a required prop to the component surfaced here as a
 * runtime crash rather than a red typecheck. Defaults go in the object below,
 * where the compiler can see them.
 */
function renderTool(props: Partial<React.ComponentProps<typeof PriorityDateEstimator>> = {}) {
  return render(
    <PriorityDateEstimator
      bulletins={SERIES}
      categoryCodes={CODES}
      today={TODAY}
      {...props}
    />,
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
function chartSvg(container: HTMLElement): SVGSVGElement {
  const svg = container.querySelector('svg[role="img"]');
  expect(svg).not.toBeNull();
  return svg as SVGSVGElement;
}

/**
 * The columns that say "these priority dates qualified", by their own fill.
 *
 * Counting every `rect` under the figure also collects the clip rect, the
 * hatch pattern's tile, the invisible hover surfaces and the cap rules, so a
 * bare count comes back inflated and reads as a product bug.
 */
function qualifyingColumns(container: HTMLElement): SVGRectElement[] {
  return [...chartSvg(container).querySelectorAll("rect")].filter(
    (r) =>
      r.getAttribute("fill") === "var(--data-good)" &&
      r.getAttribute("fill-opacity") === "0.16",
  );
}

/** The columns that say "shut", which carry a pattern rather than a fill. */
function closedColumns(container: HTMLElement): SVGRectElement[] {
  return [...chartSvg(container).querySelectorAll("rect")].filter((r) =>
    (r.getAttribute("fill") ?? "").startsWith("url(#"),
  );
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
    // And it must not promise the cutoff comes back to where it was. The
    // wording changed in the 2026-08-26 voice pass; the assertion this test
    // exists for did not.
    expect(
      screen.getByText(/can reopen anywhere, earlier or later than where it stood/i),
    ).toBeInTheDocument();
  });
});

describe("PriorityDateEstimator: chart and legend", () => {
  it("draws a full-height column for every month of an all-current category", () => {
    const { container } = renderTool();
    // EB-1 worldwide is C in every bulletin, so it has no dated points at all.
    // The figure used to be gated on having two DATED months, which meant the
    // one case the legend describes was the one case that rendered nothing.
    selectByLabel(/^category$/i, "EB1");
    selectByLabel(/country of birth/i, "worldwide");

    const cols = qualifyingColumns(container);
    expect(cols.length).toBe(SERIES.length);
    // Current means every priority date qualified, so the column is the whole
    // plot: the cutoff for that month genuinely is "everything".
    const heights = new Set(cols.map((c) => c.getAttribute("height")));
    expect(heights.size).toBe(1);
    expect(closedColumns(container)).toHaveLength(0);
  });

  it("separates closed from current by TEXTURE, not by a second opacity", () => {
    const mixed = [
      bulletin("2026-03", "01JAN14"),
      bulletin("2026-04", "C"),
      bulletin("2026-05", "U"),
      bulletin("2026-06", "01SEP13"),
    ];
    const { container } = render(
      <PriorityDateEstimator bulletins={mixed} categoryCodes={CODES} today={TODAY} />,
    );

    // Two dated months and one current month qualify somebody; the closed one
    // qualifies nobody and is drawn as a hatch instead of a fill.
    expect(qualifyingColumns(container)).toHaveLength(3);
    expect(closedColumns(container)).toHaveLength(1);

    // The defect this pins: two states that differ only in how faint they are
    // get read as one state at two strengths, which is how a closed month and
    // an open one once shared a caption. Nothing may separate them by opacity
    // alone.
    const closedFill = closedColumns(container)[0]!.getAttribute("fill")!;
    const openFill = qualifyingColumns(container)[0]!.getAttribute("fill")!;
    expect(closedFill).not.toBe(openFill);
    expect(closedFill).toMatch(/^url\(#/);
  });

  it("keys every mark on the drawing, and only the marks on it", () => {
    const mixed = [
      bulletin("2026-03", "01JAN14"),
      bulletin("2026-04", "C"),
      bulletin("2026-05", "U"),
      bulletin("2026-06", "01SEP13"),
    ];
    const { container } = render(
      <PriorityDateEstimator bulletins={mixed} categoryCodes={CODES} today={TODAY} />,
    );
    const caption = container.querySelector("figcaption")!;
    expect(caption.textContent).toContain("Closed, no visa numbers");
    expect(caption.textContent).toContain("Current, open to every date");
    expect(caption.textContent).toContain("The cutoff that month");
    // No priority date entered, so no dashed line exists to key.
    expect(caption.textContent).not.toContain("Your priority date");

    // Every swatch is drawn, never named. A word tinted with one token beside
    // a mark filled with another is two colours claiming to be one.
    expect(caption.querySelectorAll("svg").length).toBeGreaterThanOrEqual(3);
  });

  it("drops the closed key entirely when nothing on the drawing is closed", () => {
    const open = [
      bulletin("2026-03", "01JAN14"),
      bulletin("2026-04", "01FEB14"),
    ];
    const { container } = render(
      <PriorityDateEstimator bulletins={open} categoryCodes={CODES} today={TODAY} />,
    );
    expect(container.querySelector("figcaption")!.textContent).not.toContain(
      "Closed, no visa numbers",
    );
  });

  it("names both axes", () => {
    // Two different date scales on one drawing. Unlabelled they are
    // indistinguishable, and "is the axis right?" is unanswerable.
    const { container } = renderTool();
    const svg = chartSvg(container);
    const labels = [...svg.querySelectorAll("text")].map((t) => t.textContent);
    expect(labels).toContain("Bulletin month");
    expect(labels).toContain("Cutoff date");
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
      <PriorityDateEstimator bulletins={gapped} categoryCodes={CODES} today={TODAY} />,
    );
    const polylines = [...chartSvg(container).querySelectorAll("polyline")];
    // Two runs of two, not one run of four. A single polyline would draw a
    // smooth rise straight through the month the category was shut.
    expect(polylines.length).toBe(2);
    polylines.forEach((line) => {
      expect(line.getAttribute("points")!.trim().split(/\s+/).length).toBe(2);
    });
  });
});

describe("PriorityDateEstimator: the priority-date line", () => {
  it("labels the line at the line's own coordinate", () => {
    const { container } = renderTool();
    setPriorityDate("2014-01-01");
    const svg = chartSvg(container);
    const line = svg.querySelector("line[stroke-dasharray]") as SVGLineElement;
    expect(line).not.toBeNull();

    const label = [...svg.querySelectorAll("text")].find((t) =>
      t.textContent!.startsWith("Your date,"),
    );
    expect(label).toBeDefined();
    // A label parked at a fixed offset names whatever date happens to sit
    // there instead of the one it belongs to. Same drawing, same y.
    const lineY = Number(line.getAttribute("y1"));
    const labelY = Number(label!.getAttribute("y"));
    expect(Math.abs(labelY - lineY)).toBeLessThanOrEqual(14);
  });

  it("keeps the axis on the cutoffs when the date is years past them", () => {
    const { container } = renderTool();
    // Cutoffs here run 2013 to 2014. Stretching the axis to reach a 2024 date
    // squashes the whole series into a sliver and destroys the movement the
    // chart exists to show.
    setPriorityDate("2024-06-01");
    expect(chartSvg(container).querySelector("line[stroke-dasharray]")).toBeNull();

    // An absence in a drawing has to be explained before the drawing, not
    // after it and not at all.
    //
    // Compared by document position, not by string index. The first version
    // searched for "Bulletin month" and found the sentence introducing the
    // axes rather than the axis label itself, so it measured the note against
    // a string that sits above it either way.
    const note = [...container.querySelectorAll("p")].find((el) =>
      el.textContent!.includes("sits off the top of the chart"),
    );
    expect(note).toBeDefined();
    const figure = container.querySelector("figure")!;
    expect(
      note!.compareDocumentPosition(figure) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("draws the line when the date is inside the plotted range", () => {
    const { container } = renderTool();
    setPriorityDate("2014-01-01");
    expect(chartSvg(container).querySelector("line[stroke-dasharray]")).not.toBeNull();
    expect(container.textContent).not.toContain("sits off the top of the chart");
  });
});

describe("PriorityDateEstimator: the category selector", () => {
  it("offers only the categories the archive actually holds", () => {
    // Six were hardcoded and three exist. Picking one of the missing three
    // left every cell lookup undefined, so the verdict, the retrogression
    // note and the whole chart stopped rendering with no warning anywhere
    // near the control that caused it.
    renderTool();
    const select = screen.getByLabelText(/^category$/i) as HTMLSelectElement;
    const values = [...select.options].map((o) => o.value);
    expect(values).toEqual(["EB1", "EB2"]);
    expect(values).not.toContain("EB5");
  });

  it("opens on a category the archive holds when EB-2 is absent", () => {
    renderTool({ categoryCodes: ["EB1"] });
    const select = screen.getByLabelText(/^category$/i) as HTMLSelectElement;
    expect(select.value).toBe("EB1");
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
