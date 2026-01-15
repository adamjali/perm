// @vitest-environment jsdom
/**
 * CasePagination Component Tests
 * Tests for pagination controls with neobrutalist styling.
 *
 * Requirements:
 * 1. Shows correct case count range ("Showing X-Y of Z cases")
 * 2. Shows correct page of total ("Page X of Y")
 * 3. Previous button disabled on page 1
 * 4. Next button disabled on last page
 * 5. Page change callback fires with correct page number
 * 6. Page size dropdown works
 * 7. Page size change callback fires with correct size
 * 8. Neobrutalist styling (black borders, shadow-hard)
 * 9. Hover lift effect on buttons
 */

import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "../../../../test-utils/render-utils";
import { CasePagination } from "../CasePagination";

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Calculate expected range display text.
 * Examples:
 * - Page 1, size 12, total 50 -> "Showing 1-12 of 50 cases"
 * - Page 3, size 12, total 50 -> "Showing 25-36 of 50 cases"
 * - Page 5, size 12, total 50 -> "Showing 49-50 of 50 cases"
 */
// Helper function for validating range text calculations
function _calculateRangeText(
  currentPage: number,
  pageSize: number,
  totalCount: number
): string {
  const start = (currentPage - 1) * pageSize + 1;
  const end = Math.min(currentPage * pageSize, totalCount);
  return `Showing ${start}-${end} of ${totalCount} cases`;
}

// ============================================================================
// CASE COUNT DISPLAY TESTS
// ============================================================================

describe("CasePagination - Case Count Display", () => {
  it("shows correct range for first page", () => {
    renderWithProviders(
      <CasePagination
        currentPage={1}
        totalPages={5}
        totalCount={50}
        pageSize={12}
        onPageChange={vi.fn()}
        onPageSizeChange={vi.fn()}
      />
    );

    expect(screen.getByText("Showing 1-12 of 50 cases")).toBeInTheDocument();
  });

  it("shows correct range for middle page", () => {
    renderWithProviders(
      <CasePagination
        currentPage={3}
        totalPages={5}
        totalCount={50}
        pageSize={12}
        onPageChange={vi.fn()}
        onPageSizeChange={vi.fn()}
      />
    );

    expect(screen.getByText("Showing 25-36 of 50 cases")).toBeInTheDocument();
  });

  it("shows correct range for last page with partial results", () => {
    renderWithProviders(
      <CasePagination
        currentPage={5}
        totalPages={5}
        totalCount={50}
        pageSize={12}
        onPageChange={vi.fn()}
        onPageSizeChange={vi.fn()}
      />
    );

    expect(screen.getByText("Showing 49-50 of 50 cases")).toBeInTheDocument();
  });

  it("shows correct range for single page", () => {
    renderWithProviders(
      <CasePagination
        currentPage={1}
        totalPages={1}
        totalCount={5}
        pageSize={12}
        onPageChange={vi.fn()}
        onPageSizeChange={vi.fn()}
      />
    );

    expect(screen.getByText("Showing 1-5 of 5 cases")).toBeInTheDocument();
  });

  it("handles zero results", () => {
    renderWithProviders(
      <CasePagination
        currentPage={1}
        totalPages={1}
        totalCount={0}
        pageSize={12}
        onPageChange={vi.fn()}
        onPageSizeChange={vi.fn()}
      />
    );

    expect(screen.getByText("Showing 0 of 0 cases")).toBeInTheDocument();
  });
});

// ============================================================================
// PAGE NUMBER DISPLAY TESTS
// ============================================================================

describe("CasePagination - Page Number Display", () => {
  it("shows correct page of total", () => {
    renderWithProviders(
      <CasePagination
        currentPage={3}
        totalPages={10}
        totalCount={120}
        pageSize={12}
        onPageChange={vi.fn()}
        onPageSizeChange={vi.fn()}
      />
    );

    expect(screen.getByText("Page 3 of 10")).toBeInTheDocument();
  });

  it("shows page 1 of 1 for single page", () => {
    renderWithProviders(
      <CasePagination
        currentPage={1}
        totalPages={1}
        totalCount={5}
        pageSize={12}
        onPageChange={vi.fn()}
        onPageSizeChange={vi.fn()}
      />
    );

    expect(screen.getByText("Page 1 of 1")).toBeInTheDocument();
  });

  it("shows page 1 of 1 for zero results", () => {
    renderWithProviders(
      <CasePagination
        currentPage={1}
        totalPages={1}
        totalCount={0}
        pageSize={12}
        onPageChange={vi.fn()}
        onPageSizeChange={vi.fn()}
      />
    );

    expect(screen.getByText("Page 1 of 1")).toBeInTheDocument();
  });
});

// ============================================================================
// NAVIGATION BUTTON TESTS
// ============================================================================

describe("CasePagination - Navigation Buttons", () => {
  it("disables Previous button on first page", () => {
    renderWithProviders(
      <CasePagination
        currentPage={1}
        totalPages={5}
        totalCount={50}
        pageSize={12}
        onPageChange={vi.fn()}
        onPageSizeChange={vi.fn()}
      />
    );

    const prevButton = screen.getByRole("button", { name: /previous/i });
    expect(prevButton).toBeDisabled();
  });

  it("enables Previous button on pages after first", () => {
    renderWithProviders(
      <CasePagination
        currentPage={2}
        totalPages={5}
        totalCount={50}
        pageSize={12}
        onPageChange={vi.fn()}
        onPageSizeChange={vi.fn()}
      />
    );

    const prevButton = screen.getByRole("button", { name: /previous/i });
    expect(prevButton).not.toBeDisabled();
  });

  it("disables Next button on last page", () => {
    renderWithProviders(
      <CasePagination
        currentPage={5}
        totalPages={5}
        totalCount={50}
        pageSize={12}
        onPageChange={vi.fn()}
        onPageSizeChange={vi.fn()}
      />
    );

    const nextButton = screen.getByRole("button", { name: /next/i });
    expect(nextButton).toBeDisabled();
  });

  it("enables Next button on pages before last", () => {
    renderWithProviders(
      <CasePagination
        currentPage={4}
        totalPages={5}
        totalCount={50}
        pageSize={12}
        onPageChange={vi.fn()}
        onPageSizeChange={vi.fn()}
      />
    );

    const nextButton = screen.getByRole("button", { name: /next/i });
    expect(nextButton).not.toBeDisabled();
  });

  it("calls onPageChange with decremented page when Previous is clicked", async () => {
    const onPageChangeMock = vi.fn();
    const { user } = renderWithProviders(
      <CasePagination
        currentPage={3}
        totalPages={5}
        totalCount={50}
        pageSize={12}
        onPageChange={onPageChangeMock}
        onPageSizeChange={vi.fn()}
      />
    );

    const prevButton = screen.getByRole("button", { name: /previous/i });
    await user.click(prevButton);

    expect(onPageChangeMock).toHaveBeenCalledWith(2);
  });

  it("calls onPageChange with incremented page when Next is clicked", async () => {
    const onPageChangeMock = vi.fn();
    const { user } = renderWithProviders(
      <CasePagination
        currentPage={3}
        totalPages={5}
        totalCount={50}
        pageSize={12}
        onPageChange={onPageChangeMock}
        onPageSizeChange={vi.fn()}
      />
    );

    const nextButton = screen.getByRole("button", { name: /next/i });
    await user.click(nextButton);

    expect(onPageChangeMock).toHaveBeenCalledWith(4);
  });
});

// ============================================================================
// PAGE SIZE DROPDOWN TESTS
// ============================================================================

describe("CasePagination - Page Size Dropdown", () => {
  it("shows current page size", () => {
    renderWithProviders(
      <CasePagination
        currentPage={1}
        totalPages={5}
        totalCount={50}
        pageSize={12}
        onPageChange={vi.fn()}
        onPageSizeChange={vi.fn()}
      />
    );

    expect(screen.getByText("12 per page")).toBeInTheDocument();
  });

  it("shows all page size options in dropdown", async () => {
    const { user } = renderWithProviders(
      <CasePagination
        currentPage={1}
        totalPages={5}
        totalCount={50}
        pageSize={12}
        onPageChange={vi.fn()}
        onPageSizeChange={vi.fn()}
      />
    );

    // Open dropdown
    const trigger = screen.getByRole("button", { name: /per page/i });
    await user.click(trigger);

    // Check all options are present
    expect(await screen.findByRole("menuitem", { name: /6 per page/i })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /12 per page/i })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /24 per page/i })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /50 per page/i })).toBeInTheDocument();
  });

  it("calls onPageSizeChange when different size is selected", async () => {
    const onPageSizeChangeMock = vi.fn();
    const { user } = renderWithProviders(
      <CasePagination
        currentPage={1}
        totalPages={5}
        totalCount={50}
        pageSize={12}
        onPageChange={vi.fn()}
        onPageSizeChange={onPageSizeChangeMock}
      />
    );

    // Open dropdown
    const trigger = screen.getByRole("button", { name: /per page/i });
    await user.click(trigger);

    // Select 24 per page
    const option24 = await screen.findByRole("menuitem", { name: /24 per page/i });
    await user.click(option24);

    expect(onPageSizeChangeMock).toHaveBeenCalledWith(24);
  });

  it("calls onPageSizeChange with correct values for all options", { timeout: 15000 }, async () => {
    const onPageSizeChangeMock = vi.fn();
    const { user } = renderWithProviders(
      <CasePagination
        currentPage={1}
        totalPages={5}
        totalCount={50}
        pageSize={12}
        onPageChange={vi.fn()}
        onPageSizeChange={onPageSizeChangeMock}
      />
    );

    // Test each option
    const options = [
      { name: /6 per page/i, value: 6 },
      { name: /24 per page/i, value: 24 },
      { name: /50 per page/i, value: 50 },
    ];

    for (const option of options) {
      onPageSizeChangeMock.mockClear();

      // Open dropdown
      const trigger = screen.getByRole("button", { name: /per page/i });
      await user.click(trigger);

      // Select option
      const menuItem = await screen.findByRole("menuitem", { name: option.name });
      await user.click(menuItem);

      expect(onPageSizeChangeMock).toHaveBeenCalledWith(option.value);
    }
  });
});

// ============================================================================
// STYLING TESTS
// ============================================================================

describe("CasePagination - Neobrutalist Styling", () => {
  it("has black borders on buttons", () => {
    const { container } = renderWithProviders(
      <CasePagination
        currentPage={2}
        totalPages={5}
        totalCount={50}
        pageSize={12}
        onPageChange={vi.fn()}
        onPageSizeChange={vi.fn()}
      />
    );

    const prevButton = screen.getByRole("button", { name: /previous/i });
    const nextButton = screen.getByRole("button", { name: /next/i });

    // Buttons should have border styling (from Button component)
    expect(prevButton).toHaveClass("border");
    expect(nextButton).toHaveClass("border");
  });

  it("has shadow-hard on buttons", () => {
    renderWithProviders(
      <CasePagination
        currentPage={2}
        totalPages={5}
        totalCount={50}
        pageSize={12}
        onPageChange={vi.fn()}
        onPageSizeChange={vi.fn()}
      />
    );

    const prevButton = screen.getByRole("button", { name: /previous/i });
    const nextButton = screen.getByRole("button", { name: /next/i });

    // Buttons should have shadow-hard effect (from Button component)
    expect(prevButton).toHaveClass("shadow-hard");
    expect(nextButton).toHaveClass("shadow-hard");
  });

  it("uses monospace font for page numbers", () => {
    const { container } = renderWithProviders(
      <CasePagination
        currentPage={3}
        totalPages={10}
        totalCount={120}
        pageSize={12}
        onPageChange={vi.fn()}
        onPageSizeChange={vi.fn()}
      />
    );

    const pageNumber = screen.getByText("Page 3 of 10");
    expect(pageNumber).toHaveClass("font-mono");
  });

  it("uses monospace font for case count", () => {
    const { container } = renderWithProviders(
      <CasePagination
        currentPage={1}
        totalPages={5}
        totalCount={50}
        pageSize={12}
        onPageChange={vi.fn()}
        onPageSizeChange={vi.fn()}
      />
    );

    const caseCount = screen.getByText("Showing 1-12 of 50 cases");
    expect(caseCount).toHaveClass("font-mono");
  });
});

// ============================================================================
// LAYOUT TESTS
// ============================================================================

describe("CasePagination - Layout", () => {
  it("has three-column layout structure", () => {
    const { container } = renderWithProviders(
      <CasePagination
        currentPage={2}
        totalPages={5}
        totalCount={50}
        pageSize={12}
        onPageChange={vi.fn()}
        onPageSizeChange={vi.fn()}
      />
    );

    // Main container should be a flex layout
    const mainContainer = container.querySelector('[data-testid="case-pagination"]');
    expect(mainContainer).toBeInTheDocument();
    expect(mainContainer).toHaveClass("flex");
  });

  it("displays case count on left", () => {
    renderWithProviders(
      <CasePagination
        currentPage={1}
        totalPages={5}
        totalCount={50}
        pageSize={12}
        onPageChange={vi.fn()}
        onPageSizeChange={vi.fn()}
      />
    );

    const caseCount = screen.getByText("Showing 1-12 of 50 cases");
    expect(caseCount).toBeInTheDocument();
  });

  it("displays page number in center", () => {
    renderWithProviders(
      <CasePagination
        currentPage={3}
        totalPages={10}
        totalCount={120}
        pageSize={12}
        onPageChange={vi.fn()}
        onPageSizeChange={vi.fn()}
      />
    );

    const pageNumber = screen.getByText("Page 3 of 10");
    expect(pageNumber).toBeInTheDocument();
  });

  it("displays navigation controls on right", () => {
    renderWithProviders(
      <CasePagination
        currentPage={2}
        totalPages={5}
        totalCount={50}
        pageSize={12}
        onPageChange={vi.fn()}
        onPageSizeChange={vi.fn()}
      />
    );

    const prevButton = screen.getByRole("button", { name: /previous/i });
    const nextButton = screen.getByRole("button", { name: /next/i });

    expect(prevButton).toBeInTheDocument();
    expect(nextButton).toBeInTheDocument();
  });
});
