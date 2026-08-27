import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { OctoberNote, OCTOBER_2025 } from "../OctoberNote";

/**
 * The October 2025 note: every measurement, every quotation, and the one
 * thing that is still not sourced.
 *
 * WHY THE SQL IS IN THE TEST. This note makes a claim about a federal agency
 * having stopped work for a month. The figures supporting it are literals in
 * a component, which is the right shape (they describe a closed month and
 * must not drift), but a literal with no provenance is a number nobody can
 * check. Each one below carries the query that produced it against the
 * project's Turso database on 2026-08-27.
 *
 * THIS TEST WAS INVERTED ON 2026-08-27 AND THAT IS THE POINT. It used to
 * assert the word "shutdown" was ABSENT, because no primary source we had
 * named a cause. DOL had published one on a host that refuses automated
 * clients, eleven days after the resumption notice, and it never appeared on
 * flag.dol.gov at all. The assertions now run the other way: the quotation
 * must be present, and what is still unsourced must stay out.
 *
 * The test does NOT hit the database or the network. A unit test that needs
 * live credentials fails on every machine that lacks them, which teaches
 * people to skip it.
 */

const FIGURES = [
  {
    value: "1,616",
    means: "applications with an October 2025 filing date, in the per-case mirror",
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
      "PERM determinations DOL issued in the whole of October 2025, from its own quarterly disclosure release",
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
    means: "of those 21 landed on 31 October: 1 certified plus 18 withdrawn",
    sql: "SELECT decision_date, status, COUNT(*) FROM perm_cases WHERE substr(decision_date,1,7)='2025-10' GROUP BY 1,2",
  },
  {
    value: "30 September",
    means:
      "the last ordinary determination day: 592 decisions, against 2 across the following 30 days",
    sql: "SELECT date, total FROM daily_decisions WHERE date BETWEEN '2025-09-28' AND '2025-11-04' ORDER BY date",
  },
  {
    value: "33 calendar days",
    means: "DOL's own deadline extension, quoted from its 5 November 2025 announcement",
    sql: "(not ours: DOL's figure)",
  },
] as const;

/** Verbatim fragments of DOL's announcement that must survive an edit. */
const QUOTED = [
  "due to the government shutdown, beginning October 1",
  "ceased all application processing activities",
  "Foreign Labor Application Gateway (FLAG) system",
  "October 1, 2025, through October 31, 2025",
  "officially recalled back to work on November 3",
  "will be considered to have been filed on the date it was",
] as const;

describe("OctoberNote", () => {
  it("renders every measured figure, so none can be edited unnoticed", () => {
    render(<OctoberNote />);
    const text = document.body.textContent ?? "";
    for (const f of FIGURES) {
      expect(text, `missing ${f.value} (${f.means})`).toContain(f.value);
    }
  });

  it("quotes DOL verbatim rather than paraphrasing the cause", () => {
    render(<OctoberNote />);
    // Curly quotes and entities render as real characters, so compare on the
    // text content with straight apostrophes normalised out of the way.
    const text = (document.body.textContent ?? "").replace(/[‘’]/g, "'");
    for (const q of QUOTED) {
      expect(text, `missing DOL's words: "${q}"`).toContain(q);
    }
  });

  it("links both sources, and says the cause was read from an archive", () => {
    render(<OctoberNote />);
    expect(
      screen.getByRole("link", { name: /announcement of 5 November 2025, archived/i }),
    ).toHaveAttribute(
      "href",
      "https://web.archive.org/web/20251113005349/https://www.dol.gov/agencies/eta/foreign-labor/news",
    );
    expect(
      screen.getByRole("link", { name: /resumption notice of 31 October 2025/i }),
    ).toHaveAttribute("href", "https://flag.dol.gov/announcement/2025-10-31");
    const text = document.body.textContent ?? "";
    // The live host is named but deliberately not linked, so a reader is not
    // sent to an archive without being told that is what it is.
    expect(text).toContain("www.dol.gov/agencies/eta/foreign-labor/news");
    expect(text).toMatch(/Internet Archive/i);
  });

  it("says why October is not empty, which is the part everyone gets wrong", () => {
    render(<OctoberNote />);
    const text = document.body.textContent ?? "";
    expect(text).toMatch(/postmark/i);
    expect(text).toMatch(/mail/i);
  });

  it("never claims a date for the end of the lapse, which is not sourced", () => {
    // THIS IS THE ASSERTION THAT MATTERS MOST NOW. DOL's announcement gives
    // the dates OFLC was down and the date its staff returned. It says
    // nothing about when the appropriations lapse itself ended, and OFLC
    // demonstrably came back before it did, so "processing resumed when the
    // shutdown ended" would be wrong against both DOL's text and our data.
    render(<OctoberNote />);
    const text = (document.body.textContent ?? "").toLowerCase();
    for (const claim of [
      "when the shutdown ended",
      "after the shutdown ended",
      "once the shutdown ended",
      "november 12",
      "12 november",
      "43 days",
    ]) {
      expect(text, `note asserts an unsourced claim: "${claim}"`).not.toContain(claim);
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
