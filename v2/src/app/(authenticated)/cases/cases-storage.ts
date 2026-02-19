/**
 * Cases page localStorage helpers and URL parsing utilities.
 * Extracted from CasesPageClient.tsx for cleaner separation.
 */

import type { ViewMode } from "@/components/cases/ViewToggle";
import type {
  CaseListFilters,
  CaseListSort,
  CaseListSortField,
  SortOrder,
} from "../../../../convex/lib/caseListTypes";
import type { CaseStatus, ProgressStatus } from "../../../../convex/lib/dashboardTypes";

// ============================================================================
// CONSTANTS
// ============================================================================

export const DEFAULT_PAGE_SIZE = 12;
const PAGE_SIZE_STORAGE_KEY = "perm-tracker-page-size";
const VIEW_MODE_STORAGE_KEY = "perm-tracker-view-mode";
const SORT_STORAGE_KEY = "perm-tracker-sort";
const FILTERS_STORAGE_KEY = "perm-tracker-filters";
export const DEFAULT_SORT: CaseListSort = {
  sortBy: "deadline",
  sortOrder: "asc",
};

// ============================================================================
// LOCAL STORAGE HELPERS
// ============================================================================

export function getStoredPageSize(): number {
  if (typeof window === "undefined") return DEFAULT_PAGE_SIZE;
  try {
    const stored = localStorage.getItem(PAGE_SIZE_STORAGE_KEY);
    if (stored) {
      const parsed = parseInt(stored, 10);
      if (!isNaN(parsed) && parsed > 0 && parsed <= 100) {
        return parsed;
      }
    }
  } catch {
    // localStorage unavailable (private browsing, SSR) — expected, use default
  }
  return DEFAULT_PAGE_SIZE;
}

export function setStoredPageSize(size: number): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(PAGE_SIZE_STORAGE_KEY, String(size));
  } catch {
    // localStorage unavailable or quota exceeded — expected, silently fail
  }
}

export function getStoredViewMode(): ViewMode {
  if (typeof window === "undefined") return "card";
  try {
    const stored = localStorage.getItem(VIEW_MODE_STORAGE_KEY);
    if (stored === "list" || stored === "card") {
      return stored;
    }
  } catch {
    // localStorage unavailable (private browsing, SSR) — expected, use default
  }
  return "card";
}

export function setStoredViewMode(mode: ViewMode): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(VIEW_MODE_STORAGE_KEY, mode);
  } catch {
    // localStorage unavailable or quota exceeded — expected, silently fail
  }
}

export function getStoredSort(): CaseListSort | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = localStorage.getItem(SORT_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed && typeof parsed.sortBy === "string" && typeof parsed.sortOrder === "string") {
        return parsed as CaseListSort;
      }
    }
  } catch {
    // localStorage unavailable or corrupt data — expected, use default
  }
  return null;
}

export function setStoredSort(sort: CaseListSort): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(SORT_STORAGE_KEY, JSON.stringify(sort));
  } catch {
    // localStorage unavailable or quota exceeded — expected, silently fail
  }
}

export function getStoredFilters(): CaseListFilters | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = localStorage.getItem(FILTERS_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed && typeof parsed === "object") {
        return parsed as CaseListFilters;
      }
    }
  } catch {
    // localStorage unavailable or corrupt data — expected, use default
  }
  return null;
}

export function setStoredFilters(filters: CaseListFilters): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(FILTERS_STORAGE_KEY, JSON.stringify(filters));
  } catch {
    // localStorage unavailable or quota exceeded — expected, silently fail
  }
}

// ============================================================================
// URL PARAM PARSING
// ============================================================================

export function parseURLFilters(searchParams: URLSearchParams): CaseListFilters {
  const status = searchParams.get("status") as CaseStatus | null;
  const progressStatus = searchParams.get("progress") as ProgressStatus | null;
  const searchQuery = searchParams.get("search");
  const favoritesOnly = searchParams.get("favorites") === "true";
  const duplicatesOnly = searchParams.get("duplicates") === "true";
  // activeOnly defaults to true (Active tab is default), false only when explicitly set
  const activeOnlyParam = searchParams.get("activeOnly");
  const activeOnly = activeOnlyParam === "false" ? false : true;

  return {
    status: status || undefined,
    progressStatus: progressStatus || undefined,
    searchQuery: searchQuery || undefined,
    favoritesOnly: favoritesOnly || undefined,
    duplicatesOnly: duplicatesOnly || undefined,
    activeOnly,
  };
}

export function parseURLSort(searchParams: URLSearchParams): CaseListSort {
  const sortBy = searchParams.get("sort") as CaseListSortField | null;
  const sortOrder = searchParams.get("order") as SortOrder | null;

  return {
    sortBy: sortBy || DEFAULT_SORT.sortBy,
    sortOrder: sortOrder || DEFAULT_SORT.sortOrder,
  };
}

export function parseURLPage(searchParams: URLSearchParams): number {
  const page = searchParams.get("page");
  return page ? Math.max(1, parseInt(page, 10)) : 1;
}
