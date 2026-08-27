import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { OctoberNote, OCTOBER_2025 } from "../OctoberNote";

/**
 * The October 2025 note, and the measurements behind every figure in it.
 *
 * WHY THE SQL IS IN THE TEST. This note makes a claim about a federal agency
 * having stopped work for a month. The figures supporting it are literals in
 * a component, which is the right shape (they describe a closed month and
 * must not drift), but a literal with no provenance is a number nobody can
 * check. Each one below carries the query that produced it against the
 * project's Turso database on 2026-08-27, so re-deriving them is a copy and a
 * paste rather than an afternoon.
 *
 * The test does NOT hit the database. A unit test that needs live credentials
 * fails on every machine that lacks them, which teaches people to skip it.
 */

const FIGURES = [
  {
    value: "1,616",
    means: "applications with an October 2025 filing date, in the live per-case mirror",
    sql: "SELECT COUNT(*) FROM perm_case_status WHERE substr(filing_date,1,7)='2025-10'",
  },
  {
    value: "13,629",
    means: "the same count for September 2025",
    sql: "SELECT COUNT(*) FROM perm_case_status WHERE substr(filing_date,1,7)='2025-09'",
  },
  {
    value: "15,034",
    means: "the same count for November 2025",
    sql: "SELECT COUNT(*) FROM perm_case_status WHERE substr(filing_date,1,7)='2025-11'",
  },
  {
    value: "21",
    means:
      "PERM determinations DOL issued in the whole of October 2025, from the quarterly disclosure files",
    sql: "SELECT COUNT(*) FROM perm_cases WHERE substr(decision_date,1,7)='2025-10'",
  },
  {
    value: "14,239",
    means: "determinations in September 2025",
    sql: "SELECT COUNT(*) FROM perm_cases WHERE substr(decision_date,1,7)='2025-09'",
  },
  {
    value: "8,890",
    means: "determinations in November 2025",
    sql: "SELECT COUNT(*) FROM perm_cases WHERE substr(decision_date,1,7)='2025-11'",
  },
  {
    value: "Nineteen",
    means:
      "of those 21 determinations landed on 31 October: 1 certified plus 18 withdrawn",
    sql: "SELECT decision_date, status, COUNT(*) FROM perm_cases WHERE substr(decision_date,1,7)='2025-10' GROUP BY 1,2",
  },
] as const;

describe("OctoberNote", () => {
  it("renders every measured figure, so none can be edited unnoticed", () => {
    render(<OctoberNote />);
    const text = document.body.textContent ?? "";
    for (const f of FIGURES) {
      expect(text, `missing ${f.value} (${f.means})`).toContain(f.value);
    }
  });

  it("states that this is not a gap in our data, which is the whole point", () => {
    render(<OctoberNote />);
    expect(
      screen.getByRole("heading", { name: /not a gap in this data/i }),
    ).toBeInTheDocument();
  });

  it("names two sources that do not share a pipeline", () => {
    render(<OctoberNote />);
    const text = document.body.textContent ?? "";
    expect(text).toMatch(/per-case scan/i);
    expect(text).toMatch(/quarterly disclosure files/i);
  });

  it("links DOL's own announcement rather than describing it second hand", () => {
    render(<OctoberNote />);
    const link = screen.getByRole("link", { name: /DOL.s announcement/i });
    expect(link).toHaveAttribute("href", "https://flag.dol.gov/announcement/2025-10-31");
  });

  it("refuses to name a cause, because no primary source gives one", () => {
    // THIS IS THE ASSERTION THAT MATTERS MOST. The obvious explanation for a
    // federal office stopping on the first day of a fiscal year is easy to
    // write and was not sourced. A reader repeats whatever is here, and it
    // arrives somewhere else with this site's name on it.
    render(<OctoberNote />);
    const text = (document.body.textContent ?? "").toLowerCase();
    expect(text).toContain("the cause isn");
    for (const guess of [
      "shutdown",
      "lapse in appropriations",
      "furlough",
      "budget",
      "funding",
      "because",
    ]) {
      expect(text, `note asserts a cause: "${guess}"`).not.toContain(guess);
    }
  });

  it("writes in house voice", () => {
    render(<OctoberNote />);
    const text = document.body.textContent ?? "";
    expect(text).not.toMatch(/[—–]/);
    expect(text).not.toMatch(/!/);
  });

  it("exposes an anchor the backlog row can point at", () => {
    const { container } = render(<OctoberNote />);
    expect(OCTOBER_2025.month).toBe("2025-10");
    expect(container.querySelector(`#${OCTOBER_2025.anchorId}`)).not.toBeNull();
  });
});
