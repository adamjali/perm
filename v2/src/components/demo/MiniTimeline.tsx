/**
 * MiniTimeline Component
 *
 * Neobrutalist case progress panel showing stage completion bars.
 * Matches the real product's visual language with bold borders,
 * stage-colored progress bars, and compact typography.
 */

"use client";

import { useMemo } from "react";
import { BarChart3 } from "lucide-react";
import type { DemoCase } from "@/lib/demo";
import type { CaseStatus, ProgressStatus } from "@/lib/perm";

interface MiniTimelineProps {
  cases: DemoCase[];
}

const STATUS_PROGRESS: Record<string, number> = {
  "pwd:working": 5,
  "pwd:waiting_intake": 8,
  "pwd:filed": 12,
  "pwd:under_review": 15,
  "pwd:rfi_rfe": 14,
  "pwd:approved": 20,
  "recruitment:working": 25,
  "recruitment:waiting_intake": 28,
  "recruitment:filed": 32,
  "recruitment:under_review": 35,
  "recruitment:rfi_rfe": 34,
  "recruitment:approved": 40,
  "eta9089:working": 45,
  "eta9089:waiting_intake": 48,
  "eta9089:filed": 55,
  "eta9089:under_review": 60,
  "eta9089:rfi_rfe": 58,
  "eta9089:approved": 70,
  "i140:working": 75,
  "i140:waiting_intake": 78,
  "i140:filed": 85,
  "i140:under_review": 90,
  "i140:rfi_rfe": 88,
  "i140:approved": 100,
  "closed:working": 0,
  "closed:waiting_intake": 0,
  "closed:filed": 0,
  "closed:under_review": 0,
  "closed:rfi_rfe": 0,
  "closed:approved": 0,
};

const STAGE_COLORS: Record<CaseStatus, string> = {
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
  closed: "Complete",
};

const PROGRESS_LABELS: Record<ProgressStatus, string> = {
  working: "Working",
  waiting_intake: "Waiting",
  filed: "Filed",
  approved: "Approved",
  under_review: "Review",
  rfi_rfe: "RFI/RFE",
};

function getProgressPercentage(status: CaseStatus, progressStatus: ProgressStatus): number {
  const key = `${status}:${progressStatus}`;
  return STATUS_PROGRESS[key] ?? 0;
}

function getNearestDeadline(caseData: DemoCase): Date | null {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const deadlines: Date[] = [];

  if (caseData.pwdExpirationDate) deadlines.push(new Date(caseData.pwdExpirationDate));
  if (caseData.jobOrderEndDate) deadlines.push(new Date(caseData.jobOrderEndDate));
  if (caseData.noticeOfFilingEndDate) deadlines.push(new Date(caseData.noticeOfFilingEndDate));
  if (caseData.rfiDueDate && !caseData.rfiSubmittedDate) deadlines.push(new Date(caseData.rfiDueDate));
  if (caseData.rfeDueDate && !caseData.rfeSubmittedDate) deadlines.push(new Date(caseData.rfeDueDate));
  if (caseData.eta9089ExpirationDate) deadlines.push(new Date(caseData.eta9089ExpirationDate));

  const upcoming = deadlines.filter((d) => d >= today);
  if (upcoming.length === 0) return null;
  return upcoming.reduce((nearest, current) => (current < nearest ? current : nearest));
}

export function MiniTimeline({ cases }: MiniTimelineProps) {
  const sortedCases = useMemo(() => {
    const withDeadlines = cases.map((c) => ({
      ...c,
      nearestDeadline: getNearestDeadline(c),
    }));

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
      <div className="border-3 border-border bg-background shadow-hard overflow-hidden">
        <div className="flex items-center gap-2 border-b-2 border-border bg-muted px-4 py-3">
          <BarChart3 className="h-4 w-4 text-primary" />
          <h3 className="font-heading text-sm font-bold">Case Progress</h3>
        </div>
        <div className="p-8 text-center">
          <p className="text-sm text-muted-foreground">No cases to display</p>
        </div>
      </div>
    );
  }

  return (
    <div className="border-3 border-border bg-background shadow-hard overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 border-b-2 border-border bg-muted px-4 py-3">
        <BarChart3 className="h-4 w-4 text-primary" />
        <h3 className="font-heading text-sm font-bold">Case Progress</h3>
      </div>

      {/* Cases */}
      <div className="divide-y-2 divide-border">
        {sortedCases.map((caseData) => {
          const progress = getProgressPercentage(caseData.status, caseData.progressStatus);
          const stageColor = STAGE_COLORS[caseData.status];
          const stageLabel = STAGE_LABELS[caseData.status];
          const progressLabel = PROGRESS_LABELS[caseData.progressStatus];
          const isClosed = caseData.status === "closed";

          return (
            <div
              key={caseData.id}
              className="px-4 py-3"
              style={{ borderLeft: `4px solid var(--stage-${caseData.status})` }}
            >
              {/* Case header */}
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="truncate text-xs font-bold">
                  {caseData.beneficiaryName}
                </p>
                <span
                  className={`shrink-0 px-1.5 py-0 text-[9px] font-black uppercase tracking-wider text-black ${stageColor}`}
                >
                  {stageLabel}
                </span>
              </div>

              {/* Progress Bar */}
              <div className="mb-1.5 h-2.5 w-full border border-border bg-muted overflow-hidden">
                <div
                  className={`h-full transition-all duration-500 ${stageColor}`}
                  style={{ width: `${isClosed && caseData.progressStatus === "approved" ? 100 : progress}%` }}
                />
              </div>

              {/* Progress info */}
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] text-muted-foreground">
                  {progressLabel}
                </span>
                <span className="font-mono text-[10px] font-bold">
                  {isClosed && caseData.progressStatus === "approved" ? 100 : progress}%
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {cases.length > 5 && (
        <div className="border-t-2 border-dashed border-border px-4 py-2 text-center">
          <span className="font-mono text-[10px] text-muted-foreground">
            +{cases.length - 5} more cases
          </span>
        </div>
      )}
    </div>
  );
}
