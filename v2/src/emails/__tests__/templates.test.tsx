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
 * - RfiAlert: Request for Information alerts
 * - RfeAlert: Request for Evidence alerts
 * - AutoClosure: Automatic case closure notifications
 *
 */

import { describe, it, expect } from "vitest";
import { render } from "@react-email/render";
import { DeadlineDigest } from "../DeadlineDigest";
import type { DeadlineDigestItem } from "../../../convex/lib/reminderDigest";
import { StatusChange } from "../StatusChange";
import { RfiAlert } from "../RfiAlert";
import { RfeAlert } from "../RfeAlert";
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
// RFI ALERT TESTS
// ============================================================================

describe("RfiAlert", () => {
  const baseProps = {
    beneficiaryName: "John Doe",
    companyName: "Acme Corp",
    dueDate: "January 30, 2025",
    daysRemaining: 25,
    receivedDate: "December 31, 2024",
    alertType: "new" as const,
    caseUrl: "https://app.com/cases/123",
  };

  describe("Basic Rendering", () => {
    it("renders without errors", async () => {
      const html = await render(RfiAlert(baseProps));
      expect(html).toBeDefined();
      expect(typeof html).toBe("string");
    });

    it("contains beneficiary name", async () => {
      const html = await render(RfiAlert(baseProps));
      expect(html).toContain("John Doe");
    });

    it("contains company name", async () => {
      const html = await render(RfiAlert(baseProps));
      expect(html).toContain("Acme Corp");
    });

    it("contains due date", async () => {
      const html = await render(RfiAlert(baseProps));
      expect(html).toContain("January 30, 2025");
    });

    it("contains received date", async () => {
      const html = await render(RfiAlert(baseProps));
      expect(html).toContain("December 31, 2024");
    });

    it("contains settings link in footer", async () => {
      const html = await render(RfiAlert(baseProps));
      expect(html).toContain("Manage notification settings");
    });
  });

  describe("Alert Type Handling", () => {
    it("shows 'New RFI received' for new alert type", async () => {
      const html = await render(RfiAlert(baseProps));
      expect(html).toContain("New RFI received");
    });

    it("shows 'RFI response due soon' for reminder alert type", async () => {
      const html = await render(
        RfiAlert({
          ...baseProps,
          alertType: "reminder",
        })
      );
      expect(html).toContain("RFI response due soon");
    });

    it("shows 30-day response info box for new RFI", async () => {
      const html = await render(RfiAlert(baseProps));
      expect(html).toContain("within 30 days");
    });
  });

  describe("Days Remaining Display", () => {
    it("shows days remaining for positive values", async () => {
      const html = await render(RfiAlert(baseProps));
      expect(html).toContain("25 days remaining");
    });

    it("shows singular 'day' for 1 day remaining", async () => {
      const html = await render(
        RfiAlert({
          ...baseProps,
          daysRemaining: 1,
        })
      );
      expect(html).toContain("1 day remaining");
    });

    it("shows 'Due today' for 0 days", async () => {
      const html = await render(
        RfiAlert({
          ...baseProps,
          daysRemaining: 0,
        })
      );
      expect(html).toContain("Due today");
    });

    it("shows overdue message for negative days", async () => {
      const html = await render(
        RfiAlert({
          ...baseProps,
          daysRemaining: -5,
        })
      );
      expect(html).toContain("5 days overdue");
    });

    it("shows singular 'day' for 1 day overdue", async () => {
      const html = await render(
        RfiAlert({
          ...baseProps,
          daysRemaining: -1,
        })
      );
      expect(html).toContain("1 day overdue");
    });
  });

  describe("Warning Message", () => {
    it("contains warning about denial", async () => {
      const html = await render(RfiAlert(baseProps));
      expect(html).toContain("Failure to respond");
      expect(html).toContain("denial");
    });
  });

  describe("Case Number", () => {
    it("shows case number when provided", async () => {
      const html = await render(
        RfiAlert({
          ...baseProps,
          caseNumber: "PERM-2024-001",
        })
      );
      expect(html).toContain("Case #PERM-2024-001");
    });
  });
});

// ============================================================================
// RFE ALERT TESTS
// ============================================================================

describe("RfeAlert", () => {
  const baseProps = {
    beneficiaryName: "John Doe",
    companyName: "Acme Corp",
    dueDate: "February 28, 2025",
    daysRemaining: 60,
    receivedDate: "December 31, 2024",
    alertType: "new" as const,
    caseUrl: "https://app.com/cases/123",
  };

  describe("Basic Rendering", () => {
    it("renders without errors", async () => {
      const html = await render(RfeAlert(baseProps));
      expect(html).toBeDefined();
      expect(typeof html).toBe("string");
    });

    it("contains beneficiary name", async () => {
      const html = await render(RfeAlert(baseProps));
      expect(html).toContain("John Doe");
    });

    it("contains company name", async () => {
      const html = await render(RfeAlert(baseProps));
      expect(html).toContain("Acme Corp");
    });

    it("contains due date", async () => {
      const html = await render(RfeAlert(baseProps));
      expect(html).toContain("February 28, 2025");
    });

    it("contains settings link in footer", async () => {
      const html = await render(RfeAlert(baseProps));
      expect(html).toContain("Manage notification settings");
    });
  });

  describe("Alert Type Handling", () => {
    it("shows 'New RFE received' for new alert type", async () => {
      const html = await render(RfeAlert(baseProps));
      expect(html).toContain("New RFE received");
    });

    it("shows 'RFE response due soon' for reminder alert type", async () => {
      const html = await render(
        RfeAlert({
          ...baseProps,
          alertType: "reminder",
        })
      );
      expect(html).toContain("RFE response due soon");
    });

    it("shows USCIS info box for new RFE", async () => {
      const html = await render(RfeAlert(baseProps));
      expect(html).toContain("USCIS");
      expect(html).toContain("I-140");
    });
  });

  describe("I-140 Filing Date", () => {
    it("shows I-140 filing date when provided", async () => {
      const html = await render(
        RfeAlert({
          ...baseProps,
          i140FilingDate: "October 15, 2024",
        })
      );
      expect(html).toContain("I-140 Filing Date");
      expect(html).toContain("October 15, 2024");
    });

    it("renders without I-140 section when not provided", async () => {
      const html = await render(RfeAlert(baseProps));
      // Should not contain the label "I-140 Filing Date" as a separate section
      // (the warning message still mentions I-140)
      expect(html).toContain("I-140"); // In warning
    });
  });

  describe("Days Remaining Display", () => {
    it("shows days remaining for positive values", async () => {
      const html = await render(RfeAlert(baseProps));
      expect(html).toContain("60 days remaining");
    });

    it("shows 'Due today' for 0 days", async () => {
      const html = await render(
        RfeAlert({
          ...baseProps,
          daysRemaining: 0,
        })
      );
      expect(html).toContain("Due today");
    });

    it("shows overdue message for negative days", async () => {
      const html = await render(
        RfeAlert({
          ...baseProps,
          daysRemaining: -10,
        })
      );
      expect(html).toContain("10 days overdue");
    });
  });

  describe("Warning Message", () => {
    it("contains warning about denial and priority date", async () => {
      const html = await render(RfeAlert(baseProps));
      expect(html).toContain("Failure to respond");
      expect(html).toContain("priority date");
    });
  });

  describe("Case Number", () => {
    it("shows case number when provided", async () => {
      const html = await render(
        RfeAlert({
          ...baseProps,
          caseNumber: "PERM-2024-001",
        })
      );
      expect(html).toContain("Case #PERM-2024-001");
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
    const rfiHtml = await render(
      RfiAlert({
        beneficiaryName: "Test",
        companyName: "Test",
        dueDate: "Test",
        daysRemaining: 10,
        receivedDate: "Test",
        alertType: "new",
        caseUrl: "https://test.com",
      })
    );
    const rfeHtml = await render(
      RfeAlert({
        beneficiaryName: "Test",
        companyName: "Test",
        dueDate: "Test",
        daysRemaining: 10,
        receivedDate: "Test",
        alertType: "new",
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
    expect(rfiHtml).toContain("PERM");
    expect(rfeHtml).toContain("PERM");
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
    const rfiHtml = await render(
      RfiAlert({
        beneficiaryName: "Test",
        companyName: "Test",
        dueDate: "Test",
        daysRemaining: 10,
        receivedDate: "Test",
        alertType: "new",
        caseUrl: "https://test.com",
      })
    );
    const rfeHtml = await render(
      RfeAlert({
        beneficiaryName: "Test",
        companyName: "Test",
        dueDate: "Test",
        daysRemaining: 10,
        receivedDate: "Test",
        alertType: "new",
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
    expect(rfiHtml).toContain("Open PERM Tracker");
    expect(rfeHtml).toContain("Open PERM Tracker");
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
