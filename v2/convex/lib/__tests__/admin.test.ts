/**
 * Admin Helper Tests
 *
 * Tests for admin authorization helpers, shared utilities,
 * and extracted admin functions.
 */

import { describe, it, expect } from "vitest";
import { buildDefaultProfile } from "../userDefaults";
import { formatDateForNotification } from "../formatDate";
import { FROM_EMAIL } from "../email";
import type { Id } from "../../_generated/dataModel";

// ============================================================================
// FIXTURES
// ============================================================================

const MOCK_USER_ID = "test-user-123" as Id<"users">;

// ============================================================================
// buildDefaultProfile
// ============================================================================

describe("buildDefaultProfile", () => {
  it("creates profile with correct userId", () => {
    const profile = buildDefaultProfile(MOCK_USER_ID);
    expect(profile.userId).toBe(MOCK_USER_ID);
  });

  it("sets default userType to individual", () => {
    const profile = buildDefaultProfile(MOCK_USER_ID);
    expect(profile.userType).toBe("individual");
  });

  it("sets default casesPerPage to 20", () => {
    const profile = buildDefaultProfile(MOCK_USER_ID);
    expect(profile.casesPerPage).toBe(20);
  });

  it("sets default autoDeadlineEnforcementEnabled to false", () => {
    const profile = buildDefaultProfile(MOCK_USER_ID);
    expect(profile.autoDeadlineEnforcementEnabled).toBe(false);
  });

  it("sets default calendarSyncEnabled to true", () => {
    const profile = buildDefaultProfile(MOCK_USER_ID);
    expect(profile.calendarSyncEnabled).toBe(true);
  });

  it("enables email notifications and disables push/sms by default", () => {
    const profile = buildDefaultProfile(MOCK_USER_ID);
    expect(profile.emailNotificationsEnabled).toBe(true);
    expect(profile.pushNotificationsEnabled).toBe(false);
    expect(profile.smsNotificationsEnabled).toBe(false);
  });

  it("enables all email notification types by default", () => {
    const profile = buildDefaultProfile(MOCK_USER_ID);
    expect(profile.emailDeadlineReminders).toBe(true);
    expect(profile.emailStatusUpdates).toBe(true);
    expect(profile.emailRfeAlerts).toBe(true);
    expect(profile.emailWeeklyDigest).toBe(true);
  });

  it("sets googleCalendarConnected to false by default", () => {
    const profile = buildDefaultProfile(MOCK_USER_ID);
    expect(profile.googleCalendarConnected).toBe(false);
  });

  it("applies fullName override", () => {
    const profile = buildDefaultProfile(MOCK_USER_ID, { fullName: "John Doe" });
    expect(profile.fullName).toBe("John Doe");
  });

  it("applies profilePhotoUrl override", () => {
    const profile = buildDefaultProfile(MOCK_USER_ID, { profilePhotoUrl: "https://example.com/photo.jpg" });
    expect(profile.profilePhotoUrl).toBe("https://example.com/photo.jpg");
  });

  it("applies terms overrides", () => {
    const now = Date.now();
    const profile = buildDefaultProfile(MOCK_USER_ID, {
      termsAcceptedAt: now,
      termsVersion: "2.0",
    });
    expect(profile.termsAcceptedAt).toBe(now);
    expect(profile.termsVersion).toBe("2.0");
  });

  it("does not include terms fields when not provided", () => {
    const profile = buildDefaultProfile(MOCK_USER_ID);
    expect(profile.termsAcceptedAt).toBeUndefined();
    expect(profile.termsVersion).toBeUndefined();
  });

  it("sets createdAt and updatedAt to current time", () => {
    const before = Date.now();
    const profile = buildDefaultProfile(MOCK_USER_ID);
    const after = Date.now();
    expect(profile.createdAt).toBeGreaterThanOrEqual(before);
    expect(profile.createdAt).toBeLessThanOrEqual(after);
    expect(profile.updatedAt).toBeGreaterThanOrEqual(before);
    expect(profile.updatedAt).toBeLessThanOrEqual(after);
  });

  it("sets all calendar sync event types", () => {
    const profile = buildDefaultProfile(MOCK_USER_ID);
    expect(profile.calendarSyncPwd).toBe(true);
    expect(profile.calendarSyncEta9089).toBe(true);
    expect(profile.calendarSyncFilingWindow).toBe(true);
    expect(profile.calendarSyncRecruitment).toBe(true);
    expect(profile.calendarSyncI140).toBe(true);
    expect(profile.calendarSyncRfi).toBe(true);
    expect(profile.calendarSyncRfe).toBe(true);
  });
});

// ============================================================================
// formatDateForNotification
// ============================================================================

describe("formatDateForNotification", () => {
  // Use a fixed UTC timestamp: 2025-06-15T12:00:00Z
  const JUNE_15_2025 = new Date("2025-06-15T12:00:00Z").getTime();

  it("formats date without weekday by default", () => {
    const result = formatDateForNotification(JUNE_15_2025);
    expect(result).toContain("June");
    expect(result).toContain("15");
    expect(result).toContain("2025");
  });

  it("includes weekday when requested", () => {
    const result = formatDateForNotification(JUNE_15_2025, true);
    // June 15, 2025 is a Sunday
    expect(result).toContain("Sunday");
    expect(result).toContain("June");
  });

  it("accepts Date object", () => {
    const date = new Date("2025-06-15T12:00:00Z");
    const result = formatDateForNotification(date);
    expect(result).toContain("June");
    expect(result).toContain("2025");
  });

  it("formats different dates correctly", () => {
    const jan1 = new Date("2025-01-01T12:00:00Z").getTime();
    const result = formatDateForNotification(jan1);
    expect(result).toContain("January");
    expect(result).toContain("2025");
  });
});

// ============================================================================
// FROM_EMAIL constant
// ============================================================================

describe("FROM_EMAIL", () => {
  it("contains PERM Tracker branding", () => {
    expect(FROM_EMAIL).toContain("PERM Tracker");
  });

  it("contains permtracker.app domain", () => {
    expect(FROM_EMAIL).toContain("@permtracker.app");
  });

  it("is a valid RFC 5322 display name + email format", () => {
    expect(FROM_EMAIL).toMatch(/^.+ <.+@.+>$/);
  });
});

// ============================================================================
// ADMIN_EMAIL constant
// ============================================================================

describe("ADMIN_EMAIL", () => {
  it("is a non-empty email string", async () => {
    const { ADMIN_EMAIL } = await import("../admin");
    expect(ADMIN_EMAIL).toBeTruthy();
    expect(ADMIN_EMAIL).toContain("@");
  });
});

// ============================================================================
// extractUserIdFromAction
// ============================================================================

describe("extractUserIdFromAction", () => {
  it("extracts user ID from subject with single segment", async () => {
    const { extractUserIdFromAction } = await import("../auth");
    const result = extractUserIdFromAction("user123");
    expect(result).toBe("user123");
  });

  it("extracts user ID from subject with pipe-separated segments", async () => {
    const { extractUserIdFromAction } = await import("../auth");
    const result = extractUserIdFromAction("user123|google|extra");
    expect(result).toBe("user123");
  });

  it("handles subject with no pipe separator", async () => {
    const { extractUserIdFromAction } = await import("../auth");
    const result = extractUserIdFromAction("simpleId");
    expect(result).toBe("simpleId");
  });
});
