import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DebarmentNotice } from "../DebarmentNotice";
import type { Debarment } from "@/lib/turso/debarments";

/**
 * The notice tells a reader, in a sentence, whether a sponsor is barred.
 *
 * It classified anything not in force TODAY as finished and said so in words:
 * "was barred from filing in the past; the period has ended". For a debarment
 * that has not started that is false in every clause, on the page of a sponsor
 * somebody may be about to sign with.
 *
 * No live page carries this case yet - the one future-dated row in the data on
 * 2026-09-10 is an H-2A employer with no PERM entity page - so this file is the
 * only thing standing between that copy and the first future-dated PERM or
 * H-1B debarment, which comes off the same lists.
 */
const d = (over: Partial<Debarment> = {}): Debarment => ({
  program: "perm",
  entity: "Hercules Staffing, LLC",
  entitySlug: "hercules-staffing-llc",
  entityType: "Employer",
  location: "Orem, Utah",
  startDate: "2025-05-29",
  endDate: "2027-05-29",
  violation: "Failure to respond to an audit",
  citation: "20 C.F.R. § 656.31(f)(1)(ii)",
  sourceUrl: "https://www.dol.gov/agencies/eta/foreign-labor/program-debarments",
  ...over,
});

const TODAY = "2026-09-10";

describe("DebarmentNotice", () => {
  it("never says a debarment that has not started has ended", () => {
    render(
      <DebarmentNotice
        rows={[d({ startDate: "2026-11-01", endDate: "2027-10-31" })]}
        pageName="Hercules Staffing"
        today={TODAY}
      />,
    );
    const body = document.body.textContent ?? "";
    expect(body).not.toMatch(/has ended/);
    expect(body).not.toMatch(/in the past/);
    expect(body).toMatch(/barred from filing from Nov 1, 2026/);
    expect(body).toMatch(/not started/);
  });

  it("says barred today when the period contains today", () => {
    render(<DebarmentNotice rows={[d()]} pageName="Hercules Staffing" today={TODAY} />);
    const body = document.body.textContent ?? "";
    expect(body).toMatch(/is barred from filing today/);
    expect(body).not.toMatch(/\(ended\)/);
    expect(body).not.toMatch(/not started/);
  });

  it("still says ended for a period that has run out", () => {
    render(
      <DebarmentNotice
        rows={[d({ startDate: "2020-01-01", endDate: "2021-01-01" })]}
        pageName="Hercules Staffing"
        today={TODAY}
      />,
    );
    const body = document.body.textContent ?? "";
    expect(body).toMatch(/the period has ended/);
    expect(body).toMatch(/\(ended\)/);
  });

  it("leads with the strongest fact when a sponsor has several rows", () => {
    // In force beats about-to-start beats finished: the reader's question is
    // "can this sponsor file for me", and today's answer is the lede.
    render(
      <DebarmentNotice
        rows={[
          d({ startDate: "2020-01-01", endDate: "2021-01-01" }),
          d({ startDate: "2026-11-01", endDate: "2027-10-31" }),
          d(),
        ]}
        pageName="Hercules Staffing"
        today={TODAY}
      />,
    );
    expect(document.body.textContent ?? "").toMatch(/is barred from filing today/);
  });

  it("renders nothing when there are no rows", () => {
    const { container } = render(
      <DebarmentNotice rows={[]} pageName="Hercules Staffing" today={TODAY} />,
    );
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByLabelText("Debarment notice")).toBeNull();
  });
});
