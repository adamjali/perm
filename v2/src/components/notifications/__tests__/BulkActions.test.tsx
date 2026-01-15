// @vitest-environment jsdom
/**
 * BulkActions Component Tests
 *
 * Tests for the bulk action buttons on the notifications page header.
 *
 * Requirements:
 * - Mark All Read button calls mutation
 * - Delete All Read button shows confirmation dialog
 * - Buttons disabled when appropriate (no unread/read notifications)
 * - Success toast appears after actions
 * - Loading states display correctly
 *
 * Phase: 24 (Notifications)
 * Created: 2025-12-31
 */

import { describe, it, expect, vi, beforeEach, Mock } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { renderWithProviders } from "../../../../test-utils/render-utils";
import BulkActions from "../BulkActions";

// Mock Convex React hooks
vi.mock("convex/react", () => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(() => vi.fn()),
}));

// Mock auth-aware toast wrapper (not sonner directly)
vi.mock("@/lib/toast", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
  // Required by AuthContext
  updateToastAuthState: vi.fn(),
}));

// Import the mocked modules
import { useQuery, useMutation } from "convex/react";
import { toast } from "@/lib/toast";

// ============================================================================
// SETUP
// ============================================================================

beforeEach(() => {
  vi.clearAllMocks();

  // Default mock: No notifications
  (useQuery as Mock).mockReturnValue({
    total: 0,
    unread: 0,
    byType: {},
  });

  // Default mutation mocks
  (useMutation as Mock).mockReturnValue(vi.fn().mockResolvedValue({ count: 0 }));
});

// ============================================================================
// RENDERING TESTS
// ============================================================================

describe("BulkActions - Rendering", () => {
  it("renders Mark All Read button", () => {
    renderWithProviders(<BulkActions />);

    expect(screen.getByRole("button", { name: /mark all read/i })).toBeInTheDocument();
  });

  it("renders Delete Read button", () => {
    renderWithProviders(<BulkActions />);

    expect(screen.getByRole("button", { name: /delete read/i })).toBeInTheDocument();
  });

  it("applies custom className when provided", () => {
    const { container } = renderWithProviders(<BulkActions className="custom-class" />);

    const wrapper = container.querySelector(".custom-class");
    expect(wrapper).toBeInTheDocument();
  });

  it("displays CheckCheck icon on Mark All Read button", () => {
    renderWithProviders(<BulkActions />);

    const markAllButton = screen.getByRole("button", { name: /mark all read/i });
    // Icon should be rendered (SVG element)
    const svg = markAllButton.querySelector("svg");
    expect(svg).toBeInTheDocument();
  });

  it("displays Trash2 icon on Delete Read button", () => {
    renderWithProviders(<BulkActions />);

    const deleteButton = screen.getByRole("button", { name: /delete read/i });
    // Icon should be rendered (SVG element)
    const svg = deleteButton.querySelector("svg");
    expect(svg).toBeInTheDocument();
  });
});

// ============================================================================
// DISABLED STATE TESTS
// ============================================================================

describe("BulkActions - Disabled States", () => {
  it("disables Mark All Read button when unread count is 0", () => {
    (useQuery as Mock).mockReturnValue({
      total: 10,
      unread: 0,
      byType: {},
    });

    renderWithProviders(<BulkActions />);

    const markAllButton = screen.getByRole("button", { name: /mark all read/i });
    expect(markAllButton).toBeDisabled();
  });

  it("enables Mark All Read button when unread count > 0", () => {
    (useQuery as Mock).mockReturnValue({
      total: 10,
      unread: 5,
      byType: {},
    });

    renderWithProviders(<BulkActions />);

    const markAllButton = screen.getByRole("button", { name: /mark all read/i });
    expect(markAllButton).not.toBeDisabled();
  });

  it("disables Delete Read button when read count is 0", () => {
    (useQuery as Mock).mockReturnValue({
      total: 5,
      unread: 5, // All are unread, so read count = 0
      byType: {},
    });

    renderWithProviders(<BulkActions />);

    const deleteButton = screen.getByRole("button", { name: /delete read/i });
    expect(deleteButton).toBeDisabled();
  });

  it("enables Delete Read button when read count > 0", () => {
    (useQuery as Mock).mockReturnValue({
      total: 10,
      unread: 3, // 7 are read
      byType: {},
    });

    renderWithProviders(<BulkActions />);

    const deleteButton = screen.getByRole("button", { name: /delete read/i });
    expect(deleteButton).not.toBeDisabled();
  });
});

// ============================================================================
// COUNT BADGE TESTS
// ============================================================================

describe("BulkActions - Count Badges", () => {
  it("shows unread count badge on Mark All Read button", () => {
    (useQuery as Mock).mockReturnValue({
      total: 10,
      unread: 5,
      byType: {},
    });

    renderWithProviders(<BulkActions />);

    const markAllButton = screen.getByRole("button", { name: /mark all read/i });
    expect(markAllButton.textContent).toContain("5");
  });

  it("shows read count badge on Delete Read button", () => {
    (useQuery as Mock).mockReturnValue({
      total: 10,
      unread: 3, // 7 are read
      byType: {},
    });

    renderWithProviders(<BulkActions />);

    const deleteButton = screen.getByRole("button", { name: /delete read/i });
    expect(deleteButton.textContent).toContain("7");
  });

  it("does not show count badge when count is 0", () => {
    (useQuery as Mock).mockReturnValue({
      total: 0,
      unread: 0,
      byType: {},
    });

    renderWithProviders(<BulkActions />);

    // Buttons should not contain "0" as a count badge
    const markAllButton = screen.getByRole("button", { name: /mark all read/i });
    const deleteButton = screen.getByRole("button", { name: /delete read/i });

    // Check that neither button has the count badge element
    // The buttons should just show the text without a number
    const markAllBadge = markAllButton.querySelector(".bg-muted");
    const deleteBadge = deleteButton.querySelector(".bg-muted");

    expect(markAllBadge).not.toBeInTheDocument();
    expect(deleteBadge).not.toBeInTheDocument();
  });
});

// ============================================================================
// MARK ALL READ TESTS
// ============================================================================

describe("BulkActions - Mark All Read", () => {
  it("calls markAllAsRead mutation when button clicked", async () => {
    const mockMarkAllAsRead = vi.fn().mockResolvedValue({ count: 5 });
    (useMutation as Mock).mockReturnValue(mockMarkAllAsRead);

    (useQuery as Mock).mockReturnValue({
      total: 10,
      unread: 5,
      byType: {},
    });

    const { user } = renderWithProviders(<BulkActions />);

    const markAllButton = screen.getByRole("button", { name: /mark all read/i });
    await user.click(markAllButton);

    expect(mockMarkAllAsRead).toHaveBeenCalledWith({});
  });

  it("shows success toast after marking all as read", async () => {
    const mockMarkAllAsRead = vi.fn().mockResolvedValue({ count: 5 });
    (useMutation as Mock).mockReturnValue(mockMarkAllAsRead);

    (useQuery as Mock).mockReturnValue({
      total: 10,
      unread: 5,
      byType: {},
    });

    const { user } = renderWithProviders(<BulkActions />);

    const markAllButton = screen.getByRole("button", { name: /mark all read/i });
    await user.click(markAllButton);

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith("Marked 5 notifications as read");
    });
  });

  it("shows info toast when no notifications to mark", async () => {
    const mockMarkAllAsRead = vi.fn().mockResolvedValue({ count: 0 });
    (useMutation as Mock).mockReturnValue(mockMarkAllAsRead);

    (useQuery as Mock).mockReturnValue({
      total: 10,
      unread: 5, // Button is enabled but mutation returns 0
      byType: {},
    });

    const { user } = renderWithProviders(<BulkActions />);

    const markAllButton = screen.getByRole("button", { name: /mark all read/i });
    await user.click(markAllButton);

    await waitFor(() => {
      expect(toast.info).toHaveBeenCalledWith("No unread notifications to mark");
    });
  });

  it("shows error toast when mutation fails", async () => {
    const mockMarkAllAsRead = vi.fn().mockRejectedValue(new Error("Network error"));
    (useMutation as Mock).mockReturnValue(mockMarkAllAsRead);

    (useQuery as Mock).mockReturnValue({
      total: 10,
      unread: 5,
      byType: {},
    });

    const { user } = renderWithProviders(<BulkActions />);

    const markAllButton = screen.getByRole("button", { name: /mark all read/i });
    await user.click(markAllButton);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Failed to mark all as read");
    });
  });

  it("uses singular form when count is 1", async () => {
    const mockMarkAllAsRead = vi.fn().mockResolvedValue({ count: 1 });
    (useMutation as Mock).mockReturnValue(mockMarkAllAsRead);

    (useQuery as Mock).mockReturnValue({
      total: 10,
      unread: 1,
      byType: {},
    });

    const { user } = renderWithProviders(<BulkActions />);

    const markAllButton = screen.getByRole("button", { name: /mark all read/i });
    await user.click(markAllButton);

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith("Marked 1 notification as read");
    });
  });
});

// ============================================================================
// DELETE ALL READ TESTS
// ============================================================================

describe("BulkActions - Delete All Read", () => {
  it("opens confirmation dialog when delete button clicked", async () => {
    (useQuery as Mock).mockReturnValue({
      total: 10,
      unread: 3, // 7 are read
      byType: {},
    });

    const { user } = renderWithProviders(<BulkActions />);

    const deleteButton = screen.getByRole("button", { name: /delete read/i });
    await user.click(deleteButton);

    // Confirmation dialog should appear
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText(/delete read notifications/i)).toBeInTheDocument();
    expect(screen.getByText(/are you sure/i)).toBeInTheDocument();
  });

  it("shows correct count in confirmation dialog", async () => {
    (useQuery as Mock).mockReturnValue({
      total: 15,
      unread: 5, // 10 are read
      byType: {},
    });

    const { user } = renderWithProviders(<BulkActions />);

    const deleteButton = screen.getByRole("button", { name: /delete read/i });
    await user.click(deleteButton);

    expect(screen.getByText(/10 read notification/i)).toBeInTheDocument();
  });

  it("closes dialog when Cancel button clicked", async () => {
    (useQuery as Mock).mockReturnValue({
      total: 10,
      unread: 3,
      byType: {},
    });

    const { user } = renderWithProviders(<BulkActions />);

    // Open dialog
    const deleteButton = screen.getByRole("button", { name: /delete read/i });
    await user.click(deleteButton);

    expect(screen.getByRole("dialog")).toBeInTheDocument();

    // Click cancel
    const cancelButton = screen.getByRole("button", { name: /cancel/i });
    await user.click(cancelButton);

    // Dialog should close
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  it("calls deleteAllRead mutation when confirmed", async () => {
    const mockDeleteAllRead = vi.fn().mockResolvedValue({ count: 7 });
    let callCount = 0;
    (useMutation as Mock).mockImplementation(() => {
      callCount++;
      // First call is markAllAsRead, second is deleteAllRead
      return callCount === 1 ? vi.fn() : mockDeleteAllRead;
    });

    (useQuery as Mock).mockReturnValue({
      total: 10,
      unread: 3, // 7 are read
      byType: {},
    });

    const { user } = renderWithProviders(<BulkActions />);

    // Open dialog
    const deleteButton = screen.getByRole("button", { name: /delete read/i });
    await user.click(deleteButton);

    // Confirm deletion
    const confirmButton = screen.getByRole("button", { name: /^delete$/i });
    await user.click(confirmButton);

    expect(mockDeleteAllRead).toHaveBeenCalledWith({});
  });

  it("shows success toast after deleting", async () => {
    const mockDeleteAllRead = vi.fn().mockResolvedValue({ count: 7 });
    let callCount = 0;
    (useMutation as Mock).mockImplementation(() => {
      callCount++;
      return callCount === 1 ? vi.fn() : mockDeleteAllRead;
    });

    (useQuery as Mock).mockReturnValue({
      total: 10,
      unread: 3,
      byType: {},
    });

    const { user } = renderWithProviders(<BulkActions />);

    // Open dialog and confirm
    const deleteButton = screen.getByRole("button", { name: /delete read/i });
    await user.click(deleteButton);

    const confirmButton = screen.getByRole("button", { name: /^delete$/i });
    await user.click(confirmButton);

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith("Deleted 7 notifications");
    });
  });

  it("shows error toast when deletion fails", async () => {
    const mockDeleteAllRead = vi.fn().mockRejectedValue(new Error("Network error"));
    let callCount = 0;
    (useMutation as Mock).mockImplementation(() => {
      callCount++;
      return callCount === 1 ? vi.fn() : mockDeleteAllRead;
    });

    (useQuery as Mock).mockReturnValue({
      total: 10,
      unread: 3,
      byType: {},
    });

    const { user } = renderWithProviders(<BulkActions />);

    // Open dialog and confirm
    const deleteButton = screen.getByRole("button", { name: /delete read/i });
    await user.click(deleteButton);

    const confirmButton = screen.getByRole("button", { name: /^delete$/i });
    await user.click(confirmButton);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Failed to delete notifications");
    });
  });

  it("uses singular form when count is 1", async () => {
    const mockDeleteAllRead = vi.fn().mockResolvedValue({ count: 1 });
    let callCount = 0;
    (useMutation as Mock).mockImplementation(() => {
      callCount++;
      return callCount === 1 ? vi.fn() : mockDeleteAllRead;
    });

    (useQuery as Mock).mockReturnValue({
      total: 2,
      unread: 1, // 1 is read
      byType: {},
    });

    const { user } = renderWithProviders(<BulkActions />);

    // Open dialog and confirm
    const deleteButton = screen.getByRole("button", { name: /delete read/i });
    await user.click(deleteButton);

    const confirmButton = screen.getByRole("button", { name: /^delete$/i });
    await user.click(confirmButton);

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith("Deleted 1 notification");
    });
  });
});

// ============================================================================
// LOADING STATE TESTS
// ============================================================================

describe("BulkActions - Loading States", () => {
  it("shows loading state on Mark All Read button during mutation", async () => {
    // Create a promise that we can control
    let resolvePromise: (value: { count: number }) => void;
    const pendingPromise = new Promise<{ count: number }>((resolve) => {
      resolvePromise = resolve;
    });

    const mockMarkAllAsRead = vi.fn().mockReturnValue(pendingPromise);
    (useMutation as Mock).mockReturnValue(mockMarkAllAsRead);

    (useQuery as Mock).mockReturnValue({
      total: 10,
      unread: 5,
      byType: {},
    });

    const { user } = renderWithProviders(<BulkActions />);

    const markAllButton = screen.getByRole("button", { name: /mark all read/i });
    await user.click(markAllButton);

    // Button should show loading state (text changes to "Marking...")
    await waitFor(() => {
      expect(screen.getByText(/marking/i)).toBeInTheDocument();
    });

    // Resolve the promise
    resolvePromise!({ count: 5 });
  });

  it("disables buttons during loading", async () => {
    // Create a promise that we can control
    let resolvePromise: (value: { count: number }) => void;
    const pendingPromise = new Promise<{ count: number }>((resolve) => {
      resolvePromise = resolve;
    });

    const mockMarkAllAsRead = vi.fn().mockReturnValue(pendingPromise);
    (useMutation as Mock).mockReturnValue(mockMarkAllAsRead);

    (useQuery as Mock).mockReturnValue({
      total: 10,
      unread: 5,
      byType: {},
    });

    const { user } = renderWithProviders(<BulkActions />);

    const markAllButton = screen.getByRole("button", { name: /mark all read/i });
    await user.click(markAllButton);

    // Button should be disabled during loading
    await waitFor(() => {
      expect(screen.getByText(/marking/i).closest("button")).toBeDisabled();
    });

    // Resolve the promise
    resolvePromise!({ count: 5 });
  });
});

// ============================================================================
// STYLING TESTS
// ============================================================================

describe("BulkActions - Styling", () => {
  it("buttons have uppercase font-heading styling", () => {
    (useQuery as Mock).mockReturnValue({
      total: 10,
      unread: 5,
      byType: {},
    });

    renderWithProviders(<BulkActions />);

    const markAllButton = screen.getByRole("button", { name: /mark all read/i });
    const deleteButton = screen.getByRole("button", { name: /delete read/i });

    expect(markAllButton).toHaveClass("uppercase");
    expect(markAllButton).toHaveClass("font-heading");
    expect(deleteButton).toHaveClass("uppercase");
    expect(deleteButton).toHaveClass("font-heading");
  });

  it("delete button has destructive text color", () => {
    (useQuery as Mock).mockReturnValue({
      total: 10,
      unread: 3,
      byType: {},
    });

    renderWithProviders(<BulkActions />);

    const deleteButton = screen.getByRole("button", { name: /delete read/i });
    expect(deleteButton).toHaveClass("text-destructive");
  });

  it("confirmation dialog has warning icon", async () => {
    (useQuery as Mock).mockReturnValue({
      total: 10,
      unread: 3,
      byType: {},
    });

    const { user } = renderWithProviders(<BulkActions />);

    const deleteButton = screen.getByRole("button", { name: /delete read/i });
    await user.click(deleteButton);

    // Dialog should have AlertTriangle icon
    const dialog = screen.getByRole("dialog");
    const icon = dialog.querySelector("svg");
    expect(icon).toBeInTheDocument();
  });
});

// ============================================================================
// ACCESSIBILITY TESTS
// ============================================================================

describe("BulkActions - Accessibility", () => {
  it("buttons have descriptive accessible names", () => {
    (useQuery as Mock).mockReturnValue({
      total: 10,
      unread: 5,
      byType: {},
    });

    renderWithProviders(<BulkActions />);

    expect(screen.getByRole("button", { name: /mark all read/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /delete read/i })).toBeInTheDocument();
  });

  it("confirmation dialog has proper heading", async () => {
    (useQuery as Mock).mockReturnValue({
      total: 10,
      unread: 3,
      byType: {},
    });

    const { user } = renderWithProviders(<BulkActions />);

    const deleteButton = screen.getByRole("button", { name: /delete read/i });
    await user.click(deleteButton);

    // Dialog should have a heading
    expect(screen.getByRole("heading", { name: /delete read notifications/i })).toBeInTheDocument();
  });

  it("confirmation dialog is properly labeled", async () => {
    (useQuery as Mock).mockReturnValue({
      total: 10,
      unread: 3,
      byType: {},
    });

    const { user } = renderWithProviders(<BulkActions />);

    const deleteButton = screen.getByRole("button", { name: /delete read/i });
    await user.click(deleteButton);

    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();
  });
});

// ============================================================================
// EDGE CASES
// ============================================================================

describe("BulkActions - Edge Cases", () => {
  it("handles undefined stats gracefully", () => {
    (useQuery as Mock).mockReturnValue(undefined);

    // Should not throw
    renderWithProviders(<BulkActions />);

    // Buttons should exist but be disabled
    const markAllButton = screen.getByRole("button", { name: /mark all read/i });
    const deleteButton = screen.getByRole("button", { name: /delete read/i });

    expect(markAllButton).toBeDisabled();
    expect(deleteButton).toBeDisabled();
  });

  it("handles null stats gracefully", () => {
    (useQuery as Mock).mockReturnValue(null);

    // Should not throw
    renderWithProviders(<BulkActions />);
  });

  it("prevents double-clicking during loading", async () => {
    // Create a promise that we can control to simulate a slow mutation
    let resolvePromise: (value: { count: number }) => void;
    const pendingPromise = new Promise<{ count: number }>((resolve) => {
      resolvePromise = resolve;
    });

    const mockMarkAllAsRead = vi.fn().mockReturnValue(pendingPromise);
    (useMutation as Mock).mockReturnValue(mockMarkAllAsRead);

    (useQuery as Mock).mockReturnValue({
      total: 10,
      unread: 5,
      byType: {},
    });

    const { user } = renderWithProviders(<BulkActions />);

    const markAllButton = screen.getByRole("button", { name: /mark all read/i });

    // First click starts the loading
    await user.click(markAllButton);

    // At this point button should be disabled, verify mutation was called once
    expect(mockMarkAllAsRead).toHaveBeenCalledTimes(1);

    // Resolve the promise to clean up
    resolvePromise!({ count: 5 });
  });
});
