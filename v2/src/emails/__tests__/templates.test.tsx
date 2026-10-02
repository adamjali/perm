// @vitest-environment jsdom
/**
 * Email Templates Tests
 *
 * Tests for all PERM Tracker email templates ensuring they render correctly
 * and display appropriate content based on props.
 *
 * Templates tested:
 * - DeadlineDigest: the daily deadline email (in the shared checks below)
 * - StatusChange: Case status change notifications
 * - AutoClosure: Automatic case closure notifications
 *
 */

import { describe, it, expect } from "vitest";
import { render } from "@react-email/render";
import { DeadlineDigest } from "../DeadlineDigest";
import type { DeadlineDigestItem } from "@convex/lib/reminderDigest";
import { StatusChange } from "../StatusChange";
import { AutoClosure } from "../AutoClosure";

// ============================================================================
// DEADLINE REMINDER TESTS
// ============================================================================

/** The live deadline email with one row, for the checks every template shares. */
function oneDeadline(employerName: string, daysUntil: number) {
  const urgency: DeadlineDigestItem["urgency"] =
    daysUntil < 0 ? "overdue" : daysUntil <= 7 ? "urgent" : daysUntil <= 14 ? "upcoming" : "later";
  return {
    userName: "Test",
    items: [
      { caseId: "c1" as never, employerName, beneficiaryIdentifier: "John Doe", deadlineType: "PWD expiration", deadlineDate: "2026-01-15", daysUntil, urgency },
    ],
  };
}

describe("StatusChange", () => {
  const baseProps = {
    beneficiaryName: "John Doe",
    companyName: "Acme Corp",
    previousStatus: "PWD",
    newStatus: "Recruitment",
    changeType: "stage" as const,
    changedAt: "December 31, 2024",
    caseUrl: "https://app.com/cases/123",
  };

  describe("Basic Rendering", () => {
    it("renders without errors", async () => {
      const html = await render(StatusChange(baseProps));
      expect(html).toBeDefined();
      expect(typeof html).toBe("string");
    });

    it("contains beneficiary name", async () => {
      const html = await render(StatusChange(baseProps));
      expect(html).toContain("John Doe");
    });

    it("contains company name", async () => {
      const html = await render(StatusChange(baseProps));
      expect(html).toContain("Acme Corp");
    });

    it("contains previous status", async () => {
      const html = await render(StatusChange(baseProps));
      expect(html).toContain("PWD");
    });

    it("contains new status", async () => {
      const html = await render(StatusChange(baseProps));
      expect(html).toContain("Recruitment");
    });

    it("contains changed at date", async () => {
      const html = await render(StatusChange(baseProps));
      expect(html).toContain("December 31, 2024");
    });

    it("contains View Case button with case URL", async () => {
      const html = await render(StatusChange(baseProps));
      expect(html).toContain("https://app.com/cases/123");
      expect(html).toContain("View case");
    });

    it("contains settings link in footer", async () => {
      const html = await render(StatusChange(baseProps));
      expect(html).toContain("Manage notification settings");
    });
  });

  describe("Change Type Handling", () => {
    it("shows 'Case stage updated' for stage change", async () => {
      const html = await render(StatusChange(baseProps));
      expect(html).toContain("Case stage updated");
    });

    it("shows 'Case progress updated' for progress change", async () => {
      const html = await render(
        StatusChange({
          ...baseProps,
          changeType: "progress",
        })
      );
      expect(html).toContain("Case progress updated");
    });
  });

  describe("Case Number", () => {
    it("shows case number when provided", async () => {
      const html = await render(
        StatusChange({
          ...baseProps,
          caseNumber: "PERM-2024-001",
        })
      );
      expect(html).toContain("Case #PERM-2024-001");
    });

    it("renders without case number when not provided", async () => {
      const html = await render(StatusChange(baseProps));
      expect(html).not.toContain("Case #");
    });
  });

  describe("Preview Text", () => {
    it("generates correct preview text", async () => {
      const html = await render(StatusChange(baseProps));
      // Check for preview text components (arrow may be HTML encoded)
      expect(html).toContain("Case status changed");
      expect(html).toContain("PWD");
      expect(html).toContain("Recruitment");
    });
  });
});

// ============================================================================
// AUTO CLOSURE TESTS
// ============================================================================

describe("AutoClosure", () => {
  const baseProps = {
    beneficiaryName: "John Doe",
    companyName: "Acme Corp",
    violationType: "PWD expiration",
    reason:
      "The Prevailing Wage Determination expired before ETA 9089 filing.",
    closedAt: "December 31, 2024 at 10:30 AM",
    caseUrl: "https://app.com/cases/123",
  };

  describe("Basic Rendering", () => {
    it("renders without errors", async () => {
      const html = await render(AutoClosure(baseProps));
      expect(html).toBeDefined();
      expect(typeof html).toBe("string");
    });

    it("contains 'Case closed automatically' title", async () => {
      const html = await render(AutoClosure(baseProps));
      expect(html).toContain("Case closed automatically");
    });

    it("contains beneficiary name", async () => {
      const html = await render(AutoClosure(baseProps));
      expect(html).toContain("John Doe");
    });

    it("contains company name", async () => {
      const html = await render(AutoClosure(baseProps));
      expect(html).toContain("Acme Corp");
    });

    it("contains violation type", async () => {
      const html = await render(AutoClosure(baseProps));
      expect(html).toContain("PWD expiration");
    });

    it("contains closure reason", async () => {
      const html = await render(AutoClosure(baseProps));
      expect(html).toContain(
        "The Prevailing Wage Determination expired before ETA 9089 filing."
      );
    });

    it("contains closed at timestamp", async () => {
      const html = await render(AutoClosure(baseProps));
      expect(html).toContain("December 31, 2024 at 10:30 AM");
    });

    it("contains View Case button with case URL", async () => {
      const html = await render(AutoClosure(baseProps));
      expect(html).toContain("https://app.com/cases/123");
      expect(html).toContain("View case");
    });

    it("contains settings link in footer", async () => {
      const html = await render(AutoClosure(baseProps));
      expect(html).toContain("Manage notification settings");
    });
  });

  describe("Information Box", () => {
    it("contains reopen instruction", async () => {
      const html = await render(AutoClosure(baseProps));
      expect(html).toContain("reopen the case");
    });

    it("mentions critical deadline was missed", async () => {
      const html = await render(AutoClosure(baseProps));
      expect(html).toContain("critical deadline was missed");
    });
  });

  describe("Case Number", () => {
    it("shows case number when provided", async () => {
      const html = await render(
        AutoClosure({
          ...baseProps,
          caseNumber: "PERM-2024-001",
        })
      );
      expect(html).toContain("Case #PERM-2024-001");
    });

    it("renders without case number when not provided", async () => {
      const html = await render(AutoClosure(baseProps));
      expect(html).not.toContain("Case #");
    });
  });

  describe("Preview Text", () => {
    it("generates correct preview text", async () => {
      const html = await render(AutoClosure(baseProps));
      expect(html).toContain(
        "Case closed automatically: John Doe at Acme Corp"
      );
    });
  });
});

// ============================================================================
// CROSS-TEMPLATE TESTS
// ============================================================================

describe("Email Templates - Common Features", () => {
  it("all templates include PERM Tracker branding", async () => {
    const deadlineHtml = await render(
      DeadlineDigest(oneDeadline("Test", 7))
    );
    const statusHtml = await render(
      StatusChange({
        beneficiaryName: "Test",
        companyName: "Test",
        previousStatus: "Test",
        newStatus: "Test",
        changeType: "stage",
        changedAt: "Test",
        caseUrl: "https://test.com",
      })
    );
    const autoClosureHtml = await render(
      AutoClosure({
        beneficiaryName: "Test",
        companyName: "Test",
        violationType: "Test",
        reason: "Test",
        closedAt: "Test",
        caseUrl: "https://test.com",
      })
    );

    // All should contain PERM Tracker branding
    expect(deadlineHtml).toContain("PERM");
    expect(statusHtml).toContain("PERM");
    expect(autoClosureHtml).toContain("PERM");
  });

  it("all templates include Open PERM Tracker link", async () => {
    const deadlineHtml = await render(
      DeadlineDigest(oneDeadline("Test", 7))
    );
    const statusHtml = await render(
      StatusChange({
        beneficiaryName: "Test",
        companyName: "Test",
        previousStatus: "Test",
        newStatus: "Test",
        changeType: "stage",
        changedAt: "Test",
        caseUrl: "https://test.com",
      })
    );
    const autoClosureHtml = await render(
      AutoClosure({
        beneficiaryName: "Test",
        companyName: "Test",
        violationType: "Test",
        reason: "Test",
        closedAt: "Test",
        caseUrl: "https://test.com",
      })
    );

    // All should contain link to open PERM Tracker
    expect(deadlineHtml).toContain("Open PERM Tracker");
    expect(statusHtml).toContain("Open PERM Tracker");
    expect(autoClosureHtml).toContain("Open PERM Tracker");
  });

  it("all templates include copyright notice", async () => {
    const year = new Date().getFullYear();

    const deadlineHtml = await render(
      DeadlineDigest(oneDeadline("Test", 7))
    );

    // Note: The year may be rendered with HTML comments around it
    // e.g., "<!-- -->2025<!-- -->" due to React's rendering
    expect(deadlineHtml).toContain(String(year));
    expect(deadlineHtml).toContain("PERM Tracker");
    expect(deadlineHtml).toContain("All rights reserved");
  });
});

// ============================================================================
// EDGE CASE TESTS
// ============================================================================

describe("Email Templates - Edge Cases", () => {
  describe("Special Characters Handling", () => {
    it("handles special characters in employer name", async () => {
      const html = await render(
        DeadlineDigest(oneDeadline("O'Brien & Associates, LLC", 7))
      );
      expect(html).toBeDefined();
      // The name should be properly encoded in HTML
      // Apostrophe is encoded as &#x27; in HTML
      expect(html).toContain("O&#x27;Brien");
    });

    it("handles very long names", async () => {
      const longName = "A".repeat(100);
      const html = await render(
        DeadlineDigest(oneDeadline(longName, 7))
      );
      expect(html).toBeDefined();
      expect(html).toContain(longName);
    });
  });

  describe("Extreme Values", () => {
    it("handles large positive days until", async () => {
      const html = await render(
        DeadlineDigest(oneDeadline("Acme Corp", 365))
      );
      expect(html).toContain("in 365 days");
    });

    it("handles large negative days (very overdue)", async () => {
      const html = await render(
        DeadlineDigest(oneDeadline("Acme Corp", -365))
      );
      expect(html).toContain("365 days overdue");
    });
  });
});
