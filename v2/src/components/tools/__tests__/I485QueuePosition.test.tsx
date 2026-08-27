import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import { I485QueuePosition } from "../I485QueuePosition";
import { CELLS } from "@/lib/i485/__tests__/cells.fixture";

// The component reads and writes the query string. Neither needs to work for
// these assertions, but both have to exist or every render throws.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

/** The newest Dates for Filing chart, as the bulletin publishes it. */
const FILING_CHART = {
  EB1: { worldwide: "C", china: "01DEC23", india: "01DEC23", mexico: "C", philippines: "C" },
  EB2: { worldwide: "C", china: "01JAN22", india: "15JAN15", mexico: "C", philippines: "C" },
  EB3: { worldwide: "C", china: "08JAN22", india: "15JAN15", mexico: "C", philippines: "01JAN24" },
};

/**
 * The page's whole argument is that the answer is a RANGE, so these pin the
 * three states that argument produces and the one it refuses to produce.
 *
 * Fixture is the real 2026-08-05 release for the pairs involved, so the
 * figures asserted below are USCIS's own.
 */

const OPTIONS = [
  { country: "China", categories: ["EW3", "EB1"] },
  { country: "India", categories: ["CRW", "EB3", "EB1", "EB2"] },
  { country: "Mexico", categories: ["EB5R"] },
  { country: "Philippines", categories: ["CRW"] },
  { country: "Rest of the World", categories: ["EB2"] },
];

const TREND = [
  { asOf: "2026-05-06", total: 244422 },
  { asOf: "2026-06-06", total: 283367 },
  { asOf: "2026-07-06", total: 264158 },
  { asOf: "2026-08-05", total: 263975 },
];

function renderTool(props: Partial<React.ComponentProps<typeof I485QueuePosition>> = {}) {
  return render(
    <I485QueuePosition
      cells={CELLS}
      options={OPTIONS}
      asOf="2026-08-05"
      trend={TREND}
      filingChart={FILING_CHART}
      filingChartMonth="2026-09"
      {...props}
    />,
  );
}

function select(label: RegExp, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

describe("I485QueuePosition", () => {
  it("opens on a real answer, presented as two figures of equal weight", () => {
    // India EB2 at 2013-01. Never one number with a footnote: the floor and
    // the ceiling are both true and neither is the answer on its own.
    renderTool();
    expect(screen.getByText(/at least/i)).toBeInTheDocument();
    expect(screen.getByText(/at most/i)).toBeInTheDocument();
    const low = screen.getByText(/at least/i).parentElement?.textContent ?? "";
    const high = screen.getByText(/at most/i).parentElement?.textContent ?? "";
    expect(low).not.toBe(high);
  });

  it("states the suppressed-cell count and what it means", () => {
    renderTool();
    select(/priority date year/i, "2012");
    select(/priority date month/i, "6");
    // 184 counted + 49 withheld cells = 233 to 674, straight from the release.
    // Each figure appears twice on purpose: once as the headline and once as
    // the bar's tick label, which is the point of the next test.
    expect(screen.getAllByText("233").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("674").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("184")).toBeInTheDocument();
    expect(screen.getByText("49")).toBeInTheDocument();
    expect(screen.getByText(/between 1 and 10 applications/i)).toBeInTheDocument();
  });

  it("puts each tick label at the coordinate its own figure occupies", () => {
    // A label parked at a fixed edge while its value sits elsewhere is the
    // defect this repo booked on DeadlineWindowDiagram, where a rail label sat
    // 204 units from the date it named. Here low/high = 233/674 = 34.57%, so
    // the low tick must be at 34.57% of the bar and nowhere else.
    renderTool();
    select(/priority date year/i, "2012");
    select(/priority date month/i, "6");
    const low = screen
      .getAllByText("233")
      .find((el) => el.tagName === "SPAN" && el.style.left);
    expect(low).toBeDefined();
    expect(parseFloat(low!.style.left)).toBeCloseTo((233 / 674) * 100, 4);
  });

  it("keeps the low tick but drops its label when the two would collide", () => {
    // Rest-of-the-World EB2 is 99.5% solid: the two figures are 216 apart on a
    // bar 42,086 wide, so their labels would sit on top of each other. The
    // TICK stays, so the coordinate is still shown.
    renderTool();
    select(/country of chargeability/i, "Rest of the World");
    select(/priority date year/i, "2024");
    select(/priority date month/i, "6");
    const ticks = document.querySelectorAll("span.absolute.top-0");
    expect(ticks.length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("16,711")).toHaveLength(1);
  });

  it("gives one figure, not a range of one value, where nothing was suppressed", () => {
    // India EB1 has no withheld cell anywhere, so "at least X, at most X"
    // would be an absurd way to report an exact count.
    renderTool();
    select(/preference category/i, "EB1");
    select(/priority date year/i, "2023");
    select(/priority date month/i, "1");
    expect(screen.queryByText(/at least/i)).not.toBeInTheDocument();
    expect(screen.getByText(/^ahead of you$/i)).toBeInTheDocument();
    expect(screen.getByText(/suppressed no cell in this span/i)).toBeInTheDocument();
  });

  it("withholds a position entirely when the date is past everything published", () => {
    // India EB2's last published cell is 2015-01. At 2019 there is no
    // position inside the queue, and inventing one from the category total
    // is exactly what this refuses to do.
    renderTool();
    select(/priority date year/i, "2019");
    expect(
      screen.getByText(/USCIS doesn’t publish this queue past January 2015/i),
    ).toBeInTheDocument();
    expect(screen.queryByText(/at least/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/at most/i)).not.toBeInTheDocument();
  });

  it("catches a date inside the last published YEAR but past its last month", () => {
    // The case the read layer's year-level `outsideCoverage` misses. 33 of
    // the 47 pairs stop before December, so this is the common shape.
    renderTool();
    select(/priority date year/i, "2015");
    select(/priority date month/i, "6");
    expect(
      screen.getByText(/USCIS doesn’t publish this queue past January 2015/i),
    ).toBeInTheDocument();
  });

  it("explains beyond-published as filing not having opened yet", () => {
    // The modal state for a real visitor, and the lead measured why it happens:
    // India EB-2's Dates for Filing chart stands at 15JAN15 and USCIS publishes
    // inventory through 2015, the same boundary from two sides. Nobody at a
    // 2019 date has been allowed to file, so there is nothing to count.
    renderTool();
    select(/priority date year/i, "2019");
    expect(screen.getByText(/filing hasn’t opened for this priority date yet/i)).toBeInTheDocument();
    expect(screen.getByText(/January 15, 2015/)).toBeInTheDocument();
    expect(screen.getByText(/September 2026 bulletin/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /track that cutoff/i })).toHaveAttribute(
      "href",
      "/tools/priority-date-calculator",
    );
  });

  it("does not claim a filing gate where the category is current", () => {
    // Rest-of-the-World EB2 reads C, so filing is open to every priority date
    // and "filing hasn't opened yet" would be false.
    //
    // The month matters and the first version of this test got it wrong: ROW
    // EB2's last published cell is 2026-07, so January 2026 is INSIDE the
    // published span and never enters this branch at all. The test passed
    // while asserting nothing, and a probe that treated "C" as a date stayed
    // green. August 2026 is the first month past the span.
    renderTool();
    select(/country of chargeability/i, "Rest of the World");
    select(/priority date year/i, "2026");
    select(/priority date month/i, "8");
    expect(screen.getByText(/USCIS doesn’t publish this queue past July 2026/i)).toBeInTheDocument();
    expect(screen.queryByText(/filing hasn’t opened/i)).not.toBeInTheDocument();
  });

  it("orders the categories by preference, not alphabetically by code", () => {
    // The source sorts alphabetically, which put "Religious worker" above EB-1
    // and stranded EW-3 behind the EB-5 set-asides, on a site whose traffic is
    // almost entirely EB-2 and EB-3.
    renderTool();
    const shown = Array.from(
      (screen.getByLabelText(/preference category/i) as HTMLSelectElement).options,
    ).map((o) => o.value);
    expect(shown).toEqual(["EB1", "EB2", "EB3", "CRW"]);
  });

  it("counts how many are behind you, from published figures only", () => {
    // India EB2 at 2012-06: 27,736 counted in the category, 184 counted ahead,
    // 49 withheld cells in the category, 49 of them ahead. So behind is
    // 27,552 counted with no withheld cells left over, an exact figure.
    renderTool();
    select(/priority date year/i, "2012");
    select(/priority date month/i, "6");
    const band = screen.getByText(/^behind you$/i).parentElement;
    expect(band?.textContent).toContain("27,552");
    expect(screen.getByText(/anyone who hasn’t filed yet isn’t in this figure/i)).toBeInTheDocument();
  });

  it("says nobody is necessarily behind you, rather than implying it", () => {
    renderTool();
    select(/priority date year/i, "2019");
    expect(screen.getByText(/doesn’t mean nobody is behind you/i)).toBeInTheDocument();
  });

  it("never prints a bare zero for a category USCIS publishes as all-suppressed", () => {
    // Mexico EB5R has 0 counted and 21 withheld cells. "0 pending" would be
    // false about a category holding between 21 and 210 applications.
    renderTool();
    select(/country of chargeability/i, "Mexico");
    const band = screen.getByText(/the whole category/i).parentElement;
    expect(band?.textContent).toContain("21 to 210");
    expect(screen.getByText(/USCIS withheld every cell in this category/i)).toBeInTheDocument();
  });

  it("keeps the category selection valid when the country changes", () => {
    // Mexico publishes no EB2 in this fixture, so the selection has to fall
    // back rather than compute against a pair that does not exist.
    renderTool();
    select(/preference category/i, "EB2");
    select(/country of chargeability/i, "Mexico");
    const categorySelect = screen.getByLabelText(/preference category/i) as HTMLSelectElement;
    expect(categorySelect.value).toBe("EB5R");
    expect(screen.queryByText(/being fetched/i)).not.toBeInTheDocument();
  });

  it("falls back to the head of the ordered list, not the raw array", () => {
    // China declares ["EW3", "EB1"], so an unsorted `categories[0]` fallback
    // lands on EW-3 while the ordered one lands on EB-1. That raw-array
    // fallback is what shipped first, and on the real data it put a visitor on
    // "Religious worker".
    //
    // The tool otherwise REMEMBERS a selection and restores it when a country
    // supports it again, which is why this has to be a category China lacks.
    renderTool();
    select(/country of chargeability/i, "China"); // default EB2 is unavailable here
    const sel = screen.getByLabelText(/preference category/i) as HTMLSelectElement;
    expect(sel.value).toBe("EB1");
    expect(sel.value).toBe(sel.options[0]!.value);
  });

  it("labels the release-by-release figures as a floor and as the whole system", () => {
    renderTool();
    expect(screen.getByText(/across all countries and categories/i)).toBeInTheDocument();
    expect(screen.getByText(/makes each\s+figure a floor/i)).toBeInTheDocument();
  });

  it("narrates no single step in the release series", () => {
    // The series carries a 19,209 move from June to July that nothing here can
    // explain, and an earlier version narrated the 183 move two rows below it
    // while ignoring that one. Pointing at either is worse than pointing at
    // neither, so the caption describes what the series IS.
    renderTool();
    expect(screen.queryByText(/fell by|rose by/i)).not.toBeInTheDocument();
    expect(screen.getByText(/moves with both new filings and decisions/i)).toBeInTheDocument();
  });

  it("renders an empty state pointing at USCIS when the release has not landed", () => {
    // Deploy skew: a frontend live ahead of its data.
    renderTool({ cells: {}, options: [], trend: [] });
    expect(screen.getByText(/being fetched/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /USCIS publishes it directly/i })).toHaveAttribute(
      "href",
      expect.stringContaining("uscis.gov"),
    );
  });

  it("describes the bar in text for anyone not reading the drawing", () => {
    renderTool();
    const bar = screen.getByRole("img");
    expect(bar).toHaveAttribute("aria-label", expect.stringContaining("cells were withheld by USCIS"));
  });
});
