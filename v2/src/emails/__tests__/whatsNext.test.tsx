// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render } from "@react-email/render";

import { alsoLinksFor, nextStepsFor } from "@convex/lib/alertNextSteps";
import { CaseStatusChanged, type CaseStatusChangedProps } from "../CaseStatusChanged";
import { PossiblePermMatch } from "../PossiblePermMatch";

/**
 * The "what comes next" block in the final case alerts, as rendered, and the
 * possible-PERM email's wording. The block's content is tested in
 * src/lib/__tests__/alertNextSteps.test.ts; this holds what reaches an inbox.
 */

const base: CaseStatusChangedProps = {
  caseNumber: "G-100-26070-123456",
  employerName: "Example Systems, Inc.",
  jobTitle: "Software Engineer",
  fromStatus: "ANALYST REVIEW",
  toStatus: "CERTIFIED",
  tone: "live",
  meaning: null,
  isFinal: true,
  observedAt: "October 15, 2026",
  contextRows: [{ label: "Cases now at this status", value: "906" }],
  contextProvenance: "Counted from DOL's own case status, checked daily.",
  caseUrl: "https://permtracker.app/perm-case-status?case=G-100-26070-123456",
  unsubscribeUrl: "https://permtracker.app/case-alert/unsubscribe?token=U",
};

describe("what comes next, in the email", () => {
  it("puts the I-140 day, the priority date and the bulletin alert in a certified PERM's email", async () => {
    const input = {
      program: "perm" as const,
      caseNumber: base.caseNumber,
      status: "CERTIFIED",
      isFinal: true,
      approved: true,
      priorityDate: "2026-03-11",
      certifiedOn: "2026-10-15",
    };
    const html = await render(
      CaseStatusChanged({ ...base, next: nextStepsFor(input), alsoLinks: alsoLinksFor(input) }),
    );
    expect(html).toContain("What comes next");
    expect(html).toContain("April 12, 2027");
    expect(html).toContain("March 11, 2026");
    expect(html).toContain("https://permtracker.app/visa-bulletin?pd=2026-03-11#bulletin-alert");
    expect(html).not.toContain("https://permtracker.app/perm-processing-times");
  });

  it("drops the we-won't-guess line when the next step follows, and keeps it when nothing does", async () => {
    const lca = { program: "lca" as const, caseNumber: "I-200-26118-846661", status: "CERTIFIED", isFinal: true, approved: true };
    const withNext = await render(CaseStatusChanged({ ...base, caseNumber: lca.caseNumber, next: nextStepsFor(lca) }));
    expect(withNext).toContain("What comes next");
    expect(withNext).not.toContain("going to guess");
    const withoutNext = await render(CaseStatusChanged({ ...base, toStatus: "IN PROCESS", isFinal: false, next: null }));
    expect(withoutNext).toContain("going to guess");
  });

  it("never ends the preview line with two periods after a name ending in one", async () => {
    const html = await render(CaseStatusChanged({ ...base, next: null }));
    expect(html).toContain("G-100-26070-123456 at Example Systems, Inc. DOL last checked it on October 15, 2026.");
    expect(html).not.toContain("Inc..");
  });

  it("shows an LCA reader no PERM queue link", async () => {
    const input = { program: "lca" as const, caseNumber: "I-200-26118-846661", status: "CERTIFIED", isFinal: true, approved: true };
    const html = await render(
      CaseStatusChanged({ ...base, caseNumber: input.caseNumber, next: nextStepsFor(input), alsoLinks: alsoLinksFor(input) }),
    );
    expect(html).toContain("Form I-129");
    expect(html).not.toContain("perm-processing-times");
    expect(html).not.toContain("filing month DOL&#x27;s queue");
  });

  it("keeps the old links for a caller that passes none", async () => {
    const html = await render(CaseStatusChanged({ ...base, isFinal: false, toStatus: "RFI ISSUED" }));
    expect(html).toContain("https://permtracker.app/perm-processing-times");
    expect(html).not.toContain("What comes next");
  });
});

describe("the possible-PERM email", () => {
  it("says may, and says what was compared", async () => {
    const html = await render(PossiblePermMatch(PossiblePermMatch.PreviewProps));
    expect(html).toContain("A PERM application that may be yours");
    expect(html).toContain("G-100-26286-296040");
    expect(html).toContain("#watch");
    expect(html).toMatch(/the employer, the job title/);
    expect(html).not.toMatch(/\bis your (PERM|case)\b|your PERM (was|has been) filed/i);
  });
});
