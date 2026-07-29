import { describe, it, expect, vi, afterEach } from "vitest";
import {
  checkDeadlineViolations,
  canRestartProcess,
  getRestartViability,
  generateClosureMessage,
  generateClosureTitle,
  getTodayISO,
  MIN_DAYS_FOR_RESTART,
  type CaseDataForEnforcement,
  type DeadlineViolation,
} from "../deadlineEnforcementHelpers";

// TEST FIXTURES

const TODAY_ISO = "2025-01-15";

function createMinimalCase(
  overrides: Partial<CaseDataForEnforcement> = {}
): CaseDataForEnforcement {
  return {
    caseStatus: "pwd",
    ...overrides,
  };
}

/**
 * Helper to create a date string N days from TODAY_ISO.
 */
function daysFromToday(days: number): string {
  const date = new Date("2025-01-15");
  date.setDate(date.getDate() + days);
  return date.toISOString().split("T")[0]!;
}

// canRestartProcess Tests

describe("canRestartProcess", () => {
  it("returns true when PWD has more than 60 days remaining", () => {
    // 91 days from today
    const pwdExpiration = daysFromToday(91);
    expect(canRestartProcess(pwdExpiration, TODAY_ISO)).toBe(true);
  });

  it("returns true when PWD has more than 60 days remaining (62 days)", () => {
    // Use 62 days to avoid edge case with date boundary
    const pwdExpiration = daysFromToday(62);
    expect(canRestartProcess(pwdExpiration, TODAY_ISO)).toBe(true);
  });

  it("returns false when PWD has exactly 60 days remaining", () => {
    const pwdExpiration = daysFromToday(60);
    expect(canRestartProcess(pwdExpiration, TODAY_ISO)).toBe(false);
  });

  it("returns false when PWD has less than 60 days remaining", () => {
    const pwdExpiration = daysFromToday(30);
    expect(canRestartProcess(pwdExpiration, TODAY_ISO)).toBe(false);
  });

  it("returns false when PWD has expired", () => {
    const pwdExpiration = daysFromToday(-10);
    expect(canRestartProcess(pwdExpiration, TODAY_ISO)).toBe(false);
  });

  it("returns false when PWD expiration is null", () => {
    expect(canRestartProcess(null, TODAY_ISO)).toBe(false);
  });

  it("returns false when PWD expiration is undefined", () => {
    expect(canRestartProcess(undefined, TODAY_ISO)).toBe(false);
  });

  it("returns false for invalid date format", () => {
    expect(canRestartProcess("invalid-date", TODAY_ISO)).toBe(false);
    expect(canRestartProcess("2025/01/15", TODAY_ISO)).toBe(false);
  });
});

// checkDeadlineViolations Tests - PWD Expiration

describe("getRestartViability", () => {
  it("distinguishes viable from not_viable by the 60-day threshold", () => {
    expect(getRestartViability(daysFromToday(91), TODAY_ISO)).toBe("viable");
    expect(getRestartViability(daysFromToday(45), TODAY_ISO)).toBe("not_viable");
  });

  // The whole point of the tri-state: a date we do not have is not the same
  // as a date that has run out.
  it("reports unknown when there is no usable PWD date", () => {
    expect(getRestartViability(undefined, TODAY_ISO)).toBe("unknown");
    expect(getRestartViability(null, TODAY_ISO)).toBe("unknown");
    expect(getRestartViability("", TODAY_ISO)).toBe("unknown");
    expect(getRestartViability("invalid-date", TODAY_ISO)).toBe("unknown");
    expect(getRestartViability("2025/01/15", TODAY_ISO)).toBe("unknown");
  });

  it("stays consistent with the boolean canRestartProcess", () => {
    for (const d of [daysFromToday(91), daysFromToday(45), undefined, "invalid-date"]) {
      expect(canRestartProcess(d, TODAY_ISO)).toBe(
        getRestartViability(d, TODAY_ISO) === "viable"
      );
    }
  });
});

// A missing PWD expiration date must never be read as "no time left".
// Previously every one of these closed the case outright.
describe("checkDeadlineViolations - unknown restart viability", () => {
  it("suggests review, not close, when the recruitment window passed without a PWD date", () => {
    const violation = checkDeadlineViolations(
      createMinimalCase({
        caseStatus: "recruitment",
        pwdExpirationDate: undefined,
        recruitmentStartDate: daysFromToday(-200),
        recruitmentComplete: false,
        recruitmentWindowCloses: daysFromToday(-10),
      }),
      TODAY_ISO
    );

    expect(violation).not.toBeNull();
    expect(violation!.type).toBe("recruitment_window_missed");
    expect(violation!.suggestedAction).toBe("review");
    expect(violation!.canRestart).toBe(false);
  });

  it("suggests review, not close, when the filing window passed without a PWD date", () => {
    const violation = checkDeadlineViolations(
      createMinimalCase({
        caseStatus: "eta9089",
        pwdExpirationDate: undefined,
        filingWindowCloses: daysFromToday(-10),
      }),
      TODAY_ISO
    );

    expect(violation).not.toBeNull();
    expect(violation!.type).toBe("filing_window_missed");
    expect(violation!.suggestedAction).toBe("review");
  });

  it("suggests review, not close, when the ETA 9089 expired without a PWD date", () => {
    const violation = checkDeadlineViolations(
      createMinimalCase({
        caseStatus: "i140",
        pwdExpirationDate: undefined,
        eta9089CertificationDate: daysFromToday(-200),
        eta9089ExpirationDate: daysFromToday(-20),
        i140FilingDate: undefined,
      }),
      TODAY_ISO
    );

    expect(violation).not.toBeNull();
    expect(violation!.type).toBe("eta9089_expired");
    expect(violation!.suggestedAction).toBe("review");
  });

  // The safety property that matters: neither enforcement caller acts unless
  // suggestedAction is exactly "close", so "review" cannot close a case.
  it("never yields close for any violation type when the PWD date is missing", () => {
    const cases: CaseDataForEnforcement[] = [
      createMinimalCase({
        recruitmentStartDate: daysFromToday(-200),
        recruitmentWindowCloses: daysFromToday(-10),
      }),
      createMinimalCase({ filingWindowCloses: daysFromToday(-10) }),
      createMinimalCase({
        eta9089CertificationDate: daysFromToday(-200),
        eta9089ExpirationDate: daysFromToday(-20),
      }),
    ];

    for (const c of cases) {
      const v = checkDeadlineViolations(c, TODAY_ISO);
      expect(v).not.toBeNull();
      expect(v!.suggestedAction).not.toBe("close");
    }
  });

  // A PWD date we DO hold, which HAS run out, must still close the case —
  // the fix must not blunt genuine enforcement.
  it("still closes when the PWD date is present and out of time", () => {
    const violation = checkDeadlineViolations(
      createMinimalCase({
        caseStatus: "recruitment",
        pwdExpirationDate: daysFromToday(45), // present, ≤60 days
        recruitmentStartDate: daysFromToday(-200),
        recruitmentComplete: false,
        recruitmentWindowCloses: daysFromToday(-10),
      }),
      TODAY_ISO
    );

    expect(violation!.suggestedAction).toBe("close");
  });
});

describe("checkDeadlineViolations - PWD Expiration", () => {
  it("returns pwd_expired when PWD expired and ETA 9089 not filed", () => {
    const caseData = createMinimalCase({
      caseStatus: "recruitment",
      pwdExpirationDate: daysFromToday(-10), // Expired 10 days ago
      eta9089FilingDate: undefined,
    });

    const violation = checkDeadlineViolations(caseData, TODAY_ISO);

    expect(violation).not.toBeNull();
    expect(violation!.type).toBe("pwd_expired");
    expect(violation!.suggestedAction).toBe("close");
    expect(violation!.canRestart).toBe(false);
  });

  it("returns null when PWD expired but ETA 9089 already filed", () => {
    const caseData = createMinimalCase({
      caseStatus: "eta9089",
      pwdExpirationDate: daysFromToday(-10), // Expired
      eta9089FilingDate: daysFromToday(-30), // Filed before expiration
    });

    const violation = checkDeadlineViolations(caseData, TODAY_ISO);
    expect(violation).toBeNull();
  });

  it("returns null when PWD is still valid", () => {
    const caseData = createMinimalCase({
      caseStatus: "recruitment",
      pwdExpirationDate: daysFromToday(90),
      eta9089FilingDate: undefined,
    });

    const violation = checkDeadlineViolations(caseData, TODAY_ISO);
    expect(violation).toBeNull();
  });
});

// checkDeadlineViolations Tests - Recruitment Window

describe("checkDeadlineViolations - Recruitment Window", () => {
  it("returns recruitment_window_missed with restart when PWD >60 days", () => {
    const caseData = createMinimalCase({
      caseStatus: "recruitment",
      pwdExpirationDate: daysFromToday(120), // 120 days remaining - can restart
      recruitmentStartDate: daysFromToday(-200),
      recruitmentWindowCloses: daysFromToday(-10), // Missed 10 days ago
      eta9089FilingDate: undefined,
    });

    const violation = checkDeadlineViolations(caseData, TODAY_ISO);

    expect(violation).not.toBeNull();
    expect(violation!.type).toBe("recruitment_window_missed");
    expect(violation!.suggestedAction).toBe("restart_recruitment");
    expect(violation!.canRestart).toBe(true);
  });

  it("returns recruitment_window_missed with close when PWD ≤60 days", () => {
    const caseData = createMinimalCase({
      caseStatus: "recruitment",
      pwdExpirationDate: daysFromToday(45), // Only 45 days remaining - must close
      recruitmentStartDate: daysFromToday(-200),
      recruitmentWindowCloses: daysFromToday(-10), // Missed
      eta9089FilingDate: undefined,
    });

    const violation = checkDeadlineViolations(caseData, TODAY_ISO);

    expect(violation).not.toBeNull();
    expect(violation!.type).toBe("recruitment_window_missed");
    expect(violation!.suggestedAction).toBe("close");
    expect(violation!.canRestart).toBe(false);
  });

  it("returns null when recruitment window is still open", () => {
    const caseData = createMinimalCase({
      caseStatus: "recruitment",
      pwdExpirationDate: daysFromToday(120),
      recruitmentStartDate: daysFromToday(-30),
      recruitmentWindowCloses: daysFromToday(120), // Still open
      eta9089FilingDate: undefined,
    });

    const violation = checkDeadlineViolations(caseData, TODAY_ISO);
    expect(violation).toBeNull();
  });

  // Regression: the window governs when recruitment must FINISH. A case that
  // finished in time was previously flagged the moment that date slipped into
  // the past, and the daily enforcement cron closed it again every night.
  it("returns null when recruitment completed before the window closed", () => {
    const caseData = createMinimalCase({
      caseStatus: "recruitment",
      pwdExpirationDate: daysFromToday(16),
      recruitmentStartDate: daysFromToday(-68),
      recruitmentEndDate: daysFromToday(-37), // finished...
      recruitmentComplete: true,
      recruitmentWindowCloses: daysFromToday(-14), // ...23 days before the deadline
      eta9089FilingDate: undefined,
    });

    expect(checkDeadlineViolations(caseData, TODAY_ISO)).toBeNull();
  });

  it("still flags a case whose recruitment never completed", () => {
    const caseData = createMinimalCase({
      caseStatus: "recruitment",
      pwdExpirationDate: daysFromToday(45),
      recruitmentStartDate: daysFromToday(-200),
      recruitmentEndDate: undefined,
      recruitmentComplete: false,
      recruitmentWindowCloses: daysFromToday(-10),
      eta9089FilingDate: undefined,
    });

    const violation = checkDeadlineViolations(caseData, TODAY_ISO);
    expect(violation).not.toBeNull();
    expect(violation!.type).toBe("recruitment_window_missed");
  });

  // Both halves of the guard are load-bearing. A partial end date can precede
  // the window (e.g. a job order ran, but the Sunday ads never did), so the
  // date comparison alone would wrongly spare an unfinished case.
  it("still flags an incomplete case whose partial end date precedes the window", () => {
    const caseData = createMinimalCase({
      caseStatus: "recruitment",
      pwdExpirationDate: daysFromToday(45),
      recruitmentStartDate: daysFromToday(-200),
      recruitmentEndDate: daysFromToday(-60), // before the deadline...
      recruitmentComplete: false, // ...but recruitment was never finished
      recruitmentWindowCloses: daysFromToday(-10),
      eta9089FilingDate: undefined,
    });

    const violation = checkDeadlineViolations(caseData, TODAY_ISO);
    expect(violation).not.toBeNull();
    expect(violation!.type).toBe("recruitment_window_missed");
  });

  // The mirror case: every step has a date, but they were backfilled after the
  // deadline. Completeness alone would wrongly spare this.
  it("still flags a complete case that finished after the window closed", () => {
    const caseData = createMinimalCase({
      caseStatus: "recruitment",
      pwdExpirationDate: daysFromToday(45),
      recruitmentStartDate: daysFromToday(-200),
      recruitmentEndDate: daysFromToday(-5), // finished after...
      recruitmentComplete: true,
      recruitmentWindowCloses: daysFromToday(-10), // ...the deadline
      eta9089FilingDate: undefined,
    });

    const violation = checkDeadlineViolations(caseData, TODAY_ISO);
    expect(violation).not.toBeNull();
    expect(violation!.type).toBe("recruitment_window_missed");
  });

  it("treats finishing exactly on the deadline as met", () => {
    const caseData = createMinimalCase({
      caseStatus: "recruitment",
      pwdExpirationDate: daysFromToday(120),
      recruitmentStartDate: daysFromToday(-200),
      recruitmentEndDate: daysFromToday(-10),
      recruitmentComplete: true,
      recruitmentWindowCloses: daysFromToday(-10), // same day
      eta9089FilingDate: undefined,
    });

    expect(checkDeadlineViolations(caseData, TODAY_ISO)).toBeNull();
  });

  // Completing recruitment must not mask a genuinely missed FILING deadline —
  // that obligation is checked separately and still has to fire.
  it("still flags the filing window when recruitment finished in time but nothing was filed", () => {
    const caseData = createMinimalCase({
      caseStatus: "recruitment",
      pwdExpirationDate: daysFromToday(120),
      recruitmentStartDate: daysFromToday(-250),
      recruitmentEndDate: daysFromToday(-200),
      recruitmentComplete: true,
      recruitmentWindowCloses: daysFromToday(-100),
      filingWindowCloses: daysFromToday(-20), // filing deadline blown
      eta9089FilingDate: undefined,
    });

    const violation = checkDeadlineViolations(caseData, TODAY_ISO);
    expect(violation).not.toBeNull();
    expect(violation!.type).toBe("filing_window_missed");
  });

  // …and an expired PWD must still close the case outright.
  it("still flags PWD expiration for a case that completed recruitment in time", () => {
    const caseData = createMinimalCase({
      caseStatus: "recruitment",
      pwdExpirationDate: daysFromToday(-1),
      recruitmentStartDate: daysFromToday(-100),
      recruitmentEndDate: daysFromToday(-60),
      recruitmentComplete: true,
      recruitmentWindowCloses: daysFromToday(-30),
      eta9089FilingDate: undefined,
    });

    const violation = checkDeadlineViolations(caseData, TODAY_ISO);
    expect(violation).not.toBeNull();
    expect(violation!.type).toBe("pwd_expired");
    expect(violation!.suggestedAction).toBe("close");
  });
});

// checkDeadlineViolations Tests - Filing Window

describe("checkDeadlineViolations - Filing Window", () => {
  it("returns filing_window_missed with restart when PWD >60 days", () => {
    const caseData = createMinimalCase({
      caseStatus: "recruitment",
      pwdExpirationDate: daysFromToday(120), // Can restart
      filingWindowCloses: daysFromToday(-5), // Missed 5 days ago
      eta9089FilingDate: undefined,
    });

    const violation = checkDeadlineViolations(caseData, TODAY_ISO);

    expect(violation).not.toBeNull();
    expect(violation!.type).toBe("filing_window_missed");
    expect(violation!.suggestedAction).toBe("restart_recruitment");
    expect(violation!.canRestart).toBe(true);
  });

  it("returns filing_window_missed with close when PWD ≤60 days", () => {
    const caseData = createMinimalCase({
      caseStatus: "recruitment",
      pwdExpirationDate: daysFromToday(30), // Must close
      filingWindowCloses: daysFromToday(-5), // Missed
      eta9089FilingDate: undefined,
    });

    const violation = checkDeadlineViolations(caseData, TODAY_ISO);

    expect(violation).not.toBeNull();
    expect(violation!.type).toBe("filing_window_missed");
    expect(violation!.suggestedAction).toBe("close");
    expect(violation!.canRestart).toBe(false);
  });

  it("returns null when filing window is still open", () => {
    const caseData = createMinimalCase({
      caseStatus: "recruitment",
      pwdExpirationDate: daysFromToday(120),
      filingWindowCloses: daysFromToday(30), // Still open
      eta9089FilingDate: undefined,
    });

    const violation = checkDeadlineViolations(caseData, TODAY_ISO);
    expect(violation).toBeNull();
  });
});

// checkDeadlineViolations Tests - ETA 9089 Expiration

describe("checkDeadlineViolations - ETA 9089 Expiration", () => {
  it("returns eta9089_expired with restart_eta9089 when can restart and filing window open", () => {
    const caseData = createMinimalCase({
      caseStatus: "eta9089",
      pwdExpirationDate: daysFromToday(120), // Can restart
      eta9089CertificationDate: daysFromToday(-200), // Certified 200 days ago
      eta9089ExpirationDate: daysFromToday(-20), // Expired 20 days ago (180 days after cert)
      filingWindowCloses: daysFromToday(30), // Filing window still open
      i140FilingDate: undefined,
    });

    const violation = checkDeadlineViolations(caseData, TODAY_ISO);

    expect(violation).not.toBeNull();
    expect(violation!.type).toBe("eta9089_expired");
    expect(violation!.suggestedAction).toBe("restart_eta9089");
    expect(violation!.canRestart).toBe(true);
  });

  it("returns eta9089_expired with restart_recruitment when filing window open but ETA9089 filed previously", () => {
    // When ETA 9089 was filed (meaning we're past the filing window check),
    // but certification expired before I-140 filing
    const caseData = createMinimalCase({
      caseStatus: "eta9089",
      pwdExpirationDate: daysFromToday(120), // Can restart
      eta9089FilingDate: daysFromToday(-190), // ETA 9089 was filed
      eta9089CertificationDate: daysFromToday(-185), // Certified
      eta9089ExpirationDate: daysFromToday(-5), // Expired (180 days after cert)
      // No filing window since ETA 9089 already filed
      i140FilingDate: undefined,
    });

    const violation = checkDeadlineViolations(caseData, TODAY_ISO);

    expect(violation).not.toBeNull();
    expect(violation!.type).toBe("eta9089_expired");
    // With no filingWindowCloses set, suggests restart_eta9089
    expect(violation!.suggestedAction).toBe("restart_eta9089");
    expect(violation!.canRestart).toBe(true);
  });

  it("returns eta9089_expired with close when PWD ≤60 days", () => {
    const caseData = createMinimalCase({
      caseStatus: "eta9089",
      pwdExpirationDate: daysFromToday(45), // Must close
      eta9089CertificationDate: daysFromToday(-200),
      eta9089ExpirationDate: daysFromToday(-20), // Expired
      i140FilingDate: undefined,
    });

    const violation = checkDeadlineViolations(caseData, TODAY_ISO);

    expect(violation).not.toBeNull();
    expect(violation!.type).toBe("eta9089_expired");
    expect(violation!.suggestedAction).toBe("close");
    expect(violation!.canRestart).toBe(false);
  });

  it("returns null when I-140 is already filed", () => {
    const caseData = createMinimalCase({
      caseStatus: "i140",
      pwdExpirationDate: daysFromToday(45),
      eta9089CertificationDate: daysFromToday(-200),
      eta9089ExpirationDate: daysFromToday(-20), // Expired but I-140 filed
      i140FilingDate: daysFromToday(-25), // Filed before expiration
    });

    const violation = checkDeadlineViolations(caseData, TODAY_ISO);
    expect(violation).toBeNull();
  });

  it("returns null when ETA 9089 is still valid", () => {
    const caseData = createMinimalCase({
      caseStatus: "eta9089",
      pwdExpirationDate: daysFromToday(120),
      eta9089CertificationDate: daysFromToday(-30),
      eta9089ExpirationDate: daysFromToday(150), // Still valid
      i140FilingDate: undefined,
    });

    const violation = checkDeadlineViolations(caseData, TODAY_ISO);
    expect(violation).toBeNull();
  });
});

// checkDeadlineViolations Tests - Edge Cases

describe("checkDeadlineViolations - Edge Cases", () => {
  it("skips already closed cases", () => {
    const caseData = createMinimalCase({
      caseStatus: "closed",
      pwdExpirationDate: daysFromToday(-100), // Super expired
    });

    const violation = checkDeadlineViolations(caseData, TODAY_ISO);
    expect(violation).toBeNull();
  });

  it("skips deleted cases", () => {
    const caseData = createMinimalCase({
      caseStatus: "pwd",
      deletedAt: Date.now() - 1000,
      pwdExpirationDate: daysFromToday(-100),
    });

    const violation = checkDeadlineViolations(caseData, TODAY_ISO);
    expect(violation).toBeNull();
  });

  it("returns null for case with no deadline data", () => {
    const caseData = createMinimalCase({
      caseStatus: "pwd",
      // No dates set
    });

    const violation = checkDeadlineViolations(caseData, TODAY_ISO);
    expect(violation).toBeNull();
  });

  it("uses current date when todayISO not provided", () => {
    // This test just verifies the function doesn't throw
    const caseData = createMinimalCase({
      caseStatus: "closed",
    });

    const violation = checkDeadlineViolations(caseData);
    expect(violation).toBeNull();
  });
});

// Timezone-Aware Enforcement Tests

describe("checkDeadlineViolations - Timezone Awareness", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("filing_window_missed uses DOL timezone regardless of user timezone", () => {
    // Mock: 11 PM Pacific on June 30 = 2 AM ET July 1
    // filingWindowCloses = "2025-06-30"
    // In PT: still June 30, so filing window is NOT expired
    // In ET: already July 1, so filing window IS expired
    const mockDate = new Date("2025-07-01T06:00:00Z"); // 11 PM PT / 2 AM ET
    vi.useFakeTimers();
    vi.setSystemTime(mockDate);

    const caseData = createMinimalCase({
      caseStatus: "recruitment",
      pwdExpirationDate: "2025-12-30", // Valid
      filingWindowCloses: "2025-06-30", // Expires today in ET but not in PT
      recruitmentStartDate: "2025-01-01",
      recruitmentWindowCloses: "2025-12-01", // Far future — recruitment check won't trigger
      eta9089FilingDate: undefined,
    });

    // Call WITHOUT todayISO to exercise timezone resolution
    const violation = checkDeadlineViolations(caseData, undefined, "America/Los_Angeles");

    // filing_window_missed uses DOL (ET) timezone → should detect violation
    // because in ET, June 30 has passed (it's July 1)
    expect(violation).not.toBeNull();
    expect(violation!.type).toBe("filing_window_missed");
  });

  it("pwd_expired uses user's local timezone", () => {
    // Mock: 11 PM Pacific on June 30 = 2 AM ET July 1
    // pwdExpirationDate = "2025-06-30"
    // In PT: still June 30, so PWD is NOT expired (daysUntil = 0)
    // In ET: already July 1, so PWD would be expired
    const mockDate = new Date("2025-07-01T06:00:00Z"); // 11 PM PT / 2 AM ET
    vi.useFakeTimers();
    vi.setSystemTime(mockDate);

    const caseData = createMinimalCase({
      caseStatus: "pwd",
      pwdExpirationDate: "2025-06-30",
      eta9089FilingDate: undefined,
    });

    // Call WITHOUT todayISO, user in Pacific Time
    const violation = checkDeadlineViolations(caseData, undefined, "America/Los_Angeles");

    // pwd_expired uses local (PT) timezone → should NOT detect violation
    // because in PT, it's still June 30 (daysUntil = 0, not < 0)
    expect(violation).toBeNull();
  });
});

// Priority Order Tests

describe("checkDeadlineViolations - Priority Order", () => {
  it("returns PWD violation over recruitment window violation", () => {
    const caseData = createMinimalCase({
      caseStatus: "recruitment",
      pwdExpirationDate: daysFromToday(-10), // PWD expired
      recruitmentStartDate: daysFromToday(-200),
      recruitmentWindowCloses: daysFromToday(-5), // Also missed
      eta9089FilingDate: undefined,
    });

    const violation = checkDeadlineViolations(caseData, TODAY_ISO);

    expect(violation).not.toBeNull();
    expect(violation!.type).toBe("pwd_expired"); // Most critical first
  });

  it("returns recruitment window violation over filing window violation", () => {
    const caseData = createMinimalCase({
      caseStatus: "recruitment",
      pwdExpirationDate: daysFromToday(120), // Valid
      recruitmentStartDate: daysFromToday(-200),
      recruitmentWindowCloses: daysFromToday(-10), // Missed
      filingWindowCloses: daysFromToday(-5), // Also missed
      eta9089FilingDate: undefined,
    });

    const violation = checkDeadlineViolations(caseData, TODAY_ISO);

    expect(violation).not.toBeNull();
    expect(violation!.type).toBe("recruitment_window_missed");
  });
});

// Message Generation Tests

describe("generateClosureMessage", () => {
  it("generates close message for PWD expired", () => {
    const violation: DeadlineViolation = {
      type: "pwd_expired",
      reason: "PWD expired on 2025-01-05",
      suggestedAction: "close",
      canRestart: false,
    };

    const message = generateClosureMessage(violation, "Acme Corp", "John D.");

    expect(message).toContain("John D.");
    expect(message).toContain("Acme Corp");
    expect(message).toContain("automatically closed");
  });

  it("generates restart message when action is not close", () => {
    const violation: DeadlineViolation = {
      type: "recruitment_window_missed",
      reason: "Window closed on 2025-01-05",
      suggestedAction: "restart_recruitment",
      canRestart: true,
    };

    const message = generateClosureMessage(violation, "Acme Corp", "Jane S.");

    expect(message).toContain("Jane S.");
    expect(message).toContain("requires attention");
    expect(message).toContain("restart recruitment");
  });
});

describe("generateClosureTitle", () => {
  it("generates title for PWD expired", () => {
    const violation: DeadlineViolation = {
      type: "pwd_expired",
      reason: "PWD expired",
      suggestedAction: "close",
      canRestart: false,
    };

    expect(generateClosureTitle(violation)).toBe("PWD Expired - Case Closed");
  });

  it("generates title for recruitment window with restart", () => {
    const violation: DeadlineViolation = {
      type: "recruitment_window_missed",
      reason: "Window missed",
      suggestedAction: "restart_recruitment",
      canRestart: true,
    };

    expect(generateClosureTitle(violation)).toBe("Recruitment Window Missed - Action Required");
  });

  it("generates title for recruitment window without restart", () => {
    const violation: DeadlineViolation = {
      type: "recruitment_window_missed",
      reason: "Window missed",
      suggestedAction: "close",
      canRestart: false,
    };

    expect(generateClosureTitle(violation)).toBe("Recruitment Window Missed - Case Closed");
  });

  it("generates title for filing window with restart", () => {
    const violation: DeadlineViolation = {
      type: "filing_window_missed",
      reason: "Window missed",
      suggestedAction: "restart_recruitment",
      canRestart: true,
    };

    expect(generateClosureTitle(violation)).toBe("Filing Window Missed - Action Required");
  });

  it("generates title for ETA 9089 expired with restart", () => {
    const violation: DeadlineViolation = {
      type: "eta9089_expired",
      reason: "ETA 9089 expired",
      suggestedAction: "restart_eta9089",
      canRestart: true,
    };

    expect(generateClosureTitle(violation)).toBe("ETA 9089 Expired - Action Required");
  });
});

// getTodayISO Tests

describe("getTodayISO", () => {
  it("returns date in YYYY-MM-DD format", () => {
    const today = getTodayISO();
    expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

// Constants Tests

describe("Constants", () => {
  it("MIN_DAYS_FOR_RESTART is 60", () => {
    expect(MIN_DAYS_FOR_RESTART).toBe(60);
  });
});
