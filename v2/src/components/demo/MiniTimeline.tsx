/**
 * MiniTimeline Component
 *
 * Vertical list of cases with progress bars showing stage completion.
 * Compact styling for grid cell display.
 *
 * Features:
 * - Progress bar (width based on stage completion %)
 * - Status badge for current stage
 * - Stage color for progress bar
 * - Max 5 items shown (sorted by nearest deadline)
 * - Dark mode support
 *
 */

"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { DemoCase } from "@/lib/demo";
import type { CaseStatus, ProgressStatus } from "@/lib/perm";

interface MiniTimelineProps {
  cases: DemoCase[];
}

/**
 * Progress percentage mapping based on case status and progress
 * Represents overall completion through the PERM process
 */
const STATUS_PROGRESS: Record<string, number> = {
  // PWD Stage (0-20%)
  "pwd:working": 5,
  "pwd:waiting_intake": 8,
  "pwd:filed": 12,
  "pwd:under_review": 15,
  "pwd:rfi_rfe": 14,
  "pwd:approved": 20,

  // Recruitment Stage (20-40%)
  "recruitment:working": 25,
  "recruitment:waiting_intake": 28,
  "recruitment:filed": 32,
  "recruitment:under_review": 35,
  "recruitment:rfi_rfe": 34,
  "recruitment:approved": 40,

  // ETA 9089 Stage (40-70%)
  "eta9089:working": 45,
  "eta9089:waiting_intake": 48,
  "eta9089:filed": 55,
  "eta9089:under_review": 60,
  "eta9089:rfi_rfe": 58,
  "eta9089:approved": 70,

  // I-140 Stage (70-100%)
  "i140:working": 75,
  "i140:waiting_intake": 78,
  "i140:filed": 85,
  "i140:under_review": 90,
  "i140:rfi_rfe": 88,
  "i140:approved": 100,

  // Closed (could be at any stage)
  "closed:working": 0,
  "closed:waiting_intake": 0,
  "closed:filed": 0,
  "closed:under_review": 0,
  "closed:rfi_rfe": 0,
  "closed:approved": 0,
};

/**
 * Stage color CSS classes for progress bars
 */
const STAGE_COLORS: Record<CaseStatus, string> = {
  pwd: "bg-stage-pwd",
  recruitment: "bg-stage-recruitment",
  eta9089: "bg-stage-eta9089",
  i140: "bg-stage-i140",
  closed: "bg-stage-closed",
};

/**
 * Human-readable stage labels
 */
const STAGE_LABELS: Record<CaseStatus, string> = {
  pwd: "PWD",
  recruitment: "Recruitment",
  eta9089: "ETA 9089",
  i140: "I-140",
  closed: "Closed",
};

/**
 * Human-readable progress status labels
 */
const PROGRESS_LABELS: Record<ProgressStatus, string> = {
  working: "Working",
  waiting_intake: "Waiting",
  filed: "Filed",
  approved: "Approved",
  under_review: "Review",
  rfi_rfe: "RFI/RFE",
};

/**
 * Get progress percentage for a case
 */
function getProgressPercentage(status: CaseStatus, progressStatus: ProgressStatus): number {
  const key = `${status}:${progressStatus}`;
  return STATUS_PROGRESS[key] ?? 0;
}

/**
 * Get the nearest upcoming deadline from a case
 */
function getNearestDeadline(caseData: DemoCase): Date | null {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const deadlines: Date[] = [];

  if (caseData.pwdExpirationDate) {
    deadlines.push(new Date(caseData.pwdExpirationDate));
  }
  if (caseData.jobOrderEndDate) {
    deadlines.push(new Date(caseData.jobOrderEndDate));
  }
  if (caseData.noticeOfFilingEndDate) {
    deadlines.push(new Date(caseData.noticeOfFilingEndDate));
  }
  if (caseData.rfiDueDate && !caseData.rfiSubmittedDate) {
    deadlines.push(new Date(caseData.rfiDueDate));
  }
  if (caseData.rfeDueDate && !caseData.rfeSubmittedDate) {
    deadlines.push(new Date(caseData.rfeDueDate));
  }
  if (caseData.eta9089ExpirationDate) {
    deadlines.push(new Date(caseData.eta9089ExpirationDate));
  }

  // Filter to upcoming deadlines only
  const upcoming = deadlines.filter((d) => d >= today);

  if (upcoming.length === 0) return null;

  // Return nearest
  return upcoming.reduce((nearest, current) =>
    current < nearest ? current : nearest
  );
}

export function MiniTimeline({ cases }: MiniTimelineProps) {
  // Sort cases by nearest deadline and take top 5
  const sortedCases = useMemo(() => {
    const withDeadlines = cases.map((c) => ({
      ...c,
      nearestDeadline: getNearestDeadline(c),
    }));

    // Sort by nearest deadline (null deadlines go to end)
    withDeadlines.sort((a, b) => {
      if (!a.nearestDeadline && !b.nearestDeadline) return 0;
      if (!a.nearestDeadline) return 1;
      if (!b.nearestDeadline) return -1;
      return a.nearestDeadline.getTime() - b.nearestDeadline.getTime();
    });

    return withDeadlines.slice(0, 5);
  }, [cases]);

  if (sortedCases.length === 0) {
    return (
      <Card className="h-full">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Case Progress</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="py-4 text-center text-sm text-muted-foreground">
            No cases to display
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">Case Progress</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 pb-4">
        {sortedCases.map((caseData) => {
          const progress = getProgressPercentage(caseData.status, caseData.progressStatus);
          const stageColor = STAGE_COLORS[caseData.status];
          const stageLabel = STAGE_LABELS[caseData.status];
          const progressLabel = PROGRESS_LABELS[caseData.progressStatus];

          return (
            <div
              key={caseData.id}
              className="border-l-4 pl-3"
              style={{
                borderColor: `var(--stage-${caseData.status})`,
              }}
            >
              {/* Case Name */}
              <div className="mb-1 flex items-start justify-between gap-2">
                <p className="line-clamp-1 text-xs font-medium">
                  {caseData.beneficiaryName} @ {caseData.employerName}
                </p>
                <Badge
                  variant="outline"
                  className="shrink-0 px-1.5 py-0 text-[10px]"
                >
                  {stageLabel}
                </Badge>
              </div>

              {/* Progress Bar */}
              <div className="mb-1 h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className={`h-full transition-all duration-300 ${stageColor}`}
                  style={{ width: `${progress}%` }}
                />
              </div>

              {/* Progress Info */}
              <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                <span>{progressLabel}</span>
                <span>{progress}%</span>
              </div>
            </div>
          );
        })}

        {cases.length > 5 && (
          <p className="pt-1 text-center text-[10px] text-muted-foreground">
            +{cases.length - 5} more cases
          </p>
        )}
      </CardContent>
    </Card>
  );
}
