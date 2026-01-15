// @vitest-environment jsdom
/**
 * @fileoverview Tests for ProfileSection component
 * @see v2/src/components/settings/ProfileSection.tsx
 *
 * Tests cover:
 * - Basic rendering (header, form fields, profile photo area)
 * - Profile photo/initials display logic
 * - Form field behavior (name, email, timezone)
 * - Dirty state detection and save button
 * - Save functionality and error handling
 * - Google sign-in badge display
 * - Accessibility
 * - Neobrutalist styling
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "../../../../test-utils/render-utils";
import ProfileSection from "../ProfileSection";

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

// Mock Intl for timezone detection
const originalIntl = globalThis.Intl;

// ============================================================================
// TEST DATA
// ============================================================================

const defaultProfile = {
  fullName: "John Doe",
  profilePhotoUrl: undefined,
  timezone: "America/New_York",
};

const profileWithPhoto = {
  fullName: "Jane Smith",
  profilePhotoUrl: "https://lh3.googleusercontent.com/a/test-photo-url",
  timezone: "America/Los_Angeles",
};

const emptyProfile = {
  fullName: undefined,
  profilePhotoUrl: undefined,
  timezone: undefined,
};

const defaultEmail = "john.doe@example.com";

// ============================================================================
// SETUP
// ============================================================================

describe("ProfileSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdateProfile.mockResolvedValue(undefined);
    // Mock Intl.DateTimeFormat for timezone detection
    globalThis.Intl = {
      ...originalIntl,
      DateTimeFormat: vi.fn().mockReturnValue({
        resolvedOptions: () => ({ timeZone: "America/New_York" }),
      }),
    } as typeof Intl;
  });

  afterEach(() => {
    vi.resetAllMocks();
    globalThis.Intl = originalIntl;
  });

  // ============================================================================
  // BASIC RENDERING TESTS
  // ============================================================================

  describe("Basic Rendering", () => {
    it("renders Profile Information header", () => {
      renderWithProviders(
        <ProfileSection profile={defaultProfile} userEmail={defaultEmail} />
      );

      expect(screen.getByText("Profile Information")).toBeInTheDocument();
    });

    it("renders Full Name field with label", () => {
      renderWithProviders(
        <ProfileSection profile={defaultProfile} userEmail={defaultEmail} />
      );

      expect(screen.getByText("Full Name")).toBeInTheDocument();
      expect(screen.getByPlaceholderText("Enter your full name")).toBeInTheDocument();
    });

    it("renders Email field with label and hint", () => {
      renderWithProviders(
        <ProfileSection profile={defaultProfile} userEmail={defaultEmail} />
      );

      expect(screen.getByText("Email")).toBeInTheDocument();
      expect(screen.getByText("Email cannot be changed")).toBeInTheDocument();
    });

    it("renders Timezone field with label and hint", () => {
      renderWithProviders(
        <ProfileSection profile={defaultProfile} userEmail={defaultEmail} />
      );

      expect(screen.getByText("Timezone")).toBeInTheDocument();
      expect(screen.getByText("Used for deadline reminders and notifications")).toBeInTheDocument();
    });

    it("renders Save Changes button", () => {
      renderWithProviders(
        <ProfileSection profile={defaultProfile} userEmail={defaultEmail} />
      );

      expect(screen.getByRole("button", { name: /Save Changes/i })).toBeInTheDocument();
    });
  });

  // ============================================================================
  // PROFILE PHOTO/INITIALS TESTS
  // ============================================================================

  describe("Profile Photo and Initials", () => {
    it("displays profile photo when provided", () => {
      renderWithProviders(
        <ProfileSection profile={profileWithPhoto} userEmail={defaultEmail} />
      );

      const img = screen.getByRole("img", { name: /Jane Smith/i });
      expect(img).toBeInTheDocument();
      expect(img).toHaveAttribute("src", profileWithPhoto.profilePhotoUrl);
    });

    it("displays initials when no photo but name is provided", () => {
      renderWithProviders(
        <ProfileSection profile={defaultProfile} userEmail={defaultEmail} />
      );

      expect(screen.getByText("JD")).toBeInTheDocument();
    });

    it("displays single initial for single-word name", () => {
      const singleNameProfile = { ...defaultProfile, fullName: "Madonna" };
      renderWithProviders(
        <ProfileSection profile={singleNameProfile} userEmail={defaultEmail} />
      );

      expect(screen.getByText("M")).toBeInTheDocument();
    });

    it("displays helper text for photo from Google", () => {
      renderWithProviders(
        <ProfileSection profile={profileWithPhoto} userEmail={defaultEmail} />
      );

      expect(screen.getByText("Profile photo from Google")).toBeInTheDocument();
    });

    it("displays helper text for initials display", () => {
      renderWithProviders(
        <ProfileSection profile={defaultProfile} userEmail={defaultEmail} />
      );

      expect(screen.getByText("Your initials are displayed")).toBeInTheDocument();
    });

    it("displays helper text when no name is set", () => {
      renderWithProviders(
        <ProfileSection profile={emptyProfile} userEmail={defaultEmail} />
      );

      expect(screen.getByText("Add your name to show initials")).toBeInTheDocument();
    });
  });

  // ============================================================================
  // FORM FIELD BEHAVIOR TESTS
  // ============================================================================

  describe("Form Field Behavior", () => {
    it("populates full name from profile", () => {
      renderWithProviders(
        <ProfileSection profile={defaultProfile} userEmail={defaultEmail} />
      );

      const nameInput = screen.getByPlaceholderText("Enter your full name") as HTMLInputElement;
      expect(nameInput.value).toBe("John Doe");
    });

    it("populates email from prop", () => {
      renderWithProviders(
        <ProfileSection profile={defaultProfile} userEmail={defaultEmail} />
      );

      const emailInput = screen.getByDisplayValue(defaultEmail) as HTMLInputElement;
      expect(emailInput).toBeInTheDocument();
      expect(emailInput).toBeDisabled();
    });

    it("populates timezone from profile", () => {
      renderWithProviders(
        <ProfileSection profile={defaultProfile} userEmail={defaultEmail} />
      );

      const timezoneSelect = screen.getByRole("combobox") as HTMLSelectElement;
      expect(timezoneSelect.value).toBe("America/New_York");
    });

    it("allows editing full name", async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <ProfileSection profile={defaultProfile} userEmail={defaultEmail} />
      );

      const nameInput = screen.getByPlaceholderText("Enter your full name");
      await user.clear(nameInput);
      await user.type(nameInput, "Jane Doe");

      expect(nameInput).toHaveValue("Jane Doe");
    });

    it("allows changing timezone", async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <ProfileSection profile={defaultProfile} userEmail={defaultEmail} />
      );

      const timezoneSelect = screen.getByRole("combobox");
      await user.selectOptions(timezoneSelect, "America/Los_Angeles");

      expect(timezoneSelect).toHaveValue("America/Los_Angeles");
    });
  });

  // ============================================================================
  // GOOGLE SIGN-IN BADGE TESTS
  // ============================================================================

  describe("Google Sign-In Badge", () => {
    it("shows Google badge when profile photo is from Google", () => {
      renderWithProviders(
        <ProfileSection profile={profileWithPhoto} userEmail={defaultEmail} />
      );

      expect(screen.getByText("Signed in with Google")).toBeInTheDocument();
    });

    it("hides Google badge when no Google photo", () => {
      renderWithProviders(
        <ProfileSection profile={defaultProfile} userEmail={defaultEmail} />
      );

      expect(screen.queryByText("Signed in with Google")).not.toBeInTheDocument();
    });
  });

  // ============================================================================
  // DIRTY STATE TESTS
  // ============================================================================

  describe("Dirty State", () => {
    it("shows 'All changes saved' when no changes", () => {
      renderWithProviders(
        <ProfileSection profile={defaultProfile} userEmail={defaultEmail} />
      );

      expect(screen.getByText("All changes saved")).toBeInTheDocument();
    });

    it("disables Save button when no changes", () => {
      renderWithProviders(
        <ProfileSection profile={defaultProfile} userEmail={defaultEmail} />
      );

      const saveButton = screen.getByRole("button", { name: /Save Changes/i });
      expect(saveButton).toBeDisabled();
    });

    it("shows unsaved changes message when name is changed", async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <ProfileSection profile={defaultProfile} userEmail={defaultEmail} />
      );

      const nameInput = screen.getByPlaceholderText("Enter your full name");
      await user.clear(nameInput);
      await user.type(nameInput, "New Name");

      await waitFor(() => {
        expect(screen.getByText("You have unsaved changes")).toBeInTheDocument();
      });
    });

    it("enables Save button when changes are made", async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <ProfileSection profile={defaultProfile} userEmail={defaultEmail} />
      );

      const nameInput = screen.getByPlaceholderText("Enter your full name");
      await user.clear(nameInput);
      await user.type(nameInput, "New Name");

      await waitFor(() => {
        const saveButton = screen.getByRole("button", { name: /Save Changes/i });
        expect(saveButton).not.toBeDisabled();
      });
    });

    it("shows unsaved changes when timezone is changed", async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <ProfileSection profile={defaultProfile} userEmail={defaultEmail} />
      );

      const timezoneSelect = screen.getByRole("combobox");
      await user.selectOptions(timezoneSelect, "America/Chicago");

      await waitFor(() => {
        expect(screen.getByText("You have unsaved changes")).toBeInTheDocument();
      });
    });
  });

  // ============================================================================
  // SAVE FUNCTIONALITY TESTS
  // ============================================================================

  describe("Save Functionality", () => {
    it("calls updateProfile with only changed fields when name changed", async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <ProfileSection profile={defaultProfile} userEmail={defaultEmail} />
      );

      const nameInput = screen.getByPlaceholderText("Enter your full name");
      await user.clear(nameInput);
      await user.type(nameInput, "New Name");

      const saveButton = screen.getByRole("button", { name: /Save Changes/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(mockUpdateProfile).toHaveBeenCalledWith({ fullName: "New Name" });
      });
    });

    it("calls updateProfile with only changed fields when timezone changed", async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <ProfileSection profile={defaultProfile} userEmail={defaultEmail} />
      );

      const timezoneSelect = screen.getByRole("combobox");
      await user.selectOptions(timezoneSelect, "America/Chicago");

      const saveButton = screen.getByRole("button", { name: /Save Changes/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(mockUpdateProfile).toHaveBeenCalledWith({ timezone: "America/Chicago" });
      });
    });

    it("calls updateProfile with both fields when both changed", async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <ProfileSection profile={defaultProfile} userEmail={defaultEmail} />
      );

      const nameInput = screen.getByPlaceholderText("Enter your full name");
      await user.clear(nameInput);
      await user.type(nameInput, "New Name");

      const timezoneSelect = screen.getByRole("combobox");
      await user.selectOptions(timezoneSelect, "America/Chicago");

      const saveButton = screen.getByRole("button", { name: /Save Changes/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(mockUpdateProfile).toHaveBeenCalledWith({
          fullName: "New Name",
          timezone: "America/Chicago",
        });
      });
    });

    it("shows success toast when save succeeds", async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <ProfileSection profile={defaultProfile} userEmail={defaultEmail} />
      );

      const nameInput = screen.getByPlaceholderText("Enter your full name");
      await user.clear(nameInput);
      await user.type(nameInput, "New Name");

      const saveButton = screen.getByRole("button", { name: /Save Changes/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(mockToastSuccess).toHaveBeenCalledWith("Profile updated successfully");
      });
    });

    it("shows Saved! message after successful save", async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <ProfileSection profile={defaultProfile} userEmail={defaultEmail} />
      );

      const nameInput = screen.getByPlaceholderText("Enter your full name");
      await user.clear(nameInput);
      await user.type(nameInput, "New Name");

      const saveButton = screen.getByRole("button", { name: /Save Changes/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText("Saved!")).toBeInTheDocument();
      });
    });
  });

  // ============================================================================
  // ERROR HANDLING TESTS
  // ============================================================================

  describe("Error Handling", () => {
    it("shows error toast when save fails", async () => {
      mockUpdateProfile.mockRejectedValueOnce(new Error("Update failed"));
      const user = userEvent.setup();
      renderWithProviders(
        <ProfileSection profile={defaultProfile} userEmail={defaultEmail} />
      );

      const nameInput = screen.getByPlaceholderText("Enter your full name");
      await user.clear(nameInput);
      await user.type(nameInput, "New Name");

      const saveButton = screen.getByRole("button", { name: /Save Changes/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(mockToastError).toHaveBeenCalledWith("Failed to update profile. Please try again.");
      });
    });

    it("re-enables Save button after error", async () => {
      mockUpdateProfile.mockRejectedValueOnce(new Error("Update failed"));
      const user = userEvent.setup();
      renderWithProviders(
        <ProfileSection profile={defaultProfile} userEmail={defaultEmail} />
      );

      const nameInput = screen.getByPlaceholderText("Enter your full name");
      await user.clear(nameInput);
      await user.type(nameInput, "New Name");

      const saveButton = screen.getByRole("button", { name: /Save Changes/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(mockToastError).toHaveBeenCalled();
      });

      // Button should be re-enabled after error
      await waitFor(() => {
        expect(saveButton).not.toBeDisabled();
      });
    });
  });

  // ============================================================================
  // TIMEZONE OPTIONS TESTS
  // ============================================================================

  describe("Timezone Options", () => {
    it("includes all 6 US timezone options", () => {
      renderWithProviders(
        <ProfileSection profile={defaultProfile} userEmail={defaultEmail} />
      );

      const timezoneSelect = screen.getByRole("combobox");
      const options = timezoneSelect.querySelectorAll("option");

      // Should have 6 timezones
      expect(options).toHaveLength(6);
    });

    it("displays timezone labels correctly", () => {
      renderWithProviders(
        <ProfileSection profile={defaultProfile} userEmail={defaultEmail} />
      );

      expect(screen.getByText("Eastern (ET)")).toBeInTheDocument();
      expect(screen.getByText("Central (CT)")).toBeInTheDocument();
      expect(screen.getByText("Mountain (MT)")).toBeInTheDocument();
      expect(screen.getByText("Pacific (PT)")).toBeInTheDocument();
      expect(screen.getByText("Alaska (AKT)")).toBeInTheDocument();
      expect(screen.getByText("Hawaii (HST)")).toBeInTheDocument();
    });
  });

  // ============================================================================
  // ACCESSIBILITY TESTS
  // ============================================================================

  describe("Accessibility", () => {
    it("has accessible name input", () => {
      renderWithProviders(
        <ProfileSection profile={defaultProfile} userEmail={defaultEmail} />
      );

      const nameInput = screen.getByPlaceholderText("Enter your full name");
      expect(nameInput).toHaveAttribute("id", "fullName");
    });

    it("has accessible email input", () => {
      renderWithProviders(
        <ProfileSection profile={defaultProfile} userEmail={defaultEmail} />
      );

      const emailInput = screen.getByDisplayValue(defaultEmail);
      expect(emailInput).toHaveAttribute("id", "email");
    });

    it("has accessible timezone select", () => {
      renderWithProviders(
        <ProfileSection profile={defaultProfile} userEmail={defaultEmail} />
      );

      const timezoneSelect = screen.getByRole("combobox");
      expect(timezoneSelect).toHaveAttribute("id", "timezone");
    });

    it("profile photo has alt text", () => {
      renderWithProviders(
        <ProfileSection profile={profileWithPhoto} userEmail={defaultEmail} />
      );

      const img = screen.getByRole("img");
      expect(img).toHaveAttribute("alt", "Jane Smith");
    });
  });

  // ============================================================================
  // NEOBRUTALIST STYLING TESTS
  // ============================================================================

  describe("Neobrutalist Styling", () => {
    it("applies neobrutalist border styling to main card", () => {
      const { container } = renderWithProviders(
        <ProfileSection profile={defaultProfile} userEmail={defaultEmail} />
      );

      const card = container.querySelector(".border-2.border-black");
      expect(card).toBeInTheDocument();
    });

    it("applies box shadow styling via inline style", () => {
      const { container } = renderWithProviders(
        <ProfileSection profile={defaultProfile} userEmail={defaultEmail} />
      );

      const cardWithShadow = container.querySelector('[style*="box-shadow"]');
      expect(cardWithShadow).toBeInTheDocument();
    });

    it("applies neobrutalist styling to profile photo container", () => {
      const { container } = renderWithProviders(
        <ProfileSection profile={defaultProfile} userEmail={defaultEmail} />
      );

      const photoContainer = container.querySelector(".w-20.h-20.border-2.border-black");
      expect(photoContainer).toBeInTheDocument();
    });
  });

  // ============================================================================
  // EDGE CASES
  // ============================================================================

  describe("Edge Cases", () => {
    it("handles empty profile gracefully", () => {
      renderWithProviders(
        <ProfileSection profile={emptyProfile} userEmail={defaultEmail} />
      );

      const nameInput = screen.getByPlaceholderText("Enter your full name") as HTMLInputElement;
      expect(nameInput.value).toBe("");
    });

    it("uses browser timezone when profile timezone is undefined", () => {
      renderWithProviders(
        <ProfileSection profile={emptyProfile} userEmail={defaultEmail} />
      );

      const timezoneSelect = screen.getByRole("combobox") as HTMLSelectElement;
      expect(timezoneSelect.value).toBe("America/New_York"); // Default from mock
    });

    it("handles whitespace-only name", async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <ProfileSection profile={defaultProfile} userEmail={defaultEmail} />
      );

      const nameInput = screen.getByPlaceholderText("Enter your full name");
      await user.clear(nameInput);
      await user.type(nameInput, "   ");

      // Should show unsaved changes
      await waitFor(() => {
        expect(screen.getByText("You have unsaved changes")).toBeInTheDocument();
      });
    });

    it("does not save when no changes are made", async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <ProfileSection profile={defaultProfile} userEmail={defaultEmail} />
      );

      // Simulate making no changes but trying to save
      const saveButton = screen.getByRole("button", { name: /Save Changes/i });
      expect(saveButton).toBeDisabled();

      // Even if we force a click (which shouldn't happen with disabled button)
      // the handler should check isDirty and return early
    });
  });
});
