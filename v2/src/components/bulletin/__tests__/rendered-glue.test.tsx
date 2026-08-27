import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";

import { BulletinBoard } from "../BulletinBoard";
import { PriorityDateEstimator } from "@/components/tools/PriorityDateEstimator";
import type { BulletinBoard as Board, BoardCell } from "@/lib/turso/bulletin";
import type { BulletinMonth } from "@/lib/perm";

/**
 * The glue check, run against RENDERED markup rather than source.
 *
 * The source gate cannot see the shapes these two components are built from.
 * There is no newline between two tags when the tags come out of a `.map()`,
 * so a mapped run of legend items, of pace rows or of SVG axis labels is
 * invisible to a pattern that looks for `</Tag>` newline `<Tag`. That blind
 * spot is not hypothetical: the source gate reported clean while 153 real
 * pairs were being served, and Google has printed the glued form verbatim in
 * a live search listing.
 *
 * `scripts/audit_glued_text.py` is still the authority, because it reads the
 * whole page including the layout. This runs the SAME predicate over these
 * components alone, so a regression is caught by `pnpm test:run` rather than
 * only by a build, a server and a sweep.
 */

// The tag list is verbatim from scripts/audit_glued_text.py. `div` is
// deliberately absent there, measured rather than assumed, and it stays
// absent here so the two checks cannot disagree about what counts.
const TAGS =
  "h1|h2|h3|h4|h5|h6|p|span|a|li|dt|dd|strong|b|em|td|th|button|label|ul|ol";

// THE OPENING TAG IS SCANNED QUOTE-AWARE, AND THE PYTHON SCRIPT IS NOT.
//
// `audit_glued_text.py` reads an opening tag as `<tag(?:\s[^>]*)?>`, which
// stops at the first `>` ANYWHERE after the tag name, including one inside a
// quoted attribute. Tailwind arbitrary variants put one there routinely, and
// the house mobile-grid rule mandates the worst offender: every grid holding
// a form control carries `[&>*]:min-w-0`, which serialises as
// `class="...[&amp;>*]:min-w-0"`. Measured: 96 such class attributes across
// 52 files in src.
//
// The consequence is a false PASS. Deleting a real separator between two
// `<li>` left this test green, because the match ended mid-attribute and the
// next character read was `*` rather than a letter. Same family as the SVG
// attribute regex that ran into `fill-opacity="0.7"` and reported every label
// at y=1. Skipping quoted runs is the fix.
const ATTRS = String.raw`(?:\s(?:"[^"]*"|'[^']*'|[^>"'])*)?`;
const BOUNDARY = new RegExp(`</(?:${TAGS})>(<(?:${TAGS})${ATTRS}>)`, "gi");
const TAG = new RegExp(String.raw`<[a-zA-Z/!?][^>"']*(?:"[^"]*"|'[^']*')?[^>"']*>`, "g");
const WORD = /[A-Za-z0-9]/;

function unescapeHtml(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

function gluedPairs(markup: string): string[] {
  const found: string[] = [];
  for (const m of markup.matchAll(BOUNDARY)) {
    const start = m.index!;
    const end = start + m[0].length;
    // Read forward from AFTER the whole opening tag. Starting inside it makes
    // the first character `>` or a space every time, which is how an earlier
    // version reported a clean sweep over a page with fourteen real pairs.
    const before = unescapeHtml(markup.slice(Math.max(0, start - 300), start).replace(TAG, ""));
    const after = unescapeHtml(markup.slice(end, end + 300).replace(TAG, ""));
    if (!before || !after) continue;
    // Two adjacent icon-only links have no text between them and are fine.
    // Only text touching text is the defect.
    if (WORD.test(before[before.length - 1]!) && WORD.test(after[0]!)) {
      found.push(`${before.trim().slice(-40)}||${after.trim().slice(0, 40)}`);
    }
  }
  return found;
}

function cell(over: Partial<BoardCell> & Pick<BoardCell, "category" | "country">): BoardCell {
  return {
    latest: { kind: "date", iso: "2014-01-01" },
    latestMonth: "2026-09",
    movedDays: 610,
    spanMonths: 35,
    pace: 0.57,
    retrogressions: [],
    states: [],
    ...over,
  };
}

const BOARD: Board = {
  firstMonth: "2023-10",
  lastMonth: "2026-09",
  bulletinCount: 36,
  categories: ["EB1", "EB2", "EB3"],
  finalAction: [
    cell({ category: "EB1", country: "india", pace: 1.98 }),
    cell({ category: "EB2", country: "india", pace: null, latest: { kind: "unavailable" } }),
    cell({ category: "EB3", country: "india", pace: 0.57 }),
    cell({ category: "EB1", country: "worldwide", pace: null, movedDays: null, latest: { kind: "current" } }),
  ],
  datesForFiling: [cell({ category: "EB2", country: "india", pace: 1.4 })],
};

function bulletin(month: string, eb2india: string): BulletinMonth {
  return {
    bulletinMonth: month,
    finalAction: { EB2: { india: eb2india, worldwide: "C" }, EB1: { india: "01JAN23" } },
    datesForFiling: { EB2: { india: "01JAN15" }, EB1: { india: "01JUN23" } },
  } as unknown as BulletinMonth;
}

const SERIES: BulletinMonth[] = [
  bulletin("2026-03", "01JAN14"),
  bulletin("2026-04", "15JUL14"),
  bulletin("2026-05", "C"),
  bulletin("2026-06", "01SEP13"),
  bulletin("2026-07", "U"),
];

describe("rendered glue", () => {
  it("proves the predicate can still find a pair", () => {
    // A sweep that has silently stopped matching reports everything as fixed.
    // This is the control: if it ever passes, every result below is worthless.
    expect(gluedPairs("<p>Petitions waiting</p><p>89,215</p>")).toHaveLength(1);
    // And adjacency alone is not glue: two icon-only links are fine.
    expect(gluedPairs("<a><svg/></a><a><svg/></a>")).toHaveLength(0);
    // The attribute-quote hole, which let this whole file pass over a real
    // defect until the tag pattern learned to skip quoted runs.
    expect(
      gluedPairs(
        '<li class="[&amp;>*]:min-w-0">1.98x</li><li class="[&amp;>*]:min-w-0">EB-3</li>',
      ),
    ).toHaveLength(1);
  });

  it("finds none in the bulletin board", () => {
    const { container } = render(<BulletinBoard board={BOARD} />);
    expect(gluedPairs(container.innerHTML)).toEqual([]);
  });

  it("finds none in the priority-date estimator", () => {
    const { container } = render(
      <PriorityDateEstimator
        bulletins={SERIES}
        categoryCodes={["EB1", "EB2"]}
        today="2026-08-27"
        currentBulletinMonth="2026-09"
        currentEmploymentChart="Final Action Dates"
      />,
    );
    expect(gluedPairs(container.innerHTML)).toEqual([]);
  });
});
