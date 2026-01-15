import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import { useDerivedDates, DerivedDatesInput } from "../useDerivedDates";

// Constants matching the hook
const FILING_WINDOW_WAIT_DAYS = 30;
const FILING_WINDOW_CLOSE_DAYS = 180;

/**
 * Helper to add days to ISO date string
 */
function addDays(dateStr: string, days: number): string {
  const date = new Date(dateStr + "T00:00:00Z");
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().split("T")[0]!;
}

describe("useDerivedDates", () => {
  describe("null/undefined input handling", () => {
    it("returns all undefined for null input", () => {
      const { result } = renderHook(() => useDerivedDates(null));

      expect(result.current).toEqual({
        filingWindowOpens: undefined,
        filingWindowCloses: undefined,
        recruitmentStartDate: undefined,
        recruitmentEndDate: undefined,
        recruitmentWindowCloses: undefined,
      });
    });

    it("returns all undefined for undefined input", () => {
      const { result } = renderHook(() => useDerivedDates(undefined));

      expect(result.current).toEqual({
        filingWindowOpens: undefined,
        filingWindowCloses: undefined,
        recruitmentStartDate: undefined,
        recruitmentEndDate: undefined,
        recruitmentWindowCloses: undefined,
      });
    });

    it("returns all undefined for empty object", () => {
      const { result } = renderHook(() => useDerivedDates({}));

      expect(result.current).toEqual({
        filingWindowOpens: undefined,
        filingWindowCloses: undefined,
        recruitmentStartDate: undefined,
        recruitmentEndDate: undefined,
        recruitmentWindowCloses: undefined,
      });
    });
  });

  describe("stored value priority", () => {
    it("uses stored filingWindowOpens when available", () => {
      const input: DerivedDatesInput = {
        filingWindowOpens: "2025-06-15",
        sundayAdSecondDate: "2025-04-01", // Would calculate to 2025-05-01 if used
      };

      const { result } = renderHook(() => useDerivedDates(input));

      expect(result.current.filingWindowOpens).toBe("2025-06-15");
    });

    it("uses stored filingWindowCloses when available", () => {
      const input: DerivedDatesInput = {
        filingWindowCloses: "2025-12-31",
        sundayAdFirstDate: "2025-03-01", // Would calculate differently if used
      };

      const { result } = renderHook(() => useDerivedDates(input));

      expect(result.current.filingWindowCloses).toBe("2025-12-31");
    });

    it("uses stored recruitmentStartDate when available", () => {
      const input: DerivedDatesInput = {
        recruitmentStartDate: "2025-02-15",
        sundayAdFirstDate: "2025-03-01", // Would be different if calculated
        jobOrderStartDate: "2025-02-20",
      };

      const { result } = renderHook(() => useDerivedDates(input));

      expect(result.current.recruitmentStartDate).toBe("2025-02-15");
    });

    it("uses stored recruitmentEndDate when available", () => {
      const input: DerivedDatesInput = {
        recruitmentEndDate: "2025-05-15",
        sundayAdSecondDate: "2025-04-01", // Would be different if calculated
      };

      const { result } = renderHook(() => useDerivedDates(input));

      expect(result.current.recruitmentEndDate).toBe("2025-05-15");
    });

    it("uses stored recruitmentWindowCloses when available", () => {
      const input: DerivedDatesInput = {
        recruitmentWindowCloses: "2025-08-01",
      };

      const { result } = renderHook(() => useDerivedDates(input));

      expect(result.current.recruitmentWindowCloses).toBe("2025-08-01");
    });
  });

  describe("fallback calculations - recruitment start date", () => {
    it("calculates from sundayAdFirstDate only", () => {
      const input: DerivedDatesInput = {
        sundayAdFirstDate: "2025-03-02",
      };

      const { result } = renderHook(() => useDerivedDates(input));

      expect(result.current.recruitmentStartDate).toBe("2025-03-02");
    });

    it("calculates from jobOrderStartDate only", () => {
      const input: DerivedDatesInput = {
        jobOrderStartDate: "2025-03-15",
      };

      const { result } = renderHook(() => useDerivedDates(input));

      expect(result.current.recruitmentStartDate).toBe("2025-03-15");
    });

    it("calculates MIN of multiple start dates", () => {
      const input: DerivedDatesInput = {
        sundayAdFirstDate: "2025-03-15",
        jobOrderStartDate: "2025-03-01", // Earliest
        noticeOfFilingStartDate: "2025-03-20",
      };

      const { result } = renderHook(() => useDerivedDates(input));

      expect(result.current.recruitmentStartDate).toBe("2025-03-01");
    });

    it("ignores invalid date formats", () => {
      const input: DerivedDatesInput = {
        sundayAdFirstDate: "invalid",
        jobOrderStartDate: "2025-03-15",
        noticeOfFilingStartDate: "03/20/2025", // Wrong format
      };

      const { result } = renderHook(() => useDerivedDates(input));

      expect(result.current.recruitmentStartDate).toBe("2025-03-15");
    });

    it("returns undefined if no valid start dates", () => {
      const input: DerivedDatesInput = {
        sundayAdFirstDate: null,
        jobOrderStartDate: "invalid",
      };

      const { result } = renderHook(() => useDerivedDates(input));

      expect(result.current.recruitmentStartDate).toBeUndefined();
    });
  });

  describe("fallback calculations - recruitment end date", () => {
    it("calculates from sundayAdSecondDate only", () => {
      const input: DerivedDatesInput = {
        sundayAdSecondDate: "2025-04-15",
      };

      const { result } = renderHook(() => useDerivedDates(input));

      expect(result.current.recruitmentEndDate).toBe("2025-04-15");
    });

    it("calculates MAX of multiple end dates", () => {
      const input: DerivedDatesInput = {
        sundayAdSecondDate: "2025-04-15",
        jobOrderEndDate: "2025-04-30", // Latest
        noticeOfFilingEndDate: "2025-04-20",
      };

      const { result } = renderHook(() => useDerivedDates(input));

      expect(result.current.recruitmentEndDate).toBe("2025-04-30");
    });

    it("excludes additional recruitment when isProfessionalOccupation is false", () => {
      const input: DerivedDatesInput = {
        sundayAdSecondDate: "2025-04-15",
        additionalRecruitmentEndDate: "2025-05-15", // Should be ignored
        isProfessionalOccupation: false,
      };

      const { result } = renderHook(() => useDerivedDates(input));

      expect(result.current.recruitmentEndDate).toBe("2025-04-15");
    });

    it("excludes additional recruitment when isProfessionalOccupation is undefined", () => {
      const input: DerivedDatesInput = {
        sundayAdSecondDate: "2025-04-15",
        additionalRecruitmentEndDate: "2025-05-15", // Should be ignored
      };

      const { result } = renderHook(() => useDerivedDates(input));

      expect(result.current.recruitmentEndDate).toBe("2025-04-15");
    });

    it("includes additionalRecruitmentEndDate when isProfessionalOccupation is true", () => {
      const input: DerivedDatesInput = {
        sundayAdSecondDate: "2025-04-15",
        additionalRecruitmentEndDate: "2025-05-15", // Latest, should be included
        isProfessionalOccupation: true,
      };

      const { result } = renderHook(() => useDerivedDates(input));

      expect(result.current.recruitmentEndDate).toBe("2025-05-15");
    });

    it("includes additionalRecruitmentMethods dates when isProfessionalOccupation is true", () => {
      const input: DerivedDatesInput = {
        sundayAdSecondDate: "2025-04-15",
        additionalRecruitmentMethods: [
          { date: "2025-05-01" },
          { date: "2025-06-01" }, // Latest
          { date: "2025-05-20" },
        ],
        isProfessionalOccupation: true,
      };

      const { result } = renderHook(() => useDerivedDates(input));

      expect(result.current.recruitmentEndDate).toBe("2025-06-01");
    });

    it("handles empty additionalRecruitmentMethods array", () => {
      const input: DerivedDatesInput = {
        sundayAdSecondDate: "2025-04-15",
        additionalRecruitmentMethods: [],
        isProfessionalOccupation: true,
      };

      const { result } = renderHook(() => useDerivedDates(input));

      expect(result.current.recruitmentEndDate).toBe("2025-04-15");
    });

    it("handles additionalRecruitmentMethods with missing dates", () => {
      const input: DerivedDatesInput = {
        sundayAdSecondDate: "2025-04-15",
        additionalRecruitmentMethods: [
          { date: undefined },
          { date: "2025-05-01" },
          {},
        ] as Array<{ date?: string }>,
        isProfessionalOccupation: true,
      };

      const { result } = renderHook(() => useDerivedDates(input));

      expect(result.current.recruitmentEndDate).toBe("2025-05-01");
    });
  });

  describe("fallback calculations - filing window opens", () => {
    it("calculates as recruitment end + 30 days", () => {
      const recruitmentEnd = "2025-04-15";
      const expectedOpens = addDays(recruitmentEnd, FILING_WINDOW_WAIT_DAYS);

      const input: DerivedDatesInput = {
        sundayAdSecondDate: recruitmentEnd,
      };

      const { result } = renderHook(() => useDerivedDates(input));

      expect(result.current.filingWindowOpens).toBe(expectedOpens);
    });

    it("returns undefined if no recruitment end date", () => {
      const input: DerivedDatesInput = {
        sundayAdFirstDate: "2025-03-01", // Only start date
      };

      const { result } = renderHook(() => useDerivedDates(input));

      expect(result.current.filingWindowOpens).toBeUndefined();
    });

    it("uses stored recruitmentEndDate for calculation if no stored filingWindowOpens", () => {
      const input: DerivedDatesInput = {
        recruitmentEndDate: "2025-04-20",
        sundayAdSecondDate: "2025-04-15", // Would give different result
      };

      const { result } = renderHook(() => useDerivedDates(input));

      // Should be based on stored recruitmentEndDate
      expect(result.current.filingWindowOpens).toBe(
        addDays("2025-04-20", FILING_WINDOW_WAIT_DAYS)
      );
    });
  });

  describe("fallback calculations - filing window closes", () => {
    it("calculates as recruitment start + 180 days", () => {
      const recruitmentStart = "2025-03-01";
      const expectedCloses = addDays(recruitmentStart, FILING_WINDOW_CLOSE_DAYS);

      const input: DerivedDatesInput = {
        sundayAdFirstDate: recruitmentStart,
      };

      const { result } = renderHook(() => useDerivedDates(input));

      expect(result.current.filingWindowCloses).toBe(expectedCloses);
    });

    it("returns undefined if no recruitment start date", () => {
      const input: DerivedDatesInput = {
        sundayAdSecondDate: "2025-04-15", // Only end date
      };

      const { result } = renderHook(() => useDerivedDates(input));

      expect(result.current.filingWindowCloses).toBeUndefined();
    });

    it("truncates to PWD expiration if earlier", () => {
      const recruitmentStart = "2025-03-01";
      const pwdExpiration = "2025-06-01"; // Earlier than 2025-03-01 + 180 = 2025-08-28

      const input: DerivedDatesInput = {
        sundayAdFirstDate: recruitmentStart,
        pwdExpirationDate: pwdExpiration,
      };

      const { result } = renderHook(() => useDerivedDates(input));

      expect(result.current.filingWindowCloses).toBe(pwdExpiration);
    });

    it("uses calculated date if PWD expiration is later", () => {
      const recruitmentStart = "2025-03-01";
      const expectedCloses = addDays(recruitmentStart, FILING_WINDOW_CLOSE_DAYS);
      const pwdExpiration = "2025-12-31"; // Later than calculated date

      const input: DerivedDatesInput = {
        sundayAdFirstDate: recruitmentStart,
        pwdExpirationDate: pwdExpiration,
      };

      const { result } = renderHook(() => useDerivedDates(input));

      expect(result.current.filingWindowCloses).toBe(expectedCloses);
    });

    it("ignores PWD expiration if null", () => {
      const recruitmentStart = "2025-03-01";
      const expectedCloses = addDays(recruitmentStart, FILING_WINDOW_CLOSE_DAYS);

      const input: DerivedDatesInput = {
        sundayAdFirstDate: recruitmentStart,
        pwdExpirationDate: null,
      };

      const { result } = renderHook(() => useDerivedDates(input));

      expect(result.current.filingWindowCloses).toBe(expectedCloses);
    });
  });

  describe("memoization", () => {
    it("returns same object reference when input is unchanged", () => {
      const input: DerivedDatesInput = {
        filingWindowOpens: "2025-06-01",
        filingWindowCloses: "2025-08-28",
      };

      const { result, rerender } = renderHook(
        ({ data }) => useDerivedDates(data),
        { initialProps: { data: input } }
      );

      const firstResult = result.current;
      rerender({ data: input });
      const secondResult = result.current;

      expect(firstResult).toBe(secondResult);
    });

    it("returns new object when input changes", () => {
      const { result, rerender } = renderHook(
        ({ data }) => useDerivedDates(data),
        { initialProps: { data: { filingWindowOpens: "2025-06-01" } } }
      );

      const firstResult = result.current;
      rerender({ data: { filingWindowOpens: "2025-07-01" } });
      const secondResult = result.current;

      expect(firstResult).not.toBe(secondResult);
      expect(secondResult.filingWindowOpens).toBe("2025-07-01");
    });
  });

  describe("edge cases", () => {
    it("handles leap year dates correctly", () => {
      // 2024 is a leap year - Feb 29 exists
      const input: DerivedDatesInput = {
        sundayAdFirstDate: "2024-02-29",
        sundayAdSecondDate: "2024-03-10",
      };

      const { result } = renderHook(() => useDerivedDates(input));

      expect(result.current.recruitmentStartDate).toBe("2024-02-29");
      expect(result.current.filingWindowOpens).toBe(
        addDays("2024-03-10", FILING_WINDOW_WAIT_DAYS)
      );
    });

    it("handles year boundary dates correctly", () => {
      const input: DerivedDatesInput = {
        sundayAdFirstDate: "2024-12-15",
        sundayAdSecondDate: "2025-01-05",
      };

      const { result } = renderHook(() => useDerivedDates(input));

      expect(result.current.recruitmentStartDate).toBe("2024-12-15");
      expect(result.current.recruitmentEndDate).toBe("2025-01-05");
      // 2025-01-05 + 30 days = 2025-02-04
      expect(result.current.filingWindowOpens).toBe("2025-02-04");
    });

    it("handles all null stored values with valid raw dates", () => {
      const input: DerivedDatesInput = {
        filingWindowOpens: null,
        filingWindowCloses: null,
        recruitmentStartDate: null,
        recruitmentEndDate: null,
        recruitmentWindowCloses: null,
        sundayAdFirstDate: "2025-03-01",
        sundayAdSecondDate: "2025-04-01",
        pwdExpirationDate: "2025-09-01",
      };

      const { result } = renderHook(() => useDerivedDates(input));

      expect(result.current.recruitmentStartDate).toBe("2025-03-01");
      expect(result.current.recruitmentEndDate).toBe("2025-04-01");
      expect(result.current.filingWindowOpens).toBe(
        addDays("2025-04-01", FILING_WINDOW_WAIT_DAYS)
      );
      // MIN(2025-03-01 + 180, 2025-09-01) = MIN(2025-08-28, 2025-09-01)
      expect(result.current.filingWindowCloses).toBe(
        addDays("2025-03-01", FILING_WINDOW_CLOSE_DAYS)
      );
    });

    it("converts null to undefined for output compatibility", () => {
      const input: DerivedDatesInput = {
        recruitmentWindowCloses: null,
      };

      const { result } = renderHook(() => useDerivedDates(input));

      // Should be undefined, not null
      expect(result.current.recruitmentWindowCloses).toBeUndefined();
      expect(result.current.recruitmentWindowCloses).not.toBeNull();
    });
  });

  describe("complete case scenario", () => {
    it("handles a typical PWD stage case", () => {
      const input: DerivedDatesInput = {
        // Stored values not yet populated
        filingWindowOpens: null,
        filingWindowCloses: null,
        recruitmentStartDate: null,
        recruitmentEndDate: null,
        // Raw dates from PWD determination
        pwdExpirationDate: "2025-12-31",
      };

      const { result } = renderHook(() => useDerivedDates(input));

      // All should be undefined since no recruitment has started
      expect(result.current.filingWindowOpens).toBeUndefined();
      expect(result.current.filingWindowCloses).toBeUndefined();
      expect(result.current.recruitmentStartDate).toBeUndefined();
      expect(result.current.recruitmentEndDate).toBeUndefined();
    });

    it("handles a recruitment stage case with all dates", () => {
      const input: DerivedDatesInput = {
        sundayAdFirstDate: "2025-03-02",
        sundayAdSecondDate: "2025-03-09",
        jobOrderStartDate: "2025-03-01",
        jobOrderEndDate: "2025-04-15",
        noticeOfFilingStartDate: "2025-03-03",
        noticeOfFilingEndDate: "2025-03-17",
        isProfessionalOccupation: true,
        additionalRecruitmentEndDate: "2025-04-20",
        additionalRecruitmentMethods: [{ date: "2025-04-25" }],
        pwdExpirationDate: "2025-12-31",
      };

      const { result } = renderHook(() => useDerivedDates(input));

      // Start: MIN(2025-03-02, 2025-03-01, 2025-03-03) = 2025-03-01
      expect(result.current.recruitmentStartDate).toBe("2025-03-01");
      // End: MAX(2025-03-09, 2025-04-15, 2025-03-17, 2025-04-20, 2025-04-25) = 2025-04-25
      expect(result.current.recruitmentEndDate).toBe("2025-04-25");
      // Opens: 2025-04-25 + 30 = 2025-05-25
      expect(result.current.filingWindowOpens).toBe("2025-05-25");
      // Closes: MIN(2025-03-01 + 180, 2025-12-31) = MIN(2025-08-28, 2025-12-31) = 2025-08-28
      expect(result.current.filingWindowCloses).toBe("2025-08-28");
    });
  });
});
