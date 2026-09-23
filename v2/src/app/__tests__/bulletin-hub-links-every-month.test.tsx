import { readFileSync } from "node:fs";
import { join } from "node:path";

import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { BulletinMonthStrip } from "@/components/data/BulletinMonthStrip";

/**
 * The bulletin hub links EVERY month page it holds.
 *
 * Until 2026-09-22 it linked one (the newest) and each month page linked only
 * its two neighbours, so 96 of 97 pages in `pages.xml` were reachable only by
 * walking an eighteen-hop chain, and Search Console read the current month as
 * "Discovered, never crawled". The strip is plain links in the HTML.
 */
const HUB = join(__dirname, "..", "(site)", "(public)", "visa-bulletin", "page.tsx");

function months(from: string, to: string): string[] {
  const out: string[] = [];
  let [y, m] = from.split("-").map(Number) as [number, number];
  const [ty, tm] = to.split("-").map(Number) as [number, number];
  while (y < ty || (y === ty && m <= tm)) {
    out.push(`${y}-${String(m).padStart(2, "0")}`);
    m += 1;
    if (m === 13) { m = 1; y += 1; }
  }
  return out;
}

describe("the bulletin hub's month strip", () => {
  const all = months("2019-10", "2026-09");

  it("spans the archive the site holds (control: 84 months, Oct 2019 to Sep 2026)", () => {
    expect(all).toHaveLength(84);
  });

  it("renders one link per month, to that month's page, newest marked current", () => {
    const { container } = render(<BulletinMonthStrip months={all} newest="2026-09" />);
    const links = [...container.querySelectorAll("a[href^='/visa-bulletin/']")];
    expect(links).toHaveLength(all.length);
    const hrefs = new Set(links.map((a) => a.getAttribute("href")));
    for (const ym of all) expect(hrefs.has(`/visa-bulletin/${ym}`)).toBe(true);
    const current = container.querySelectorAll("a[aria-current='page']");
    expect(current).toHaveLength(1);
    expect(current[0]!.getAttribute("href")).toBe("/visa-bulletin/2026-09");
  });

  it("orders years newest first and months oldest first within a year", () => {
    const { container } = render(<BulletinMonthStrip months={all} newest="2026-09" />);
    const hrefs = [...container.querySelectorAll("a[href^='/visa-bulletin/']")].map((a) => a.getAttribute("href")!);
    expect(hrefs[0]).toBe("/visa-bulletin/2026-01");
    expect(hrefs[8]).toBe("/visa-bulletin/2026-09");
    expect(hrefs[9]).toBe("/visa-bulletin/2025-01");
    expect(hrefs.at(-1)).toBe("/visa-bulletin/2019-12");
  });

  it("keeps mapped items apart in textContent (the glued-text class)", () => {
    const { container } = render(<BulletinMonthStrip months={["2026-08", "2026-09"]} newest="2026-09" />);
    expect(container.textContent).toContain("Aug 2026 Sep 2026");
  });

  it("is mounted on the hub with the whole series", () => {
    const src = readFileSync(HUB, "utf8");
    expect(src).toMatch(/<BulletinMonthStrip\s+months=\{series\.map\(/);
  });
});
