/**
 * DemoCaseCard Component
 *
 * Neobrutalist case card matching the real product's visual identity.
 * Stage-colored left border, bold typography, urgency indicators,
 * and hard shadow hover effects.
 */

"use client";

import { useMemo } from "react";
import { Pencil, Trash2, Star } from "lucide-react";
import { ProgressStatusBadge } from "@/components/status/progress-status-badge";
import { getUrgencyFromDeadline, getUrgencyDotClass } from "@/lib/status";
import type { DemoCase } from "@/lib/demo";
import type { CaseStatus } from "@/lib/perm";

interface DemoCaseCardProps {
  case: DemoCase;
  onEdit: () => void;
  onDelete: () => void;
}

const STAGE_COLORS: Record<CaseStatus, string> = {
  pwd: "var(--stage-pwd)",
  recruitment: "var(--stage-recruitment)",
  eta9089: "var(--stage-eta9089)",
  i140: "var(--stage-i140)",
  closed: "var(--stage-closed)",
};

const STAGE_BG_CLASSES: Record<CaseStatus, string> = {
  pwd: "bg-stage-pwd",
  recruitment: "bg-stage-recruitment",
  eta9089: "bg-stage-eta9089",
  i140: "bg-stage-i140",
  closed: "bg-stage-closed",
};

const STAGE_LABELS: Record<CaseStatus, string> = {
  pwd: "PWD",
  recruitment: "Recruitment",
  eta9089: "ETA 9089",
  i140: "I-140",
  closed: "Closed",
};

function getNextDeadline(caseData: DemoCase): { date: string; label: string } | null {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const deadlines: { date: string; label: string }[] = [];

  if (caseData.rfiDueDate && !caseData.rfiSubmittedDate) {
    deadlines.push({ date: caseData.rfiDueDate, label: "RFI Due" });
  }
  if (caseData.rfeDueDate && !caseData.rfeSubmittedDate) {
    deadlines.push({ date: caseData.rfeDueDate, label: "RFE Due" });
  }
  if (caseData.pwdExpirationDate) {
    deadlines.push({ date: caseData.pwdExpirationDate, label: "PWD Expires" });
  }
  if (caseData.jobOrderEndDate) {
    deadlines.push({ date: caseData.jobOrderEndDate, label: "Job Order Ends" });
  }
  if (caseData.noticeOfFilingEndDate) {
    deadlines.push({ date: caseData.noticeOfFilingEndDate, label: "NOF Ends" });
  }
  if (caseData.eta9089ExpirationDate) {
    deadlines.push({ date: caseData.eta9089ExpirationDate, label: "ETA Expires" });
  }

  const upcoming = deadlines
    .filter((d) => new Date(d.date) >= today)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return upcoming[0] || null;
}

function formatDeadline(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getDaysUntil(dateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

export function DemoCaseCard({ case: caseData, onEdit, onDelete }: DemoCaseCardProps) {
  const isClosed = caseData.status === "closed";
  const stageColor = STAGE_COLORS[caseData.status];
  const stageBgClass = STAGE_BG_CLASSES[caseData.status];
  const stageLabel = STAGE_LABELS[caseData.status];

  const nextDeadline = useMemo(() => getNextDeadline(caseData), [caseData]);
  const urgency = useMemo(
    () => (nextDeadline ? getUrgencyFromDeadline(nextDeadline.date) : null),
    [nextDeadline]
  );
  const daysUntil = useMemo(
    () => (nextDeadline ? getDaysUntil(nextDeadline.date) : null),
    [nextDeadline]
  );

  const hasActiveRfi = Boolean(caseData.rfiDueDate && !caseData.rfiSubmittedDate);
  const hasActiveRfe = Boolean(caseData.rfeDueDate && !caseData.rfeSubmittedDate);

  return (
    <div
      className="group relative border-3 border-border bg-background overflow-hidden shadow-hard transition-all duration-200 hover:-translate-x-1 hover:-translate-y-1 hover:shadow-hard-lg"
      style={{ borderLeftWidth: "6px", borderLeftColor: stageColor }}
    >
      {/* Stage header bar */}
      <div className="flex items-center justify-between border-b-2 border-border px-4 py-2.5">
        <div className="flex items-center gap-2">
          {/* Stage badge */}
          <span
            className={`inline-flex items-center px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-black ${stageBgClass}`}
          >
            {stageLabel}
          </span>

          {/* Professional badge */}
          {caseData.isProfessionalOccupation && (
            <span className="inline-flex items-center border-2 border-border bg-muted px-1.5 py-0 text-[10px] font-bold">
              PRO
            </span>
          )}

          {/* RFI/RFE badges */}
          {hasActiveRfi && (
            <span className="inline-flex items-center bg-urgency-urgent px-1.5 py-0 text-[10px] font-bold text-white">
              RFI
            </span>
          )}
          {hasActiveRfe && (
            <span className="inline-flex items-center bg-urgency-urgent px-1.5 py-0 text-[10px] font-bold text-white">
              RFE
            </span>
          )}
        </div>

        {/* Favorite star */}
        {caseData.isFavorite && (
          <Star className="h-3.5 w-3.5 fill-primary text-primary" />
        )}
      </div>

      {/* Card body */}
      <div className="p-4">
        {/* Names */}
        <h3 className="truncate font-heading text-base font-bold leading-tight">
          {caseData.beneficiaryName}
        </h3>
        <p className="truncate text-sm text-muted-foreground">
          {caseData.employerName}
        </p>

        {/* Progress Status */}
        {!isClosed && (
          <div className="mt-3">
            <ProgressStatusBadge status={caseData.progressStatus} />
          </div>
        )}

        {/* Next Deadline */}
        <div className="mt-3 border-t-2 border-dashed border-border pt-3">
          {!isClosed && nextDeadline ? (
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <div
                  className={`h-3 w-3 shrink-0 border border-border ${
                    urgency ? getUrgencyDotClass(urgency) : ""
                  }`}
                />
                <span className="truncate font-mono text-xs font-medium">
                  {nextDeadline.label}
                </span>
              </div>
              <div className="shrink-0 text-right">
                <div className="font-mono text-xs font-bold">
                  {formatDeadline(nextDeadline.date)}
                </div>
                {daysUntil !== null && (
                  <div className="text-[10px] text-muted-foreground">
                    {daysUntil === 0
                      ? "Today"
                      : daysUntil === 1
                        ? "Tomorrow"
                        : `${daysUntil} days`}
                  </div>
                )}
              </div>
            </div>
          ) : !isClosed ? (
            <span className="text-xs text-muted-foreground">No upcoming deadlines</span>
          ) : (
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 shrink-0 bg-stage-closed border border-border" />
              <span className="font-mono text-xs text-muted-foreground">
                Case complete
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex border-t-2 border-border">
        <button
          type="button"
          className="flex flex-1 items-center justify-center gap-1.5 py-2.5 text-xs font-bold uppercase tracking-wider transition-colors hover:bg-muted"
          onClick={(e) => {
            e.stopPropagation();
            onEdit();
          }}
        >
          <Pencil className="h-3 w-3" />
          Edit
        </button>
        <div className="w-px bg-border" />
        <button
          type="button"
          className="flex items-center justify-center px-4 py-2.5 text-xs text-muted-foreground transition-colors hover:bg-urgency-urgent/10 hover:text-urgency-urgent"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          aria-label="Delete case"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}
