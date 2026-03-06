"use client";

import { useMemo } from "react";
import { CheckCircle2, Circle, Clock } from "lucide-react";
import { extractMilestones } from "@/lib/timeline/milestones";
import { STAGE_COLORS } from "@/lib/timeline/types";
import type { CaseDetailData } from "./case-detail-types";

interface VerticalTimelineProps {
  caseData: CaseDetailData;
}

export function VerticalTimeline({ caseData }: VerticalTimelineProps) {
  const milestones = useMemo(
    () => extractMilestones(caseData).slice(0, 12),
    [caseData]
  );

  if (milestones.length === 0) {
    return (
      <div className="border-2 border-border bg-card p-4 shadow-hard-sm">
        <h3 className="font-heading font-semibold text-sm mb-3">Milestones</h3>
        <p className="text-xs text-muted-foreground">No milestones yet.</p>
      </div>
    );
  }

  const today = new Date().toISOString().split("T")[0] as string;

  return (
    <div className="border-2 border-border bg-card p-4 shadow-hard-sm">
      <h3 className="font-heading font-semibold text-sm mb-4">Milestones</h3>
      <div className="relative">
        {/* Vertical line */}
        <div className="absolute left-[9px] top-2 bottom-2 w-0.5 bg-border" />

        <div className="space-y-3">
          {milestones.map((milestone, index) => {
            const isPast = milestone.date <= today;
            const isFuture = milestone.date > today;
            const stageColor = STAGE_COLORS[milestone.stage] || "#888";

            return (
              <div key={`${milestone.field}-${index}`} className="flex items-start gap-3 relative">
                {/* Dot */}
                <div className="relative z-10 shrink-0 mt-0.5">
                  {isPast ? (
                    <CheckCircle2
                      className="h-[18px] w-[18px]"
                      style={{ color: stageColor }}
                    />
                  ) : isFuture && milestone.isCalculated ? (
                    <Clock className="h-[18px] w-[18px] text-muted-foreground" />
                  ) : (
                    <Circle className="h-[18px] w-[18px] text-muted-foreground" />
                  )}
                </div>

                {/* Content */}
                <div className="min-w-0 flex-1">
                  <p
                    className="text-xs font-semibold leading-tight"
                    style={{ color: isPast ? stageColor : undefined }}
                  >
                    {milestone.label}
                  </p>
                  <p className="text-[0.625rem] font-mono text-muted-foreground mt-0.5">
                    {new Date(milestone.date).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                    {milestone.isCalculated && (
                      <span className="ml-1 opacity-60">(est.)</span>
                    )}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
