/**
 * CasePagination Component
 * Pagination controls for the case list.
 *
 * Layout (md and up, one row):
 * - Left: "Showing X-Y of Z cases"
 * - Center: "Page X of Y"
 * - Right: Previous | Next buttons + the page size as one row of choices
 * Below md it's two rows: the count and page number, then Previous and Next
 * side by side over the page size. As one row it was about 560px wide and
 * pushed a phone's whole page sideways (Safari, iPhone, Oct 17 2026).
 *
 * Features:
 * - Disabled state for first/last page navigation
 * - Page size options: 6, 12 (default), 24, 50
 * - Monospace font for numbers
 */

import { CaretLeftIcon, CaretRightIcon } from "@phosphor-icons/react/ssr";
import { Button } from "@/components/ui/button";
import { ChoiceRow } from "@/components/ui/choice-row";

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
      className="flex flex-col gap-3 py-4 md:flex-row md:items-center md:justify-between md:gap-4"
    >
      {/* The count and the page number: one line on a phone, the row's ends on md+ */}
      <div className="flex min-w-0 items-center justify-between gap-3 md:contents">
        {/* Left: Case Count Range */}
        <div className="min-w-0 md:flex-1">
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
      </div>

      {/* Right: Navigation Controls */}
      <div className="grid grid-cols-2 gap-2 md:flex md:flex-1 md:items-center md:justify-end">
        {/* Previous Button */}
        <Button
          variant="outline"
          size="sm"
          onClick={handlePrevious}
          disabled={isFirstPage}
          aria-label="Previous page"
          className="w-full gap-1 md:w-auto"
        >
          <CaretLeftIcon className="size-4" />
          Previous
        </Button>

        {/* Next Button */}
        <Button
          variant="outline"
          size="sm"
          onClick={handleNext}
          disabled={isLastPage}
          aria-label="Next page"
          className="w-full gap-1 md:w-auto"
        >
          Next
          <CaretRightIcon className="size-4" />
        </Button>

        {/* Page size: four choices in one tap, the one in use lime and pressed (a menu hid both). */}
        <ChoiceRow
          className="col-span-2 flex items-center gap-2 md:ml-2"
          label="Per page"
          labelClassName="whitespace-nowrap text-sm font-mono text-muted-foreground"
          rowClassName="mt-0 flex-nowrap gap-1"
          options={PAGE_SIZE_OPTIONS.map((size) => ({ value: String(size), label: String(size), ariaLabel: `${size} per page` }))}
          value={String(pageSize)}
          onChange={(v) => onPageSizeChange(Number(v))}
        />
      </div>
    </div>
  );
}
