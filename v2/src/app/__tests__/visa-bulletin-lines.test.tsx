import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/turso/publicData", () => ({ getVisaBulletins: vi.fn() }));
vi.mock("@/lib/turso/bulletinLine", () => ({ getLineCounts: vi.fn() }));
// Reads Turso for the freshness line; not what this file is about.
vi.mock("@/components/data/DataProvenance", () => ({
  DataProvenance: () => <div data-testid="provenance" />,
}));

import { getVisaBulletins } from "@/lib/turso/publicData";
import { getLineCounts } from "@/lib/turso/bulletinLine";
import LinePage, { generateMetadata, generateStaticParams } from "../(site)/(public)/visa-bulletin/categories/[line]/page";
import HubPage from "../(site)/(public)/visa-bulletin/categories/page";

/**
 * One bulletin line per page (`/visa-bulletin/categories/<line>`) and the hub
 * that lists them. The archive here is three fiscal years of EB-2 India and
 * EB-3 Other Workers for the rest of the world, enough for a full year, a
 * partial one, and a shut month.
 */

function month(ym: string, eb2india: string, ew3row: string) {
  return {
    bulletinMonth: ym,
    finalAction: { EB2: { india: eb2india, worldwide: "C" }, EW3: { worldwide: ew3row, india: "01JAN14" } },
    datesForFiling: { EB2: { india: "15JAN15", worldwide: "C" }, EW3: { worldwide: "01AUG22", india: "15JAN15" } },
  };
}

const ARCHIVE = [
  month("2024-09", "01JAN12", "01DEC20"),
  month("2024-10", "15JUN12", "01DEC20"),
  month("2025-03", "01MAY12", "15JAN21"),
  month("2025-09", "01JAN13", "15JUL21"),
  month("2025-10", "01FEB13", "15JUL21"),
  month("2026-06", "U", "01FEB22"),
  month("2026-09", "U", "01APR22"),
];

beforeEach(() => {
  vi.mocked(getVisaBulletins).mockResolvedValue(ARCHIVE as never);
  vi.mocked(getLineCounts).mockResolvedValue({
    awaiting: { asOf: "2026-06", count: 43689 },
    inventory: { asOf: "2026-08-05", available: { low: 3976, high: 4300 }, awaiting: { low: 1200, high: 1290 } },
  });
});

const params = (line: string) => ({ params: Promise.resolve({ line }) });

async function page(line: string) {
  return renderToStaticMarkup(await LinePage(params(line)));
}

describe("a bulletin line page", () => {
  it("lists a page for every category and country the archive holds, and nothing else", async () => {
    const slugs = (await generateStaticParams()).map((p) => p.line);
    expect(slugs).toHaveLength(2 * 5);
    expect(slugs).toContain("eb2-india");
    expect(slugs).toContain("eb3-other-workers-rest-of-world");
    expect(slugs.some((s) => s.startsWith("eb1"))).toBe(false);
  });

  it("404s from metadata for anything that isn't a line, before a byte streams", async () => {
    for (const bad of ["2026-09", "eb2-canada", "eb2"]) {
      await expect(generateMetadata(params(bad))).rejects.toThrow();
    }
  });

  it("names the line in the title within the length Google shows", async () => {
    const m = await generateMetadata(params("eb3-other-workers-rest-of-world"));
    const title = typeof m.title === "string" ? m.title : (m.title as { absolute: string }).absolute;
    expect(title).toContain("EB-3 Other Workers Rest of World");
    expect(String(m.description).length).toBeLessThanOrEqual(155);
  });

  it("prints both charts as the bulletin states them, and says when the line is shut", async () => {
    const html = await page("eb2-india");
    expect(html).toContain("Final action, September 2026");
    expect(html).toContain("Unavailable");
    expect(html).toContain("Jan 15, 2015");
    expect(html).toMatch(/went backwards or shut 2 times/);
  });

  it("walks the fiscal years newest first, marking the partial ones", async () => {
    const html = await page("eb2-india");
    const fy = [...html.matchAll(/FY(\d{4})/g)].map((m) => m[1]);
    expect(fy.slice(0, 3)).toEqual(["2026", "2025", "2024"]);
    // FY2025 runs Oct 2024 to Sep 2025, both held: a whole year, +200 days.
    expect(html).toContain("+200 days");
    // FY2024 holds one bulletin (Sep 2024); FY2026 holds October and September.
    expect(html).toMatch(/FY2024<span[^>]*> \(part\)/);
    expect(html).not.toMatch(/FY2026<span[^>]*> \(part\)/);
  });

  it("shows USCIS's own counts for the line, as ranges where cells are withheld", async () => {
    const html = await page("eb3-other-workers-rest-of-world");
    expect(html).toContain("43,689");
    expect(html).toContain("3,976 to 4,300");
    expect(vi.mocked(getLineCounts)).toHaveBeenCalledWith("EW3", "worldwide");
  });

  it("offers the green card line only for the lines it covers", async () => {
    expect(await page("eb3-other-workers-rest-of-world")).toContain("/tools/green-card-line?category=EW3&amp;country=worldwide");
    vi.mocked(getVisaBulletins).mockResolvedValue([
      ...ARCHIVE.map((b) => ({ ...b, finalAction: { ...b.finalAction, EB1: { india: "01JAN23" } } })),
    ] as never);
    // The bare path is in every tool footer's list; the deep link carries the line.
    expect(await page("eb1-india")).not.toContain("/tools/green-card-line?");
  });

  it("links the same category's other countries and the country's other categories", async () => {
    const html = await page("eb2-india");
    expect(html).toContain('href="/visa-bulletin/categories/eb2-china"');
    expect(html).toContain('href="/visa-bulletin/categories/eb3-other-workers-india"');
    expect(html).not.toContain('href="/visa-bulletin/categories/eb2-india"');
  });

  it("keeps table cells apart in textContent (the glued-text class)", async () => {
    const html = await page("eb2-india");
    expect(html.replace(/<[^>]+>/g, "")).not.toMatch(/FY2025Jun/);
  });
});

describe("the categories hub", () => {
  it("links every line the archive holds, once in the grid and once in the list", async () => {
    const html = renderToStaticMarkup(await HubPage());
    const hrefs = [...html.matchAll(/href="(\/visa-bulletin\/categories\/[a-z0-9-]+)"/g)].map((m) => m[1]);
    expect(new Set(hrefs).size).toBe(10);
    expect(hrefs.filter((h) => h === "/visa-bulletin/categories/eb2-india")).toHaveLength(2);
  });
});
