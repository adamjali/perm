/**
 * @fileoverview Tests for SupportSection component
 * @see v2/src/components/settings/SupportSection.tsx
 * @see v2/docs/DESIGN_SYSTEM.md - Neobrutalist styling
 *
 * Tests cover:
 * - Basic rendering (section, all links visible)
 * - Email link has correct mailto href
 * - GitHub links have correct href with labels
 * - External links have target="_blank" and rel="noopener noreferrer"
 * - App version displays correctly
 * - Delete Account section rendering and interaction
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "../../../../test-utils/render-utils";
import SupportSection from "../SupportSection";

// ============================================================================
// CONSTANTS (matching component)
// ============================================================================

const SUPPORT_EMAIL = "support@permtracker.app";
const GITHUB_BUG_REPORT_URL =
  "https://github.com/adamjali/perm/issues/new?labels=bug";
const GITHUB_FEATURE_REQUEST_URL =
  "https://github.com/adamjali/perm/issues/new?labels=enhancement";

// ============================================================================
// MOCKS
// ============================================================================

// Mock router
const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
  }),
}));

// Mock auth actions
const mockSignOut = vi.fn();
vi.mock("@convex-dev/auth/react", () => ({
  useAuthActions: () => ({
    signOut: mockSignOut,
  }),
}));

// Mock Convex hooks
const mockRequestDeletion = vi.fn();
const mockCancelDeletion = vi.fn();
const mockImmediateDelete = vi.fn();
vi.mock("convex/react", () => ({
  useMutation: (ref: unknown) => {
    // Return appropriate mock based on which mutation is being used
    if (typeof ref === "object" && ref !== null) {
      const refStr = JSON.stringify(ref);
      if (refStr.includes("cancel")) return mockCancelDeletion;
    }
    return mockRequestDeletion;
  },
  useAction: () => mockImmediateDelete,
}));

// Mock auth-aware toast wrapper (not sonner directly)
const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();
vi.mock("@/lib/toast", () => ({
  toast: {
    success: (msg: string) => mockToastSuccess(msg),
    error: (msg: string) => mockToastError(msg),
  },
  // Required by AuthContext
  updateToastAuthState: vi.fn(),
}));

// ============================================================================
// TEST DATA
// ============================================================================

const defaultProfile = {
  deletedAt: undefined,
};

const scheduledDeletionProfile = {
  deletedAt: Date.now() + 30 * 24 * 60 * 60 * 1000, // 30 days in the future
};

// ============================================================================
// SETUP
// ============================================================================

describe("SupportSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset environment variable for each test
    process.env.NEXT_PUBLIC_APP_VERSION = undefined;
    // Set up mock defaults
    mockRequestDeletion.mockResolvedValue(undefined);
    mockCancelDeletion.mockResolvedValue(undefined);
    mockImmediateDelete.mockResolvedValue({ success: true });
  });

  // ============================================================================
  // BASIC RENDERING TESTS
  // ============================================================================

  describe("Basic Rendering", () => {
    it("renders Help & Support section header", () => {
      renderWithProviders(<SupportSection profile={defaultProfile} />);

      expect(screen.getByText("Help & Support")).toBeInTheDocument();
    });

    it("renders section description", () => {
      renderWithProviders(<SupportSection profile={defaultProfile} />);

      expect(
        screen.getByText("Get help, report issues, or suggest new features")
      ).toBeInTheDocument();
    });

    it("renders Contact Support link", () => {
      renderWithProviders(<SupportSection profile={defaultProfile} />);

      expect(screen.getByText("Contact Support")).toBeInTheDocument();
    });

    it("renders Report a Bug link", () => {
      renderWithProviders(<SupportSection profile={defaultProfile} />);

      expect(screen.getByText("Report a Bug")).toBeInTheDocument();
    });

    it("renders Request Feature link", () => {
      renderWithProviders(<SupportSection profile={defaultProfile} />);

      expect(screen.getByText("Request Feature")).toBeInTheDocument();
    });

    it("renders all three support links", () => {
      renderWithProviders(<SupportSection profile={defaultProfile} />);

      const links = screen.getAllByRole("link");
      expect(links.length).toBe(3);
    });
  });

  // ============================================================================
  // EMAIL LINK TESTS
  // ============================================================================

  describe("Email Link", () => {
    it("has correct mailto href", () => {
      renderWithProviders(<SupportSection profile={defaultProfile} />);

      const emailLink = screen.getByRole("link", { name: /contact support/i });
      expect(emailLink).toHaveAttribute("href", `mailto:${SUPPORT_EMAIL}`);
    });

    it("displays support email address", () => {
      renderWithProviders(<SupportSection profile={defaultProfile} />);

      expect(screen.getByText(SUPPORT_EMAIL)).toBeInTheDocument();
    });
  });

  // ============================================================================
  // GITHUB LINKS TESTS
  // ============================================================================

  describe("GitHub Links", () => {
    it("bug report link has correct href with bug label", () => {
      renderWithProviders(<SupportSection profile={defaultProfile} />);

      const bugLink = screen.getByRole("link", { name: /report a bug/i });
      expect(bugLink).toHaveAttribute("href", GITHUB_BUG_REPORT_URL);
      expect(bugLink.getAttribute("href")).toContain("labels=bug");
    });

    it("feature request link has correct href with enhancement label", () => {
      renderWithProviders(<SupportSection profile={defaultProfile} />);

      const featureLink = screen.getByRole("link", { name: /request feature/i });
      expect(featureLink).toHaveAttribute("href", GITHUB_FEATURE_REQUEST_URL);
      expect(featureLink.getAttribute("href")).toContain("labels=enhancement");
    });

    it("GitHub links display GitHub Issues subtitle", () => {
      renderWithProviders(<SupportSection profile={defaultProfile} />);

      const subtitles = screen.getAllByText("GitHub Issues");
      expect(subtitles.length).toBe(2);
    });
  });

  // ============================================================================
  // EXTERNAL LINKS TESTS
  // ============================================================================

  describe("External Links Security", () => {
    it("bug report link opens in new tab", () => {
      renderWithProviders(<SupportSection profile={defaultProfile} />);

      const bugLink = screen.getByRole("link", { name: /report a bug/i });
      expect(bugLink).toHaveAttribute("target", "_blank");
    });

    it("bug report link has noopener noreferrer", () => {
      renderWithProviders(<SupportSection profile={defaultProfile} />);

      const bugLink = screen.getByRole("link", { name: /report a bug/i });
      expect(bugLink).toHaveAttribute("rel", "noopener noreferrer");
    });

    it("feature request link opens in new tab", () => {
      renderWithProviders(<SupportSection profile={defaultProfile} />);

      const featureLink = screen.getByRole("link", { name: /request feature/i });
      expect(featureLink).toHaveAttribute("target", "_blank");
    });

    it("feature request link has noopener noreferrer", () => {
      renderWithProviders(<SupportSection profile={defaultProfile} />);

      const featureLink = screen.getByRole("link", { name: /request feature/i });
      expect(featureLink).toHaveAttribute("rel", "noopener noreferrer");
    });

    it("email link opens in new tab", () => {
      renderWithProviders(<SupportSection profile={defaultProfile} />);

      const emailLink = screen.getByRole("link", { name: /contact support/i });
      expect(emailLink).toHaveAttribute("target", "_blank");
    });
  });

  // ============================================================================
  // APP INFO TESTS
  // ============================================================================

  describe("App Info", () => {
    it("displays version in info bar", () => {
      const { container } = renderWithProviders(
        <SupportSection profile={defaultProfile} />
      );

      // Version is displayed in a font-mono span
      const versionSpan = container.querySelector(".font-mono");
      expect(versionSpan).toBeInTheDocument();
      expect(versionSpan?.textContent).toContain("PERM Tracker v");
    });

    it("displays copyright with current year", () => {
      const { container } = renderWithProviders(
        <SupportSection profile={defaultProfile} />
      );

      const currentYear = new Date().getFullYear();
      // Copyright is in the info bar
      const infoBar = container.querySelector(".bg-muted\\/30");
      expect(infoBar).toBeInTheDocument();
      expect(infoBar?.textContent).toContain(`${currentYear}`);
    });

    it("displays PERM Tracker in copyright", () => {
      const { container } = renderWithProviders(
        <SupportSection profile={defaultProfile} />
      );

      const infoBar = container.querySelector(".bg-muted\\/30");
      expect(infoBar).toBeInTheDocument();
      expect(infoBar?.textContent).toContain("PERM Tracker");
    });
  });

  // ============================================================================
  // DELETE ACCOUNT SECTION TESTS
  // ============================================================================

  describe("Delete Account Section", () => {
    it("renders Delete Account header", () => {
      renderWithProviders(<SupportSection profile={defaultProfile} />);

      // Use heading role to find the header specifically
      const header = screen.getByRole("heading", { name: /Delete Account/i });
      expect(header).toBeInTheDocument();
    });

    it("renders delete account description", () => {
      renderWithProviders(<SupportSection profile={defaultProfile} />);

      expect(
        screen.getByText(/Permanently delete your account and all associated data/)
      ).toBeInTheDocument();
    });

    it("renders Delete Account button when not scheduled", () => {
      renderWithProviders(<SupportSection profile={defaultProfile} />);

      const deleteButton = screen.getByRole("button", { name: /Delete Account/i });
      expect(deleteButton).toBeInTheDocument();
      expect(deleteButton).not.toBeDisabled();
    });

    it("shows Deletion Pending when deletion is scheduled", () => {
      renderWithProviders(<SupportSection profile={scheduledDeletionProfile} />);

      expect(screen.getByText("Deletion Scheduled")).toBeInTheDocument();
      expect(screen.getByText("Deletion Pending")).toBeInTheDocument();
    });

    it("shows Cancel Deletion button when deletion is scheduled", () => {
      renderWithProviders(<SupportSection profile={scheduledDeletionProfile} />);

      const cancelButton = screen.getByRole("button", { name: /Cancel Deletion/i });
      expect(cancelButton).toBeInTheDocument();
    });

    it("disables Delete Account button when deletion is scheduled", () => {
      renderWithProviders(<SupportSection profile={scheduledDeletionProfile} />);

      const deleteButton = screen.getByRole("button", { name: /Deletion Pending/i });
      expect(deleteButton).toBeDisabled();
    });

    it("opens confirmation dialog when Delete Account is clicked", async () => {
      const user = userEvent.setup();
      renderWithProviders(<SupportSection profile={defaultProfile} />);

      const deleteButton = screen.getByRole("button", { name: /Delete Account/i });
      await user.click(deleteButton);

      expect(screen.getByText("Delete Your Account")).toBeInTheDocument();
    });

    it("shows confirmation input in dialog", async () => {
      const user = userEvent.setup();
      renderWithProviders(<SupportSection profile={defaultProfile} />);

      const deleteButton = screen.getByRole("button", { name: /Delete Account/i });
      await user.click(deleteButton);

      expect(screen.getByPlaceholderText(/Type DELETE to confirm/i)).toBeInTheDocument();
    });

    it("requires DELETE confirmation to enable delete", async () => {
      const user = userEvent.setup();
      renderWithProviders(<SupportSection profile={defaultProfile} />);

      // Open dialog
      const deleteButton = screen.getByRole("button", { name: /Delete Account/i });
      await user.click(deleteButton);

      // Wait for dialog to appear
      await waitFor(() => {
        expect(screen.getByText("Delete Your Account")).toBeInTheDocument();
      });

      // Dialog delete button should be disabled initially
      // Find buttons within dialog - the confirm button typically contains specific text
      const allButtons = screen.getAllByRole("button");
      const dialogDeleteButton = allButtons.find(
        (btn) => btn.textContent?.includes("Delete Account") && btn !== deleteButton
      );
      expect(dialogDeleteButton).toBeDisabled();

      // Type confirmation
      const input = screen.getByPlaceholderText(/Type DELETE to confirm/i);
      await user.type(input, "DELETE");

      // Button should now be enabled
      await waitFor(() => {
        expect(dialogDeleteButton).not.toBeDisabled();
      });
    });

    it("closes dialog when Cancel is clicked", async () => {
      const user = userEvent.setup();
      renderWithProviders(<SupportSection profile={defaultProfile} />);

      // Open dialog
      const deleteButton = screen.getByRole("button", { name: /Delete Account/i });
      await user.click(deleteButton);

      expect(screen.getByText("Delete Your Account")).toBeInTheDocument();

      // Click cancel
      const cancelButton = screen.getByRole("button", { name: /^Cancel$/i });
      await user.click(cancelButton);

      await waitFor(() => {
        expect(screen.queryByText("Delete Your Account")).not.toBeInTheDocument();
      });
    });

    it("shows deletion warning information in dialog", async () => {
      const user = userEvent.setup();
      renderWithProviders(<SupportSection profile={defaultProfile} />);

      const deleteButton = screen.getByRole("button", { name: /Delete Account/i });
      await user.click(deleteButton);

      expect(screen.getByText(/All your PERM cases and related data/)).toBeInTheDocument();
      expect(screen.getByText(/Notification preferences and history/)).toBeInTheDocument();
      expect(screen.getByText(/Calendar sync settings/)).toBeInTheDocument();
      expect(screen.getByText(/Your user profile/)).toBeInTheDocument();
    });

    it("shows Delete Now button when deletion is scheduled", () => {
      renderWithProviders(<SupportSection profile={scheduledDeletionProfile} />);

      const deleteNowButton = screen.getByRole("button", { name: /Delete Now/i });
      expect(deleteNowButton).toBeInTheDocument();
    });

    it("does not show Delete Now button when no deletion scheduled", () => {
      renderWithProviders(<SupportSection profile={defaultProfile} />);

      expect(screen.queryByRole("button", { name: /Delete Now/i })).not.toBeInTheDocument();
    });

    it("opens DeleteNowDialog when Delete Now is clicked", async () => {
      const user = userEvent.setup();
      renderWithProviders(<SupportSection profile={scheduledDeletionProfile} />);

      const deleteNowButton = screen.getByRole("button", { name: /Delete Now/i });
      await user.click(deleteNowButton);

      expect(screen.getByText("Delete Account Now")).toBeInTheDocument();
    });
  });

  // ============================================================================
  // NEOBRUTALIST STYLING TESTS
  // ============================================================================

  describe("Neobrutalist Styling", () => {
    it("applies neobrutalist border styling to main card", () => {
      const { container } = renderWithProviders(
        <SupportSection profile={defaultProfile} />
      );

      const card = container.querySelector(".border-2.border-black");
      expect(card).toBeInTheDocument();
    });

    it("applies box shadow styling via inline style", () => {
      const { container } = renderWithProviders(
        <SupportSection profile={defaultProfile} />
      );

      // Main cards have box-shadow: 4px 4px 0px #000
      const mainCard = container.querySelector('[style*="box-shadow"]');
      expect(mainCard).toBeInTheDocument();
    });

    it("support links have border styling", () => {
      const { container } = renderWithProviders(
        <SupportSection profile={defaultProfile} />
      );

      const links = container.querySelectorAll("a.border-2");
      expect(links.length).toBe(3);
    });

    it("applies hover transition classes to links", () => {
      const { container } = renderWithProviders(
        <SupportSection profile={defaultProfile} />
      );

      const links = container.querySelectorAll("a.transition-colors");
      expect(links.length).toBeGreaterThanOrEqual(3);
    });

    it("delete account section has destructive border", () => {
      const { container } = renderWithProviders(
        <SupportSection profile={defaultProfile} />
      );

      const deleteSection = container.querySelector(".border-destructive");
      expect(deleteSection).toBeInTheDocument();
    });
  });

  // ============================================================================
  // ACCESSIBILITY TESTS
  // ============================================================================

  describe("Accessibility", () => {
    it("all links are accessible via role", () => {
      renderWithProviders(<SupportSection profile={defaultProfile} />);

      const links = screen.getAllByRole("link");
      expect(links.length).toBe(3);
    });

    it("links have accessible names", () => {
      renderWithProviders(<SupportSection profile={defaultProfile} />);

      const contactLink = screen.getByRole("link", { name: /contact support/i });
      expect(contactLink).toHaveAccessibleName();

      const bugLink = screen.getByRole("link", { name: /report a bug/i });
      expect(bugLink).toHaveAccessibleName();

      const featureLink = screen.getByRole("link", { name: /request feature/i });
      expect(featureLink).toHaveAccessibleName();
    });

    it("delete button has accessible name", () => {
      renderWithProviders(<SupportSection profile={defaultProfile} />);

      const deleteButton = screen.getByRole("button", { name: /Delete Account/i });
      expect(deleteButton).toHaveAccessibleName();
    });
  });

  // ============================================================================
  // RESPONSIVE LAYOUT TESTS
  // ============================================================================

  describe("Responsive Layout", () => {
    it("has grid layout for support links", () => {
      const { container } = renderWithProviders(
        <SupportSection profile={defaultProfile} />
      );

      const grid = container.querySelector(".grid");
      expect(grid).toBeInTheDocument();
    });

    it("has responsive grid columns class", () => {
      const { container } = renderWithProviders(
        <SupportSection profile={defaultProfile} />
      );

      const grid = container.querySelector(".sm\\:grid-cols-3");
      expect(grid).toBeInTheDocument();
    });
  });
});
