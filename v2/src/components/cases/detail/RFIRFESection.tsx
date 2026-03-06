"use client";

import { useState, useMemo, useEffect } from "react";
import { AlertTriangle, CheckCircle2, Clock, ChevronLeft, ChevronRight, ChevronsUpDown } from "lucide-react";
import { CaseDetailSection } from "./CaseDetailSection";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatISODate } from "@/lib/utils/date";
import { cn } from "@/lib/utils";
import { getUrgencyLevelFull, getDaysUntilDeadline, type UrgencyLevelFull } from "@/lib/status/urgency";
import type { RFIEntry, RFEEntry } from "@/lib/shared/types";

// Re-export types for consumers of this module
export type { RFIEntry, RFEEntry } from "@/lib/shared/types";

export interface RFIRFESectionProps {
  rfiEntries?: RFIEntry[];
  rfeEntries?: RFEEntry[];
  defaultOpen?: boolean;
  accentColor?: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/** Show this many entries before requiring "show more" */
const INITIAL_VISIBLE_COUNT = 2;

// ============================================================================
// HELPERS
// ============================================================================

function formatDate(isoDate: string | undefined): string {
  if (!isoDate) return "-";
  return formatISODate(isoDate);
}

/**
 * Calculate urgency for RFI/RFE entries using canonical thresholds.
 */
function getUrgency(
  dueDate: string | undefined,
  submittedDate: string | undefined
): {
  level: UrgencyLevelFull;
  daysRemaining?: number;
} {
  if (submittedDate) {
    return { level: "completed" };
  }

  if (!dueDate) {
    return { level: "normal" };
  }

  const daysRemaining = getDaysUntilDeadline(dueDate);
  const level = getUrgencyLevelFull({ daysUntil: daysRemaining, isCompleted: false });

  return { level, daysRemaining };
}

/**
 * Sort entries: active (by urgency) first, then completed (newest first)
 */
function sortEntries<T extends RFIEntry | RFEEntry>(entries: T[]): T[] {
  return [...entries].sort((a, b) => {
    const aCompleted = !!a.responseSubmittedDate;
    const bCompleted = !!b.responseSubmittedDate;

    // Active before completed
    if (!aCompleted && bCompleted) return -1;
    if (aCompleted && !bCompleted) return 1;

    // Among active: most urgent first (by due date ascending)
    if (!aCompleted && !bCompleted) {
      if (a.responseDueDate && b.responseDueDate) {
        return a.responseDueDate.localeCompare(b.responseDueDate);
      }
      return 0;
    }

    // Among completed: newest first
    return b.createdAt - a.createdAt;
  });
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

interface EntryCardProps {
  type: "RFI" | "RFE";
  entry: RFIEntry | RFEEntry;
  compact?: boolean;
}

function EntryCard({ type, entry, compact }: EntryCardProps) {
  const urgency = getUrgency(entry.responseDueDate, entry.responseSubmittedDate);
  const isActive = !entry.responseSubmittedDate && !!entry.receivedDate;

  const borderColor = urgency.level === "completed"
    ? "border-emerald-500 dark:border-emerald-600"
    : urgency.level === "overdue"
      ? "border-red-600 dark:border-red-500"
      : urgency.level === "urgent"
        ? "border-red-500 dark:border-red-500"
        : urgency.level === "soon"
          ? "border-orange-500 dark:border-orange-500"
          : "border-border";

  const bgColor = urgency.level === "completed"
    ? "bg-emerald-50/50 dark:bg-emerald-950/20"
    : urgency.level === "overdue" || urgency.level === "urgent"
      ? "bg-red-50/50 dark:bg-red-950/20"
      : urgency.level === "soon"
        ? "bg-orange-50/50 dark:bg-orange-950/20"
        : "bg-background";

  return (
    <div className={cn("border-2 shadow-hard-sm", borderColor, bgColor, compact ? "p-3" : "p-4")}>
      {/* Header Row */}
      <div className="flex flex-wrap items-center gap-2 mb-2">
        {/* Type Badge */}
        <Badge
          variant={type === "RFI" ? "secondary" : "outline"}
          className="font-semibold text-xs"
        >
          {type}
        </Badge>

        {/* Status Badge */}
        {urgency.level === "completed" ? (
          <Badge
            variant="secondary"
            className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300 border-emerald-500 text-xs gap-1"
          >
            <CheckCircle2 className="h-3 w-3" />
            Submitted
          </Badge>
        ) : urgency.level === "overdue" ? (
          <Badge variant="destructive" className="text-xs gap-1">
            <AlertTriangle className="h-3 w-3" />
            Overdue ({Math.abs(urgency.daysRemaining!)}d)
          </Badge>
        ) : isActive && urgency.level === "urgent" ? (
          <Badge variant="destructive" className="text-xs gap-1">
            <AlertTriangle className="h-3 w-3" />
            {urgency.daysRemaining === 0
              ? "Due Today"
              : `${urgency.daysRemaining}d remaining`}
          </Badge>
        ) : isActive && urgency.level === "soon" ? (
          <Badge
            variant="secondary"
            className="bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-300 border-orange-500 text-xs gap-1"
          >
            <Clock className="h-3 w-3" />
            {urgency.daysRemaining}d remaining
          </Badge>
        ) : isActive ? (
          <Badge variant="secondary" className="text-xs gap-1">
            <Clock className="h-3 w-3" />
            Pending
          </Badge>
        ) : null}
      </div>

      {/* Title (if present) */}
      {entry.title && (
        <h4 className={cn("font-semibold", compact ? "text-sm mb-1" : "mb-2")}>
          {entry.title}
        </h4>
      )}

      {/* Description (if present, truncated in compact mode) */}
      {entry.description && !compact && (
        <p className="text-sm text-muted-foreground mb-3">{entry.description}</p>
      )}

      {/* Dates Grid */}
      <dl className={cn("grid gap-2 text-sm", compact ? "grid-cols-3" : "gap-3 md:grid-cols-3")}>
        <div>
          <dt className="text-[10px] uppercase tracking-wider font-medium text-muted-foreground">
            Received
          </dt>
          <dd className="font-mono text-xs">{formatDate(entry.receivedDate)}</dd>
        </div>
        <div>
          <dt className="text-[10px] uppercase tracking-wider font-medium text-muted-foreground">
            Due
          </dt>
          <dd
            className={cn(
              "font-mono text-xs",
              (urgency.level === "urgent" || urgency.level === "overdue") &&
                !entry.responseSubmittedDate &&
                "text-red-600 dark:text-red-400 font-semibold",
              urgency.level === "soon" &&
                !entry.responseSubmittedDate &&
                "text-orange-600 dark:text-orange-400 font-semibold"
            )}
          >
            {formatDate(entry.responseDueDate)}
          </dd>
        </div>
        <div>
          <dt className="text-[10px] uppercase tracking-wider font-medium text-muted-foreground">
            Submitted
          </dt>
          <dd
            className={cn(
              "font-mono text-xs",
              entry.responseSubmittedDate && "text-emerald-600 dark:text-emerald-400 font-medium"
            )}
          >
            {formatDate(entry.responseSubmittedDate)}
          </dd>
        </div>
      </dl>

      {/* Notes (if present, only in non-compact) */}
      {entry.notes && !compact && (
        <div className="mt-3 pt-3 border-t border-border/50">
          <p className="text-xs text-muted-foreground">{entry.notes}</p>
        </div>
      )}
    </div>
  );
}

/**
 * Entry list with show more/collapse and pagination controls for many entries
 */
function EntryGroup({
  type,
  entries,
  activeCount,
}: {
  type: "RFI" | "RFE";
  entries: (RFIEntry | RFEEntry)[];
  activeCount: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const [page, setPage] = useState(0);

  const sorted = useMemo(() => sortEntries(entries), [entries]);
  const totalCount = sorted.length;
  const hasOverflow = totalCount > INITIAL_VISIBLE_COUNT;

  // In collapsed mode, show first N; in expanded, show all (paginated if > 6)
  const PAGINATE_THRESHOLD = 6;
  const usePagination = expanded && totalCount > PAGINATE_THRESHOLD;
  const PAGE_SIZE = 4;
  const totalPages = usePagination ? Math.ceil(totalCount / PAGE_SIZE) : 1;

  const visibleEntries = useMemo(() => {
    if (!expanded) {
      return sorted.slice(0, INITIAL_VISIBLE_COUNT);
    }
    if (usePagination) {
      const start = page * PAGE_SIZE;
      return sorted.slice(start, start + PAGE_SIZE);
    }
    return sorted;
  }, [sorted, expanded, usePagination, page]);

  // Reset page when expanding/collapsing
  useEffect(() => {
    if (!expanded) setPage(0);
  }, [expanded]);

  const fullLabel = type === "RFI"
    ? "Request for Information (RFI)"
    : "Request for Evidence (RFE)";

  const sourceLabel = type === "RFI" ? "DOL" : "USCIS";

  return (
    <div className="space-y-3">
      {/* Section Sub-Header */}
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
          {fullLabel}
          {totalCount > 0 && (
            <Badge
              variant={activeCount > 0 ? "destructive" : "secondary"}
              className="text-[10px] h-5 px-1.5"
            >
              {activeCount > 0
                ? `${activeCount} active`
                : `${totalCount} resolved`}
            </Badge>
          )}
        </h4>
        {hasOverflow && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded(!expanded)}
            className="h-7 text-xs gap-1 text-muted-foreground hover:text-foreground"
          >
            <ChevronsUpDown className="h-3 w-3" />
            {expanded ? "Show less" : `Show all ${totalCount}`}
          </Button>
        )}
      </div>

      {/* Entry Cards */}
      <div className="space-y-2">
        {visibleEntries.map((entry) => (
          <EntryCard
            key={entry.id}
            type={type}
            entry={entry}
            compact={expanded && usePagination}
          />
        ))}
      </div>

      {/* Collapsed overflow indicator */}
      {!expanded && hasOverflow && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className={cn(
            "w-full text-center py-2 text-xs text-muted-foreground",
            "border-2 border-dashed border-border hover:border-muted-foreground/50",
            "hover:bg-muted/50 transition-colors cursor-pointer"
          )}
        >
          +{totalCount - INITIAL_VISIBLE_COUNT} more {type}{totalCount - INITIAL_VISIBLE_COUNT !== 1 ? "s" : ""} from {sourceLabel}
        </button>
      )}

      {/* Pagination controls (for many entries) */}
      {usePagination && (
        <div className="flex items-center justify-between pt-1">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="h-7 text-xs gap-1 border-2"
          >
            <ChevronLeft className="h-3 w-3" />
            Prev
          </Button>
          <span className="text-xs text-muted-foreground font-mono">
            {page + 1} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            className="h-7 text-xs gap-1 border-2"
          >
            Next
            <ChevronRight className="h-3 w-3" />
          </Button>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function RFIRFESection({
  rfiEntries = [],
  rfeEntries = [],
  defaultOpen = true,
  accentColor,
}: RFIRFESectionProps) {
  const hasRfi = rfiEntries.length > 0;
  const hasRfe = rfeEntries.length > 0;
  const hasData = hasRfi || hasRfe;

  const activeRfiCount = rfiEntries.filter((e) => !e.responseSubmittedDate).length;
  const activeRfeCount = rfeEntries.filter((e) => !e.responseSubmittedDate).length;
  const totalActive = activeRfiCount + activeRfeCount;
  const totalCount = rfiEntries.length + rfeEntries.length;

  // Preview summary for collapsed state
  const preview = useMemo(() => {
    if (!hasData) return undefined;
    if (totalActive > 0) return `${totalActive} active`;
    return `${totalCount} resolved`;
  }, [hasData, totalActive, totalCount]);

  // Title with count badge
  const titleNode = useMemo(() => {
    if (totalCount === 0) return "RFI / RFE";
    return `RFI / RFE`;
  }, [totalCount]);

  return (
    <CaseDetailSection
      title={titleNode}
      icon={
        <div className="relative">
          <AlertTriangle className="h-5 w-5" />
          {totalCount > 0 && (
            <span
              className={cn(
                "absolute -top-1.5 -right-2 min-w-[16px] h-4 px-1 rounded-full text-[10px] font-bold flex items-center justify-center",
                totalActive > 0
                  ? "bg-red-500 text-white"
                  : "bg-muted-foreground/20 text-muted-foreground"
              )}
            >
              {totalCount}
            </span>
          )}
        </div>
      }
      defaultOpen={defaultOpen}
      preview={preview}
      accentColor={accentColor}
    >
      {hasData ? (
        <div className="space-y-5">
          {/* RFI Section */}
          {hasRfi && (
            <EntryGroup
              type="RFI"
              entries={rfiEntries}
              activeCount={activeRfiCount}
            />
          )}

          {/* Separator between RFI and RFE */}
          {hasRfi && hasRfe && (
            <div className="border-t border-border/50" />
          )}

          {/* RFE Section */}
          {hasRfe && (
            <EntryGroup
              type="RFE"
              entries={rfeEntries}
              activeCount={activeRfeCount}
            />
          )}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground italic">
          No RFI or RFE entries.
        </p>
      )}
    </CaseDetailSection>
  );
}
