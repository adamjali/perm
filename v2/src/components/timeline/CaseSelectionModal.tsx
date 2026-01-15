"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SelectInput, type SelectOption } from "@/components/forms/SelectInput";
import { CaseSelectionItem, type CaseForSelection } from "./CaseSelectionItem";
import { cn } from "@/lib/utils";
import type { CaseStatus } from "@/lib/perm";

// Re-export for consumers
export type { CaseForSelection };

export interface CaseSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  allCases: CaseForSelection[];
  selectedIds: Set<string>;
  onSelectionChange: (ids: string[]) => void;
  /** Optional title override. Defaults to "Select Cases" */
  title?: string;
  /** Optional description override. Defaults to "Choose which cases to display." */
  description?: string;
}

type SortOption = "name" | "status" | "date";
type FilterOption = "all" | "active" | "completed" | CaseStatus;

const sortOptions: SelectOption[] = [
  { value: "name", label: "Name (A-Z)" },
  { value: "status", label: "Status" },
  { value: "date", label: "Date (newest first)" },
];

const filterOptions: SelectOption[] = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "pwd", label: "PWD" },
  { value: "recruitment", label: "Recruitment" },
  { value: "eta9089", label: "ETA 9089" },
  { value: "i140", label: "I-140" },
  { value: "completed", label: "Completed" },
  { value: "closed", label: "Closed" },
];

// Status order for sorting
const STATUS_ORDER: Record<CaseStatus, number> = {
  pwd: 1,
  recruitment: 2,
  eta9089: 3,
  i140: 4,
  closed: 5,
};

/**
 * CaseSelectionModal - Modal for selecting which cases to display on the timeline.
 *
 * Features:
 * - Search by employer name or position title
 * - Sort by name, status, or date
 * - Filter by status (all, active, or specific stage)
 * - Bulk actions: Select All, Deselect All, Active Only
 * - Scrollable case list with neobrutalist styling
 */
export function CaseSelectionModal({
  isOpen,
  onClose,
  allCases,
  selectedIds,
  onSelectionChange,
  title,
  description,
}: CaseSelectionModalProps) {
  // Local state for modal (will be committed on save)
  const [localSelectedIds, setLocalSelectedIds] = React.useState<Set<string>>(
    new Set(selectedIds)
  );
  const [searchQuery, setSearchQuery] = React.useState("");
  const [sortBy, setSortBy] = React.useState<SortOption>("name");
  const [filterBy, setFilterBy] = React.useState<FilterOption>("all");

  // Sync local state when modal opens or selectedIds change externally
  React.useEffect(() => {
    if (isOpen) {
      setLocalSelectedIds(new Set(selectedIds));
    }
  }, [isOpen, selectedIds]);

  // Filter cases
  const filteredCases = React.useMemo(() => {
    let result = [...allCases];

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter(
        (c) =>
          c.employerName.toLowerCase().includes(query) ||
          c.positionTitle.toLowerCase().includes(query)
      );
    }

    // Apply status filter
    if (filterBy === "active") {
      result = result.filter((c) => c.caseStatus !== "closed");
    } else if (filterBy === "completed") {
      // Completed = I-140 approved cases
      result = result.filter(
        (c) => c.caseStatus === "i140" && c.progressStatus === "approved"
      );
    } else if (filterBy !== "all") {
      result = result.filter((c) => c.caseStatus === filterBy);
    }

    // Apply sort
    result.sort((a, b) => {
      switch (sortBy) {
        case "name":
          return a.employerName.localeCompare(b.employerName);
        case "status":
          return STATUS_ORDER[a.caseStatus] - STATUS_ORDER[b.caseStatus];
        case "date":
          return b.createdAt - a.createdAt; // Newest first
        default:
          return 0;
      }
    });

    return result;
  }, [allCases, searchQuery, filterBy, sortBy]);

  // Handlers
  const handleToggle = (id: string) => {
    setLocalSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    const allFilteredIds = new Set(filteredCases.map((c) => c._id));
    setLocalSelectedIds((prev) => {
      const next = new Set(prev);
      allFilteredIds.forEach((id) => next.add(id));
      return next;
    });
  };

  const handleDeselectAll = () => {
    const allFilteredIds = new Set(filteredCases.map((c) => c._id));
    setLocalSelectedIds((prev) => {
      const next = new Set(prev);
      allFilteredIds.forEach((id) => next.delete(id));
      return next;
    });
  };

  const handleActiveOnly = () => {
    const activeIds = allCases
      .filter((c) => c.caseStatus !== "closed")
      .map((c) => c._id);
    setLocalSelectedIds(new Set(activeIds));
  };

  const handleSave = () => {
    onSelectionChange(Array.from(localSelectedIds));
    onClose();
  };

  const handleCancel = () => {
    // Reset to original selection
    setLocalSelectedIds(new Set(selectedIds));
    setSearchQuery("");
    onClose();
  };

  // Count selected from filtered list
  const selectedFromFiltered = filteredCases.filter((c) =>
    localSelectedIds.has(c._id)
  ).length;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleCancel()}>
      <DialogContent
        className="sm:max-w-xl max-h-[85vh] flex flex-col overflow-hidden"
        showCloseButton={true}
        data-testid="case-selection-modal"
      >
        {/* Header */}
        <DialogHeader>
          <DialogTitle className="font-display text-xl">
            {title ?? "Select Cases"}
          </DialogTitle>
          <DialogDescription>
            {description ?? "Choose which cases to display."}
          </DialogDescription>
        </DialogHeader>

        {/* Controls Row */}
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
          {/* Search */}
          <Input
            type="search"
            placeholder="Search cases..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1"
            aria-label="Search cases"
            data-testid="case-search-input"
          />

          {/* Sort */}
          <SelectInput
            options={sortOptions}
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
            aria-label="Sort cases"
            className="sm:w-40"
            data-testid="case-sort-select"
          />

          {/* Filter */}
          <SelectInput
            options={filterOptions}
            value={filterBy}
            onChange={(e) => setFilterBy(e.target.value as FilterOption)}
            aria-label="Filter cases"
            className="sm:w-36"
            data-testid="case-filter-select"
          />
        </div>

        {/* Bulk Actions Row */}
        <div className="flex flex-wrap items-center gap-2 py-1">
          <Button
            variant="outline"
            size="sm"
            onClick={handleSelectAll}
            data-testid="select-all-btn"
          >
            Select All
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleDeselectAll}
            data-testid="deselect-all-btn"
          >
            Deselect All
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleActiveOnly}
            data-testid="active-only-btn"
          >
            Active Only
          </Button>
          <span className="ml-auto text-sm text-muted-foreground">
            Showing {filteredCases.length} of {allCases.length} cases
            {selectedFromFiltered > 0 && ` (${selectedFromFiltered} selected)`}
          </span>
        </div>

        {/* Case List - with CSS animations for performance */}
        <div
          className={cn(
            "flex-1 min-h-[200px] max-h-[320px] overflow-y-auto",
            "border-2 border-border shadow-hard-sm"
          )}
          data-testid="case-list-container"
        >
          {filteredCases.length === 0 ? (
            <div className="flex items-center justify-center h-full text-muted-foreground py-8 animate-in fade-in duration-150">
              {searchQuery || filterBy !== "all"
                ? "No cases match your search or filter"
                : "No cases available"}
            </div>
          ) : (
            filteredCases.map((caseData, index) => (
              <div
                key={caseData._id}
                className="animate-in fade-in slide-in-from-top-2 duration-150"
                style={{
                  animationDelay: `${Math.min(index * 20, 200)}ms`,
                  animationFillMode: "both",
                }}
              >
                <CaseSelectionItem
                  case={caseData}
                  isSelected={localSelectedIds.has(caseData._id)}
                  onToggle={handleToggle}
                />
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <DialogFooter className="pt-2">
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button onClick={handleSave} data-testid="save-selection-btn">
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
