/**
 * Tests for deadline extraction.
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import {
  extractActiveDeadlines,
  getActiveDeadlineTypes,
  shouldRemindForDeadline,
  daysBetween,
} from "./extractActiveDeadlines";
import type { CaseDataForDeadlines } from "./types";

describe("daysBetween", () => {
  it("returns positive days for future date", () => {
    expect(daysBetween("2024-01-01", "2024-01-15")).toBe(14);
  });

  it("returns negative days for past date", () => {
    expect(daysBetween("2024-01-15", "2024-01-01")).toBe(-14);
  });

  it("returns 0 for same date", () => {
    expect(daysBetween("2024-01-15", "2024-01-15")).toBe(0);
  });

  it("handles year boundaries", () => {
    expect(daysBetween("2024-12-31", "2025-01-01")).toBe(1);
  });

  it("handles leap years", () => {
    expect(daysBetween("2024-02-28", "2024-03-01")).toBe(2); // 2024 is leap year
    expect(daysBetween("2023-02-28", "2023-03-01")).toBe(1); // 2023 is not
  });
});

describe("extractActiveDeadlines", () => {
  const TODAY = "2024-12-15";

  describe("filtering", () => {
    it("returns empty array for closed cases", () => {
      const caseData: CaseDataForDeadlines = {
        caseStatus: "closed",
        pwdExpirationDate: "2025-06-30",
      };

      const result = extractActiveDeadlines(caseData, TODAY);

      expect(result).toHaveLength(0);
    });

    it("returns empty array for deleted cases", () => {
      const caseData: CaseDataForDeadlines = {
        deletedAt: Date.now(),
        pwdExpirationDate: "2025-06-30",
      };

      const result = extractActiveDeadlines(caseData, TODAY);

      expect(result).toHaveLength(0);
    });
  });

  describe("PWD expiration", () => {
    it("extracts PWD expiration when active", () => {
      const caseData: CaseDataForDeadlines = {
        pwdExpirationDate: "2025-06-30",
      };

      const result = extractActiveDeadlines(caseData, TODAY);

      // PWD expiration + per-step recruitment deadlines (computed from PWD alone)
      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result).toContainEqual(expect.objectContaining({
        type: "pwd_expiration",
        label: "PWD Expiration",
        date: "2025-06-30",
      }));
    });

    it("does not extract PWD when ETA 9089 filed", () => {
      const caseData: CaseDataForDeadlines = {
        pwdExpirationDate: "2025-06-30",
        eta9089FilingDate: "2024-12-01",
      };

      const result = extractActiveDeadlines(caseData, TODAY);
      const pwdDeadline = result.find((d) => d.type === "pwd_expiration");

      expect(pwdDeadline).toBeUndefined();
    });
  });

  describe("filing window", () => {
    // Filing window requires recruitment to be complete
    const completedRecruitment = {
      jobOrderStartDate: "2024-08-01",
      jobOrderEndDate: "2024-09-01",
      sundayAdFirstDate: "2024-08-04",
      sundayAdSecondDate: "2024-08-11",
      noticeOfFilingStartDate: "2024-08-01",
      noticeOfFilingEndDate: "2024-08-15",
    };

    it("extracts filing window opens when active", () => {
      const caseData: CaseDataForDeadlines = {
        ...completedRecruitment,
        filingWindowOpens: "2025-03-01",
      };

      const result = extractActiveDeadlines(caseData, TODAY);

      expect(result.find((d) => d.type === "filing_window_opens")).toBeDefined();
    });

    it("extracts filing window closes when active", () => {
      const caseData: CaseDataForDeadlines = {
        ...completedRecruitment,
        filingWindowCloses: "2025-06-15",
      };

      const result = extractActiveDeadlines(caseData, TODAY);

      expect(result.find((d) => d.type === "filing_window_closes")).toBeDefined();
    });

    it("does not extract filing window when recruitment incomplete", () => {
      const caseData: CaseDataForDeadlines = {
        filingWindowOpens: "2025-03-01",
        filingWindowCloses: "2025-06-15",
      };

      const result = extractActiveDeadlines(caseData, TODAY);

      expect(result.find((d) => d.type === "filing_window_opens")).toBeUndefined();
      expect(result.find((d) => d.type === "filing_window_closes")).toBeUndefined();
    });

    it("does not extract filing window when ETA 9089 filed", () => {
      const caseData: CaseDataForDeadlines = {
        ...completedRecruitment,
        filingWindowOpens: "2025-03-01",
        filingWindowCloses: "2025-06-15",
        eta9089FilingDate: "2024-12-01",
      };

      const result = extractActiveDeadlines(caseData, TODAY);

      expect(result.find((d) => d.type === "filing_window_opens")).toBeUndefined();
      expect(result.find((d) => d.type === "filing_window_closes")).toBeUndefined();
    });
  });

  describe("I-140 deadline", () => {
    it("extracts I-140 deadline when certified and not filed", () => {
      const caseData: CaseDataForDeadlines = {
        eta9089CertificationDate: "2024-06-01",
        eta9089ExpirationDate: "2024-11-28",
      };

      const result = extractActiveDeadlines(caseData, TODAY);

      const i140Deadline = result.find((d) => d.type === "i140_filing_deadline");
      expect(i140Deadline).toBeDefined();
      expect(i140Deadline?.date).toBe("2024-11-28");
    });

    it("does not extract I-140 deadline when filed", () => {
      const caseData: CaseDataForDeadlines = {
        eta9089CertificationDate: "2024-06-01",
        eta9089ExpirationDate: "2024-11-28",
        i140FilingDate: "2024-10-01",
      };

      const result = extractActiveDeadlines(caseData, TODAY);

      expect(result.find((d) => d.type === "i140_filing_deadline")).toBeUndefined();
    });

    it("does not extract I-140 deadline when not certified", () => {
      const caseData: CaseDataForDeadlines = {
        eta9089FilingDate: "2024-05-01",
      };

      const result = extractActiveDeadlines(caseData, TODAY);

      expect(result.find((d) => d.type === "i140_filing_deadline")).toBeUndefined();
    });
  });

  describe("RFI deadline", () => {
    it("extracts RFI deadline when active", () => {
      const caseData: CaseDataForDeadlines = {
        rfiEntries: [
          {
            id: "rfi-1", createdAt: Date.now(),
            receivedDate: "2024-12-01",
            responseDueDate: "2024-12-31",
          },
        ],
      };

      const result = extractActiveDeadlines(caseData, TODAY);

      const rfiDeadline = result.find((d) => d.type === "rfi_due");
      expect(rfiDeadline).toBeDefined();
      expect(rfiDeadline?.date).toBe("2024-12-31");
      expect(rfiDeadline?.entryId).toBe("rfi-1");
    });

    it("does not extract RFI deadline when responded", () => {
      const caseData: CaseDataForDeadlines = {
        rfiEntries: [
          {
            id: "rfi-1", createdAt: Date.now(),
            receivedDate: "2024-12-01",
            responseDueDate: "2024-12-31",
            responseSubmittedDate: "2024-12-15",
          },
        ],
      };

      const result = extractActiveDeadlines(caseData, TODAY);

      expect(result.find((d) => d.type === "rfi_due")).toBeUndefined();
    });
  });

  describe("RFE deadline", () => {
    it("extracts RFE deadline when active", () => {
      const caseData: CaseDataForDeadlines = {
        rfeEntries: [
          {
            id: "rfe-1", createdAt: Date.now(),
            receivedDate: "2024-12-01",
            responseDueDate: "2025-01-15",
          },
        ],
      };

      const result = extractActiveDeadlines(caseData, TODAY);

      const rfeDeadline = result.find((d) => d.type === "rfe_due");
      expect(rfeDeadline).toBeDefined();
      expect(rfeDeadline?.date).toBe("2025-01-15");
      expect(rfeDeadline?.entryId).toBe("rfe-1");
    });

    it("does not extract RFE deadline when responded", () => {
      const caseData: CaseDataForDeadlines = {
        rfeEntries: [
          {
            id: "rfe-1", createdAt: Date.now(),
            receivedDate: "2024-12-01",
            responseDueDate: "2025-01-15",
            responseSubmittedDate: "2025-01-10",
          },
        ],
      };

      const result = extractActiveDeadlines(caseData, TODAY);

      expect(result.find((d) => d.type === "rfe_due")).toBeUndefined();
    });
  });

  describe("sorting", () => {
    // Filing window requires completed recruitment
    const completedRecruitment = {
      jobOrderStartDate: "2024-08-01",
      jobOrderEndDate: "2024-09-01",
      sundayAdFirstDate: "2024-08-04",
      sundayAdSecondDate: "2024-08-11",
      noticeOfFilingStartDate: "2024-08-01",
      noticeOfFilingEndDate: "2024-08-15",
    };

    it("sorts deadlines by daysUntil (most urgent first)", () => {
      const caseData: CaseDataForDeadlines = {
        ...completedRecruitment,
        pwdExpirationDate: "2025-06-30", // Far future
        filingWindowOpens: "2025-01-01", // Soon
        rfiEntries: [
          {
            id: "rfi-1", createdAt: Date.now(),
            receivedDate: "2024-12-01",
            responseDueDate: "2024-12-20", // Very soon
          },
        ],
      };

      const result = extractActiveDeadlines(caseData, TODAY);

      expect(result.length).toBeGreaterThanOrEqual(3);
      // Most urgent (smallest daysUntil) should be first
      for (let i = 1; i < result.length; i++) {
        expect(result[i]!.daysUntil).toBeGreaterThanOrEqual(result[i - 1]!.daysUntil);
      }
    });

    it("handles overdue deadlines (negative daysUntil)", () => {
      const caseData: CaseDataForDeadlines = {
        ...completedRecruitment,
        pwdExpirationDate: "2024-12-01", // Overdue
        filingWindowOpens: "2025-01-01", // Future
      };

      const result = extractActiveDeadlines(caseData, TODAY);

      expect(result.length).toBe(2);
      expect(result[0]!.daysUntil).toBeLessThan(0); // Overdue first
      expect(result[1]!.daysUntil).toBeGreaterThan(0); // Future second
    });
  });

  describe("multiple deadlines", () => {
    it("extracts all active deadlines from complex case", () => {
      const caseData: CaseDataForDeadlines = {
        jobOrderStartDate: "2024-08-01",
        jobOrderEndDate: "2024-09-01",
        sundayAdFirstDate: "2024-08-04",
        sundayAdSecondDate: "2024-08-11",
        noticeOfFilingStartDate: "2024-08-01",
        noticeOfFilingEndDate: "2024-08-15",
        pwdExpirationDate: "2025-06-30",
        filingWindowOpens: "2025-03-01",
        filingWindowCloses: "2025-06-15",
        rfiEntries: [
          {
            id: "rfi-1", createdAt: Date.now(),
            receivedDate: "2024-12-01",
            responseDueDate: "2024-12-31",
          },
        ],
      };

      const result = extractActiveDeadlines(caseData, TODAY);

      expect(result.length).toBe(4);
      expect(result.map((d) => d.type)).toContain("pwd_expiration");
      expect(result.map((d) => d.type)).toContain("filing_window_opens");
      expect(result.map((d) => d.type)).toContain("filing_window_closes");
      expect(result.map((d) => d.type)).toContain("rfi_due");
    });
  });
});

describe("timezoneRule on extracted deadlines", () => {
  const TODAY = "2024-12-15";
  // Filing window requires completed recruitment
  const completedRecruitment = {
    jobOrderStartDate: "2024-08-01",
    jobOrderEndDate: "2024-09-01",
    sundayAdFirstDate: "2024-08-04",
    sundayAdSecondDate: "2024-08-11",
    noticeOfFilingStartDate: "2024-08-01",
    noticeOfFilingEndDate: "2024-08-15",
  };

  it("sets timezoneRule to 'local' for pwd_expiration", () => {
    const caseData: CaseDataForDeadlines = {
      pwdExpirationDate: "2025-06-30",
    };
    const result = extractActiveDeadlines(caseData, TODAY);
    const pwd = result.find((d) => d.type === "pwd_expiration");
    expect(pwd?.timezoneRule).toBe("local");
  });

  it("sets timezoneRule to 'local' for filing_window_opens", () => {
    const caseData: CaseDataForDeadlines = {
      ...completedRecruitment,
      filingWindowOpens: "2025-03-01",
    };
    const result = extractActiveDeadlines(caseData, TODAY);
    const fwo = result.find((d) => d.type === "filing_window_opens");
    expect(fwo?.timezoneRule).toBe("local");
  });

  it("sets timezoneRule to 'dol' for filing_window_closes", () => {
    const caseData: CaseDataForDeadlines = {
      ...completedRecruitment,
      filingWindowCloses: "2025-06-15",
    };
    const result = extractActiveDeadlines(caseData, TODAY);
    const fwc = result.find((d) => d.type === "filing_window_closes");
    expect(fwc?.timezoneRule).toBe("dol");
  });

  it("extracts recruitment_window_closes when active", () => {
    const caseData: CaseDataForDeadlines = {
      recruitmentWindowCloses: "2025-04-01",
    };
    const result = extractActiveDeadlines(caseData, TODAY);
    const rwc = result.find((d) => d.type === "recruitment_window_closes");
    expect(rwc).toBeDefined();
    expect(rwc?.timezoneRule).toBe("local");
  });

  it("sets timezoneRule to 'local' for i140_filing_deadline", () => {
    const caseData: CaseDataForDeadlines = {
      eta9089CertificationDate: "2024-06-01",
      eta9089ExpirationDate: "2024-11-28",
    };
    const result = extractActiveDeadlines(caseData, TODAY);
    const i140 = result.find((d) => d.type === "i140_filing_deadline");
    expect(i140?.timezoneRule).toBe("local");
  });

  it("sets timezoneRule to 'dol' for rfi_due", () => {
    const caseData: CaseDataForDeadlines = {
      rfiEntries: [
        {
          id: "rfi-1",
          createdAt: Date.now(),
          receivedDate: "2024-12-01",
          responseDueDate: "2024-12-31",
        },
      ],
    };
    const result = extractActiveDeadlines(caseData, TODAY);
    const rfi = result.find((d) => d.type === "rfi_due");
    expect(rfi?.timezoneRule).toBe("dol");
  });

  it("sets timezoneRule to 'local' for rfe_due", () => {
    const caseData: CaseDataForDeadlines = {
      rfeEntries: [
        {
          id: "rfe-1",
          createdAt: Date.now(),
          receivedDate: "2024-12-01",
          responseDueDate: "2025-01-15",
        },
      ],
    };
    const result = extractActiveDeadlines(caseData, TODAY);
    const rfe = result.find((d) => d.type === "rfe_due");
    expect(rfe?.timezoneRule).toBe("local");
  });

  it("all DOL deadlines are only filing_window_closes and rfi_due", () => {
    const caseData: CaseDataForDeadlines = {
      ...completedRecruitment,
      pwdExpirationDate: "2025-06-30",
      filingWindowOpens: "2025-03-01",
      filingWindowCloses: "2025-06-15",
      recruitmentWindowCloses: "2025-04-01",
      eta9089CertificationDate: "2024-06-01",
      eta9089ExpirationDate: "2024-11-28",
      rfiEntries: [
        {
          id: "rfi-1",
          createdAt: Date.now(),
          receivedDate: "2024-12-01",
          responseDueDate: "2024-12-31",
        },
      ],
      rfeEntries: [
        {
          id: "rfe-1",
          createdAt: Date.now(),
          receivedDate: "2024-12-01",
          responseDueDate: "2025-01-15",
        },
      ],
    };
    const result = extractActiveDeadlines(caseData, TODAY);

    const dolDeadlines = result.filter((d) => d.timezoneRule === "dol");
    const localDeadlines = result.filter((d) => d.timezoneRule === "local");

    expect(dolDeadlines.map((d) => d.type).sort()).toEqual(
      ["filing_window_closes", "rfi_due"].sort()
    );
    expect(localDeadlines.length).toBe(result.length - dolDeadlines.length);
    for (const d of localDeadlines) {
      expect(d.timezoneRule).toBe("local");
    }
  });
});

describe("timezone-aware daysUntil", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("DOL deadline daysUntil differs from local deadline near midnight", () => {
    // Mock: 11 PM Pacific on June 30 = 2 AM ET July 1
    const mockDate = new Date("2025-07-01T06:00:00Z");
    vi.useFakeTimers();
    vi.setSystemTime(mockDate);

    const caseData: CaseDataForDeadlines = {
      pwdExpirationDate: "2025-07-01", // local deadline: due July 1
      filingWindowCloses: "2025-07-01", // DOL deadline: due July 1
      // Completed recruitment required for filing window
      jobOrderStartDate: "2025-01-01",
      jobOrderEndDate: "2025-02-01",
      sundayAdFirstDate: "2025-01-05",
      sundayAdSecondDate: "2025-01-12",
      noticeOfFilingStartDate: "2025-01-01",
      noticeOfFilingEndDate: "2025-01-15",
    };

    // Call WITHOUT todayISO, user in Pacific Time
    const result = extractActiveDeadlines(caseData, undefined, "America/Los_Angeles");

    const pwd = result.find((d) => d.type === "pwd_expiration");
    const fwc = result.find((d) => d.type === "filing_window_closes");

    // In PT (11 PM June 30): PWD due July 1 → daysUntil = 1
    // In ET (2 AM July 1): filing window due July 1 → daysUntil = 0
    expect(pwd).toBeDefined();
    expect(fwc).toBeDefined();
    expect(pwd!.daysUntil).toBe(1); // PT: still June 30
    expect(fwc!.daysUntil).toBe(0); // ET: already July 1
  });
});

describe("getActiveDeadlineTypes", () => {
  it("returns all active deadline types", () => {
    const caseData: CaseDataForDeadlines = {
      pwdExpirationDate: "2025-06-30",
      filingWindowOpens: "2025-03-01",
      // Completed recruitment required for filing window
      jobOrderStartDate: "2024-08-01",
      jobOrderEndDate: "2024-09-01",
      sundayAdFirstDate: "2024-08-04",
      sundayAdSecondDate: "2024-08-11",
      noticeOfFilingStartDate: "2024-08-01",
      noticeOfFilingEndDate: "2024-08-15",
    };

    const result = getActiveDeadlineTypes(caseData);

    expect(result).toContain("pwd_expiration");
    expect(result).toContain("filing_window_opens");
  });

  it("excludes superseded deadline types", () => {
    const caseData: CaseDataForDeadlines = {
      pwdExpirationDate: "2025-06-30",
      eta9089FilingDate: "2024-12-01",
    };

    const result = getActiveDeadlineTypes(caseData);

    expect(result).not.toContain("pwd_expiration");
    expect(result).not.toContain("filing_window_opens");
    expect(result).not.toContain("filing_window_closes");
  });
});

describe("per-step recruitment deadlines", () => {
    const TODAY = "2024-12-15";
    const baseCase: CaseDataForDeadlines = {
      pwdExpirationDate: "2025-06-30",
      sundayAdFirstDate: "2024-08-04", // first recruitment date
    };

    it("extracts job_order_start_deadline when conditions met", () => {
      const result = extractActiveDeadlines(baseCase, TODAY);
      const deadline = result.find((d) => d.type === "job_order_start_deadline");
      expect(deadline).toBeDefined();
      expect(deadline?.label).toBe("Start Job Order By");
    });

    it("does not extract job_order_start_deadline when step completed", () => {
      const caseData: CaseDataForDeadlines = {
        ...baseCase,
        jobOrderStartDate: "2024-09-01",
      };
      const result = extractActiveDeadlines(caseData, TODAY);
      expect(result.find((d) => d.type === "job_order_start_deadline")).toBeUndefined();
    });

    it("extracts notice_of_filing_start_deadline when conditions met", () => {
      const result = extractActiveDeadlines(baseCase, TODAY);
      const deadline = result.find((d) => d.type === "notice_of_filing_start_deadline");
      expect(deadline).toBeDefined();
      expect(deadline?.label).toBe("Start Notice of Filing By");
    });

    it("does not extract notice_of_filing_start_deadline when step completed", () => {
      const caseData: CaseDataForDeadlines = {
        ...baseCase,
        noticeOfFilingStartDate: "2024-09-01",
      };
      const result = extractActiveDeadlines(caseData, TODAY);
      expect(result.find((d) => d.type === "notice_of_filing_start_deadline")).toBeUndefined();
    });

    it("extracts first_sunday_ad_deadline when first ad not placed but other recruitment started", () => {
      const caseData: CaseDataForDeadlines = {
        pwdExpirationDate: "2025-06-30",
        jobOrderStartDate: "2024-08-01", // first recruitment = job order
      };
      const result = extractActiveDeadlines(caseData, TODAY);
      const deadline = result.find((d) => d.type === "first_sunday_ad_deadline");
      expect(deadline).toBeDefined();
    });

    it("extracts per-step deadlines from PWD expiration alone", () => {
      const caseData: CaseDataForDeadlines = {
        pwdExpirationDate: "2025-06-30",
        // No recruitment dates — deadlines computed from PWD arm only
      };
      const result = extractActiveDeadlines(caseData, TODAY);
      // Should have per-step deadlines derived from pwd-Y
      expect(result.find((d) => d.type === "job_order_start_deadline")).toBeDefined();
    });

    it("extracts per-step deadlines from firstRecruitmentDate alone", () => {
      const caseData: CaseDataForDeadlines = {
        sundayAdFirstDate: "2024-08-04",
        // No PWD expiration — deadlines computed from recruitment arm only
      };
      const result = extractActiveDeadlines(caseData, TODAY);
      // Should have per-step deadlines derived from first+X
      expect(result.find((d) => d.type === "job_order_start_deadline")).toBeDefined();
    });
});

describe("shouldRemindForDeadline", () => {
  it("returns true when deadline is active and has date", () => {
    const caseData: CaseDataForDeadlines = {
      pwdExpirationDate: "2025-06-30",
    };

    expect(shouldRemindForDeadline("pwd_expiration", caseData)).toBe(true);
  });

  it("returns false when deadline is superseded", () => {
    const caseData: CaseDataForDeadlines = {
      pwdExpirationDate: "2025-06-30",
      eta9089FilingDate: "2024-12-01",
    };

    expect(shouldRemindForDeadline("pwd_expiration", caseData)).toBe(false);
  });

  it("returns false when deadline has no date", () => {
    const caseData: CaseDataForDeadlines = {};

    expect(shouldRemindForDeadline("pwd_expiration", caseData)).toBe(false);
  });

  it("returns true for active RFI with due date", () => {
    const caseData: CaseDataForDeadlines = {
      rfiEntries: [
        {
          id: "rfi-1", createdAt: Date.now(),
          receivedDate: "2024-12-01",
          responseDueDate: "2024-12-31",
        },
      ],
    };

    expect(shouldRemindForDeadline("rfi_due", caseData)).toBe(true);
  });

  it("returns false for responded RFI", () => {
    const caseData: CaseDataForDeadlines = {
      rfiEntries: [
        {
          id: "rfi-1", createdAt: Date.now(),
          receivedDate: "2024-12-01",
          responseDueDate: "2024-12-31",
          responseSubmittedDate: "2024-12-15",
        },
      ],
    };

    expect(shouldRemindForDeadline("rfi_due", caseData)).toBe(false);
  });
});
