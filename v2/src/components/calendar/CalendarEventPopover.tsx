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
 * - Neobrutalist styling (shadow-hard-lg, border-2, no radius)
 *
 * Phase: 23.1 (Calendar UI)
 * Created: 2025-12-28
 */

"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "convex/react";
import { motion } from "motion/react";
import { Calendar, Eye, EyeOff, ExternalLink } from "lucide-react";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
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

// ============================================================================
// Animation Constants
// ============================================================================

/**
 * Stagger animation for content items
 */
const contentItemVariants = {
  hidden: { opacity: 0, x: -8 },
  visible: (i: number) => ({
    opacity: 1,
    x: 0,
    transition: {
      delay: i * 0.05,
      duration: 0.15,
    },
  }),
};

// ============================================================================
// Constants
// ============================================================================

/**
 * Case status display labels and colors
 */
const CASE_STATUS_CONFIG: Record<
  CaseStatus,
  { label: string; color: string }
> = {
  pwd: { label: "PWD", color: "#0066FF" },
  recruitment: { label: "Recruitment", color: "#9333ea" },
  eta9089: { label: "ETA 9089", color: "#D97706" },
  i140: { label: "I-140", color: "#059669" },
  closed: { label: "Closed", color: "#6B7280" },
};

/**
 * Urgency text labels for popover display
 */
const URGENCY_LABELS: Record<Urgency, string> = {
  overdue: "Overdue",
  urgent: "Urgent",
  soon: "Coming Soon",
  normal: "On Track",
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
        className="border-2 font-semibold"
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
 * Renders the case status badge with stage colors
 */
function CaseStatusBadge({ status }: { status: CaseStatus }) {
  const config = CASE_STATUS_CONFIG[status];

  return (
    <Badge
      variant="default"
      className="border-2 font-semibold"
      style={{
        backgroundColor: config.color,
        borderColor: "#1a1a1a",
        color: "#ffffff",
      }}
    >
      {config.label}
    </Badge>
  );
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

  // Don't render if no event
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
      console.error("Failed to hide case from calendar:", error);
    } finally {
      setIsHiding(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="sm:max-w-md border-2 border-border shadow-hard-lg p-0 gap-0"
        showCloseButton={true}
      >
        {/* Header with stage color accent */}
        <div
          className="border-b-2 border-border p-4"
          style={{ backgroundColor: `${stageColor}15` }}
        >
          <DialogHeader className="gap-1">
            <div className="flex items-center gap-2">
              <Calendar
                className="size-5"
                style={{ color: stageColor }}
                aria-hidden="true"
              />
              <DialogTitle className="font-['Space_Grotesk'] text-lg">
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
          <motion.div
            custom={0}
            variants={contentItemVariants}
            initial="hidden"
            animate="visible"
          >
            <UrgencyBadge urgency={event.urgency} daysUntil={event.daysUntil} />
          </motion.div>

          {/* Case details */}
          <div className="space-y-3">
            {/* Case status badge */}
            {caseData && (
              <motion.div
                custom={1}
                variants={contentItemVariants}
                initial="hidden"
                animate="visible"
                className="flex items-center gap-2"
              >
                <span className="text-sm text-muted-foreground w-20">Status:</span>
                <CaseStatusBadge status={caseData.caseStatus} />
              </motion.div>
            )}

            {/* Employer */}
            {caseData && (
              <motion.div
                custom={2}
                variants={contentItemVariants}
                initial="hidden"
                animate="visible"
                className="flex items-start gap-2"
              >
                <span className="text-sm text-muted-foreground w-20 shrink-0">
                  Employer:
                </span>
                <span className="text-sm font-semibold text-foreground">
                  {caseData.employerName}
                </span>
              </motion.div>
            )}

            {/* Foreign Worker */}
            {caseData && (
              <motion.div
                custom={3}
                variants={contentItemVariants}
                initial="hidden"
                animate="visible"
                className="flex items-start gap-2"
              >
                <span className="text-sm text-muted-foreground w-20 shrink-0">
                  Foreign Worker:
                </span>
                <span className="text-sm font-semibold text-foreground">
                  {caseData.beneficiaryIdentifier}
                </span>
              </motion.div>
            )}

            {/* Position */}
            {caseData && (
              <motion.div
                custom={4}
                variants={contentItemVariants}
                initial="hidden"
                animate="visible"
                className="flex items-start gap-2"
              >
                <span className="text-sm text-muted-foreground w-20 shrink-0">
                  Position:
                </span>
                <span className="text-sm font-semibold text-foreground">
                  {caseData.positionTitle}
                </span>
              </motion.div>
            )}

            {/* Filing window indicator */}
            {event.isFilingWindow && (
              <motion.div
                custom={5}
                variants={contentItemVariants}
                initial="hidden"
                animate="visible"
                className="flex items-center gap-2 p-2 bg-muted border-2 border-border"
              >
                <Eye className="size-4 text-primary" aria-hidden="true" />
                <span className="text-xs font-medium text-foreground">
                  Filing Window Deadline
                </span>
              </motion.div>
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
            className="text-muted-foreground hover:text-destructive"
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
            <ExternalLink className="size-4" aria-hidden="true" />
            <span>View Case</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default CalendarEventPopover;
