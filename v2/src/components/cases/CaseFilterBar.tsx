"use client";

/**
 * CaseFilterBar Component
 * Filter and sort controls for case list with neobrutalist design.
 *
 * Features:
 * - Show By tabs: Active (default) | Completed | Closed/Archived | All
 * - Search input with debounced callback (300ms)
 * - Case Status dropdown (All, PWD, Recruitment, ETA 9089, I-140)
 * - Progress Status dropdown (All, Working, Waiting, Filed, Approved, etc.)
 * - Sort dropdown (Deadline, Favorites, Recent, Employer, etc.)
 * - Responsive: horizontal on desktop, vertical on mobile
 */

import { useState, useEffect, useRef } from "react";
import { Search, ArrowUp, ArrowDown, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type {
  CaseListFilters,
  CaseListSort,
  CaseListSortField,
} from "../../../convex/lib/caseListTypes";
import type { CaseStatus, ProgressStatus } from "../../../convex/lib/dashboardTypes";

// ============================================================================
// TYPES
// ============================================================================

export interface CaseFilterBarProps {
  filters: CaseListFilters;
  sort: CaseListSort;
  onFiltersChange: (filters: CaseListFilters) => void;
  onSortChange: (sort: CaseListSort) => void;
  pageSize: number;
  onPageSizeChange: (size: number) => void;
}

type ShowByTab = "active" | "completed" | "closed" | "all";

// ============================================================================
// LABEL MAPS
// ============================================================================

// Status labels for dropdown display
const CASE_STATUS_LABELS: Record<CaseStatus, string> = {
  pwd: "PWD",
  recruitment: "Recruitment",
  eta9089: "ETA 9089",
  i140: "I-140",
  closed: "Closed",
};

const PROGRESS_STATUS_LABELS: Record<ProgressStatus, string> = {
  working: "Working on it",
  waiting_intake: "Waiting for intake",
  filed: "Filed",
  approved: "Approved",
  under_review: "Under review",
  rfi_rfe: "RFI/RFE",
};

const SORT_FIELD_LABELS: Record<CaseListSortField, string> = {
  deadline: "Next deadline",
  updated: "Recently updated",
  favorites: "Favorites first",
  employer: "Employer name",
  status: "Case status",
  pwdFiled: "PWD filed",
  etaFiled: "ETA 9089 filed",
  i140Filed: "I-140 filed",
  custom: "Custom order",
};

const PAGE_SIZE_OPTIONS = [6, 12, 24, 50] as const;

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Derive the initial tab selection from filter state.
 * Ensures tab matches URL params on initial mount.
 */
const deriveTabFromFilters = (f: CaseListFilters): ShowByTab => {
  if (f.status === "closed") return "closed";
  if (f.status === "i140" && f.progressStatus === "approved") return "completed";
  // If activeOnly is explicitly false with no status filters, show "all"
  if (f.activeOnly === false && !f.status && !f.progressStatus) return "all";
  return "active";
};

// ============================================================================
// COMPONENT
// ============================================================================

export function CaseFilterBar({
  filters,
  sort,
  onFiltersChange,
  onSortChange,
  pageSize,
  onPageSizeChange,
}: CaseFilterBarProps) {
  // ============================================================================
  // STATE
  // ============================================================================

  // Active tab state (derived from filters on mount, synced via effect)
  const [activeTab, setActiveTab] = useState<ShowByTab>(() => deriveTabFromFilters(filters));

  // Search input local state (for debouncing)
  const [searchInput, setSearchInput] = useState(filters.searchQuery ?? "");

  // Refs for stable access in debounce effect (avoids dependency array issues)
  const filtersRef = useRef(filters);
  const onFiltersChangeRef = useRef(onFiltersChange);

  // Update refs in effect to avoid updating during render
  useEffect(() => {
    filtersRef.current = filters;
    onFiltersChangeRef.current = onFiltersChange;
  });

  // ============================================================================
  // SYNC TAB WITH FILTERS
  // ============================================================================

  // Sync activeTab when filters change from URL or external source
  useEffect(() => {
    // Completed = i140 + approved
    if (filters.status === "i140" && filters.progressStatus === "approved") {
      setActiveTab("completed");
    } else if (filters.status === "closed") {
      setActiveTab("closed");
    } else if (!filters.status && !filters.progressStatus) {
      // Check activeOnly to determine if "active" or "all"
      if (filters.activeOnly === false) {
        setActiveTab("all");
      } else {
        // activeOnly true or undefined = Active tab (default view)
        setActiveTab("active");
      }
    }
    // If specific status is set but not complete/closed, don't change tab (user is filtering within active)
  }, [filters.status, filters.progressStatus, filters.activeOnly]);

  // ============================================================================
  // DEBOUNCED SEARCH
  // ============================================================================

  // Debounce search input (300ms) - uses refs to avoid dependency array triggering re-runs
  useEffect(() => {
    // Only trigger if search value actually changed from what's in filters
    const currentSearch = filtersRef.current.searchQuery ?? "";
    if (searchInput === currentSearch) {
      return; // No change, don't trigger update
    }

    const timer = setTimeout(() => {
      onFiltersChangeRef.current({
        ...filtersRef.current,
        searchQuery: searchInput || undefined, // Use undefined for empty string
      });
    }, 300);

    return () => clearTimeout(timer);
  }, [searchInput]); // Only depends on searchInput - refs provide stable access to other values

  // ============================================================================
  // TAB HANDLERS
  // ============================================================================

  const handleTabClick = (tab: ShowByTab) => {
    setActiveTab(tab);

    switch (tab) {
      case "active":
        // Active = show all non-closed, non-completed cases
        // Uses activeOnly filter to exclude closed and completed (i140 + approved)
        onFiltersChange({
          ...filters,
          status: undefined,
          progressStatus: undefined,
          activeOnly: true,
        });
        break;
      case "completed":
        // Completed = I-140 approved
        onFiltersChange({
          ...filters,
          status: "i140",
          progressStatus: "approved",
          activeOnly: false,
        });
        break;
      case "closed":
        // Closed/Archived = closed status
        onFiltersChange({
          ...filters,
          status: "closed",
          progressStatus: undefined,
          activeOnly: false,
        });
        break;
      case "all":
        // All = clear status filters, show everything
        onFiltersChange({
          ...filters,
          status: undefined,
          progressStatus: undefined,
          activeOnly: false,
        });
        break;
    }
  };

  // ============================================================================
  // DROPDOWN HANDLERS
  // ============================================================================

  const handleCaseStatusChange = (status: CaseStatus | "all") => {
    onFiltersChange({
      ...filters,
      status: status === "all" ? undefined : status,
    });
  };

  const handleProgressStatusChange = (status: ProgressStatus | "all") => {
    onFiltersChange({
      ...filters,
      progressStatus: status === "all" ? undefined : status,
    });
  };

  const handleSortChange = (sortBy: CaseListSortField) => {
    // Determine default sort order for each field
    let sortOrder: "asc" | "desc" = "asc";
    if (sortBy === "updated" || sortBy === "deadline") {
      sortOrder = "desc"; // Recently updated / deadline should show most urgent first
    }

    onSortChange({
      sortBy,
      sortOrder,
    });
  };

  const handleSortOrderToggle = () => {
    onSortChange({
      sortBy: sort.sortBy,
      sortOrder: sort.sortOrder === "asc" ? "desc" : "asc",
    });
  };

  // ============================================================================
  // RENDER HELPERS
  // ============================================================================

  const getCurrentCaseStatusLabel = (): string => {
    if (!filters.status) return "All";
    return CASE_STATUS_LABELS[filters.status];
  };

  const getCurrentProgressStatusLabel = (): string => {
    if (!filters.progressStatus) return "All";
    return PROGRESS_STATUS_LABELS[filters.progressStatus];
  };

  const getCurrentSortLabel = (): string => {
    return SORT_FIELD_LABELS[sort.sortBy];
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div
      data-testid="case-filter-bar"
      className="space-y-5 border-2 border-border bg-background p-5 shadow-hard"
    >
      {/* Show By Tabs */}
      <div className="flex flex-wrap gap-3">
        <Button
          variant={activeTab === "active" ? "default" : "outline"}
          size="default"
          onClick={() => handleTabClick("active")}
        >
          Active
        </Button>
        <Button
          variant={activeTab === "completed" ? "default" : "outline"}
          size="default"
          onClick={() => handleTabClick("completed")}
        >
          Completed
        </Button>
        <Button
          variant={activeTab === "closed" ? "default" : "outline"}
          size="default"
          onClick={() => handleTabClick("closed")}
        >
          Closed/Archived
        </Button>
        <Button
          variant={activeTab === "all" ? "default" : "outline"}
          size="default"
          onClick={() => handleTabClick("all")}
        >
          All
        </Button>
      </div>

      {/* Filter Row */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        {/* Search Input */}
        <div data-testid="search-input-container" className="relative flex-1 group">
          <Search className="absolute left-3 top-1/2 z-20 size-5 -translate-y-1/2 text-foreground/60 dark:text-foreground/50 pointer-events-none transition-transform duration-150 group-hover:-translate-y-[calc(50%+1px)]" />
          <Input
            type="text"
            placeholder="Search cases..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-11 h-11 text-base"
          />
        </div>

        {/* Case Status Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="default"
              className="w-full md:w-44 justify-between cursor-pointer"
              aria-label={`Case Status: ${getCurrentCaseStatusLabel()}`}
            >
              <span className="truncate">Case Status: {getCurrentCaseStatusLabel()}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-[calc(100vw-2.5rem)] md:w-44">
            <DropdownMenuItem onClick={() => handleCaseStatusChange("all")} className="cursor-pointer">
              All
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleCaseStatusChange("pwd")} className="cursor-pointer">
              PWD
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleCaseStatusChange("recruitment")} className="cursor-pointer">
              Recruitment
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleCaseStatusChange("eta9089")} className="cursor-pointer">
              ETA 9089
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleCaseStatusChange("i140")} className="cursor-pointer">
              I-140
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Progress Status Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="default"
              className="w-full md:w-52 justify-between cursor-pointer"
              aria-label={`Progress Status: ${getCurrentProgressStatusLabel()}`}
            >
              <span className="truncate">Progress: {getCurrentProgressStatusLabel()}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-[calc(100vw-2.5rem)] md:w-48">
            <DropdownMenuItem onClick={() => handleProgressStatusChange("all")} className="cursor-pointer">
              All
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleProgressStatusChange("working")} className="cursor-pointer">
              Working on it
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleProgressStatusChange("waiting_intake")} className="cursor-pointer">
              Waiting for intake
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleProgressStatusChange("filed")} className="cursor-pointer">
              Filed
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleProgressStatusChange("approved")} className="cursor-pointer">
              Approved
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleProgressStatusChange("under_review")} className="cursor-pointer">
              Under review
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleProgressStatusChange("rfi_rfe")} className="cursor-pointer">
              RFI/RFE
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Duplicates Only Toggle */}
        <Button
          variant={filters.duplicatesOnly ? "default" : "outline"}
          size="default"
          onClick={() => onFiltersChange({ ...filters, duplicatesOnly: !filters.duplicatesOnly })}
          aria-label={filters.duplicatesOnly ? "Showing duplicates only" : "Show duplicates only"}
          title={filters.duplicatesOnly ? "Showing duplicates only - click to show all" : "Show only duplicate cases"}
          className="gap-2"
        >
          <Copy className="size-4" />
          Duplicates
        </Button>

        {/* Sort Dropdown + Order Toggle */}
        <div className="flex w-full md:w-auto items-center gap-1">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="default"
                className="flex-1 md:w-44 justify-between cursor-pointer"
                aria-label={`Sort by: ${getCurrentSortLabel()}`}
              >
                <span className="truncate">Sort: {getCurrentSortLabel()}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[calc(100vw-2.5rem)] md:w-44">
              <DropdownMenuItem onClick={() => handleSortChange("custom")} className="cursor-pointer">
                Custom order
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleSortChange("deadline")} className="cursor-pointer">
                Next deadline
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleSortChange("updated")} className="cursor-pointer">
                Recently updated
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleSortChange("favorites")} className="cursor-pointer">
                Favorites first
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleSortChange("employer")} className="cursor-pointer">
                Employer name
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleSortChange("status")} className="cursor-pointer">
                Case status
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleSortChange("pwdFiled")} className="cursor-pointer">
                PWD filed
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleSortChange("etaFiled")} className="cursor-pointer">
                ETA 9089 filed
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleSortChange("i140Filed")} className="cursor-pointer">
                I-140 filed
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Sort Order Toggle Button */}
          <Button
            variant="outline"
            size="icon"
            onClick={handleSortOrderToggle}
            aria-label={`Sort order: ${sort.sortOrder === "asc" ? "Ascending" : "Descending"}`}
            title={sort.sortOrder === "asc" ? "Ascending (click for descending)" : "Descending (click for ascending)"}
          >
            {sort.sortOrder === "asc" ? (
              <ArrowUp className="size-4" />
            ) : (
              <ArrowDown className="size-4" />
            )}
          </Button>
        </div>

        {/* Per Page Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="default"
              className="w-full md:w-36 justify-between cursor-pointer font-mono"
              aria-label={`Per Page: ${pageSize}`}
            >
              <span className="truncate">Per Page: {pageSize}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-[calc(100vw-2.5rem)] md:w-36">
            {PAGE_SIZE_OPTIONS.map((size) => (
              <DropdownMenuItem
                key={size}
                onClick={() => onPageSizeChange(size)}
                className="font-mono cursor-pointer"
                aria-label={`${size} per page`}
              >
                {size}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
