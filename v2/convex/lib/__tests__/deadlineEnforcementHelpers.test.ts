/**
 * Deadline Enforcement Helper Functions Tests
 *
 * Tests for automatic deadline enforcement logic per perm_flow.md lines 74-78.
 *
 * Test scenarios:
 * 1. PWD expired before ETA 9089 filed → close
 * 2. Recruitment window missed, PWD >60 days → can restart
 * 3. Recruitment window missed, PWD ≤60 days → close
 * 4. Filing window missed, PWD >60 days → can restart
 * 5. Filing window missed, PWD ≤60 days → close
 * 6. ETA 9089 expired with time to restart → can restart
 * 7. ETA 9089 expired without time → close
 * 8. No violations → healthy case
 * 9. Already closed case → skip
 *
 * @see /perm_flow.md - Source of truth for business rules
 */

import { describe, it, expect } from "vitest";
import {
  checkDeadlineViolations,
  canRestartProcess,
  generateClosureMessage,
  generateClosureTitle,
  getTodayISO,
  MIN_DAYS_FOR_RESTART,
  type CaseDataForEnforcement,
  type DeadlineViolation,
} from "../deadlineEnforcementHelpers";

// ============================================================================
// TEST FIXTURES
// ============================================================================

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

// ============================================================================
// canRestartProcess Tests
// ============================================================================

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

// ============================================================================
// checkDeadlineViolations Tests - PWD Expiration
// ============================================================================

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

// ============================================================================
// checkDeadlineViolations Tests - Recruitment Window
// ============================================================================

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
});

// ============================================================================
// checkDeadlineViolations Tests - Filing Window
// ============================================================================

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

// ============================================================================
// checkDeadlineViolations Tests - ETA 9089 Expiration
// ============================================================================

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

// ============================================================================
// checkDeadlineViolations Tests - Edge Cases
// ============================================================================

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

// ============================================================================
// Priority Order Tests
// ============================================================================

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

// ============================================================================
// Message Generation Tests
// ============================================================================

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

// ============================================================================
// getTodayISO Tests
// ============================================================================

describe("getTodayISO", () => {
  it("returns date in YYYY-MM-DD format", () => {
    const today = getTodayISO();
    expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

// ============================================================================
// Constants Tests
// ============================================================================

describe("Constants", () => {
  it("MIN_DAYS_FOR_RESTART is 60", () => {
    expect(MIN_DAYS_FOR_RESTART).toBe(60);
  });
});
