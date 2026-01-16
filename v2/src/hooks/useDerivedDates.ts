/**
 * useDerivedDates Hook
 *
 * Provides filing window and recruitment window dates with fallback calculations.
 * Uses stored values when available, otherwise recalculates from raw recruitment dates.
 *
 * @see convex/lib/derivedCalculations.ts - Backend canonical source
 */

import { useMemo } from "react";

import {
  FILING_WINDOW_WAIT_DAYS,
  FILING_WINDOW_CLOSE_DAYS,
  isValidISODate,
} from "@/lib/perm";

export interface DerivedDatesInput {
  filingWindowOpens?: string | null;
  filingWindowCloses?: string | null;
  recruitmentStartDate?: string | null;
  recruitmentEndDate?: string | null;
  recruitmentWindowCloses?: string | null;
  sundayAdFirstDate?: string | null;
  sundayAdSecondDate?: string | null;
  jobOrderStartDate?: string | null;
  jobOrderEndDate?: string | null;
  noticeOfFilingStartDate?: string | null;
  noticeOfFilingEndDate?: string | null;
  additionalRecruitmentEndDate?: string | null;
  additionalRecruitmentMethods?: Array<{ date?: string }>;
  isProfessionalOccupation?: boolean;
  pwdExpirationDate?: string | null;
}

export interface DerivedDatesOutput {
  filingWindowOpens: string | undefined;
  filingWindowCloses: string | undefined;
  recruitmentStartDate: string | undefined;
  recruitmentEndDate: string | undefined;
  recruitmentWindowCloses: string | undefined;
}

function addDays(dateStr: string, days: number): string {
  const date = new Date(dateStr + "T00:00:00Z");
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().split("T")[0]!;
}

/** Collect valid ISO dates from an array of potentially invalid values */
function collectValidDates(dates: (string | null | undefined)[]): string[] {
  return dates.filter(isValidISODate);
}

/** Find min or max from date strings */
function findExtreme(dates: string[], type: "min" | "max"): string | null {
  if (dates.length === 0) return null;
  return dates.reduce((acc, d) => (type === "min" ? (d < acc ? d : acc) : d > acc ? d : acc));
}

function calculateRecruitmentStartDate(data: DerivedDatesInput): string | null {
  const dates = collectValidDates([
    data.sundayAdFirstDate,
    data.jobOrderStartDate,
    data.noticeOfFilingStartDate,
  ]);
  return findExtreme(dates, "min");
}

function calculateRecruitmentEndDate(data: DerivedDatesInput): string | null {
  const baseDates = collectValidDates([
    data.sundayAdSecondDate,
    data.jobOrderEndDate,
    data.noticeOfFilingEndDate,
  ]);

  if (!data.isProfessionalOccupation) {
    return findExtreme(baseDates, "max");
  }

  const professionalDates = collectValidDates([
    data.additionalRecruitmentEndDate,
    ...(data.additionalRecruitmentMethods?.map((m) => m.date) ?? []),
  ]);

  return findExtreme([...baseDates, ...professionalDates], "max");
}

function calculateFilingWindowOpens(recruitmentEndDate: string | null): string | null {
  return recruitmentEndDate ? addDays(recruitmentEndDate, FILING_WINDOW_WAIT_DAYS) : null;
}

function calculateFilingWindowCloses(
  recruitmentStartDate: string | null,
  pwdExpirationDate: string | null
): string | null {
  if (!recruitmentStartDate) return null;
  const fromRecruitment = addDays(recruitmentStartDate, FILING_WINDOW_CLOSE_DAYS);
  if (!pwdExpirationDate) return fromRecruitment;
  return fromRecruitment < pwdExpirationDate ? fromRecruitment : pwdExpirationDate;
}

/** Convert null to undefined for React prop compatibility */
function toUndefined(value: string | null | undefined): string | undefined {
  return value ?? undefined;
}

/**
 * Hook to get derived dates with fallback calculations.
 * Uses stored values if available, otherwise calculates from raw dates.
 */
export function useDerivedDates(caseData: DerivedDatesInput | null | undefined): DerivedDatesOutput {
  return useMemo(() => {
    if (!caseData) {
      return {
        filingWindowOpens: undefined,
        filingWindowCloses: undefined,
        recruitmentStartDate: undefined,
        recruitmentEndDate: undefined,
        recruitmentWindowCloses: undefined,
      };
    }

    const recruitmentStartDate = toUndefined(
      caseData.recruitmentStartDate ?? calculateRecruitmentStartDate(caseData)
    );
    const recruitmentEndDate = toUndefined(
      caseData.recruitmentEndDate ?? calculateRecruitmentEndDate(caseData)
    );

    return {
      recruitmentStartDate,
      recruitmentEndDate,
      filingWindowOpens: toUndefined(
        caseData.filingWindowOpens ?? calculateFilingWindowOpens(recruitmentEndDate ?? null)
      ),
      filingWindowCloses: toUndefined(
        caseData.filingWindowCloses ??
          calculateFilingWindowCloses(recruitmentStartDate ?? null, caseData.pwdExpirationDate ?? null)
      ),
      recruitmentWindowCloses: toUndefined(caseData.recruitmentWindowCloses),
    };
  }, [caseData]);
}

export default useDerivedDates;
