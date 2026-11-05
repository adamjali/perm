import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/nivIssuances", () => ({ postNiv: vi.fn() }));

import { WorkVisasView } from "../WorkVisasAtPost";
import { monthsTo } from "@/lib/consular/niv";

/** A consulate's work visas: the newest month's figures, H-1B and L-1 month by month, then every class. */

const months = monthsTo("2026-02", 12);
const byMonth = new Map<string, Record<string, number>>([
  ["2025-12", { H1B: 40, L1: 6, K1: 3 }],
  ["2026-01", { H1B: 52, L1: 9, "B1/B2": 1200 }],
  ["2026-02", { H1B: 61, L1: 11, H4: 30, L2: 12, K1: 42, "B1/B2": 1410, F1: 80 }],
]);
// The site holds three of the twelve months' tables; the rest must draw as gaps.
const data = { months, held: ["2025-12", "2026-01", "2026-02"], byMonth };

function render(d = data) {
  const out = renderToStaticMarkup(<WorkVisasView data={d} name="Mumbai" />);
  return { out, text: out.replace(/<[^>]+>/g, " ").replace(/&#x27;/g, "'").replace(/\s+/g, " ") };
}

describe("work visas at a consulate", () => {
  it("leads with the newest month's H-1B, L-1 and every work visa", () => {
    const { text } = render();
    expect(text).toContain("Work visas issued here");
    expect(text).toMatch(/H-1B, February 2026 61 153 in the 12 months to February 2026/);
    expect(text).toMatch(/L-1, February 2026 11 26 in the 12 months/);
    // H-1B 61, H-4 30, L-1 11, L-2 12: K-1, visitors and students aren't work visas.
    expect(text).toMatch(/Every work visa, February 2026 114 /);
  });

  it("charts H-1B and L-1 month by month, a month not held as a gap and never a zero", () => {
    const { out } = render();
    expect(out).toContain("Mumbai, February 2026\n61 H-1B\n11 L-1");
    expect((out.match(/No table for this month/g) ?? []).length).toBeGreaterThanOrEqual(9);
  });

  it("lists every class, work visas first, K-1 labelled as a fiancé(e) visa", () => {
    const { out, text } = render();
    const order = ["H-1B", "H-4", "L-1", "L-2", "B-1/B-2", "F-1", "K-1 fiancé(e)"].map((n) => out.indexOf(`>${n} <`));
    expect(order.every((i) => i > 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(text).toContain("fiancé(e) of a U.S. citizen");
  });

  it("links why visas are refused", () => {
    expect(render().out).toContain('href="/visa-refusals"');
  });

  it("says so when the post issued none in the months shown", () => {
    const { text } = render({ months, held: [], byMonth: new Map() });
    expect(text).toContain("show no nonimmigrant visas issued in Mumbai from March 2025 to February 2026");
    expect(text).not.toContain("Every visa class issued here");
  });
});
