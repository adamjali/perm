import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { billNumber } from "@convex/lib/billNumber";
import type { CommentCount } from "@/lib/db/policyComments";
import type { PolicyNotice } from "@/lib/db/policyNotices";
import { BALCA_TYPE, BILL_TYPE, COURT_TYPE } from "@/lib/policyFeed";

import { commentsLine, dateLine, DocRow, typeLabel } from "../DocRow";

const base: PolicyNotice = {
  documentNumber: "2026-18631", publicationDate: "2026-09-11", type: "Proposed Rule", title: "Grace periods",
  abstract: null, url: "https://www.federalregister.gov/d/2026-18631", agencies: ["Homeland Security Department"],
  topics: [], effectiveOn: null, commentsCloseOn: "2026-11-10", commentUrl: "https://www.regulations.gov/commenton/x",
  citation: null, action: null, dates: null, correctionOf: null, pdfUrl: null, source: "federal-register",
  status: "published", piFiled: null, signingDate: null, supersededBy: null,
};
const count: CommentCount = {
  documentNumber: "2026-18631", comments: 26697, countedBy: "regulations.gov", changedAt: 1,
  docketUrl: "https://www.regulations.gov/docket/USCIS-2026-0364/comments", commentUrl: null, commentEnd: "2026-11-10",
};

describe("a bill's row", () => {
  const bill: PolicyNotice = {
    ...base, documentNumber: "bill-119-hr-2315", publicationDate: "2025-03-25", type: BILL_TYPE, source: "congress",
    title: "Fairness for High-Skilled Americans Act of 2025", url: "https://www.congress.gov/bill/119th-congress/house-bill/2315",
    agencies: ["House"], commentsCloseOn: null, commentUrl: null, status: null,
    action: "Referred to the Subcommittee on Immigration Integrity, Security, and Enforcement.", dates: "2026-10-22",
  };
  it("names its number, its introduction and its latest action, and links congress.gov", () => {
    const out = renderToStaticMarkup(<DocRow doc={bill} today="2026-10-27" />);
    expect(typeLabel(BILL_TYPE)).toBe("Bill");
    expect(out).toContain(">H.R. 2315<");
    expect(out).toContain("Introduced Mar 25, 2025");
    expect(dateLine(bill, "2026-10-27")).toBe(
      "Latest action Oct 22, 2026: Referred to the Subcommittee on Immigration Integrity, Security, and Enforcement",
    );
    expect(out).toContain(">Read it on congress.gov<");
    // Its `dates` is a day, not a DATES paragraph to quote.
    expect(out).not.toContain("Dates, as published");
  });
  it("prints Congress's numbers the way Congress does, the same as the evening check", () => {
    const fx = JSON.parse(readFileSync(join(process.cwd(), "scripts/fixtures/bill_numbers.json"), "utf8")) as {
      cases: Record<string, string | null>;
    };
    expect(Object.keys(fx.cases).length).toBeGreaterThanOrEqual(5);
    for (const [doc, printed] of Object.entries(fx.cases)) expect(billNumber(doc), doc).toBe(printed);
  });
});

describe("the comment count on an open proposal", () => {
  it("is shown while comments are open, with whose count it is", () => {
    const out = renderToStaticMarkup(<DocRow doc={base} today="2026-10-27" comments={count} />);
    expect(out).toContain("26,697 comments posted so far");
    expect(out).toContain("The count is regulations.gov&#x27;s");
    expect(out).toContain(">The posted comments<");
  });
  it("is gone once the window shuts, and says one comment, not one comments", () => {
    expect(renderToStaticMarkup(<DocRow doc={base} today="2026-11-11" comments={count} />)).not.toContain("posted so far");
    expect(commentsLine({ ...count, comments: 1 }, true)).toBe("1 comment posted so far");
    expect(commentsLine(null, true)).toBeNull();
  });
});

describe("a decision's row", () => {
  const court: PolicyNotice = {
    ...base, documentNumber: "cl-11045835", publicationDate: "2026-10-26", type: COURT_TYPE, source: "courtlistener",
    title: "E. v. U.S. Department of State", url: "https://www.courtlistener.com/opinion/11045835/e-v-u-s-department-of-state/",
    agencies: ["District Court, District of Columbia"], citation: "No. 2026-0092", commentsCloseOn: null, commentUrl: null, status: null,
  };
  it("says when it was decided, names the court and the docket, and links CourtListener", () => {
    const out = renderToStaticMarkup(<DocRow doc={court} today="2026-10-27" />);
    expect(typeLabel(COURT_TYPE)).toBe("Court");
    expect(out).toContain("Decided Oct 26, 2026");
    expect(out).toContain("District Court, District of Columbia");
    expect(out).toMatch(/>Docket<\/dt>/);
    expect(out).toContain(">Read the opinion on CourtListener<");
  });
  it("gives BALCA's kind of decision as its line", () => {
    const balca: PolicyNotice = { ...court, documentNumber: "balca-x", type: BALCA_TYPE, source: "balca", action: "En banc decision",
      agencies: ["Board of Alien Labor Certification Appeals"], url: "https://www.dol.gov/agencies/oalj/x" };
    expect(dateLine(balca, "2026-10-27")).toBe("En banc decision");
    expect(renderToStaticMarkup(<DocRow doc={balca} today="2026-10-27" />)).toContain(">See it on OALJ&#x27;s caselist<");
  });
});
