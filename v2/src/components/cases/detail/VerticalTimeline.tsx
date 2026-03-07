"use client";

import { useMemo } from "react";
import { Check, Clock, Circle } from "lucide-react";
import { parseISO, format } from "date-fns";
import { extractMilestones } from "@/lib/timeline/milestones";
import { isRecruitmentComplete } from "@/lib/perm";
import type { CaseDetailData } from "./case-detail-types";

// All key PERM stages to always show
const ALL_STAGES: { field: string; label: string }[] = [
  { field: "pwdFilingDate", label: "PWD Filed" },
  { field: "pwdDeterminationDate", label: "PWD Determined" },
  { field: "jobOrderStartDate", label: "Job Order Started" },
  { field: "sundayAds", label: "Sunday Ads" },
  { field: "noticeOfFilingStartDate", label: "NOF Posted" },
  { field: "recruitmentEndDate", label: "Recruitment Completed" },
  { field: "eta9089FilingDate", label: "ETA 9089 Filed" },
  { field: "eta9089CertificationDate", label: "ETA 9089 Certified" },
  { field: "i140FilingDate", label: "I-140 Filed" },
  { field: "i140ApprovalDate", label: "I-140 Approved" },
];

interface VerticalTimelineProps {
  caseData: CaseDetailData;
}

export function VerticalTimeline({ caseData }: VerticalTimelineProps) {
  const milestones = useMemo(
    () => extractMilestones(caseData),
    [caseData]
  );

  const today = new Date().toISOString().split("T")[0] as string;

  // Build full steps: merge extracted milestones with all stages skeleton
  const steps = useMemo(() => {
    // Create a set of fields that have milestones
    const milestoneByField = new Map(milestones.map((m) => [m.field, m]));

    // Also check direct caseData fields for dates not in milestones
    const directFields: [string, string | undefined][] = [
      ["jobOrderStartDate", caseData.jobOrderStartDate],
      ["noticeOfFilingStartDate", caseData.noticeOfFilingStartDate],
    ];
    for (const [field, date] of directFields) {
      if (date && !milestoneByField.has(field)) {
        milestoneByField.set(field, { field, label: "", date, stage: "recruitment" as const, color: "#9333ea", isCalculated: false });
      }
    }

    // Recruitment Completed — only mark as done if central isRecruitmentComplete passes
    const recruitComplete = isRecruitmentComplete(caseData);
    if (recruitComplete) {
      // Use recruitmentEndDate or derive from latest recruitment date
      const endDate = caseData.recruitmentEndDate
        || [caseData.jobOrderEndDate, caseData.sundayAdSecondDate, caseData.noticeOfFilingEndDate].filter(Boolean).sort().reverse()[0];
      if (endDate && !milestoneByField.has("recruitmentEndDate")) {
        milestoneByField.set("recruitmentEndDate", { field: "recruitmentEndDate", label: "", date: endDate, stage: "recruitment" as const, color: "#9333ea", isCalculated: false });
      }
    }

    // Combine sunday ads into a single entry
    const ad1 = caseData.sundayAdFirstDate;
    const ad2 = caseData.sundayAdSecondDate;
    if (ad1 || ad2) {
      const date = ad2 || ad1 || "";
      milestoneByField.set("sundayAds", {
        field: "sundayAds",
        label: "Sunday Ads",
        date,
        stage: "recruitment" as const,
        color: "#9333ea",
        isCalculated: false,
      });
    }

    // Build combined list: use milestone data if exists, else show as pending
    const combined: { field: string; label: string; date: string; status: "done" | "current" | "pending"; isCalculated?: boolean }[] = [];
    let foundCurrent = false;

    for (const stage of ALL_STAGES) {
      const m = milestoneByField.get(stage.field);
      if (m && m.date && m.date <= today && !m.isCalculated) {
        combined.push({ ...m, label: m.label || stage.label, status: "done" });
        milestoneByField.delete(stage.field);
      } else if (m && !foundCurrent) {
        foundCurrent = true;
        combined.push({ ...m, label: m.label || stage.label, status: "current" });
        milestoneByField.delete(stage.field);
      } else if (!m && !foundCurrent) {
        foundCurrent = true;
        combined.push({ field: stage.field, label: stage.label, date: "", status: "current" });
      } else {
        combined.push({ field: stage.field, label: stage.label, date: m?.date || "", status: "pending" });
        if (m) milestoneByField.delete(stage.field);
      }
    }

    return combined;
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
            let dateStr = "Pending";
            if (step.status !== "pending" && step.date) {
              try {
                if (step.field === "sundayAds" && caseData.sundayAdFirstDate) {
                  const d1 = format(parseISO(caseData.sundayAdFirstDate), "MMM d");
                  const d2 = caseData.sundayAdSecondDate
                    ? format(parseISO(caseData.sundayAdSecondDate), "MMM d, yyyy")
                    : null;
                  dateStr = d2 ? `${d1} & ${d2}` : format(parseISO(caseData.sundayAdFirstDate), "MMM d, yyyy");
                } else {
                  dateStr = format(parseISO(step.date), "MMM d, yyyy");
                }
              } catch {
                dateStr = "Pending";
              }
            }

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
