/**
 * TimeoutWarningModal Component Tests
 *
 * Tests:
 * - Renders nothing when not visible
 * - Renders modal when visible
 * - Shows countdown timer
 * - Calls onExtend when "Stay Logged In" clicked
 * - Calls onLogout when "Log Out Now" clicked
 * - ESC key calls onExtend
 * - Uses correct z-index
 * - Accessibility (ARIA roles, keyboard support)
 *
 * Phase: 20 (Dashboard + UI Polish)
 * Created: 2025-12-24
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import { renderWithProviders } from "../../../../test-utils/render-utils";
import TimeoutWarningModal from "../TimeoutWarningModal";
import { Z_INDEX } from "@/lib/constants/zIndex";

// ============================================================================
// TESTS
// ============================================================================

describe("TimeoutWarningModal", () => {
  const defaultProps = {
    isVisible: true,
    remainingSeconds: 120,
    onExtend: vi.fn(),
    onLogout: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // --------------------------------------------------------------------------
  // VISIBILITY TESTS
  // --------------------------------------------------------------------------

  describe("Visibility", () => {
    it("renders nothing when not visible", () => {
      const { container } = renderWithProviders(
        <TimeoutWarningModal {...defaultProps} isVisible={false} />
      );

      expect(container.firstChild).toBeNull();
    });

    it("renders modal when visible", () => {
      renderWithProviders(<TimeoutWarningModal {...defaultProps} />);

      expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    });
  });

  // --------------------------------------------------------------------------
  // COUNTDOWN DISPLAY TESTS
  // --------------------------------------------------------------------------

  describe("Countdown display", () => {
    it("displays formatted countdown (120 seconds = 2:00)", () => {
      renderWithProviders(
        <TimeoutWarningModal {...defaultProps} remainingSeconds={120} />
      );

      expect(screen.getByText("2:00")).toBeInTheDocument();
    });

    it("displays formatted countdown (65 seconds = 1:05)", () => {
      renderWithProviders(
        <TimeoutWarningModal {...defaultProps} remainingSeconds={65} />
      );

      expect(screen.getByText("1:05")).toBeInTheDocument();
    });

    it("displays formatted countdown (9 seconds = 0:09)", () => {
      renderWithProviders(
        <TimeoutWarningModal {...defaultProps} remainingSeconds={9} />
      );

      expect(screen.getByText("0:09")).toBeInTheDocument();
    });
  });

  // --------------------------------------------------------------------------
  // BUTTON INTERACTION TESTS
  // --------------------------------------------------------------------------

  describe("Button interactions", () => {
    it("calls onExtend when Stay Logged In is clicked", () => {
      const onExtend = vi.fn();
      renderWithProviders(
        <TimeoutWarningModal {...defaultProps} onExtend={onExtend} />
      );

      const stayButton = screen.getByRole("button", { name: /stay logged in/i });
      fireEvent.click(stayButton);

      expect(onExtend).toHaveBeenCalledTimes(1);
    });

    it("calls onLogout when Log Out Now is clicked", () => {
      const onLogout = vi.fn();
      renderWithProviders(
        <TimeoutWarningModal {...defaultProps} onLogout={onLogout} />
      );

      const logoutButton = screen.getByRole("button", { name: /log out now/i });
      fireEvent.click(logoutButton);

      expect(onLogout).toHaveBeenCalledTimes(1);
    });

    it("Stay Logged In button is the primary action", () => {
      renderWithProviders(<TimeoutWarningModal {...defaultProps} />);

      const stayButton = screen.getByRole("button", { name: /stay logged in/i });
      // Primary button should have primary styling
      expect(stayButton).toHaveClass("bg-primary");
    });
  });

  // --------------------------------------------------------------------------
  // KEYBOARD TESTS
  // --------------------------------------------------------------------------

  describe("Keyboard interactions", () => {
    it("ESC key calls onExtend", () => {
      const onExtend = vi.fn();
      renderWithProviders(
        <TimeoutWarningModal {...defaultProps} onExtend={onExtend} />
      );

      fireEvent.keyDown(document, { key: "Escape" });

      expect(onExtend).toHaveBeenCalledTimes(1);
    });

    it("ESC key does nothing when not visible", () => {
      const onExtend = vi.fn();
      renderWithProviders(
        <TimeoutWarningModal {...defaultProps} isVisible={false} onExtend={onExtend} />
      );

      fireEvent.keyDown(document, { key: "Escape" });

      expect(onExtend).not.toHaveBeenCalled();
    });
  });

  // --------------------------------------------------------------------------
  // STYLING TESTS
  // --------------------------------------------------------------------------

  describe("Styling", () => {
    it("uses centralized z-index constant", () => {
      renderWithProviders(<TimeoutWarningModal {...defaultProps} />);

      const modal = screen.getByRole("alertdialog");
      expect(modal).toHaveStyle({ zIndex: Z_INDEX.timeoutWarning.toString() });
    });

    it("has fixed positioning", () => {
      renderWithProviders(<TimeoutWarningModal {...defaultProps} />);

      const modal = screen.getByRole("alertdialog");
      expect(modal).toHaveClass("fixed");
      expect(modal).toHaveClass("inset-0");
    });

    it("shows urgent styling when remainingSeconds <= 30", () => {
      const { container } = renderWithProviders(
        <TimeoutWarningModal {...defaultProps} remainingSeconds={25} />
      );

      // Check for red/urgent styling
      const countdown = screen.getByText("0:25");
      expect(countdown).toHaveClass("text-red-600");
    });

    it("does not show urgent styling when remainingSeconds > 30", () => {
      renderWithProviders(
        <TimeoutWarningModal {...defaultProps} remainingSeconds={60} />
      );

      const countdown = screen.getByText("1:00");
      expect(countdown).not.toHaveClass("text-red-600");
    });
  });

  // --------------------------------------------------------------------------
  // ACCESSIBILITY TESTS
  // --------------------------------------------------------------------------

  describe("Accessibility", () => {
    it("has alertdialog role", () => {
      renderWithProviders(<TimeoutWarningModal {...defaultProps} />);

      expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    });

    it("has aria-modal true", () => {
      renderWithProviders(<TimeoutWarningModal {...defaultProps} />);

      expect(screen.getByRole("alertdialog")).toHaveAttribute(
        "aria-modal",
        "true"
      );
    });

    it("has aria-labelledby pointing to title", () => {
      renderWithProviders(<TimeoutWarningModal {...defaultProps} />);

      const modal = screen.getByRole("alertdialog");
      expect(modal).toHaveAttribute("aria-labelledby", "timeout-title");

      // Verify the title exists with correct id
      const title = screen.getByText("Session Timeout Warning");
      expect(title).toHaveAttribute("id", "timeout-title");
    });

    it("has aria-describedby pointing to description", () => {
      renderWithProviders(<TimeoutWarningModal {...defaultProps} />);

      const modal = screen.getByRole("alertdialog");
      expect(modal).toHaveAttribute("aria-describedby", "timeout-description");
    });

    it("shows keyboard hint for ESC key", () => {
      renderWithProviders(<TimeoutWarningModal {...defaultProps} />);

      // Find the kbd element containing "Esc"
      expect(screen.getByText("Esc")).toBeInTheDocument();
      // Verify the hint text is present (in the paragraph containing the kbd)
      expect(screen.getByText(/to stay logged in/i)).toBeInTheDocument();
    });
  });

  // --------------------------------------------------------------------------
  // CONTENT TESTS
  // --------------------------------------------------------------------------

  describe("Content", () => {
    it("shows session timeout warning title", () => {
      renderWithProviders(<TimeoutWarningModal {...defaultProps} />);

      expect(screen.getByText("Session Timeout Warning")).toBeInTheDocument();
    });

    it("shows inactivity message", () => {
      renderWithProviders(<TimeoutWarningModal {...defaultProps} />);

      expect(
        screen.getByText(/you've been inactive for a while/i)
      ).toBeInTheDocument();
    });

    it("clicking backdrop calls onExtend", () => {
      const onExtend = vi.fn();
      const { container } = renderWithProviders(
        <TimeoutWarningModal {...defaultProps} onExtend={onExtend} />
      );

      const backdrop = container.querySelector('[aria-hidden="true"]');
      expect(backdrop).toBeInTheDocument();
      fireEvent.click(backdrop!);

      expect(onExtend).toHaveBeenCalledTimes(1);
    });
  });
});
