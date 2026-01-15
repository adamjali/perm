"use client";

import { useState, useMemo, useDeferredValue } from "react";
import type { CaseForSelection } from "./CaseSelectionItem";
import type { CaseStatus } from "@/lib/perm";

/**
 * Sort options for case list
 */
export type SortOption = "name" | "status" | "date";

/**
 * Filter options for case list
 */
export type FilterOption = "all" | "active" | CaseStatus;

/**
 * Options for the useCaseSelection hook
 */
export interface UseCaseSelectionOptions {
  cases: CaseForSelection[];
  initialSelectedIds: string[];
}

/**
 * Return type for the useCaseSelection hook
 */
export interface UseCaseSelectionReturn {
  // Filtered/sorted cases
  displayedCases: CaseForSelection[];
  filteredCount: number;
  totalCount: number;

  // Search
  searchQuery: string;
  setSearchQuery: (query: string) => void;

  // Sort
  sortBy: SortOption;
  setSortBy: (sort: SortOption) => void;

  // Filter
  filterStatus: FilterOption;
  setFilterStatus: (filter: FilterOption) => void;

  // Selection
  selectedIds: Set<string>;
  toggleCase: (id: string) => void;
  selectAll: () => void;
  deselectAll: () => void;
  selectActiveOnly: () => void;

  // Dirty state
  hasChanges: boolean;
  getSelectedArray: () => string[];
}

/**
 * Status order for sorting by case progression
 * Earlier stages have lower numbers
 */
const STATUS_ORDER: Record<CaseStatus, number> = {
  pwd: 1,
  recruitment: 2,
  eta9089: 3,
  i140: 4,
  closed: 5,
};

/**
 * useCaseSelection - Custom hook for case selection logic with search, filter, sort, and bulk actions.
 *
 * Features:
 * - Debounced search (200ms via useDeferredValue)
 * - Case-insensitive search on employerName or positionTitle
 * - Sort by name (alphabetical), status (progression order), or date (newest first)
 * - Filter by all, active (non-closed), or specific CaseStatus
 * - Bulk actions: selectAll, deselectAll, selectActiveOnly
 * - Tracks dirty state (hasChanges) by comparing current selection to initial
 *
 * @param options - Cases array and initial selected IDs
 * @returns State and handlers for case selection
 */
export default function useCaseSelection({
  cases,
  initialSelectedIds,
}: UseCaseSelectionOptions): UseCaseSelectionReturn {
  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(initialSelectedIds)
  );

  // Search state with deferred value for debouncing
  const [searchQuery, setSearchQuery] = useState("");
  const deferredSearchQuery = useDeferredValue(searchQuery);

  // Sort and filter state
  const [sortBy, setSortBy] = useState<SortOption>("name");
  const [filterStatus, setFilterStatus] = useState<FilterOption>("all");

  // Compute displayed cases with filtering and sorting
  const displayedCases = useMemo(() => {
    let result = [...cases];

    // Apply search filter (case-insensitive on employerName OR positionTitle)
    if (deferredSearchQuery.trim()) {
      const query = deferredSearchQuery.toLowerCase().trim();
      result = result.filter(
        (c) =>
          c.employerName.toLowerCase().includes(query) ||
          c.positionTitle.toLowerCase().includes(query)
      );
    }

    // Apply status filter
    if (filterStatus === "active") {
      // Active = all except closed
      result = result.filter((c) => c.caseStatus !== "closed");
    } else if (filterStatus !== "all") {
      // Specific status filter
      result = result.filter((c) => c.caseStatus === filterStatus);
    }

    // Apply sort
    result.sort((a, b) => {
      switch (sortBy) {
        case "name":
          // Alphabetical by employerName
          return a.employerName.localeCompare(b.employerName);
        case "status":
          // By case progression (pwd < recruitment < eta9089 < i140 < closed)
          return STATUS_ORDER[a.caseStatus] - STATUS_ORDER[b.caseStatus];
        case "date":
          // By createdAt descending (newest first)
          return b.createdAt - a.createdAt;
        default:
          return 0;
      }
    });

    return result;
  }, [cases, deferredSearchQuery, filterStatus, sortBy]);

  // Toggle a single case selection
  const toggleCase = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Select all currently displayed (filtered) cases
  const selectAll = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      displayedCases.forEach((c) => next.add(c._id));
      return next;
    });
  };

  // Deselect all currently displayed (filtered) cases
  const deselectAll = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      displayedCases.forEach((c) => next.delete(c._id));
      return next;
    });
  };

  // Select only active cases (from all cases, not just filtered)
  const selectActiveOnly = () => {
    const activeIds = cases
      .filter((c) => c.caseStatus !== "closed")
      .map((c) => c._id);
    setSelectedIds(new Set(activeIds));
  };

  // Check if selection has changed from initial
  const hasChanges = useMemo(() => {
    const initialSet = new Set(initialSelectedIds);

    // Different count = different selection
    if (selectedIds.size !== initialSet.size) {
      return true;
    }

    // Check if all current IDs were in initial
    for (const id of selectedIds) {
      if (!initialSet.has(id)) {
        return true;
      }
    }

    return false;
  }, [selectedIds, initialSelectedIds]);

  // Get selected IDs as array
  const getSelectedArray = () => Array.from(selectedIds);

  return {
    // Filtered/sorted cases
    displayedCases,
    filteredCount: displayedCases.length,
    totalCount: cases.length,

    // Search
    searchQuery,
    setSearchQuery,

    // Sort
    sortBy,
    setSortBy,

    // Filter
    filterStatus,
    setFilterStatus,

    // Selection
    selectedIds,
    toggleCase,
    selectAll,
    deselectAll,
    selectActiveOnly,

    // Dirty state
    hasChanges,
    getSelectedArray,
  };
}
