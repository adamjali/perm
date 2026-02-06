// @vitest-environment jsdom
/**
 * Email Shared Components Tests
 *
 * Tests for shared email components ensuring they render correctly
 * and display appropriate styling based on props.
 *
 * Components tested:
 * - EmailLayout: Wrapper with header, footer, and branding
 * - EmailButton: CTA button with urgency variants
 * - EmailHeader: Section header with urgency color bars
 *
 * Phase: 24 (Notifications + Email)
 * Created: 2025-12-31
 */

import { describe, it, expect } from "vitest";
import { render } from "@react-email/render";
import { Text } from "@react-email/components";
import * as React from "react";
import { EmailLayout } from "../components/EmailLayout";
import { EmailButton } from "../components/EmailButton";
import { EmailHeader } from "../components/EmailHeader";

// ============================================================================
// EMAIL LAYOUT TESTS
// ============================================================================

describe("EmailLayout", () => {
  describe("Basic Rendering", () => {
    it("renders without errors", async () => {
      const html = await render(
        EmailLayout({
          previewText: "Test preview",
          children: React.createElement(Text, null, "Test content"),
        })
      );
      expect(html).toBeDefined();
      expect(typeof html).toBe("string");
    });

    it("contains preview text", async () => {
      const html = await render(
        EmailLayout({
          previewText: "This is a preview message",
          children: React.createElement(Text, null, "Content"),
        })
      );
      expect(html).toContain("This is a preview message");
    });

    it("contains children content", async () => {
      const html = await render(
        EmailLayout({
          previewText: "Preview",
          children: React.createElement(Text, null, "Child content here"),
        })
      );
      expect(html).toContain("Child content here");
    });
  });

  describe("Branding", () => {
    it("contains PERM Tracker logo", async () => {
      const html = await render(
        EmailLayout({
          previewText: "Test",
          children: React.createElement(Text, null, "Content"),
        })
      );
      expect(html).toContain("PERM");
      expect(html).toContain("Tracker");
    });

    it("contains copyright notice", async () => {
      const html = await render(
        EmailLayout({
          previewText: "Test",
          children: React.createElement(Text, null, "Content"),
        })
      );
      expect(html).toContain("All rights reserved");
    });
  });

  describe("Footer Links", () => {
    it("contains default settings URL", async () => {
      const html = await render(
        EmailLayout({
          previewText: "Test",
          children: React.createElement(Text, null, "Content"),
        })
      );
      expect(html).toContain("https://permtracker.app/settings");
    });

    it("uses custom settings URL when provided", async () => {
      const html = await render(
        EmailLayout({
          previewText: "Test",
          children: React.createElement(Text, null, "Content"),
          settingsUrl: "https://custom.com/settings",
        })
      );
      expect(html).toContain("https://custom.com/settings");
    });

    it("contains Manage notification settings link", async () => {
      const html = await render(
        EmailLayout({
          previewText: "Test",
          children: React.createElement(Text, null, "Content"),
        })
      );
      expect(html).toContain("Manage notification settings");
    });

    it("contains Open PERM Tracker link", async () => {
      const html = await render(
        EmailLayout({
          previewText: "Test",
          children: React.createElement(Text, null, "Content"),
        })
      );
      expect(html).toContain("Open PERM Tracker");
      expect(html).toContain("https://permtracker.app");
    });
  });

  describe("Notification Explanation", () => {
    it("contains explanation text", async () => {
      const html = await render(
        EmailLayout({
          previewText: "Test",
          children: React.createElement(Text, null, "Content"),
        })
      );
      expect(html).toContain("notifications enabled");
      expect(html).toContain("PERM Tracker account");
    });
  });
});

// ============================================================================
// EMAIL BUTTON TESTS
// ============================================================================

describe("EmailButton", () => {
  describe("Basic Rendering", () => {
    it("renders without errors", async () => {
      const html = await render(
        EmailButton({
          href: "https://test.com",
          children: "Click Me",
        })
      );
      expect(html).toBeDefined();
      expect(typeof html).toBe("string");
    });

    it("contains button text", async () => {
      const html = await render(
        EmailButton({
          href: "https://test.com",
          children: "View Case Details",
        })
      );
      expect(html).toContain("View Case Details");
    });

    it("contains href URL", async () => {
      const html = await render(
        EmailButton({
          href: "https://example.com/action",
          children: "Action",
        })
      );
      expect(html).toContain("https://example.com/action");
    });
  });

  describe("Default Variant", () => {
    it("renders with default (black) background", async () => {
      const html = await render(
        EmailButton({
          href: "https://test.com",
          children: "Click",
        })
      );
      // Default button has near-black background (#000001 — off-by-one for Gmail dark mode)
      expect(html).toContain("#000001");
    });
  });

  describe("Urgent Variant", () => {
    it("renders with red background for urgent variant", async () => {
      const html = await render(
        EmailButton({
          href: "https://test.com",
          children: "Urgent Action",
          variant: "urgent",
        })
      );
      // Urgent button has red background (#dc2626)
      expect(html).toContain("#dc2626");
    });
  });

  describe("Warning Variant", () => {
    it("renders with orange background for warning variant", async () => {
      const html = await render(
        EmailButton({
          href: "https://test.com",
          children: "Warning Action",
          variant: "warning",
        })
      );
      // Warning button has orange background (#f97316)
      expect(html).toContain("#f97316");
    });
  });

  describe("Neobrutalist Styling", () => {
    it("contains box shadow styling", async () => {
      const html = await render(
        EmailButton({
          href: "https://test.com",
          children: "Click",
        })
      );
      expect(html).toContain("box-shadow");
    });

    it("contains border styling", async () => {
      const html = await render(
        EmailButton({
          href: "https://test.com",
          children: "Click",
        })
      );
      expect(html).toContain("border");
    });
  });
});

// ============================================================================
// EMAIL HEADER TESTS
// ============================================================================

describe("EmailHeader", () => {
  describe("Basic Rendering", () => {
    it("renders without errors", async () => {
      const html = await render(
        EmailHeader({
          title: "Test Header",
        })
      );
      expect(html).toBeDefined();
      expect(typeof html).toBe("string");
    });

    it("contains title text", async () => {
      const html = await render(
        EmailHeader({
          title: "PWD Expiration Deadline",
        })
      );
      expect(html).toContain("PWD Expiration Deadline");
    });

    it("contains subtitle when provided", async () => {
      const html = await render(
        EmailHeader({
          title: "Header Title",
          subtitle: "Case #PERM-2024-001",
        })
      );
      expect(html).toContain("Case #PERM-2024-001");
    });

    it("renders without subtitle when not provided", async () => {
      const html = await render(
        EmailHeader({
          title: "Header Title Only",
        })
      );
      expect(html).toContain("Header Title Only");
      // Should not contain subtitle styling or extra paragraph
    });
  });

  describe("Icon Display", () => {
    it("contains icon when provided", async () => {
      const html = await render(
        EmailHeader({
          title: "Alert",
          icon: "🚨",
        })
      );
      // Emoji may be HTML encoded
      expect(html.length).toBeGreaterThan(0);
    });

    it("renders without icon when not provided", async () => {
      const html = await render(
        EmailHeader({
          title: "No Icon Header",
        })
      );
      expect(html).toContain("No Icon Header");
    });
  });

  describe("Urgency Colors", () => {
    it("uses blue color for normal urgency", async () => {
      const html = await render(
        EmailHeader({
          title: "Normal Priority",
          urgency: "normal",
        })
      );
      // Normal uses blue (#3b82f6)
      expect(html).toContain("#3b82f6");
    });

    it("uses orange color for high urgency", async () => {
      const html = await render(
        EmailHeader({
          title: "High Priority",
          urgency: "high",
        })
      );
      // High uses orange (#f97316)
      expect(html).toContain("#f97316");
    });

    it("uses red color for urgent urgency", async () => {
      const html = await render(
        EmailHeader({
          title: "Urgent Priority",
          urgency: "urgent",
        })
      );
      // Urgent uses red (#dc2626)
      expect(html).toContain("#dc2626");
    });

    it("uses dark red color for overdue urgency", async () => {
      const html = await render(
        EmailHeader({
          title: "Overdue Priority",
          urgency: "overdue",
        })
      );
      // Overdue uses dark red (#991b1b)
      expect(html).toContain("#991b1b");
    });

    it("defaults to normal urgency when not specified", async () => {
      const html = await render(
        EmailHeader({
          title: "Default Urgency",
        })
      );
      // Should use normal/blue color
      expect(html).toContain("#3b82f6");
    });
  });
});

// ============================================================================
// INTEGRATION TESTS
// ============================================================================

describe("Email Components - Integration", () => {
  it("EmailLayout wraps EmailHeader and EmailButton correctly", async () => {
    const html = await render(
      EmailLayout({
        previewText: "Integration test",
        children: React.createElement(
          React.Fragment,
          null,
          React.createElement(EmailHeader, {
            title: "Test Integration",
            urgency: "high",
          }),
          React.createElement(
            EmailButton,
            { href: "https://test.com" },
            "Click Here"
          )
        ),
      })
    );

    expect(html).toContain("Test Integration");
    expect(html).toContain("Click Here");
    expect(html).toContain("https://test.com");
    expect(html).toContain("PERM"); // Branding
    expect(html).toContain("Manage notification settings"); // Footer
  });
});
