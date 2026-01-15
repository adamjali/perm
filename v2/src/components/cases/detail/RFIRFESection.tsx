"use client";

import * as React from "react";
import { AlertTriangle, CheckCircle2, Clock } from "lucide-react";
import { CaseDetailSection } from "./CaseDetailSection";
import { Badge } from "@/components/ui/badge";
import { formatISODate } from "@/lib/utils/date";
import { differenceInDays } from "date-fns";
import { cn } from "@/lib/utils";
import type { RFIEntry, RFEEntry } from "@/lib/shared/types";

// Re-export types for consumers of this module
export type { RFIEntry, RFEEntry } from "@/lib/shared/types";

export interface RFIRFESectionProps {
  /**
   * RFI entries (DOL requests during ETA 9089)
   */
  rfiEntries?: RFIEntry[];

  /**
   * RFE entries (USCIS requests during I-140)
   */
  rfeEntries?: RFEEntry[];

  /**
   * Whether section is initially expanded
   */
  defaultOpen?: boolean;
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Format date for display, returning "-" if empty
 */
function formatDate(isoDate: string | undefined): string {
  if (!isoDate) return "-";
  return formatISODate(isoDate);
}

/**
 * Get urgency level based on due date and submission status
 */
function getUrgency(
  dueDate: string | undefined,
  submittedDate: string | undefined
): {
  level: "completed" | "urgent" | "soon" | "normal";
  daysRemaining?: number;
} {
  if (submittedDate) {
    return { level: "completed" };
  }

  if (!dueDate) {
    return { level: "normal" };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const deadline = new Date(dueDate + "T00:00:00");
  const daysRemaining = differenceInDays(deadline, today);

  if (daysRemaining <= 7) {
    return { level: "urgent", daysRemaining };
  }
  if (daysRemaining <= 30) {
    return { level: "soon", daysRemaining };
  }
  return { level: "normal", daysRemaining };
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

interface EntryCardProps {
  type: "RFI" | "RFE";
  entry: RFIEntry | RFEEntry;
}

function EntryCard({ type, entry }: EntryCardProps) {
  const urgency = getUrgency(entry.responseDueDate, entry.responseSubmittedDate);
  const isActive = !entry.responseSubmittedDate && !!entry.receivedDate;

  return (
    <div
      className={cn(
        "rounded-lg border-2 p-4 shadow-hard-sm",
        urgency.level === "completed"
          ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30"
          : urgency.level === "urgent"
            ? "border-red-600 bg-red-50 dark:bg-red-950/30"
            : urgency.level === "soon"
              ? "border-orange-500 bg-orange-50 dark:bg-orange-950/30"
              : "border-border bg-background"
      )}
    >
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          {/* Type Badge */}
          <Badge
            variant={type === "RFI" ? "secondary" : "outline"}
            className="font-semibold"
          >
            {type}
          </Badge>

          {/* Status Badge */}
          {urgency.level === "completed" ? (
            <Badge
              variant="secondary"
              className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300 border-emerald-500"
            >
              <CheckCircle2 className="h-3 w-3 mr-1" />
              Submitted
            </Badge>
          ) : isActive && urgency.level === "urgent" ? (
            <Badge
              variant="destructive"
            >
              <AlertTriangle className="h-3 w-3 mr-1" />
              Urgent - {urgency.daysRemaining} day{urgency.daysRemaining !== 1 ? "s" : ""}
            </Badge>
          ) : isActive && urgency.level === "soon" ? (
            <Badge
              variant="secondary"
              className="bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-300 border-orange-500"
            >
              <Clock className="h-3 w-3 mr-1" />
              Due Soon - {urgency.daysRemaining} days
            </Badge>
          ) : isActive ? (
            <Badge variant="secondary">
              <Clock className="h-3 w-3 mr-1" />
              Pending
            </Badge>
          ) : null}
        </div>
      </div>

      {/* Title */}
      {entry.title && (
        <h4 className="font-semibold mb-2">{entry.title}</h4>
      )}

      {/* Description */}
      {entry.description && (
        <p className="text-sm text-muted-foreground mb-3">{entry.description}</p>
      )}

      {/* Dates */}
      <dl className="grid gap-2 text-sm md:grid-cols-3">
        <div>
          <dt className="font-medium text-muted-foreground">Received</dt>
          <dd>{formatDate(entry.receivedDate)}</dd>
        </div>
        <div>
          <dt className="font-medium text-muted-foreground">Due</dt>
          <dd
            className={cn(
              urgency.level === "urgent" && !entry.responseSubmittedDate && "text-red-600 font-semibold",
              urgency.level === "soon" && !entry.responseSubmittedDate && "text-orange-600 font-semibold"
            )}
          >
            {formatDate(entry.responseDueDate)}
          </dd>
        </div>
        <div>
          <dt className="font-medium text-muted-foreground">Submitted</dt>
          <dd className={entry.responseSubmittedDate ? "text-emerald-600 font-medium" : ""}>
            {formatDate(entry.responseSubmittedDate)}
          </dd>
        </div>
      </dl>

      {/* Notes */}
      {entry.notes && (
        <div className="mt-3 pt-3 border-t border-border/50">
          <p className="text-sm text-muted-foreground">{entry.notes}</p>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

/**
 * RFIRFESection Component
 *
 * Read-only display section for RFI and RFE entries.
 *
 * Features:
 * - Lists all RFI entries (DOL requests during ETA 9089 review)
 * - Lists all RFE entries (USCIS requests during I-140 review)
 * - Status badges (Pending/Submitted)
 * - Urgency colors based on due date:
 *   - Red: <= 7 days
 *   - Orange: 8-30 days
 *   - Green: > 30 days or submitted
 * - Response dates
 *
 * @example
 * ```tsx
 * <RFIRFESection
 *   rfiEntries={[
 *     {
 *       id: "rfi-1",
 *       title: "Clarification on job duties",
 *       receivedDate: "2024-05-01",
 *       responseDueDate: "2024-05-31",
 *       responseSubmittedDate: "2024-05-15",
 *       createdAt: Date.now(),
 *     }
 *   ]}
 *   rfeEntries={[]}
 * />
 * ```
 */
export function RFIRFESection({
  rfiEntries = [],
  rfeEntries = [],
  defaultOpen = true,
}: RFIRFESectionProps) {
  const hasRfi = rfiEntries.length > 0;
  const hasRfe = rfeEntries.length > 0;
  const hasData = hasRfi || hasRfe;

  // Count active entries
  const activeRfiCount = rfiEntries.filter(e => !e.responseSubmittedDate).length;
  const activeRfeCount = rfeEntries.filter(e => !e.responseSubmittedDate).length;

  return (
    <CaseDetailSection
      title="RFI / RFE"
      icon={<AlertTriangle className="h-5 w-5" />}
      defaultOpen={defaultOpen}
    >
      {hasData ? (
        <div className="space-y-6">
          {/* RFI Section */}
          {hasRfi && (
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                Request for Information (RFI)
                {activeRfiCount > 0 && (
                  <Badge variant="destructive" className="text-xs">
                    {activeRfiCount} Active
                  </Badge>
                )}
              </h4>
              <div className="space-y-3">
                {rfiEntries.map((entry) => (
                  <EntryCard key={entry.id} type="RFI" entry={entry} />
                ))}
              </div>
            </div>
          )}

          {/* RFE Section */}
          {hasRfe && (
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                Request for Evidence (RFE)
                {activeRfeCount > 0 && (
                  <Badge variant="destructive" className="text-xs">
                    {activeRfeCount} Active
                  </Badge>
                )}
              </h4>
              <div className="space-y-3">
                {rfeEntries.map((entry) => (
                  <EntryCard key={entry.id} type="RFE" entry={entry} />
                ))}
              </div>
            </div>
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
