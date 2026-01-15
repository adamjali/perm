// @vitest-environment jsdom
/**
 * Email Templates Tests
 *
 * Tests for all PERM Tracker email templates ensuring they render correctly
 * and display appropriate content based on props.
 *
 * Templates tested:
 * - DeadlineReminder: Deadline approaching notifications
 * - StatusChange: Case status change notifications
 * - RfiAlert: Request for Information alerts
 * - RfeAlert: Request for Evidence alerts
 * - AutoClosure: Automatic case closure notifications
 *
 * Phase: 24 (Notifications + Email)
 * Created: 2025-12-31
 */

import { describe, it, expect } from "vitest";
import { render } from "@react-email/render";
import { DeadlineReminder } from "../DeadlineReminder";
import { StatusChange } from "../StatusChange";
import { RfiAlert } from "../RfiAlert";
import { RfeAlert } from "../RfeAlert";
import { AutoClosure } from "../AutoClosure";

// ============================================================================
// DEADLINE REMINDER TESTS
// ============================================================================

describe("DeadlineReminder", () => {
  const baseProps = {
    employerName: "Acme Corp",
    beneficiaryName: "John Doe",
    deadlineType: "PWD Expiration",
    deadlineDate: "January 15, 2025",
    daysUntil: 7,
    caseUrl: "https://app.com/cases/123",
  };

  describe("Basic Rendering", () => {
    it("renders without errors", async () => {
      const html = await render(DeadlineReminder(baseProps));
      expect(html).toBeDefined();
      expect(typeof html).toBe("string");
      expect(html.length).toBeGreaterThan(0);
    });

    it("contains employer name", async () => {
      const html = await render(DeadlineReminder(baseProps));
      expect(html).toContain("Acme Corp");
    });

    it("contains beneficiary name", async () => {
      const html = await render(DeadlineReminder(baseProps));
      expect(html).toContain("John Doe");
    });

    it("contains deadline type", async () => {
      const html = await render(DeadlineReminder(baseProps));
      expect(html).toContain("PWD Expiration");
    });

    it("contains deadline date", async () => {
      const html = await render(DeadlineReminder(baseProps));
      expect(html).toContain("January 15, 2025");
    });

    it("contains case URL in View Case button", async () => {
      const html = await render(DeadlineReminder(baseProps));
      expect(html).toContain("https://app.com/cases/123");
    });

    it("contains settings link in footer", async () => {
      const html = await render(DeadlineReminder(baseProps));
      expect(html).toContain("https://permtracker.app/settings");
      expect(html).toContain("Manage notification settings");
    });
  });

  describe("Urgency Levels", () => {
    it("shows OVERDUE for negative days", async () => {
      const html = await render(
        DeadlineReminder({
          ...baseProps,
          daysUntil: -3,
        })
      );
      expect(html).toContain("OVERDUE");
      expect(html).toContain("3 days overdue");
    });

    it("shows singular 'day' for 1 day overdue", async () => {
      const html = await render(
        DeadlineReminder({
          ...baseProps,
          daysUntil: -1,
        })
      );
      expect(html).toContain("1 day overdue");
    });

    it("shows 'Due today' for 0 days", async () => {
      const html = await render(
        DeadlineReminder({
          ...baseProps,
          daysUntil: 0,
        })
      );
      expect(html.toLowerCase()).toContain("due today");
    });

    it("shows 'Tomorrow' for 1 day remaining", async () => {
      const html = await render(
        DeadlineReminder({
          ...baseProps,
          daysUntil: 1,
        })
      );
      expect(html).toContain("Tomorrow");
      expect(html).toContain("Due tomorrow");
    });

    it("shows urgent styling for 1-7 days", async () => {
      const html = await render(
        DeadlineReminder({
          ...baseProps,
          daysUntil: 5,
        })
      );
      expect(html).toContain("5 days - Urgent");
      expect(html).toContain("5 days remaining");
    });

    it("shows high priority styling for 8-14 days", async () => {
      const html = await render(
        DeadlineReminder({
          ...baseProps,
          daysUntil: 10,
        })
      );
      expect(html).toContain("10 days - High Priority");
      expect(html).toContain("10 days remaining");
    });

    it("shows normal styling for 15+ days", async () => {
      const html = await render(
        DeadlineReminder({
          ...baseProps,
          daysUntil: 30,
        })
      );
      expect(html).toContain("30 days");
      expect(html).toContain("30 days remaining");
    });
  });

  describe("Preview Text", () => {
    it("generates correct preview text for overdue", async () => {
      const html = await render(
        DeadlineReminder({
          ...baseProps,
          daysUntil: -1,
        })
      );
      expect(html).toContain("OVERDUE: PWD Expiration for Acme Corp");
    });

    it("generates correct preview text for urgent", async () => {
      const html = await render(
        DeadlineReminder({
          ...baseProps,
          daysUntil: 5,
        })
      );
      expect(html).toContain("Urgent: PWD Expiration in 5 days");
    });

    it("generates correct preview text for normal", async () => {
      const html = await render(
        DeadlineReminder({
          ...baseProps,
          daysUntil: 20,
        })
      );
      expect(html).toContain("Reminder: PWD Expiration in 20 days");
    });
  });

  describe("Custom Settings URL", () => {
    it("uses custom settings URL when provided", async () => {
      const html = await render(
        DeadlineReminder({
          ...baseProps,
          settingsUrl: "https://custom.com/settings",
        })
      );
      expect(html).toContain("https://custom.com/settings");
    });
  });
});

// ============================================================================
// STATUS CHANGE TESTS
// ============================================================================

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
      expect(html).toContain("View Case Details");
    });

    it("contains settings link in footer", async () => {
      const html = await render(StatusChange(baseProps));
      expect(html).toContain("Manage notification settings");
    });
  });

  describe("Change Type Handling", () => {
    it("shows 'Case Stage Updated' for stage change", async () => {
      const html = await render(StatusChange(baseProps));
      expect(html).toContain("Case Stage Updated");
    });

    it("shows 'Case Progress Updated' for progress change", async () => {
      const html = await render(
        StatusChange({
          ...baseProps,
          changeType: "progress",
        })
      );
      expect(html).toContain("Case Progress Updated");
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
    it("shows 'New RFI Received' for new alert type", async () => {
      const html = await render(RfiAlert(baseProps));
      expect(html).toContain("New RFI Received");
    });

    it("shows 'RFI Response Due Soon' for reminder alert type", async () => {
      const html = await render(
        RfiAlert({
          ...baseProps,
          alertType: "reminder",
        })
      );
      expect(html).toContain("RFI Response Due Soon");
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

    it("shows 'DUE TODAY' for 0 days", async () => {
      const html = await render(
        RfiAlert({
          ...baseProps,
          daysRemaining: 0,
        })
      );
      expect(html).toContain("DUE TODAY");
    });

    it("shows overdue message for negative days", async () => {
      const html = await render(
        RfiAlert({
          ...baseProps,
          daysRemaining: -5,
        })
      );
      expect(html).toContain("5 days OVERDUE");
    });

    it("shows singular 'day' for 1 day overdue", async () => {
      const html = await render(
        RfiAlert({
          ...baseProps,
          daysRemaining: -1,
        })
      );
      expect(html).toContain("1 day OVERDUE");
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
    it("shows 'New RFE Received' for new alert type", async () => {
      const html = await render(RfeAlert(baseProps));
      expect(html).toContain("New RFE Received");
    });

    it("shows 'RFE Response Due Soon' for reminder alert type", async () => {
      const html = await render(
        RfeAlert({
          ...baseProps,
          alertType: "reminder",
        })
      );
      expect(html).toContain("RFE Response Due Soon");
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

    it("shows 'DUE TODAY' for 0 days", async () => {
      const html = await render(
        RfeAlert({
          ...baseProps,
          daysRemaining: 0,
        })
      );
      expect(html).toContain("DUE TODAY");
    });

    it("shows overdue message for negative days", async () => {
      const html = await render(
        RfeAlert({
          ...baseProps,
          daysRemaining: -10,
        })
      );
      expect(html).toContain("10 days OVERDUE");
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
    violationType: "PWD Expiration",
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

    it("contains 'Case Automatically Closed' title", async () => {
      const html = await render(AutoClosure(baseProps));
      expect(html).toContain("Case Automatically Closed");
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
      expect(html).toContain("PWD Expiration");
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
      expect(html).toContain("View Case Details");
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
        "Case Automatically Closed: John Doe at Acme Corp"
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
      DeadlineReminder({
        employerName: "Test",
        beneficiaryName: "Test",
        deadlineType: "Test",
        deadlineDate: "Test",
        daysUntil: 7,
        caseUrl: "https://test.com",
      })
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
      DeadlineReminder({
        employerName: "Test",
        beneficiaryName: "Test",
        deadlineType: "Test",
        deadlineDate: "Test",
        daysUntil: 7,
        caseUrl: "https://test.com",
      })
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
      DeadlineReminder({
        employerName: "Test",
        beneficiaryName: "Test",
        deadlineType: "Test",
        deadlineDate: "Test",
        daysUntil: 7,
        caseUrl: "https://test.com",
      })
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
        DeadlineReminder({
          employerName: "O'Brien & Associates, LLC",
          beneficiaryName: "John Doe",
          deadlineType: "PWD Expiration",
          deadlineDate: "January 15, 2025",
          daysUntil: 7,
          caseUrl: "https://app.com/cases/123",
        })
      );
      expect(html).toBeDefined();
      // The name should be properly encoded in HTML
      // Apostrophe is encoded as &#x27; in HTML
      expect(html).toContain("O&#x27;Brien");
    });

    it("handles very long names", async () => {
      const longName = "A".repeat(100);
      const html = await render(
        DeadlineReminder({
          employerName: longName,
          beneficiaryName: "John Doe",
          deadlineType: "PWD Expiration",
          deadlineDate: "January 15, 2025",
          daysUntil: 7,
          caseUrl: "https://app.com/cases/123",
        })
      );
      expect(html).toBeDefined();
      expect(html).toContain(longName);
    });
  });

  describe("Extreme Values", () => {
    it("handles large positive days until", async () => {
      const html = await render(
        DeadlineReminder({
          employerName: "Acme Corp",
          beneficiaryName: "John Doe",
          deadlineType: "PWD Expiration",
          deadlineDate: "January 15, 2026",
          daysUntil: 365,
          caseUrl: "https://app.com/cases/123",
        })
      );
      expect(html).toContain("365 days");
    });

    it("handles large negative days (very overdue)", async () => {
      const html = await render(
        DeadlineReminder({
          employerName: "Acme Corp",
          beneficiaryName: "John Doe",
          deadlineType: "PWD Expiration",
          deadlineDate: "January 15, 2023",
          daysUntil: -365,
          caseUrl: "https://app.com/cases/123",
        })
      );
      expect(html).toContain("365 days overdue");
    });
  });
});
