"use client";

/**
 * CaseFilterBar
 *
 * The case list's controls in two rows: which cases (Active, Completed,
 * Closed, All), then the search (debounced 300ms), one Filters panel (stage,
 * progress, duplicates only) and one Sort panel (the order and how many a
 * page shows). Each panel stays open while you choose and closes on Done,
 * a press outside or Escape.
 */

import { Fragment, useState, useEffect, useId, useRef } from "react";
import { ArrowDownIcon, ArrowUpIcon, CaretDownIcon, FunnelSimpleIcon, MagnifyingGlassIcon as Search } from "@phosphor-icons/react";
import { formatCaseStatus, formatProgressStatus } from "@convex/lib/notificationHelpers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { choiceVariants } from "@/components/ui/choice";
import { ChoiceRow } from "@/components/ui/choice-row";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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

const PANEL_LEGEND = "text-sm font-bold text-muted-foreground";

/** One choice in a panel's list: a real radio button with its whole 44px row to press. */
function RadioRow({
  name,
  value,
  checked,
  onPick,
  label,
}: {
  name: string;
  value: string;
  checked: boolean;
  onPick: () => void;
  label: string;
}) {
  return (
    <label className="flex min-h-11 cursor-pointer items-center gap-3 px-1 text-base hover:bg-accent">
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={onPick}
        className="size-5 shrink-0 accent-primary"
      />{" "}
      <span className={checked ? "font-semibold" : undefined}>{label}</span>
    </label>
  );
}

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

  const uid = useId();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);

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
  const stageValue = filters.status && !tabSetsStatus ? filters.status : "all";
  const progressValue = filters.progressStatus ?? "all";
  const activeFilters =
    (filters.status && !tabSetsStatus ? 1 : 0) +
    (filters.progressStatus && activeTab !== "completed" ? 1 : 0) +
    (filters.duplicatesOnly ? 1 : 0);

  return (
    <div data-testid="case-filter-bar" className="space-y-3">
      {/* Two by two on a phone, so "Completed" has the room it needs and the
          four stay the same size; one row from 640px. */}
      <div className="grid grid-cols-2 gap-2 [&>*]:min-w-0 sm:flex sm:flex-wrap" role="group" aria-label="Which cases">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            aria-pressed={activeTab === t.id}
            onClick={() => handleTabClick(t.id)}
            className={choiceVariants({ on: activeTab === t.id, className: "min-h-11 justify-center px-3 sm:px-4" })}
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

        {/* A panel that stays open while you choose: a menu closed on every pick, so setting a stage and a
            progress took two trips. The count says how many are on as you go; Done closes it. */}
        <Popover open={filtersOpen} onOpenChange={setFiltersOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" className="h-11" aria-label={activeFilters ? `Filters, ${activeFilters} on` : "Filters"}>
              <FunnelSimpleIcon aria-hidden="true" />
              Filters
              {activeFilters ? <span className="tabular-nums text-muted-foreground">{activeFilters}</span> : null}
            </Button>
          </PopoverTrigger>
          <PopoverContent
            align="end"
            collisionPadding={8}
            aria-label="Filters"
            className="max-h-[var(--radix-popover-content-available-height)] w-[min(20rem,calc(100vw-1rem))] overflow-y-auto border-2 border-border p-4"
          >
            <fieldset>
              <legend className={PANEL_LEGEND}>Stage</legend>{" "}
              <div className="mt-1">
                <RadioRow
                  name={`${uid}-stage`}
                  value="all"
                  checked={stageValue === "all"}
                  onPick={() => handleCaseStatusChange("all")}
                  label="Any stage"
                />
                {STAGES.map((st) => (
                  <Fragment key={st}>
                    {" "}
                    <RadioRow
                      name={`${uid}-stage`}
                      value={st}
                      checked={stageValue === st}
                      onPick={() => handleCaseStatusChange(st)}
                      label={formatCaseStatus(st)}
                    />
                  </Fragment>
                ))}
              </div>
            </fieldset>{" "}
            <fieldset className="mt-4">
              <legend className={PANEL_LEGEND}>Progress</legend>{" "}
              <div className="mt-1">
                <RadioRow
                  name={`${uid}-progress`}
                  value="all"
                  checked={progressValue === "all"}
                  onPick={() => handleProgressStatusChange("all")}
                  label="Any progress"
                />
                {PROGRESS.map((pr) => (
                  <Fragment key={pr}>
                    {" "}
                    <RadioRow
                      name={`${uid}-progress`}
                      value={pr}
                      checked={progressValue === pr}
                      onPick={() => handleProgressStatusChange(pr)}
                      label={formatProgressStatus(pr)}
                    />
                  </Fragment>
                ))}
              </div>
            </fieldset>{" "}
            <label className="mt-3 flex min-h-11 cursor-pointer items-center gap-3 border-t-2 border-border pt-3 text-base">
              <input
                type="checkbox"
                checked={Boolean(filters.duplicatesOnly)}
                onChange={(e) => onFiltersChange({ ...filters, duplicatesOnly: e.target.checked })}
                className="size-5 shrink-0 accent-primary"
              />{" "}
              Duplicates only
            </label>{" "}
            <div className="mt-4 flex items-center justify-between gap-3 border-t-2 border-border pt-3">
              <p role="status" className="text-sm text-soft">
                {activeFilters ? `${activeFilters} on` : "None on"}
              </p>{" "}
              <Button type="button" onClick={() => setFiltersOpen(false)}>
                Done
              </Button>
            </div>
          </PopoverContent>
        </Popover>

        <div className="flex items-center gap-1">
          {/* The order and how many a page shows, in one panel that stays open, the page size one tap. */}
          <Popover open={sortOpen} onOpenChange={setSortOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" className="h-11" aria-label={`Sort by: ${SORT_FIELD_LABELS[sort.sortBy]}`}>
                <span className="truncate">
                  Sort<span className="hidden sm:inline">: {SORT_FIELD_LABELS[sort.sortBy]}</span>
                </span>
                <CaretDownIcon className="size-4" aria-hidden="true" />
              </Button>
            </PopoverTrigger>
            <PopoverContent
              align="end"
              collisionPadding={8}
              aria-label="Sort"
              className="max-h-[var(--radix-popover-content-available-height)] w-[min(18rem,calc(100vw-1rem))] overflow-y-auto border-2 border-border p-4"
            >
              <fieldset>
                <legend className={PANEL_LEGEND}>Order by</legend>{" "}
                <div className="mt-1">
                  {(Object.keys(SORT_FIELD_LABELS) as CaseListSortField[]).map((field) => (
                    <Fragment key={field}>
                      <RadioRow
                        name={`${uid}-sort`}
                        value={field}
                        checked={sort.sortBy === field}
                        onPick={() => handleSortChange(field)}
                        label={SORT_FIELD_LABELS[field]}
                      />{" "}
                    </Fragment>
                  ))}
                </div>
              </fieldset>{" "}
              <ChoiceRow
                className="mt-4"
                label="Per page"
                labelClassName={PANEL_LEGEND}
                options={PAGE_SIZE_OPTIONS.map((size) => ({ value: String(size), label: String(size), ariaLabel: `${size} per page` }))}
                value={String(pageSize)}
                onChange={(v) => onPageSizeChange(Number(v))}
              />{" "}
              <div className="mt-4 flex justify-end border-t-2 border-border pt-3">
                <Button type="button" onClick={() => setSortOpen(false)}>
                  Done
                </Button>
              </div>
            </PopoverContent>
          </Popover>
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
