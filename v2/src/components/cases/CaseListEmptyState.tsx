/**
 * CaseListEmptyState Component
 * Empty state for case list with different messages.
 *
 * Variants:
 * - new-user: No cases at all (shows "Add your first case" CTA)
 * - no-results: Filtered results empty (shows "No cases match your filters")
 *
 * Design:
 * - Empty filing cabinet illustration (SVG)
 * - Message text
 * - CTA button (primary action)
 * - Neobrutalist card styling
 *
 * Phase: 21 (Case List)
 * Created: 2025-12-24
 */

import { FolderOpen, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";

// ============================================================================
// TYPES
// ============================================================================

interface CaseListEmptyStateProps {
  type: "new-user" | "no-results";
  onAddCase?: () => void;
  onClearFilters?: () => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function CaseListEmptyState({
  type,
  onAddCase,
  onClearFilters,
}: CaseListEmptyStateProps) {
  if (type === "new-user") {
    return (
      <div
        data-testid="empty-state-new-user"
        className="flex flex-col items-center justify-center py-20 px-6 border-4 border-border bg-background shadow-hard"
      >
        {/* Empty Filing Cabinet Icon */}
        <div className="mb-6 p-6 border-4 border-border bg-muted shadow-hard-sm">
          <FolderOpen className="size-24 text-muted-foreground" strokeWidth={1.5} />
        </div>

        {/* Message */}
        <h2 className="font-heading text-2xl font-bold mb-2">No cases yet</h2>
        <p className="text-muted-foreground text-center max-w-md mb-6">
          Get started by adding your first PERM case. Track deadlines, manage documents,
          and stay organized.
        </p>

        {/* CTA Button */}
        <Button onClick={onAddCase} size="lg">
          Add your first case
        </Button>
      </div>
    );
  }

  // type === "no-results"
  return (
    <div
      data-testid="empty-state-no-results"
      className="flex flex-col items-center justify-center py-20 px-6 border-4 border-border bg-background shadow-hard"
    >
      {/* Filter Icon */}
      <div className="mb-6 p-6 border-4 border-border bg-muted shadow-hard-sm">
        <Filter className="size-24 text-muted-foreground" strokeWidth={1.5} />
      </div>

      {/* Message */}
      <h2 className="font-heading text-2xl font-bold mb-2">
        No cases match your filters
      </h2>
      <p className="text-muted-foreground text-center max-w-md mb-6">
        Try adjusting your filters to see more results.
      </p>

      {/* CTA Button */}
      <Button onClick={onClearFilters} size="lg" variant="outline">
        Clear filters
      </Button>
    </div>
  );
}
