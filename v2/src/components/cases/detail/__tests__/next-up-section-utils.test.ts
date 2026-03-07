import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  getStageIndex,
  getUrgencyLevel,
  calculateNextAction,
  calculateNextDeadline,
  type NextUpCaseData,
} from "../next-up-section.utils";

// ============================================================================
// getStageIndex
// ============================================================================

describe("getStageIndex", () => {
  it.each([
    ["pwd", 0],
    ["recruitment", 1],
    ["eta9089", 2],
    ["i140", 3],
    ["closed", 4],
  ] as const)("returns %i for %s", (status, expected) => {
    expect(getStageIndex(status)).toBe(expected);
  });
});

// ============================================================================
// getUrgencyLevel
// ============================================================================

describe("getUrgencyLevel", () => {
  it.each([
    [-5, "overdue"],
    [0, "urgent"],
    [7, "urgent"],
    [15, "soon"],
    [30, "soon"],
    [31, "normal"],
    [100, "normal"],
  ] as const)("returns %s for %i days", (days, expected) => {
    expect(getUrgencyLevel(days)).toBe(expected);
  });
});

// ============================================================================
// calculateNextAction
// ============================================================================

const baseCaseData: NextUpCaseData = {
  caseStatus: "pwd",
  progressStatus: "on_track",
};

describe("calculateNextAction", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-06-01T12:00:00Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns null for closed cases", () => {
    expect(
      calculateNextAction({ ...baseCaseData, caseStatus: "closed" })
    ).toBeNull();
  });

  it("returns 'File PWD' when no PWD filing date", () => {
    const result = calculateNextAction({ ...baseCaseData, caseStatus: "pwd" });
    expect(result).not.toBeNull();
    expect(result!.action).toBe("File PWD");
  });

  it("returns 'Wait for PWD' when filed but not determined", () => {
    const result = calculateNextAction({
      ...baseCaseData,
      caseStatus: "pwd",
      pwdFilingDate: "2025-01-01",
    });
    expect(result!.action).toBe("Wait for PWD");
  });

  it("returns 'Start Recruitment' when PWD determined", () => {
    const result = calculateNextAction({
      ...baseCaseData,
      caseStatus: "pwd",
      pwdFilingDate: "2025-01-01",
      pwdDeterminationDate: "2025-05-01",
    });
    expect(result!.action).toBe("Start Recruitment");
  });

  it("prioritizes active RFI over stage actions", () => {
    const result = calculateNextAction({
      ...baseCaseData,
      caseStatus: "eta9089",
      rfiEntries: [
        {
          receivedDate: "2025-05-01",
          responseDueDate: "2025-07-01",
        },
      ],
    });
    expect(result!.action).toBe("Respond to RFI");
  });

  it("prioritizes active RFE over stage actions", () => {
    const result = calculateNextAction({
      ...baseCaseData,
      caseStatus: "i140",
      i140FilingDate: "2025-03-01",
      rfeEntries: [
        {
          receivedDate: "2025-05-01",
          responseDueDate: "2025-07-01",
        },
      ],
    });
    expect(result!.action).toBe("Respond to RFE");
  });

  it("skips answered RFI entries", () => {
    const result = calculateNextAction({
      ...baseCaseData,
      caseStatus: "eta9089",
      eta9089FilingDate: "2025-01-01",
      rfiEntries: [
        {
          receivedDate: "2025-02-01",
          responseDueDate: "2025-04-01",
          responseSubmittedDate: "2025-03-15",
        },
      ],
    });
    expect(result!.action).toBe("Wait for Certification");
  });

  // Recruitment stage
  it("returns 'Post Job Order' first in recruitment", () => {
    const result = calculateNextAction({
      ...baseCaseData,
      caseStatus: "recruitment",
    });
    expect(result!.action).toBe("Post Job Order");
  });

  it("returns 'Post Notice of Filing' after job order", () => {
    const result = calculateNextAction({
      ...baseCaseData,
      caseStatus: "recruitment",
      jobOrderStartDate: "2025-01-01",
      jobOrderEndDate: "2025-02-01",
    });
    expect(result!.action).toBe("Post Notice of Filing");
  });

  // ETA 9089 stage
  it("returns 'File ETA 9089' when in eta9089 stage", () => {
    const result = calculateNextAction({
      ...baseCaseData,
      caseStatus: "eta9089",
    });
    expect(result!.action).toBe("File ETA 9089");
  });

  // I-140 stage
  it("returns 'File I-140' when in i140 stage", () => {
    const result = calculateNextAction({
      ...baseCaseData,
      caseStatus: "i140",
    });
    expect(result!.action).toBe("File I-140");
  });

  it("returns 'Case Complete' when I-140 approved", () => {
    const result = calculateNextAction({
      ...baseCaseData,
      caseStatus: "i140",
      i140FilingDate: "2025-03-01",
      i140ApprovalDate: "2025-05-15",
    });
    expect(result!.action).toBe("Case Complete");
  });
});

// ============================================================================
// calculateNextDeadline
// ============================================================================

describe("calculateNextDeadline", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-06-01T00:00:00Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns null for closed cases", () => {
    expect(
      calculateNextDeadline({ ...baseCaseData, caseStatus: "closed" })
    ).toBeNull();
  });

  it("returns PWD expiration deadline when available", () => {
    const result = calculateNextDeadline({
      ...baseCaseData,
      caseStatus: "recruitment",
      pwdExpirationDate: "2025-12-01",
    });
    expect(result).not.toBeNull();
    expect(result!.label).toContain("PWD");
  });

  it("returns RFI response deadline when active", () => {
    const result = calculateNextDeadline({
      ...baseCaseData,
      caseStatus: "eta9089",
      eta9089FilingDate: "2025-01-01",
      rfiEntries: [
        {
          receivedDate: "2025-05-01",
          responseDueDate: "2025-07-01",
        },
      ],
    });
    expect(result).not.toBeNull();
    expect(result!.label).toContain("RFI");
  });
});
