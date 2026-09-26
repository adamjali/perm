import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/turso/publicData", () => ({ getVisaBulletins: vi.fn() }));
// Reads Turso for the freshness line; not what this file is about.
vi.mock("@/components/data/DataProvenance", () => ({
  DataProvenance: () => <div data-testid="provenance" />,
}));
vi.mock("@/components/tools/BulletinAlertForm", () => ({ BulletinAlertForm: () => null }));

import { getVisaBulletins } from "@/lib/turso/publicData";
import MonthPage from "../(site)/(public)/visa-bulletin/[month]/page";

/**
 * The dates for filing chart began with the October 2015 bulletin. The archive
 * reaches back to October 2014 (2026-09-26), so a year of month pages has no
 * filing chart at all, and the first one that does has nothing to compare to.
 */

const FA = { EB2: { india: "01JAN09", worldwide: "C" }, EB3: { india: "01JAN04", worldwide: "01MAY15" } };
const DFF = { EB2: { india: "01JUL09", worldwide: "C" }, EB3: { india: "01JUL05", worldwide: "C" } };

const ARCHIVE = [
  { bulletinMonth: "2015-08", finalAction: FA, datesForFiling: {} },
  { bulletinMonth: "2015-09", finalAction: FA, datesForFiling: {} },
  { bulletinMonth: "2015-10", finalAction: FA, datesForFiling: DFF },
  { bulletinMonth: "2015-11", finalAction: FA, datesForFiling: DFF },
];

beforeEach(() => {
  vi.mocked(getVisaBulletins).mockResolvedValue(ARCHIVE as never);
});

async function page(month: string) {
  return renderToStaticMarkup(await MonthPage({ params: Promise.resolve({ month }) }));
}

describe("the dates for filing chart on an early bulletin", () => {
  it("says the chart did not exist yet instead of drawing an empty table", async () => {
    const html = await page("2015-09");
    expect(html).toContain("The dates for filing chart began with the October 2015 bulletin");
    expect(html).not.toMatch(/<h2[^>]*>Dates for filing<\/h2>/);
    expect(html).not.toContain("Dates for filing:");
  });

  it("draws the first chart without a move and without calling it the archive's first bulletin", async () => {
    const html = await page("2015-10");
    expect(html).toMatch(/<h2[^>]*>Dates for filing<\/h2>/);
    expect(html).toContain("The first bulletin to print this chart, so no move is shown.");
    expect(html).not.toContain("The dates for filing chart began");
  });

  it("compares the chart normally once there is a month before it", async () => {
    const html = await page("2015-11");
    expect(html).toContain("move since the October 2015 bulletin");
    expect(html).not.toContain("The first bulletin to print this chart");
  });
});
