// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "../../../../test-utils/render-utils";
import { CasePagination } from "../CasePagination";

const defaultProps = {
  currentPage: 1,
  totalPages: 5,
  totalCount: 50,
  pageSize: 12,
  onPageChange: vi.fn(),
  onPageSizeChange: vi.fn(),
};

describe("CasePagination - Case Count Display", () => {
  it.each([
    [1, 5, 50, 12, "Showing 1-12 of 50 cases"],
    [3, 5, 50, 12, "Showing 25-36 of 50 cases"],
    [5, 5, 50, 12, "Showing 49-50 of 50 cases"],
    [1, 1, 5, 12, "Showing 1-5 of 5 cases"],
    [1, 1, 0, 12, "Showing 0 of 0 cases"],
  ])("page %i of %i (total=%i, size=%i) shows '%s'", (page, totalPages, totalCount, pageSize, expected) => {
    renderWithProviders(
      <CasePagination {...defaultProps} currentPage={page} totalPages={totalPages} totalCount={totalCount} pageSize={pageSize} />
    );
    expect(screen.getByText(expected)).toBeInTheDocument();
  });
});

describe("CasePagination - Page Number Display", () => {
  it.each([
    [3, 10, "Page 3 of 10"],
    [1, 1, "Page 1 of 1"],
  ])("shows '%s' for page %i of %i", (page, totalPages, expected) => {
    renderWithProviders(<CasePagination {...defaultProps} currentPage={page} totalPages={totalPages} totalCount={120} />);
    expect(screen.getByText(expected)).toBeInTheDocument();
  });
});

describe("CasePagination - Navigation Buttons", () => {
  it.each([
    ["Previous", 1, true],
    ["Previous", 2, false],
    ["Next", 5, true],
    ["Next", 4, false],
  ] as const)("%s button disabled=%s on page %i", (button, page, shouldBeDisabled) => {
    renderWithProviders(<CasePagination {...defaultProps} currentPage={page} />);
    const btn = screen.getByRole("button", { name: new RegExp(button, "i") });
    shouldBeDisabled ? expect(btn).toBeDisabled() : expect(btn).not.toBeDisabled();
  });

  it("calls onPageChange with correct page on Previous/Next click", async () => {
    const onPageChange = vi.fn();
    const { user } = renderWithProviders(<CasePagination {...defaultProps} currentPage={3} onPageChange={onPageChange} />);

    await user.click(screen.getByRole("button", { name: /previous/i }));
    expect(onPageChange).toHaveBeenCalledWith(2);

    onPageChange.mockClear();
    await user.click(screen.getByRole("button", { name: /next/i }));
    expect(onPageChange).toHaveBeenCalledWith(4);
  });
});

describe("CasePagination - page size", () => {
  it("shows every size as one tap, the one in use pressed", () => {
    renderWithProviders(<CasePagination {...defaultProps} />);
    expect(screen.getByRole("group", { name: "Per page" })).toBeInTheDocument();
    for (const size of [6, 12, 24, 50]) {
      expect(screen.getByRole("button", { name: `${size} per page` })).toHaveAttribute(
        "aria-pressed",
        size === defaultProps.pageSize ? "true" : "false",
      );
    }
  });

  it("calls onPageSizeChange when different size selected", async () => {
    const onPageSizeChange = vi.fn();
    const { user } = renderWithProviders(<CasePagination {...defaultProps} onPageSizeChange={onPageSizeChange} />);

    await user.click(screen.getByRole("button", { name: "24 per page" }));
    expect(onPageSizeChange).toHaveBeenCalledWith(24);
  });
});
