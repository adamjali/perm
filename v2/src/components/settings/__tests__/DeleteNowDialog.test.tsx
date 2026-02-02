import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "../../../../test-utils/render-utils";
import DeleteNowDialog from "../DeleteNowDialog";

// ============================================================================
// MOCKS
// ============================================================================

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

const mockSignOut = vi.fn();
vi.mock("@convex-dev/auth/react", () => ({
  useAuthActions: () => ({
    signOut: mockSignOut,
  }),
}));

const mockImmediateDelete = vi.fn();
vi.mock("convex/react", () => ({
  useAction: () => mockImmediateDelete,
}));

const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();
vi.mock("@/lib/toast", () => ({
  toast: {
    success: (msg: string) => mockToastSuccess(msg),
    error: (msg: string) => mockToastError(msg),
  },
  updateToastAuthState: vi.fn(),
}));

// ============================================================================
// TESTS
// ============================================================================

describe("DeleteNowDialog", () => {
  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockImmediateDelete.mockResolvedValue({ success: true });
  });

  describe("Rendering", () => {
    it("renders dialog title and warning when open", () => {
      renderWithProviders(<DeleteNowDialog {...defaultProps} />);

      expect(screen.getByText("Delete Account Now")).toBeInTheDocument();
      expect(
        screen.getByText(/permanently delete your account and all data RIGHT NOW/)
      ).toBeInTheDocument();
    });

    it("does not render when open is false", () => {
      renderWithProviders(
        <DeleteNowDialog open={false} onOpenChange={vi.fn()} />
      );

      expect(screen.queryByText("Delete Account Now")).not.toBeInTheDocument();
    });

    it("shows checkbox acknowledgment", () => {
      renderWithProviders(<DeleteNowDialog {...defaultProps} />);

      expect(
        screen.getByText("I understand this is immediate and irreversible")
      ).toBeInTheDocument();
    });

    it("shows confirmation input", () => {
      renderWithProviders(<DeleteNowDialog {...defaultProps} />);

      expect(
        screen.getByPlaceholderText(/Type DELETE to confirm/i)
      ).toBeInTheDocument();
    });

    it("lists data that will be deleted", () => {
      renderWithProviders(<DeleteNowDialog {...defaultProps} />);

      expect(
        screen.getByText("All your PERM cases and related data")
      ).toBeInTheDocument();
      expect(
        screen.getByText("Notification preferences and history")
      ).toBeInTheDocument();
      expect(screen.getByText("Calendar sync settings")).toBeInTheDocument();
      expect(screen.getByText("Your user profile")).toBeInTheDocument();
    });
  });

  describe("Validation", () => {
    it("Delete Now button disabled when checkbox unchecked and input empty", () => {
      renderWithProviders(<DeleteNowDialog {...defaultProps} />);

      const deleteButton = screen
        .getAllByRole("button")
        .find((btn) => btn.textContent?.includes("Delete Now"));
      expect(deleteButton).toBeDisabled();
    });

    it("Delete Now button disabled when only checkbox checked", async () => {
      const user = userEvent.setup();
      renderWithProviders(<DeleteNowDialog {...defaultProps} />);

      const checkbox = screen.getByRole("checkbox");
      await user.click(checkbox);

      const deleteButton = screen
        .getAllByRole("button")
        .find((btn) => btn.textContent?.includes("Delete Now"));
      expect(deleteButton).toBeDisabled();
    });

    it("Delete Now button disabled when only input filled", async () => {
      const user = userEvent.setup();
      renderWithProviders(<DeleteNowDialog {...defaultProps} />);

      const input = screen.getByPlaceholderText(/Type DELETE to confirm/i);
      await user.type(input, "DELETE");

      const deleteButton = screen
        .getAllByRole("button")
        .find((btn) => btn.textContent?.includes("Delete Now"));
      expect(deleteButton).toBeDisabled();
    });

    it("Delete Now button enabled when both checkbox and input confirmed", async () => {
      const user = userEvent.setup();
      renderWithProviders(<DeleteNowDialog {...defaultProps} />);

      const checkbox = screen.getByRole("checkbox");
      await user.click(checkbox);

      const input = screen.getByPlaceholderText(/Type DELETE to confirm/i);
      await user.type(input, "DELETE");

      await waitFor(() => {
        const deleteButton = screen
          .getAllByRole("button")
          .find((btn) => btn.textContent?.includes("Delete Now"));
        expect(deleteButton).not.toBeDisabled();
      });
    });
  });

  describe("Interactions", () => {
    it("resets state when dialog closes", async () => {
      const user = userEvent.setup();
      const onOpenChange = vi.fn();
      const { rerender } = renderWithProviders(
        <DeleteNowDialog open={true} onOpenChange={onOpenChange} />
      );

      // Fill in confirmation
      const checkbox = screen.getByRole("checkbox");
      await user.click(checkbox);
      const input = screen.getByPlaceholderText(/Type DELETE to confirm/i);
      await user.type(input, "DELETE");

      // Close dialog
      const cancelButton = screen.getByRole("button", { name: /^Cancel$/i });
      await user.click(cancelButton);

      expect(onOpenChange).toHaveBeenCalledWith(false);

      // Reopen
      rerender(
        <DeleteNowDialog open={true} onOpenChange={onOpenChange} />
      );

      // Input and checkbox should be reset
      const newInput = screen.getByPlaceholderText(/Type DELETE to confirm/i);
      expect(newInput).toHaveValue("");
    });

    it("calls immediateAccountDeletion mutation on confirm", async () => {
      const user = userEvent.setup();
      renderWithProviders(<DeleteNowDialog {...defaultProps} />);

      // Complete both confirmations
      const checkbox = screen.getByRole("checkbox");
      await user.click(checkbox);
      const input = screen.getByPlaceholderText(/Type DELETE to confirm/i);
      await user.type(input, "DELETE");

      // Click Delete Now
      await waitFor(() => {
        const deleteButton = screen
          .getAllByRole("button")
          .find((btn) => btn.textContent?.includes("Delete Now"));
        expect(deleteButton).not.toBeDisabled();
      });

      const deleteButton = screen
        .getAllByRole("button")
        .find((btn) => btn.textContent?.includes("Delete Now"));
      await user.click(deleteButton!);

      await waitFor(() => {
        expect(mockImmediateDelete).toHaveBeenCalledWith({});
      });
    });

    it("shows error toast on mutation failure", async () => {
      mockImmediateDelete.mockRejectedValue(new Error("Server error"));

      const user = userEvent.setup();
      renderWithProviders(<DeleteNowDialog {...defaultProps} />);

      const checkbox = screen.getByRole("checkbox");
      await user.click(checkbox);
      const input = screen.getByPlaceholderText(/Type DELETE to confirm/i);
      await user.type(input, "DELETE");

      await waitFor(() => {
        const deleteButton = screen
          .getAllByRole("button")
          .find((btn) => btn.textContent?.includes("Delete Now"));
        expect(deleteButton).not.toBeDisabled();
      });

      const deleteButton = screen
        .getAllByRole("button")
        .find((btn) => btn.textContent?.includes("Delete Now"));
      await user.click(deleteButton!);

      await waitFor(() => {
        expect(mockToastError).toHaveBeenCalledWith("Server error");
      });
    });
  });
});
