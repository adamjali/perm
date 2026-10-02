import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { UscisH1bRecord } from "../UscisH1bRecord";
import { shapeYears, type H1bYearRow } from "@/lib/uscisH1b";

/** The employer page's USCIS H-1B panel: whole years first, rates only over enough decisions, sources named. */

const row = (fy: number, appr: number, den: number, chg = 0): H1bYearRow => ({
  fy, new_appr: appr, new_den: den, cont_appr: 0, cont_den: 0, same_appr: 0, same_den: 0,
  conc_appr: 0, conc_den: 0, chg_appr: chg, chg_den: 0, amend_appr: 0, amend_den: 0,
});

const record = (years: H1bYearRow[]) => ({
  years: shapeYears(years),
  names: [{ name: "ACME CORP", approved: 100 }],
  nameCount: 3,
});

describe("UscisH1bRecord", () => {
  it("draws nothing without a record", () => {
    const { container } = render(<UscisH1bRecord record={null} through={null} />);
    expect(container.textContent).toBe("");
  });

  it("leads with the last whole year and says the newest is partway through", () => {
    const { container } = render(
      <UscisH1bRecord record={record([row(2025, 90, 10, 30), row(2026, 40, 1)])} through="2026-06-30" />,
    );
    const text = container.textContent ?? "";
    expect(text).toContain("FY2025 to FY2026 (through June 30, 2026)");
    expect(text).toContain("Approved, FY2025");
    expect(text).toContain("92%"); // 120 approved (90 new + 30 moving) of 130 decided
    expect(text).toContain("Moving here from another employer: 30 approved");
    expect(text).toContain("ACME CORP and 2 other spellings");
    expect(text).toMatch(/FY2026\s+40 approved, 1 denied/);
  });

  it("says too few rather than printing a rate over a handful", () => {
    const { container } = render(<UscisH1bRecord record={record([row(2025, 5, 1)])} through="2025-09-30" />);
    expect(container.textContent).toContain("Too few");
  });
});
