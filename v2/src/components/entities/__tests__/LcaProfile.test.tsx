import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LcaProfile } from "../LcaProfile";
import { shapeLcaProfile, type LcaProfileRow } from "@/lib/lcaProfile";

/**
 * The employer page's LCA panel. It prints the employer's own declarations
 * ("found a willful violator: Yes") on a public page, so the two things it
 * must never do are draw a claim the file didn't carry and run its labels
 * together for the readers that walk the DOM (Google's snippets among them).
 */

const row = (over: Partial<LcaProfileRow> = {}): LcaProfileRow => ({
  filings: 10, detail_rows: 8, positions: 12,
  new_employment: 4, change_employer: 5, continued_employment: 2,
  change_previous_employment: 0, new_concurrent_employment: 1, amended_petition: 0,
  level_1: 3, level_2: 2, level_3: 0, level_4: 0, level_blank: 3,
  dependent_rows: 10, dependent_yes: 10, violator_rows: 10, violator_yes: 0,
  visa_h1b: 9, visa_e3: 1, visa_h1b1_chile: 0, visa_h1b1_singapore: 0,
  ...over,
});

describe("LcaProfile", () => {
  it("draws nothing for an employer with only H-1B LCAs and no breakdown yet", () => {
    const p = shapeLcaProfile(row({ detail_rows: 0, dependent_rows: 0, violator_rows: 0, visa_h1b: 10, visa_e3: 0 }), null);
    const { container } = render(<LcaProfile name="Acme" profile={p} />);
    expect(container.textContent).toBe("");
  });

  it("states new hires against transfers, and that positions aren't people hired", () => {
    const { container } = render(<LcaProfile name="Acme" profile={shapeLcaProfile(row(), null)} />);
    const text = container.textContent ?? "";
    expect(text).toContain("4 positions for new employment, 5 moving here from another employer");
    expect(text).toContain("not people hired");
    expect(text).toContain("3 of 8 used another source");
  });

  it("keeps a label apart from its form item and its count in the DOM", () => {
    const { container } = render(<LcaProfile name="Acme" profile={shapeLcaProfile(row(), null)} />);
    const text = container.textContent ?? "";
    expect(text).toContain("New employment 7a");
    expect(text).not.toMatch(/employment7a|Level I3/);
  });

  it("prints the newest declaration with its date, and says whose answer it is", () => {
    const p = shapeLcaProfile(row(), { h1b_dependent: 1, willful_violator: 0, filed: "2026-03-05" });
    const { container } = render(<LcaProfile name="Acme" profile={p} />);
    const text = container.textContent ?? "";
    expect(text).toContain("filed March 5, 2026");
    expect(text).toContain("the employer's own answers");
    expect(text).toContain("20 CFR 655.736(a)");
  });

  it("lists a visa other than the H-1B only when there is one", () => {
    const { container } = render(<LcaProfile name="Acme" profile={shapeLcaProfile(row(), null)} />);
    expect(container.textContent).toContain("E-3 (Australia) 1");
    const { container: only } = render(
      <LcaProfile name="Acme" profile={shapeLcaProfile(row({ visa_h1b: 10, visa_e3: 0 }), null)} />,
    );
    expect(only.textContent).not.toContain("Visas these LCAs support");
  });
});
