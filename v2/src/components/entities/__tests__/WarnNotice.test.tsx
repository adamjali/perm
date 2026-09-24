import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { WarnNoticeBand } from "../WarnNotice";
import type { WarnNotice } from "@/lib/turso/warn";

/**
 * Two notices one company files the same day for different sites used to
 * print identically, so the band read as a duplicate. New York lists seven
 * Morgan Stanley notices dated 2026-03-05, two of them for one worker each:
 * 100 Park Ave and One Penn Plaza. The site line is what tells them apart.
 */
const n = (over: Partial<WarnNotice> = {}): WarnNotice => ({
  id: "a",
  state: "NY",
  noticeDate: "2026-03-05",
  effectiveDate: "2026-05-27",
  company: "Morgan Stanley",
  kind: "Layoff, Permanent",
  employees: 1,
  county: "New York",
  industry: null,
  employerSlug: "morgan-stanley-co-llc",
  sourceUrl: "https://dol.ny.gov/warn-dashboard",
  site: "100 Park Ave, New York, NY, 10017",
  ...over,
});

describe("WarnNoticeBand", () => {
  it("prints two same-day notices for different sites differently", () => {
    const { container } = render(
      <WarnNoticeBand
        pageName="Morgan Stanley"
        rows={[n(), n({ id: "b", site: "One Penn Plaza, New York, NY, 10119" })]}
      />,
    );
    const items = [...container.querySelectorAll("li")].map((li) => li.textContent ?? "");
    expect(items).toHaveLength(2);
    expect(items[0]).not.toBe(items[1]);
    expect(items[0]).toContain("100 Park Ave, New York, NY, 10017");
    expect(items[1]).toContain("One Penn Plaza, New York, NY, 10119");
  });

  it("keeps a space between the report link and the site, so extractors do not glue them", () => {
    const { container } = render(<WarnNoticeBand pageName="Morgan Stanley" rows={[n()]} />);
    expect(container.querySelector("li")?.textContent).toContain("WARN report 100 Park Ave");
  });

  it("adds no site line when the state gives none", () => {
    const { container } = render(
      <WarnNoticeBand
        pageName="Acme"
        rows={[n({ id: "w", state: "WA", county: "Seattle", site: null, sourceUrl: "https://fortress.wa.gov/x.pdf" })]}
      />,
    );
    const li = container.querySelector("li");
    expect(li?.querySelector("span.block")).toBeNull();
    expect(li?.textContent).toContain("Seattle");
  });
});
