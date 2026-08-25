/**
 * Empty state components for the cases page.
 * - NewUserEmptyState: shown when user has zero cases
 * - NoResultsEmptyState: shown when filters match nothing
 */

import { Plus } from "@phosphor-icons/react/ssr";
import { Button } from "@/components/ui/button";
import { CaseListEmptyState } from "@/components/cases/CaseListEmptyState";
import { CaseFilterBar } from "@/components/cases/CaseFilterBar";
import type { CaseListFilters, CaseListSort } from "../../../../../convex/lib/caseListTypes";

interface NewUserEmptyStateProps {
  onAddCase: () => void;
  isAddingCase: boolean;
}

export function NewUserEmptyState({ onAddCase, isAddingCase }: NewUserEmptyStateProps) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-3xl font-bold">Cases</h1>{" "}
          <p className="text-muted-foreground mt-1">0 total cases</p>
        </div>
        <Button
          onClick={onAddCase}
          loading={isAddingCase}
          loadingText="Adding..."
        >
          <Plus className="size-4 mr-2" />
          Add Case
        </Button>
      </div>

      <CaseListEmptyState
        type="new-user"
        onAddCase={onAddCase}
      />
    </div>
  );
}

interface NoResultsEmptyStateProps {
  filters: CaseListFilters;
  sort: CaseListSort;
  pageSize: number;
  onAddCase: () => void;
  isAddingCase: boolean;
  onFiltersChange: (filters: CaseListFilters) => void;
  onSortChange: (sort: CaseListSort) => void;
  onPageSizeChange: (size: number) => void;
  onClearFilters: () => void;
}

export function NoResultsEmptyState({
  filters,
  sort,
  pageSize,
  onAddCase,
  isAddingCase,
  onFiltersChange,
  onSortChange,
  onPageSizeChange,
  onClearFilters,
}: NoResultsEmptyStateProps) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-3xl font-bold">Cases</h1>{" "}
          <p className="text-muted-foreground mt-1">
            No cases match your filters
          </p>
        </div>
        <Button
          onClick={onAddCase}
          loading={isAddingCase}
          loadingText="Adding..."
        >
          <Plus className="size-4 mr-2" />
          Add Case
        </Button>
      </div>

      {/* Filter Bar */}
      <CaseFilterBar
        filters={filters}
        sort={sort}
        onFiltersChange={onFiltersChange}
        onSortChange={onSortChange}
        pageSize={pageSize}
        onPageSizeChange={onPageSizeChange}
      />

      <CaseListEmptyState
        type="no-results"
        onClearFilters={onClearFilters}
      />
    </div>
  );
}
