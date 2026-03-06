"use client";

import { useMemo } from "react";
import { Check, Clock, Circle } from "lucide-react";
import { extractMilestones } from "@/lib/timeline/milestones";
import type { CaseDetailData } from "./case-detail-types";

interface VerticalTimelineProps {
  caseData: CaseDetailData;
}

export function VerticalTimeline({ caseData }: VerticalTimelineProps) {
  const milestones = useMemo(
    () => extractMilestones(caseData).slice(0, 12),
    [caseData]
  );

  const today = new Date().toISOString().split("T")[0] as string;

  // Map milestones to done/current/pending status
  const steps = useMemo(() => {
    let foundCurrent = false;
    return milestones.map((m) => {
      if (m.date <= today && !m.isCalculated) {
        return { ...m, status: "done" as const };
      }
      if (!foundCurrent) {
        foundCurrent = true;
        return { ...m, status: "current" as const };
      }
      return { ...m, status: "pending" as const };
    });
  }, [milestones, today]);

  return (
    <div className="detail-card">
      <div className="detail-card-head ch-dark">
        <span className="flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5" />
          Timeline
        </span>
      </div>
      <div className="detail-card-body">
        {steps.length === 0 ? (
          <div className="detail-empty-state">
            <div className="detail-empty-state-title">No milestones yet</div>
            <div className="detail-empty-state-desc">Timeline milestones will appear as dates are entered.</div>
          </div>
        ) : (
          steps.map((step, i) => {
            const isLast = i === steps.length - 1;
            const dateStr = step.status === "pending" && step.isCalculated
              ? "Pending"
              : step.status === "pending"
                ? "Pending"
                : new Date(step.date).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  });

            return (
              <div key={`${step.field}-${i}`} className="vtl-step">
                <div className="vtl-icon-col">
                  <div className={`vtl-icon ${step.status}`}>
                    {step.status === "done" ? (
                      <Check className="h-3.5 w-3.5" />
                    ) : step.status === "current" ? (
                      <Clock className="h-3.5 w-3.5" />
                    ) : (
                      <Circle className="h-3.5 w-3.5" />
                    )}
                  </div>
                  {!isLast && <div className={`vtl-line ${step.status}`} />}
                </div>
                <div className="vtl-content">
                  <div className={`vtl-title ${step.status === "pending" ? "pending" : ""}`}>
                    {step.label}
                  </div>
                  <div className="vtl-date">{dateStr}</div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
