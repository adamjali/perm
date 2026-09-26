import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import Page, { metadata } from "../(site)/(public)/h1b-lottery-odds/page";

/** The page is static and reads only `lib/h1bLottery.ts`; these pin what it says with it. */
const html = renderToStaticMarkup(<Page />);
const text = html
  .replace(/<[^>]+>/g, " ")
  .replace(/&#x27;/g, "'")
  .replace(/&amp;/g, "&")
  .replace(/\s+/g, " ");

describe("/h1b-lottery-odds", () => {
  it("leads with the newest year's selected share, and says FY2027 isn't in USCIS's table yet", () => {
    expect(text).toContain("FY2026 cap");
    expect(text).toContain("34.9%");
    expect(text).toMatch(/FY2027 lottery was the first weighted by wage; USCIS hasn't added it/);
  });

  it("prints every row of USCIS's table and every year on the chart", () => {
    expect((html.match(/<tr class="border-b border-border/g) ?? []).length).toBe(6);
    for (const fy of [2021, 2022, 2023, 2024, 2025, 2026]) expect(html).toContain(`FY${fy} `);
  });

  it("labels the wage-level odds as DHS's estimate, with the rule's citation", () => {
    expect(text).toContain("61.2%");
    expect(text).toContain("90 FR 60864");
    expect(text).toContain("not a count");
  });

  it("keeps table cells apart in textContent (the glued-text class)", () => {
    // Tags stripped to NOTHING, as textContent reads them: a space here would hide the glue.
    expect(html.replace(/<[^>]+>/g, "")).not.toMatch(/\d,\d{3}\d/);
  });

  it("keeps its title and description inside what search shows", () => {
    expect(`${metadata.title} | PERM Tracker`.length).toBeLessThanOrEqual(60);
    expect(String(metadata.description).length).toBeLessThanOrEqual(155);
  });
});
