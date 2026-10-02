import { describe, expect, it } from "vitest";
import { buildSampleCaseDates, sampleCaseFilingWindow } from "@convex/lib/sampleCase";
import { calculateFilingWindowFromCase, validateCase } from "@/lib/perm";
import { previewDates } from "../steps/ValuePreviewStep";

/**
 * The onboarding illustration describes the sample case the tour creates a
 * minute later. It used to print "Oct 22" and "Feb 15, 2027, 140 days from
 * today", typed by hand, and the sample case's real window had moved on.
 */
describe("onboarding preview dates", () => {
  // Noon, so a UTC conversion inside the date builder can't cross midnight.
  const today = new Date(2026, 9, 2, 12);

  it("prints the sample case's own filing window", () => {
    const d = previewDates(today);
    expect(d).toEqual({
      opensInDays: 24,
      opensMonth: "Oct",
      opensDay: "26",
      closesShort: "Feb 19",
      closesLong: "Feb 19, 2027",
      closesInDays: 140,
    });
  });

  it("moves with today instead of staying where it was written", () => {
    const later = previewDates(new Date(2026, 11, 15, 12));
    expect(later.closesLong).toBe("May 4, 2027");
    expect(later.closesInDays).toBe(140);
  });

  it("uses the same window the inserted case gets", () => {
    const dates = buildSampleCaseDates(today);
    const window = sampleCaseFilingWindow(today);
    expect(window).toEqual(
      calculateFilingWindowFromCase({
        ...dates,
        isProfessionalOccupation: true,
        additionalRecruitmentMethods: [
          { date: dates.additionalMethod1Date },
          { date: dates.additionalMethod2Date },
          { date: dates.additionalMethod3Date },
        ],
      }),
    );
    expect(window?.isPwdLimited).toBe(false);
  });

  it("builds dates that pass the case validator", () => {
    const dates = buildSampleCaseDates(today);
    const result = validateCase({
      ...dates,
      caseStatus: "recruitment",
      progressStatus: "working",
      isProfessionalOccupation: true,
    } as Parameters<typeof validateCase>[0]);
    expect(result.errors).toEqual([]);
  });
});
