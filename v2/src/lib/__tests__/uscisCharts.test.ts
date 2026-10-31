import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { pageText, parseUscisCharts } from "../uscisCharts";

// USCIS's own page, read Oct 31 2026 and trimmed to its two months' notices.
const PAGE = readFileSync(join(__dirname, "../__fixtures__/uscis-aos-filing-charts-2026-10-31.html"), "utf8");

describe("parseUscisCharts on USCIS's own page", () => {
  it("reads the newest month and the chart each kind of filing uses", () => {
    expect(parseUscisCharts(PAGE)).toEqual({ month: "2026-11", employment: "Dates for Filing", family: "Dates for Filing" });
  });

  it("reads past the non-breaking space USCIS puts inside the sentence", () => {
    expect(PAGE).toContain("you must use the&nbsp;");
    expect(pageText("use the&nbsp; Dates for Filing chart")).toBe("use the Dates for Filing chart");
  });

  it("reports a chart only for the month its own sentence names", () => {
    const onlyOctober = PAGE.replace(/Visa Bulletin for\s*November 2026/g, "Visa Bulletin for September 2026");
    expect(parseUscisCharts(onlyOctober)).toEqual({ month: "2026-11", employment: null, family: null });
  });

  it("tells the two kinds of filing apart", () => {
    const html =
      "<h2>USCIS December 2026 Adjustment of Status Filing Charts</h2>" +
      "<p>For all family-sponsored preference categories, you must use the Dates for Filing chart in the Department of State Visa Bulletin for December 2026.</p>" +
      "<p>For all employment-based preference categories, you must use the Final Action Dates chart in the Department of State Visa Bulletin for December 2026.</p>";
    expect(parseUscisCharts(html)).toEqual({ month: "2026-12", employment: "Final Action Dates", family: "Dates for Filing" });
  });

  it("is null for a page that names no month", () => {
    expect(parseUscisCharts("<p>Page not found</p>")).toBeNull();
  });
});
