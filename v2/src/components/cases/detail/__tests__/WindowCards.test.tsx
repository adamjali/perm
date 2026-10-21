/**
 * A window a case has already acted in never reads "Expired" on the case page.
 *
 * The ETA 9089 and Recruitment tabs passed only their dates to the window
 * helper, so a case that filed its ETA 9089 on Apr 2, inside a window that
 * closed Jul 11, showed a red "Expired, 82 days past expiration" on its own
 * page, in the getting-started recording (Oct 21 2026). The I-140 tab already
 * passed its filing. The Recruitment tab's window is the PWD's validity, and
 * once recruitment began inside it its end no longer limits the case
 * (20 CFR 656.40(c), Karl Storz).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "../../../../../test-utils/render-utils";
import { ETA9089Tab } from "../ETA9089Tab";
import { RecruitmentTab } from "../RecruitmentTab";
import type { CaseDetailData } from "../case-detail-types";

const FILED = {
  _id: "case-1",
  isProfessionalOccupation: false,
  pwdFilingDate: "2025-09-02",
  pwdDeterminationDate: "2025-11-18",
  pwdExpirationDate: "2026-06-30",
  jobOrderStartDate: "2026-01-12",
  jobOrderEndDate: "2026-02-11",
  sundayAdFirstDate: "2026-01-18",
  sundayAdSecondDate: "2026-01-25",
  noticeOfFilingStartDate: "2026-01-12",
  noticeOfFilingEndDate: "2026-01-27",
  eta9089FilingDate: "2026-04-02",
} as unknown as CaseDetailData;

describe("the case page's window cards", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-01T15:00:00Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("the ETA 9089 tab says the case was filed once the window has closed", () => {
    renderWithProviders(<ETA9089Tab caseData={FILED} filingWindowOpens="2026-03-15" filingWindowCloses="2026-07-11" />);
    expect(screen.queryByText("Expired")).not.toBeInTheDocument();
    expect(screen.getByText("ETA 9089 filed Apr 2, 2026")).toBeInTheDocument();
  });

  it("the Recruitment tab says the case was filed once the PWD has passed", () => {
    renderWithProviders(<RecruitmentTab caseData={FILED} />);
    expect(screen.queryByText("Expired")).not.toBeInTheDocument();
    expect(screen.getByText("ETA 9089 filed Apr 2, 2026")).toBeInTheDocument();
  });

  it("the Recruitment tab doesn't call the PWD expired when recruitment began inside it", () => {
    const begun = { ...FILED, eta9089FilingDate: undefined } as unknown as CaseDetailData;
    renderWithProviders(<RecruitmentTab caseData={begun} />);
    expect(screen.queryByText("Expired")).not.toBeInTheDocument();
    expect(screen.getByText("Begun")).toBeInTheDocument();
  });

  it("still says expired when nothing was done inside the PWD", () => {
    const idle = { ...FILED, jobOrderStartDate: undefined, jobOrderEndDate: undefined, sundayAdFirstDate: undefined, sundayAdSecondDate: undefined, noticeOfFilingStartDate: undefined, noticeOfFilingEndDate: undefined, eta9089FilingDate: undefined } as unknown as CaseDetailData;
    renderWithProviders(<RecruitmentTab caseData={idle} />);
    expect(screen.getByText("Expired")).toBeInTheDocument();
  });
});
