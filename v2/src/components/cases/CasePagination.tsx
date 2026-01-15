/**
 * CasePagination Component
 * Pagination controls for case list with neobrutalist styling.
 *
 * Layout:
 * - Left: "Showing X-Y of Z cases"
 * - Center: "Page X of Y"
 * - Right: Previous | Next buttons + Per page dropdown
 *
 * Features:
 * - Disabled state for first/last page navigation
 * - Page size options: 6, 12 (default), 24, 50
 * - Neobrutalist: black borders, shadow-hard, hover lift
 * - Monospace font for numbers
 */

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// ============================================================================
// TYPES
// ============================================================================

export interface CasePaginationProps {
  currentPage: number;
  totalPages: number;
  totalCount: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const PAGE_SIZE_OPTIONS = [6, 12, 24, 50] as const;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Calculate the range of cases being displayed.
 * Examples:
 * - Page 1, size 12, total 50 -> { start: 1, end: 12 }
 * - Page 3, size 12, total 50 -> { start: 25, end: 36 }
 * - Page 5, size 12, total 50 -> { start: 49, end: 50 }
 * - Page 1, size 12, total 0 -> { start: 0, end: 0 }
 */
function calculateRange(
  currentPage: number,
  pageSize: number,
  totalCount: number
): { start: number; end: number } {
  if (totalCount === 0) {
    return { start: 0, end: 0 };
  }

  const start = (currentPage - 1) * pageSize + 1;
  const end = Math.min(currentPage * pageSize, totalCount);

  return { start, end };
}

// ============================================================================
// COMPONENT
// ============================================================================

export function CasePagination({
  currentPage,
  totalPages,
  totalCount,
  pageSize,
  onPageChange,
  onPageSizeChange,
}: CasePaginationProps) {
  const { start, end } = calculateRange(currentPage, pageSize, totalCount);

  const isFirstPage = currentPage === 1;
  const isLastPage = currentPage === totalPages;

  const handlePrevious = () => {
    if (!isFirstPage) {
      onPageChange(currentPage - 1);
    }
  };

  const handleNext = () => {
    if (!isLastPage) {
      onPageChange(currentPage + 1);
    }
  };

  return (
    <div
      data-testid="case-pagination"
      className="flex items-center justify-between gap-4 py-4"
    >
      {/* Left: Case Count Range */}
      <div className="flex-1">
        <p className="text-sm font-mono text-muted-foreground">
          {totalCount === 0
            ? "Showing 0 of 0 cases"
            : `Showing ${start}-${end} of ${totalCount} cases`}
        </p>
      </div>

      {/* Center: Page Number */}
      <div className="flex-shrink-0">
        <p className="text-sm font-mono font-semibold">
          Page {currentPage} of {totalPages}
        </p>
      </div>

      {/* Right: Navigation Controls */}
      <div className="flex items-center gap-2 flex-1 justify-end">
        {/* Previous Button */}
        <Button
          variant="outline"
          size="sm"
          onClick={handlePrevious}
          disabled={isFirstPage}
          aria-label="Previous page"
          className="gap-1"
        >
          <ChevronLeft className="size-4" />
          Previous
        </Button>

        {/* Next Button */}
        <Button
          variant="outline"
          size="sm"
          onClick={handleNext}
          disabled={isLastPage}
          aria-label="Next page"
          className="gap-1"
        >
          Next
          <ChevronRight className="size-4" />
        </Button>

        {/* Page Size Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              aria-label={`${pageSize} per page`}
              className="gap-1 font-mono"
            >
              {pageSize} per page
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {PAGE_SIZE_OPTIONS.map((size) => (
              <DropdownMenuItem
                key={size}
                onClick={() => onPageSizeChange(size)}
                className="font-mono"
                aria-label={`${size} per page`}
              >
                {size} per page
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
