/**
 * DemoCaseCard Component
 *
 * Simplified case card for the demo page.
 * Displays case information with neobrutalist styling.
 *
 * Features:
 * - Stage color header (full width)
 * - Beneficiary and employer names
 * - Progress status badge
 * - Next deadline with urgency indicator
 * - PRO/RFI/RFE badges when applicable
 * - Edit and Delete action buttons
 *
 */

"use client";

import { useMemo } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ProgressStatusBadge } from "@/components/status/progress-status-badge";
import { getUrgencyFromDeadline, getUrgencyDotClass } from "@/lib/status";
import type { DemoCase } from "@/lib/demo";
import type { CaseStatus } from "@/lib/perm";

interface DemoCaseCardProps {
  case: DemoCase;
  onEdit: () => void;
  onDelete: () => void;
}

/**
 * Stage color CSS variables
 */
const STAGE_COLORS: Record<CaseStatus, string> = {
  pwd: "bg-stage-pwd",
  recruitment: "bg-stage-recruitment",
  eta9089: "bg-stage-eta9089",
  i140: "bg-stage-i140",
  closed: "bg-stage-closed",
};

/**
 * Stage labels for display
 */
const STAGE_LABELS: Record<CaseStatus, string> = {
  pwd: "PWD",
  recruitment: "Recruitment",
  eta9089: "ETA 9089",
  i140: "I-140",
  closed: "Closed",
};

// Note: getUrgencyFromDeadline and getUrgencyDotClass are imported from @/lib/status

/**
 * Get the next relevant deadline from a case
 */
function getNextDeadline(caseData: DemoCase): { date: string; label: string } | null {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const deadlines: { date: string; label: string }[] = [];

  // RFI due date (highest priority)
  if (caseData.rfiDueDate && !caseData.rfiSubmittedDate) {
    deadlines.push({ date: caseData.rfiDueDate, label: "RFI Due" });
  }

  // RFE due date
  if (caseData.rfeDueDate && !caseData.rfeSubmittedDate) {
    deadlines.push({ date: caseData.rfeDueDate, label: "RFE Due" });
  }

  // PWD expiration
  if (caseData.pwdExpirationDate) {
    deadlines.push({ date: caseData.pwdExpirationDate, label: "PWD Expires" });
  }

  // Job order end
  if (caseData.jobOrderEndDate) {
    deadlines.push({ date: caseData.jobOrderEndDate, label: "Job Order Ends" });
  }

  // Notice of filing end
  if (caseData.noticeOfFilingEndDate) {
    deadlines.push({ date: caseData.noticeOfFilingEndDate, label: "NOF Ends" });
  }

  // ETA 9089 expiration
  if (caseData.eta9089ExpirationDate) {
    deadlines.push({ date: caseData.eta9089ExpirationDate, label: "ETA Expires" });
  }

  // Filter to future deadlines and sort by date
  const upcoming = deadlines
    .filter((d) => new Date(d.date) >= today)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return upcoming[0] || null;
}

/**
 * Format deadline for display
 */
function formatDeadline(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function DemoCaseCard({ case: caseData, onEdit, onDelete }: DemoCaseCardProps) {
  const isClosed = caseData.status === "closed";
  const stageColor = STAGE_COLORS[caseData.status];
  const stageLabel = STAGE_LABELS[caseData.status];

  // Calculate next deadline
  const nextDeadline = useMemo(() => getNextDeadline(caseData), [caseData]);
  const urgency = useMemo(
    () => (nextDeadline ? getUrgencyFromDeadline(nextDeadline.date) : null),
    [nextDeadline]
  );

  // Check for active RFI/RFE
  const hasActiveRfi = Boolean(caseData.rfiDueDate && !caseData.rfiSubmittedDate);
  const hasActiveRfe = Boolean(caseData.rfeDueDate && !caseData.rfeSubmittedDate);

  return (
    <Card className="relative overflow-hidden transition-all duration-150 hover:-translate-y-1">
      {/* Stage Color Header */}
      <div className={`h-2 w-full ${stageColor}`} />

      <CardContent className="pt-4">
        {/* Header with stage badge */}
        <div className="mb-3 flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            {/* Beneficiary Name */}
            <h3 className="truncate font-heading text-base font-bold leading-tight">
              {caseData.beneficiaryName}
            </h3>
            {/* Employer Name */}
            <p className="truncate text-sm text-muted-foreground">
              {caseData.employerName}
            </p>
          </div>

          {/* Stage Badge */}
          <Badge
            variant="outline"
            className="shrink-0 px-2 py-0.5 text-[10px] font-bold"
          >
            {stageLabel}
          </Badge>
        </div>

        {/* Badges Row */}
        <div className="mb-3 flex flex-wrap items-center gap-1.5">
          {/* Professional Occupation */}
          {caseData.isProfessionalOccupation && (
            <Badge
              variant="outline"
              className="bg-gray-200 px-1.5 py-0 text-[10px] font-bold text-black"
            >
              PRO
            </Badge>
          )}

          {/* RFI Active */}
          {hasActiveRfi && (
            <Badge
              variant="outline"
              className="bg-urgency-urgent px-1.5 py-0 text-[10px] font-bold text-white"
            >
              RFI
            </Badge>
          )}

          {/* RFE Active */}
          {hasActiveRfe && (
            <Badge
              variant="outline"
              className="bg-urgency-urgent px-1.5 py-0 text-[10px] font-bold text-white"
            >
              RFE
            </Badge>
          )}
        </div>

        {/* Progress Status */}
        {!isClosed && (
          <div className="mb-3">
            <ProgressStatusBadge status={caseData.progressStatus} />
          </div>
        )}

        {/* Next Deadline */}
        {!isClosed && nextDeadline ? (
          <div className="flex items-center gap-2">
            <div
              className={`h-2.5 w-2.5 shrink-0 ${
                urgency ? getUrgencyDotClass(urgency) : ""
              }`}
            />
            <span className="font-mono text-xs">
              {nextDeadline.label}: {formatDeadline(nextDeadline.date)}
            </span>
          </div>
        ) : !isClosed ? (
          <span className="text-xs text-muted-foreground">No upcoming deadlines</span>
        ) : (
          <span className="text-xs italic text-muted-foreground">Case closed</span>
        )}
      </CardContent>

      {/* Action Buttons */}
      <CardFooter className="gap-2 border-t border-border pt-4">
        <Button
          variant="outline"
          size="sm"
          className="flex-1 gap-1.5"
          onClick={(e) => {
            e.stopPropagation();
            onEdit();
          }}
        >
          <Pencil className="size-3.5" />
          Edit
        </Button>
        <Button
          variant="outline"
          size="icon-sm"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          aria-label="Delete case"
        >
          <Trash2 className="size-3.5" />
        </Button>
      </CardFooter>
    </Card>
  );
}
