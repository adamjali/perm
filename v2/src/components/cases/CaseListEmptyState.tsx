/**
 * CaseListEmptyState Component
 * Empty state for case list with different messages.
 *
 * Variants:
 * - new-user: No cases at all (shows "Add your first case" CTA)
 * - no-results: Filtered results empty (shows "No cases match your filters")
 *
 * Design: a title, one sentence, one action. No illustration.
 */

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
        className="flex flex-col items-center justify-center bg-tint px-6 py-16 border-2 shadow-hard border-border"
      >
        <h2 className="font-heading text-2xl font-bold mb-2">No cases yet</h2>{" "}
        <p className="text-muted-foreground text-center max-w-md mb-6">
          Add a case and its deadlines appear here, on your calendar and in your reminders.
        </p>{" "}

        <Button onClick={onAddCase}>
          Add your first case
        </Button>
      </div>
    );
  }

  // type === "no-results"
  return (
    <div
      data-testid="empty-state-no-results"
      className="flex flex-col items-center justify-center bg-tint px-6 py-16 border-2 shadow-hard border-border"
    >
      <h2 className="font-heading text-2xl font-bold mb-2">
        No cases match these filters
      </h2>{" "}
      <p className="text-muted-foreground text-center max-w-md mb-6">
        Clear them to see every case again.
      </p>

      <Button onClick={onClearFilters} variant="outline">
        Clear filters
      </Button>
    </div>
  );
}
