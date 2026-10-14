"use client";

/**
 * CaseFilterBar
 *
 * The case list's controls in two rows: which cases (Active, Completed,
 * Closed, All), then the search (debounced 300ms), one Filters menu (stage,
 * progress, duplicates only) and one Sort menu (the order and how many a
 * page shows).
 */

import { useState, useEffect, useRef } from "react";
import { ArrowDownIcon, ArrowUpIcon, CaretDownIcon, FunnelSimpleIcon, MagnifyingGlassIcon as Search } from "@phosphor-icons/react";
import { formatCaseStatus, formatProgressStatus } from "@convex/lib/notificationHelpers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { choiceVariants } from "@/components/ui/choice";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type {
  CaseListFilters,
  CaseListSort,
  CaseListSortField,
} from "@convex/lib/caseListTypes";
import type { CaseStatus, ProgressStatus } from "@convex/lib/dashboardTypes";

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

/** The stages a filter can pick (closed has its own toggle). */
const STAGES: readonly CaseStatus[] = ["pwd", "recruitment", "eta9089", "i140"];
const PROGRESS: readonly ProgressStatus[] = ["working", "waiting_intake", "filed", "approved", "under_review", "rfi_rfe"];

const TABS: ReadonlyArray<{ id: ShowByTab; label: string }> = [
  { id: "active", label: "Active" },
  { id: "completed", label: "Completed" },
  { id: "closed", label: "Closed" },
  { id: "all", label: "All" },
];

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
    // If specific status is set but not complete/closed, don’t change tab (user is filtering within active)
  }, [filters.status, filters.progressStatus, filters.activeOnly]);

  // ============================================================================
  // DEBOUNCED SEARCH
  // ============================================================================

  // Debounce search input (300ms) - uses refs to avoid dependency array triggering re-runs
  useEffect(() => {
    // Only trigger if search value actually changed from what’s in filters
    const currentSearch = filtersRef.current.searchQuery ?? "";
    if (searchInput === currentSearch) {
      return; // No change, don’t trigger update
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
  // RENDER
  // ============================================================================

  // The Completed and Closed toggles set the stage themselves; only a stage
  // chosen in the menu counts as a filter there.
  const tabSetsStatus = activeTab === "completed" || activeTab === "closed";
  const activeFilters =
    (filters.status && !tabSetsStatus ? 1 : 0) +
    (filters.progressStatus && activeTab !== "completed" ? 1 : 0) +
    (filters.duplicatesOnly ? 1 : 0);

  return (
    <div data-testid="case-filter-bar" className="space-y-3">
      <div className="grid grid-cols-4 gap-2 sm:flex sm:flex-wrap" role="group" aria-label="Which cases">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            aria-pressed={activeTab === t.id}
            onClick={() => handleTabClick(t.id)}
            className={choiceVariants({ on: activeTab === t.id, className: "px-2 sm:px-4" })}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div data-testid="search-input-container" className="relative min-w-0 flex-1 basis-64">
          <Input
            type="search"
            aria-label="Search cases"
            placeholder="Name, job or case number"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="h-11 pl-10 text-base"
          />
          <Search className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="h-11" aria-label={activeFilters ? `Filters, ${activeFilters} on` : "Filters"}>
              <FunnelSimpleIcon aria-hidden="true" />
              Filters
              {activeFilters ? <span className="tabular-nums text-muted-foreground">{activeFilters}</span> : null}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60">
            <DropdownMenuLabel>Stage</DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={filters.status && !tabSetsStatus ? filters.status : "all"}
              onValueChange={(v) => handleCaseStatusChange(v as CaseStatus | "all")}
            >
              <DropdownMenuRadioItem value="all">Any stage</DropdownMenuRadioItem>
              {STAGES.map((st) => (
                <DropdownMenuRadioItem key={st} value={st}>
                  {formatCaseStatus(st)}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Progress</DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={filters.progressStatus ?? "all"}
              onValueChange={(v) => handleProgressStatusChange(v as ProgressStatus | "all")}
            >
              <DropdownMenuRadioItem value="all">Any progress</DropdownMenuRadioItem>
              {PROGRESS.map((p) => (
                <DropdownMenuRadioItem key={p} value={p}>
                  {formatProgressStatus(p)}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
            <DropdownMenuSeparator />
            <DropdownMenuCheckboxItem
              checked={Boolean(filters.duplicatesOnly)}
              onCheckedChange={(on) => onFiltersChange({ ...filters, duplicatesOnly: on === true })}
            >
              Duplicates only
            </DropdownMenuCheckboxItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="flex items-center gap-1">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="h-11" aria-label={`Sort by: ${SORT_FIELD_LABELS[sort.sortBy]}`}>
                <span className="truncate">
                  Sort<span className="hidden sm:inline">: {SORT_FIELD_LABELS[sort.sortBy]}</span>
                </span>
                <CaretDownIcon className="size-4" aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuRadioGroup value={sort.sortBy} onValueChange={(v) => handleSortChange(v as CaseListSortField)}>
                {(Object.keys(SORT_FIELD_LABELS) as CaseListSortField[]).map((field) => (
                  <DropdownMenuRadioItem key={field} value={field}>
                    {SORT_FIELD_LABELS[field]}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Per page</DropdownMenuLabel>
              <DropdownMenuRadioGroup value={String(pageSize)} onValueChange={(v) => onPageSizeChange(Number(v))}>
                {PAGE_SIZE_OPTIONS.map((size) => (
                  <DropdownMenuRadioItem key={size} value={String(size)} aria-label={`${size} per page`}>
                    {size}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            variant="outline"
            size="icon"
            className="size-11"
            onClick={handleSortOrderToggle}
            aria-label={`Sort order: ${sort.sortOrder === "asc" ? "Ascending" : "Descending"}`}
            title={sort.sortOrder === "asc" ? "Ascending" : "Descending"}
          >
            {sort.sortOrder === "asc" ? <ArrowUpIcon className="size-4" /> : <ArrowDownIcon className="size-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
