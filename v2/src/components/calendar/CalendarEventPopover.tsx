"use client";

// `convex/react` is a CLIENT-ONLY module: its hooks reach `React.createContext`,
// which exists only in React's client build. Declared here rather
// than inherited from whichever importer happened to cross a boundary first.
// Without it this module works until the chunk graph shifts, then fails with
// `TypeError: (0 , d.createContext) is not a function` naming webpack bootstrap
// and no source file. See components/layout/Footer.tsx.

/**
 * CalendarEventPopover Component
 *
 * Displays detailed event information in a dialog triggered by clicking on
 * a calendar event. Uses Dialog for touch-friendly accessibility.
 *
 * Features:
 * - Full event details (deadline type, employer, beneficiary, position)
 * - Case status badge with stage colors
 * - Days until deadline with urgency coloring
 * - "View Case" navigation button
 * - "Hide from Calendar" option
 * - Keyboard accessible (Enter opens, Escape closes)
 */

"use client";

import * as React from "react";
import { CaseStageBadge } from "@/components/status/case-stage-badge";
import { useRouter } from "next/navigation";
import { useMutation } from "convex/react";
import { ArrowSquareOutIcon, CalendarIcon, EyeIcon, EyeSlashIcon as EyeOff } from "@phosphor-icons/react/ssr";

import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  type CalendarEvent,
  type Urgency,
  DEADLINE_TYPE_LABELS,
  STAGE_COLORS,
  URGENCY_COLORS,
} from "@/lib/calendar/types";
import type { CaseStatus } from "@/lib/perm";
import { handleOperationError } from "@/lib/errors";

// ============================================================================
// Constants
// ============================================================================


/**
 * Urgency text labels for popover display
 */
const URGENCY_LABELS: Record<Urgency, string> = {
  overdue: "Overdue",
  urgent: "Urgent",
  soon: "Coming soon",
  normal: "On track",
  done: "Done",
};

// ============================================================================
// Types
// ============================================================================

interface CalendarEventPopoverProps {
  /** The selected calendar event to display */
  event: CalendarEvent | null;
  /** Whether the popover is open */
  isOpen: boolean;
  /** Callback to close the popover */
  onClose: () => void;
  /** Current hidden cases list (for updating preferences) */
  hiddenCases?: Id<"cases">[];
  /** Additional case data for display */
  caseData?: {
    employerName: string;
    beneficiaryIdentifier: string;
    positionTitle: string;
    caseStatus: CaseStatus;
  };
}

// ============================================================================
// Helper Components
// ============================================================================

/**
 * Renders the urgency badge with appropriate coloring
 */
function UrgencyBadge({ urgency, daysUntil }: { urgency: Urgency; daysUntil: number }) {
  const color = URGENCY_COLORS[urgency];
  const label = URGENCY_LABELS[urgency];

  // Format the days text
  let daysText: string;
  if (daysUntil < 0) {
    daysText = `${Math.abs(daysUntil)} days ago`;
  } else if (daysUntil === 0) {
    daysText = "Today";
  } else if (daysUntil === 1) {
    daysText = "Tomorrow";
  } else {
    daysText = `${daysUntil} days`;
  }

  return (
    <div className="flex items-center gap-2">
      <Badge
        variant="outline"
        className="font-semibold border"
        style={{
          color: color,
          borderColor: color,
          backgroundColor: `${color}10`,
        }}
      >
        {label}
      </Badge>
      <span
        className="text-sm font-bold"
        style={{ color: color }}
      >
        {daysText}
      </span>
    </div>
  );
}

/**
 * The case's stage, drawn by the shared badge (fill and readable ink from the
 * stage map; this used to put white on every colour, amber and teal included).
 */
function CaseStatusBadge({ status }: { status: CaseStatus }) {
  return <CaseStageBadge stage={status} />;
}

// ============================================================================
// Main Component
// ============================================================================

export function CalendarEventPopover({
  event,
  isOpen,
  onClose,
  hiddenCases = [],
  caseData,
}: CalendarEventPopoverProps) {
  const router = useRouter();
  const updatePreferences = useMutation(api.calendar.updateCalendarPreferences);
  const [isHiding, setIsHiding] = React.useState(false);

  // Don’t render if no event
  if (!event) {
    return null;
  }

  // Get display values
  const deadlineLabel = DEADLINE_TYPE_LABELS[event.deadlineType] ?? event.deadlineType;
  const stageColor = STAGE_COLORS[event.stage] ?? "#6B7280";
  const eventDate = event.start.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  /**
   * Navigate to the case detail page
   */
  const handleViewCase = () => {
    router.push(`/cases/${event.caseId}`);
    onClose();
  };

  /**
   * Hide this case from the calendar
   */
  const handleHideCase = async () => {
    setIsHiding(true);
    try {
      const newHiddenCases = [...hiddenCases, event.caseId];
      await updatePreferences({
        hiddenCases: newHiddenCases,
      });
      onClose();
    } catch (error) {
      handleOperationError(error, {
        userMessage: "Couldn’t hide the case from the calendar. Try again.",
      });
    } finally {
      setIsHiding(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="sm:max-w-md border-border p-0 gap-0 shadow-hard-lg"
        showCloseButton={true}
      >
        {/* Header with stage color accent */}
        <div
          className="border-b-2 border-border p-4"
          style={{ backgroundColor: `${stageColor}15` }}
        >
          <DialogHeader className="gap-1">
            <div className="flex items-center gap-2">
              <CalendarIcon
                className="size-5"
                style={{ color: stageColor }}
                aria-hidden="true"
              />
              <DialogTitle>
                {deadlineLabel}
              </DialogTitle>
            </div>
            <DialogDescription className="text-sm text-muted-foreground">
              {eventDate}
            </DialogDescription>
          </DialogHeader>
        </div>

        {/* Content with staggered animations */}
        <div className="p-4 space-y-4">
          {/* Urgency indicator */}
          <div
          >
            <UrgencyBadge urgency={event.urgency} daysUntil={event.daysUntil} />
          </div>

          {/* Case details */}
          <div className="space-y-3">
            {/* Case status badge */}
            {caseData && (
              <div
                className="flex items-center gap-2"
              >
                <span className="text-sm text-muted-foreground w-20">Status:</span>
                <CaseStatusBadge status={caseData.caseStatus} />
              </div>
            )}

            {/* Employer */}
            {caseData && (
              <div
                className="flex items-start gap-2"
              >
                <span className="text-sm text-muted-foreground w-20 shrink-0">
                  Employer:
                </span>{" "}
                <span className="text-sm font-semibold text-foreground truncate" title={caseData.employerName}>
                  {caseData.employerName}
                </span>
              </div>
            )}

            {/* Foreign Worker */}
            {caseData && (
              <div
                className="flex items-start gap-2"
              >
                <span className="text-sm text-muted-foreground w-20 shrink-0">
                  Foreign Worker:
                </span>{" "}
                <span className="text-sm font-semibold text-foreground truncate" title={caseData.beneficiaryIdentifier}>
                  {caseData.beneficiaryIdentifier}
                </span>
              </div>
            )}

            {/* Position */}
            {caseData && (
              <div
                className="flex items-start gap-2"
              >
                <span className="text-sm text-muted-foreground w-20 shrink-0">
                  Position:
                </span>{" "}
                <span className="text-sm font-semibold text-foreground truncate" title={caseData.positionTitle}>
                  {caseData.positionTitle}
                </span>
              </div>
            )}

            {/* Filing window indicator */}
            {event.isFilingWindow && (
              <div
                className="flex items-center gap-2 p-2 bg-tint border-2 border-border"
              >
                <EyeIcon className="size-4 text-primary" aria-hidden="true" />
                <span className="text-sm font-medium text-foreground">
                  Filing window deadline
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Footer with actions */}
        <DialogFooter className="border-t-2 border-border p-4 gap-2 sm:gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleHideCase}
            disabled={isHiding}
            loading={isHiding}
            loadingText="Hiding..."
            className="text-muted-foreground hover:text-destructive-text"
          >
            <EyeOff className="size-4" aria-hidden="true" />
            <span>Hide from Calendar</span>
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={handleViewCase}
            className="bg-primary hover:bg-primary/90"
          >
            <ArrowSquareOutIcon className="size-4" aria-hidden="true" />
            <span>View case</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
