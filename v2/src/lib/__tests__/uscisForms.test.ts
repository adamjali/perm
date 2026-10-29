import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  FORM_PAGES,
  approvedShare,
  formPage,
  formTotals,
  lineSeries,
  quarterSlots,
  slotShort,
  type FormQuarterRow,
} from "../uscisForms";

const row = (fy: number, quarter: number, title: string, over: Partial<FormQuarterRow> = {}): FormQuarterRow => ({
  fy,
  quarter,
  quarterEnd: "",
  title,
  received: 10,
  approved: 8,
  denied: 2,
  completed: 10,
  pending: 100,
  medianMonths: 5,
  ...over,
});

describe("one page per USCIS form", () => {
  it("has a unique slug per form, written the way the form is", () => {
    const slugs = FORM_PAGES.map((p) => p.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const p of FORM_PAGES) expect(p.slug, p.form).toBe(p.form.toLowerCase());
  });

  it("never names one USCIS title on two lines", () => {
    for (const p of FORM_PAGES) {
      const titles = p.lines.flatMap((l) => l.titles);
      expect(new Set(titles).size, p.form).toBe(titles.length);
    }
  });

  it("links only to pages that exist", () => {
    const app = join(process.cwd(), "src/app/(site)/(public)");
    for (const p of FORM_PAGES) {
      for (const l of p.links) {
        const page = l.href.startsWith("/guides/")
          ? join(process.cwd(), "content/guides", `${l.href.slice("/guides/".length)}.mdx`)
          : join(app, l.href, "page.tsx");
        expect(existsSync(page), `${p.form} -> ${l.href}`).toBe(true);
      }
    }
  });

  it("keeps DACA off the pages (the owner's call, Oct 24 2026)", () => {
    for (const p of FORM_PAGES) {
      expect(p.form).not.toBe("I-821D");
      for (const l of p.lines) expect(l.titles.join(" "), p.form).not.toMatch(/DACA/);
    }
  });

  it("finds a page by its slug, and nothing else", () => {
    expect(formPage("i-485")?.form).toBe("I-485");
    expect(formPage("I-485")).toBeNull();
    expect(formPage("i-821d")).toBeNull();
  });
});

describe("quarters, gaps and renamed rows", () => {
  it("runs from the first quarter held to the last, a missing one marked as a gap", () => {
    const slots = quarterSlots([{ fy: 2024, quarter: 1 }, { fy: 2024, quarter: 3 }, { fy: 2025, quarter: 1 }]);
    expect(slots.map((s) => `${slotShort(s)}${s.gap ? " gap" : ""}`)).toEqual([
      "FY24 Q1",
      "FY24 Q2 gap",
      "FY24 Q3",
      "FY24 Q4 gap",
      "FY25 Q1",
    ]);
  });

  it("joins a row across its rename and draws it only over the quarters it existed", () => {
    const rows = [
      row(2025, 3, "Old name", { medianMonths: 4 }),
      row(2025, 4, "Old name", { medianMonths: 5 }),
      row(2026, 1, "New name", { medianMonths: 6 }),
      row(2026, 1, "Something else"),
      row(2026, 2, "Something else"),
    ];
    const slots = quarterSlots(rows);
    const joined = lineSeries(rows, { key: "x", label: "x", titles: ["New name", "Old name"] }, slots);
    expect(joined.map((p) => p.row?.medianMonths)).toEqual([4, 5, 6]);
    // A line that ends before the others doesn't run on as missing quarters.
    const old = lineSeries(rows, { key: "o", label: "o", titles: ["Old name"] }, slots);
    expect(old.map((p) => slotShort(p.slot))).toEqual(["FY25 Q3", "FY25 Q4"]);
    expect(lineSeries(rows, { key: "n", label: "n", titles: ["Nowhere"] }, slots)).toEqual([]);
  });

  it("keeps a quarter no workbook covers as a gap inside a line, never a zero", () => {
    const rows = [row(2024, 1, "A"), row(2024, 3, "A")];
    const points = lineSeries(rows, { key: "a", label: "a", titles: ["A"] }, quarterSlots(rows));
    expect(points.map((p) => [p.slot.gap, p.row === null])).toEqual([
      [false, false],
      [true, true],
      [false, false],
    ]);
  });

  it("sums every row of a form per quarter, and leaves a sum unknown when USCIS withheld a part", () => {
    const rows = [
      row(2026, 1, "A", { received: 10, pending: 100 }),
      row(2026, 1, "B", { received: 5, pending: null }),
      row(2026, 2, "A", { received: 7, pending: 50 }),
    ];
    const totals = formTotals(rows, quarterSlots(rows));
    expect(totals.map((t) => [t.received, t.pending])).toEqual([
      [15, null],
      [7, 50],
    ]);
  });

  it("gives the share approved of those decided, or nothing it can't know", () => {
    expect(approvedShare({ approved: 80, denied: 20 })).toBe(0.8);
    expect(approvedShare({ approved: 0, denied: 0 })).toBeNull();
    expect(approvedShare({ approved: null, denied: 3 })).toBeNull();
  });
});
