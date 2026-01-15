/**
 * Add Case Page Tests
 *
 * Phase: 22 (Case Forms)
 * Task: 22-04 (Add Case Page)
 * Created: 2025-12-25
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { useRouter } from "next/navigation";
import { useMutation, useConvex } from "convex/react";
import AddCasePage from "../page";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: vi.fn(),
}));

// Mock convex/react
vi.mock("convex/react", () => ({
  useMutation: vi.fn(),
  useConvex: vi.fn(),
}));

// Mock CaseForm component
vi.mock("@/components/forms/CaseForm", () => ({
  CaseForm: vi.fn(({ mode, onSuccess, onCancel }) => (
    <div data-testid="case-form">
      <div>Mode: {mode}</div>
      <button onClick={() => onSuccess("test-case-id")}>Submit</button>
      <button onClick={onCancel}>Cancel</button>
    </div>
  )),
}));

// Mock auth-aware toast wrapper (not sonner directly)
vi.mock("@/lib/toast", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
  // Required by AuthContext
  updateToastAuthState: vi.fn(),
}));

describe("AddCasePage", () => {
  const mockPush = vi.fn();
  const mockCreateMutation = vi.fn();
  const mockConvexQuery = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (useRouter as ReturnType<typeof vi.fn>).mockReturnValue({
      push: mockPush,
    });
    (useMutation as ReturnType<typeof vi.fn>).mockReturnValue(mockCreateMutation);
    (useConvex as ReturnType<typeof vi.fn>).mockReturnValue({
      query: mockConvexQuery,
    });
    // Mock no duplicates by default
    mockConvexQuery.mockResolvedValue({ duplicates: [] });
  });

  it("renders the page with correct title", () => {
    render(<AddCasePage />);

    expect(screen.getByRole("heading", { name: "Add New Case" })).toBeInTheDocument();
  });

  it("renders breadcrumb navigation", () => {
    render(<AddCasePage />);

    expect(screen.getByText("Cases")).toBeInTheDocument();
    // Check for breadcrumb by querying the nav element
    const nav = screen.getByRole("navigation");
    expect(nav).toBeInTheDocument();
  });

  it("renders CaseForm in add mode", () => {
    render(<AddCasePage />);

    const form = screen.getByTestId("case-form");
    expect(form).toBeInTheDocument();
    expect(screen.getByText("Mode: add")).toBeInTheDocument();
  });

  it("navigates back to /cases on cancel", () => {
    render(<AddCasePage />);

    const cancelButton = screen.getByText("Cancel");
    cancelButton.click();

    expect(mockPush).toHaveBeenCalledWith("/cases");
  });

  it("redirects to case detail on successful save", async () => {
    const { toast } = await import("@/lib/toast");
    mockCreateMutation.mockResolvedValue("test-case-id");

    render(<AddCasePage />);

    const submitButton = screen.getByText("Submit");
    submitButton.click();

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith("Case created successfully");
      expect(mockPush).toHaveBeenCalledWith("/cases/test-case-id");
    });
  });
});
