/**
 * One case per row, a case number first: the newest-filings lists on employer
 * pages (published, unpublished and seasonal) and the wage-request and LCA
 * columns. On a phone the number is the row's tap target, so it's 44px tall
 * and the row drops its own padding to keep the list's pitch; from `sm` the
 * row is as it was. Measured Oct 15 2026: the links were 20px tall at 390 wide.
 */
export const CASE_ROW = "flex flex-wrap items-baseline gap-x-3 gap-y-0.5 py-0 text-base sm:py-2";
export const CASE_ROW_LINK = "link inline-flex min-h-11 items-center font-mono text-sm sm:min-h-0";
