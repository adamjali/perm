import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db/visaRefusals", () => ({ refusalSummary: vi.fn(), refusalsYear: vi.fn(), refusalsByCode: vi.fn() }));
// Reads the database for the freshness line; not what this file is about.
vi.mock("@/components/data/DataProvenance", () => ({ DataProvenance: () => <div data-testid="provenance" /> }));

import { refusalSummary, refusalsByCode, refusalsYear } from "@/lib/db/visaRefusals";
import type { RefusalRow, RefusalSummary } from "@/lib/visaRefusals";
import Page, { metadata } from "../(site)/(public)/visa-refusals/page";
import REAL from "./visa-refusals.fixture.json";

/**
 * /visa-refusals on State's real tables: the fixture is what the loader read from all 25 of State's
 * PDFs, FY2000 to FY2024 (every year reconciled against its total line), with FY2024's grounds whole.
 */
async function html() {
  const out = renderToStaticMarkup(await Page());
  return { out, text: out.replace(/<[^>]+>/g, " ").replace(/&#x27;/g, "'").replace(/&amp;/g, "&").replace(/\s+/g, " ") };
}

beforeEach(() => {
  vi.mocked(refusalsYear).mockClear();
  vi.mocked(refusalSummary).mockResolvedValue(REAL.summary as unknown as RefusalSummary);
  vi.mocked(refusalsYear).mockResolvedValue(REAL.newest as RefusalRow[]);
  vi.mocked(refusalsByCode).mockResolvedValue(REAL.tracked as RefusalRow[]);
});

describe("/visa-refusals", () => {
  it("leads with public charge, as State counted it in its newest year", async () => {
    const { text } = await html();
    expect(text).toContain("Why visas are refused");
    expect(text).toMatch(/Public charge, immigrant visas, FY2024 1,008 found ineligible; 846 findings overcome/);
    expect(text).toMatch(/Public charge, nonimmigrant visas, FY2024 74 found ineligible; 30 overcome/);
    expect(text).toContain("3,010,544");
    expect(vi.mocked(refusalsYear)).toHaveBeenCalledWith(2024);
  });

  it("draws public charge for every year held, and states its extremes without a cause", async () => {
    const { out, text } = await html();
    const years = [...out.matchAll(/data-tip="FY(\d{4})\n[\d,]+ found ineligible\n/g)].map((m) => Number(m[1]));
    expect(new Set(years).size).toBe(25);
    expect(out).toContain("FY2000\n46,450 found ineligible\n30,165 overcome");
    expect(out).toContain("FY2019\n20,941 found ineligible\n9,622 overcome");
    expect(text).toContain("Most findings: 46,450 in FY2000. Fewest: 452 in FY2023. FY2024: 1,008.");
    expect(text).not.toMatch(/because|due to the rule|caused/i);
  });

  it("shows State's dash as N/A, never 0, and State's own total line", async () => {
    const { out } = await html();
    const row214 = out.slice(out.indexOf(">214(b)<"), out.indexOf("</tr>", out.indexOf(">214(b)<")));
    expect(row214).toContain("N/A");
    expect(row214).not.toMatch(/>0 </);
    expect(out).toContain("State&#x27;s total line");
    expect(out).toContain("273,845");
  });

  it("says where State's own total and rows part, from the load's record", async () => {
    const { text } = await html();
    expect(text).toContain("leaves out the table's first row, 101(a)(27)(D)(i)");
  });

  it("links the exact file its newest year came from", async () => {
    const { out } = await html();
    expect(out).toContain('href="https://travel.state.gov/content/dam/visas/Statistics/AnnualReports/FY2024AnnualReport/Table%20XIX.pdf"');
  });

  it("says the tables aren't loaded rather than showing an empty page", async () => {
    vi.mocked(refusalSummary).mockResolvedValue(null);
    const { text } = await html();
    expect(text).toContain("aren't loaded yet");
    expect(vi.mocked(refusalsYear)).not.toHaveBeenCalled();
  });

  it("keeps cells apart and its title and description inside what search shows", async () => {
    const { out } = await html();
    // Tags stripped to nothing, as textContent reads them: a space here would hide the glue.
    expect(out.replace(/<[^>]+>/g, "")).not.toMatch(/\d,\d{3}\d/);
    expect(`${metadata.title} | PERM Tracker`.length).toBeLessThanOrEqual(60);
    expect(String(metadata.description).length).toBeLessThanOrEqual(155);
    expect(metadata.alternates?.canonical).toBe("/visa-refusals");
  });
});
