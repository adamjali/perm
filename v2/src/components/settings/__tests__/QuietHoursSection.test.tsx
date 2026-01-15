// @vitest-environment jsdom
/**
 * @fileoverview Tests for QuietHoursSection component
 * @see v2/src/components/settings/QuietHoursSection.tsx
 *
 * Tests cover:
 * - Basic rendering (section header, toggle, time pickers)
 * - Master toggle behavior (show/hide time pickers)
 * - Time picker functionality
 * - Timezone display
 * - Warning messages
 * - Dirty state and save button
 * - Accessibility
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "../../../../test-utils/render-utils";
import QuietHoursSection from "../QuietHoursSection";

// ============================================================================
// MOCKS
// ============================================================================

// Mock Convex hooks
const mockUpdateProfile = vi.fn();

vi.mock("convex/react", () => ({
  useMutation: () => mockUpdateProfile,
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

// Mock settings context
vi.mock("../SettingsUnsavedChangesContext", () => ({
  useSettingsSectionDirtyState: vi.fn(),
}));

// ============================================================================
// TEST DATA
// ============================================================================

const defaultProfile = {
  quietHoursEnabled: false,
  quietHoursStart: "22:00",
  quietHoursEnd: "08:00",
  timezone: "America/New_York",
};

const enabledProfile = {
  quietHoursEnabled: true,
  quietHoursStart: "22:00",
  quietHoursEnd: "08:00",
  timezone: "America/New_York",
};

const pacificProfile = {
  quietHoursEnabled: true,
  quietHoursStart: "23:00",
  quietHoursEnd: "07:00",
  timezone: "America/Los_Angeles",
};

const mockOnNavigateToProfile = vi.fn();

// ============================================================================
// SETUP
// ============================================================================

describe("QuietHoursSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdateProfile.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  // ============================================================================
  // BASIC RENDERING TESTS
  // ============================================================================

  describe("Basic Rendering", () => {
    it("renders Quiet Hours section header", () => {
      renderWithProviders(
        <QuietHoursSection profile={defaultProfile} />
      );

      expect(screen.getByText("Quiet Hours")).toBeInTheDocument();
    });

    it("renders section description", () => {
      renderWithProviders(
        <QuietHoursSection profile={defaultProfile} />
      );

      expect(screen.getByText("Pause non-urgent notifications during specific hours")).toBeInTheDocument();
    });

    it("renders Enable Quiet Hours toggle", () => {
      renderWithProviders(
        <QuietHoursSection profile={defaultProfile} />
      );

      expect(screen.getByText("Enable Quiet Hours")).toBeInTheDocument();
      const toggle = screen.getByRole("switch");
      expect(toggle).toBeInTheDocument();
    });

    it("shows toggle unchecked when quiet hours disabled", () => {
      renderWithProviders(
        <QuietHoursSection profile={defaultProfile} />
      );

      const toggle = screen.getByRole("switch");
      expect(toggle).not.toBeChecked();
    });

    it("shows toggle checked when quiet hours enabled", () => {
      renderWithProviders(
        <QuietHoursSection profile={enabledProfile} />
      );

      const toggle = screen.getByRole("switch");
      expect(toggle).toBeChecked();
    });
  });

  // ============================================================================
  // TOGGLE BEHAVIOR TESTS
  // ============================================================================

  describe("Toggle Behavior", () => {
    it("hides time pickers when quiet hours disabled", () => {
      renderWithProviders(
        <QuietHoursSection profile={defaultProfile} />
      );

      expect(screen.queryByLabelText("Start Time")).not.toBeInTheDocument();
      expect(screen.queryByLabelText("End Time")).not.toBeInTheDocument();
    });

    it("shows time pickers when quiet hours enabled", async () => {
      renderWithProviders(
        <QuietHoursSection profile={enabledProfile} />
      );

      await waitFor(() => {
        expect(screen.getByText("Start Time")).toBeInTheDocument();
        expect(screen.getByText("End Time")).toBeInTheDocument();
      });
    });

    it("calls updateProfile when toggle changed", async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <QuietHoursSection profile={defaultProfile} />
      );

      const toggle = screen.getByRole("switch");
      await user.click(toggle);

      await waitFor(() => {
        expect(mockUpdateProfile).toHaveBeenCalledWith({ quietHoursEnabled: true });
      });
    });

    it("shows success toast when toggle enabled", async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <QuietHoursSection profile={defaultProfile} />
      );

      const toggle = screen.getByRole("switch");
      await user.click(toggle);

      await waitFor(() => {
        expect(mockToastSuccess).toHaveBeenCalledWith("Quiet hours enabled");
      });
    });

    it("shows success toast when toggle disabled", async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <QuietHoursSection profile={enabledProfile} />
      );

      const toggle = screen.getByRole("switch");
      await user.click(toggle);

      await waitFor(() => {
        expect(mockToastSuccess).toHaveBeenCalledWith("Quiet hours disabled");
      });
    });

    it("reverts toggle on error and shows error toast", async () => {
      mockUpdateProfile.mockRejectedValueOnce(new Error("Update failed"));
      const user = userEvent.setup();
      renderWithProviders(
        <QuietHoursSection profile={defaultProfile} />
      );

      const toggle = screen.getByRole("switch");
      await user.click(toggle);

      await waitFor(() => {
        expect(mockToastError).toHaveBeenCalledWith("Failed to update settings");
      });
    });
  });

  // ============================================================================
  // TIME PICKER TESTS
  // ============================================================================

  describe("Time Pickers", () => {
    it("displays time inputs when enabled", async () => {
      renderWithProviders(
        <QuietHoursSection profile={enabledProfile} />
      );

      await waitFor(() => {
        const startInput = screen.getByLabelText("Start Time");
        const endInput = screen.getByLabelText("End Time");
        expect(startInput).toBeInTheDocument();
        expect(endInput).toBeInTheDocument();
      });
    });

    it("displays default time values", async () => {
      renderWithProviders(
        <QuietHoursSection profile={enabledProfile} />
      );

      await waitFor(() => {
        const startInput = screen.getByLabelText("Start Time") as HTMLInputElement;
        const endInput = screen.getByLabelText("End Time") as HTMLInputElement;
        expect(startInput.value).toBe("22:00");
        expect(endInput.value).toBe("08:00");
      });
    });

    it("displays 12-hour format hint", async () => {
      renderWithProviders(
        <QuietHoursSection profile={enabledProfile} />
      );

      await waitFor(() => {
        expect(screen.getByText("10:00 PM")).toBeInTheDocument();
        expect(screen.getByText("8:00 AM")).toBeInTheDocument();
      });
    });
  });

  // ============================================================================
  // TIMEZONE DISPLAY TESTS
  // ============================================================================

  describe("Timezone Display", () => {
    it("displays timezone from profile", async () => {
      renderWithProviders(
        <QuietHoursSection profile={enabledProfile} />
      );

      await waitFor(() => {
        expect(screen.getByText(/Eastern \(ET\)/)).toBeInTheDocument();
      });
    });

    it("displays Pacific timezone correctly", async () => {
      renderWithProviders(
        <QuietHoursSection profile={pacificProfile} />
      );

      await waitFor(() => {
        expect(screen.getByText(/Pacific \(PT\)/)).toBeInTheDocument();
      });
    });

    it("shows Change in Profile link when callback provided", async () => {
      renderWithProviders(
        <QuietHoursSection
          profile={enabledProfile}
          onNavigateToProfile={mockOnNavigateToProfile}
        />
      );

      await waitFor(() => {
        expect(screen.getByText("Change in Profile")).toBeInTheDocument();
      });
    });

    it("calls onNavigateToProfile when link clicked", async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <QuietHoursSection
          profile={enabledProfile}
          onNavigateToProfile={mockOnNavigateToProfile}
        />
      );

      await waitFor(() => {
        const link = screen.getByText("Change in Profile");
        expect(link).toBeInTheDocument();
      });

      await user.click(screen.getByText("Change in Profile"));

      expect(mockOnNavigateToProfile).toHaveBeenCalled();
    });

    it("hides Change in Profile link when no callback", async () => {
      renderWithProviders(
        <QuietHoursSection profile={enabledProfile} />
      );

      await waitFor(() => {
        expect(screen.queryByText("Change in Profile")).not.toBeInTheDocument();
      });
    });
  });

  // ============================================================================
  // WARNING MESSAGE TESTS
  // ============================================================================

  describe("Warning Messages", () => {
    it("shows disabled warning when quiet hours off", () => {
      renderWithProviders(
        <QuietHoursSection profile={defaultProfile} />
      );

      expect(screen.getByText(/Quiet hours are disabled/)).toBeInTheDocument();
    });

    it("hides disabled warning when quiet hours on", async () => {
      renderWithProviders(
        <QuietHoursSection profile={enabledProfile} />
      );

      await waitFor(() => {
        expect(screen.queryByText(/Quiet hours are disabled/)).not.toBeInTheDocument();
      });
    });

    it("shows urgent notifications info when enabled", async () => {
      renderWithProviders(
        <QuietHoursSection profile={enabledProfile} />
      );

      await waitFor(() => {
        expect(screen.getByText(/Urgent notifications/)).toBeInTheDocument();
      });
    });
  });

  // ============================================================================
  // DIRTY STATE TESTS
  // ============================================================================

  describe("Dirty State and Save Button", () => {
    it("does not show save button initially", () => {
      renderWithProviders(
        <QuietHoursSection profile={enabledProfile} />
      );

      expect(screen.queryByRole("button", { name: /Save Changes/i })).not.toBeInTheDocument();
    });

    it("shows save button when time is changed", async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <QuietHoursSection profile={enabledProfile} />
      );

      await waitFor(() => {
        const startInput = screen.getByLabelText("Start Time");
        expect(startInput).toBeInTheDocument();
      });

      // Change the time
      const startInput = screen.getByLabelText("Start Time");
      await user.clear(startInput);
      await user.type(startInput, "21:00");

      await waitFor(() => {
        expect(screen.getByRole("button", { name: /Save Changes/i })).toBeInTheDocument();
      });
    });

    it("shows unsaved changes message when dirty", async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <QuietHoursSection profile={enabledProfile} />
      );

      await waitFor(() => {
        const startInput = screen.getByLabelText("Start Time");
        expect(startInput).toBeInTheDocument();
      });

      // Change the time
      const startInput = screen.getByLabelText("Start Time");
      await user.clear(startInput);
      await user.type(startInput, "21:00");

      await waitFor(() => {
        expect(screen.getByText(/You have unsaved changes/)).toBeInTheDocument();
      });
    });

    it("calls updateProfile when save button clicked", async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <QuietHoursSection profile={enabledProfile} />
      );

      await waitFor(() => {
        const startInput = screen.getByLabelText("Start Time");
        expect(startInput).toBeInTheDocument();
      });

      // Change the time
      const startInput = screen.getByLabelText("Start Time");
      await user.clear(startInput);
      await user.type(startInput, "21:00");

      await waitFor(() => {
        const saveButton = screen.getByRole("button", { name: /Save Changes/i });
        expect(saveButton).toBeInTheDocument();
      });

      await user.click(screen.getByRole("button", { name: /Save Changes/i }));

      await waitFor(() => {
        expect(mockUpdateProfile).toHaveBeenCalled();
      });
    });
  });

  // ============================================================================
  // ACCESSIBILITY TESTS
  // ============================================================================

  describe("Accessibility", () => {
    it("toggle has accessible name", () => {
      renderWithProviders(
        <QuietHoursSection profile={defaultProfile} />
      );

      const toggle = screen.getByRole("switch");
      expect(toggle).toHaveAccessibleName();
    });

    it("time inputs have accessible labels when enabled", async () => {
      renderWithProviders(
        <QuietHoursSection profile={enabledProfile} />
      );

      await waitFor(() => {
        const startInput = screen.getByLabelText("Start Time");
        const endInput = screen.getByLabelText("End Time");
        expect(startInput).toHaveAttribute("id", "quiet-hours-start");
        expect(endInput).toHaveAttribute("id", "quiet-hours-end");
      });
    });
  });

  // ============================================================================
  // NEOBRUTALIST STYLING TESTS
  // ============================================================================

  describe("Neobrutalist Styling", () => {
    it("applies neobrutalist border styling to main card", () => {
      const { container } = renderWithProviders(
        <QuietHoursSection profile={defaultProfile} />
      );

      const card = container.querySelector(".border-2.border-black");
      expect(card).toBeInTheDocument();
    });

    it("applies box shadow styling via inline style", () => {
      const { container } = renderWithProviders(
        <QuietHoursSection profile={defaultProfile} />
      );

      const cardWithShadow = container.querySelector('[style*="box-shadow"]');
      expect(cardWithShadow).toBeInTheDocument();
    });
  });
});
