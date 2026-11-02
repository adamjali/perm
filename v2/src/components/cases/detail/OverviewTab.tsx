"use client";

import { URGENCY_FILL } from "@/components/cases/DeadlineCountdown";
import { getUrgencyLevel } from "@/lib/status/urgency";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowCircleRightIcon, ArrowRightIcon, CaretDownIcon, FlagIcon } from "@phosphor-icons/react";
import type { Id } from "@convex/_generated/dataModel";
import { calculateNextAction, calculateNextDeadline } from "./next-up-section.utils";
import { QuickEditFields, isEditableAction, isComplexAction } from "./quick-edit";
import { InlineCaseTimeline } from "./InlineCaseTimeline";
import { CaseEstimateSection } from "./CaseEstimateSection";
import { QuickStatsPanel } from "./QuickStatsPanel";
import { VerticalTimeline } from "./VerticalTimeline";
import { RecruitmentResultsCard } from "./RecruitmentResultsCard";
import { JobDescriptionCard, type JobDescEditProps } from "./JobDescriptionCard";
import { isRecruitmentComplete } from "@/lib/perm";
import { cn } from "@/lib/utils";
import { buildEditUrl, buildEditSectionUrl } from "@/lib/cases/editDeepLinks";
import type { CaseDetailData } from "./case-detail-types";
import { fmtISODate, fmtCurrency } from "./case-detail-utils";

export type { JobDescEditProps } from "./JobDescriptionCard";

interface OverviewTabProps {
  caseData: CaseDetailData;
  caseId: Id<"cases">;
  isMobile: boolean;
  onSaveRecruitmentText?: (text: string | null) => Promise<void>;
  jobDescProps?: JobDescEditProps;
}

export function OverviewTab({
  caseData,
  caseId,
  isMobile,
  onSaveRecruitmentText,
  jobDescProps,
}: OverviewTabProps) {
  const router = useRouter();
  const [isNextUpExpanded, setIsNextUpExpanded] = useState(false);

  return (
    <div className="space-y-8">
      {/* Next Up — expandable with quick-edit */}
      {caseData.caseStatus !== "closed" && (() => {
        const nextAction = calculateNextAction(caseData);
        const nextDeadline = calculateNextDeadline(caseData);
        if (!nextAction) return null;
        const canExpand = isEditableAction(nextAction.action);
        const navigateUrl = isComplexAction(nextAction.action)
          ? buildEditSectionUrl(caseId, "recruitment")
          : null;
        const late = nextDeadline ? nextDeadline.daysUntil < 0 : false;
        // The same urgency colours as the case folders and the dashboard.
        const urgencyClass = nextDeadline ? URGENCY_FILL[getUrgencyLevel(nextDeadline.daysUntil)] : "";
        const isInteractive = !!navigateUrl || canExpand;
        const mainContent = (
          <>
            <span className="next-up-icon" aria-hidden="true">
              <ArrowCircleRightIcon className="size-6" />
            </span>{" "}
            <span className="min-w-0 flex-1">
              <span className="next-up-label block">Next up</span>{" "}
              <h3>{nextAction.action}</h3>{" "}
              <p>{nextAction.description}</p>
            </span>{" "}
            {canExpand ? (
              <CaretDownIcon
                className={cn("size-5 shrink-0 text-muted-foreground transition-transform", isNextUpExpanded && "rotate-180")}
                aria-hidden="true"
              />
            ) : navigateUrl ? (
              <ArrowRightIcon className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
            ) : null}
          </>
        );
        return (
          <section aria-label="Next up">
            <div className="next-up">
              {isInteractive ? (
                <button
                  type="button"
                  className="next-up-main w-full cursor-pointer text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                  onClick={navigateUrl ? () => router.push(navigateUrl) : () => setIsNextUpExpanded((v) => !v)}
                  aria-expanded={canExpand ? isNextUpExpanded : undefined}
                >
                  {mainContent}
                </button>
              ) : (
                <div className="next-up-main">{mainContent}</div>
              )}
              {nextDeadline ? (
                <div className="next-up-stat">
                  <div className={cn("big inline-flex min-w-14 justify-center px-2 py-1", urgencyClass)}>
                    {Math.abs(nextDeadline.daysUntil)}
                  </div>
                  <div className="label">
                    {late
                      ? `${Math.abs(nextDeadline.daysUntil) === 1 ? "day" : "days"} late: ${nextDeadline.label}`
                      : `${nextDeadline.daysUntil === 1 ? "day" : "days"} until ${nextDeadline.label}`}
                  </div>
                  <div className="date">{fmtISODate(nextDeadline.date)}</div>
                </div>
              ) : null}
            </div>
            {isNextUpExpanded && canExpand ? (
              <div className="border border-t-0 border-border bg-card p-4">
                <QuickEditFields
                  actionName={nextAction.action}
                  caseId={caseId}
                  caseData={caseData}
                  onComplete={() => setIsNextUpExpanded(false)}
                  onNavigateToForm={() => {}}
                />
              </div>
            ) : null}
          </section>
        );
      })()}

      {/* 2-Column Layout: Timeline Sidebar + Main (matching mockup) */}
      <div className="grid [&>*]:min-w-0 grid-cols-1 gap-6 lg:grid-cols-[260px_1fr]">
        {/* Sidebar: Vertical Timeline */}
        {!isMobile && (
          <div className="space-y-6">
            <div>
              <VerticalTimeline caseData={caseData} />
            </div>
          </div>
        )}

        {/* Main column */}
        <div className="space-y-6">
          {/* PWD + Quick Stats side by side (mockup: 1.8fr 1fr) */}
          <div className="grid [&>*]:min-w-0 grid-cols-1 gap-6 md:grid-cols-[1.8fr_1fr]">
            <div>
              <Link href={buildEditUrl(caseData._id, "pwdFilingDate")} className="detail-card-link" title="Edit in case form">
                <div className="detail-card">
                  <div className="detail-card-head ch-pwd">
                    <h2 className="flex items-center gap-1.5">
                      <FlagIcon className="h-3.5 w-3.5" />
                      Prevailing wage
                    </h2>
                    {caseData.pwdDeterminationDate && (
                      <span className="head-badge">Complete</span>
                    )}
                  </div>
                  <div className="field-grid">
                    <div className="field-cell">
                      <div className="fc-label">PWD Case #</div>
                      <div className={`fc-val fc-val-text mono ${!caseData.pwdCaseNumber ? "dim" : ""}`} title={caseData.pwdCaseNumber || undefined}>
                        {caseData.pwdCaseNumber || "-"}
                      </div>
                    </div>
                    <div className="field-cell">
                      <div className="fc-label">Filed</div>
                      <div className={`fc-val num ${!caseData.pwdFilingDate ? "dim" : ""}`}>
                        {fmtISODate(caseData.pwdFilingDate)}
                      </div>
                    </div>
                    <div className="field-cell">
                      <div className="fc-label">Determined</div>
                      <div className={`fc-val num ${!caseData.pwdDeterminationDate ? "dim" : ""}`}>
                        {fmtISODate(caseData.pwdDeterminationDate)}
                      </div>
                    </div>
                    <div className="field-cell">
                      <div className="fc-label">Wage level</div>
                      <div className={`fc-val ${!caseData.pwdWageLevel ? "dim" : ""}`}>
                        {caseData.pwdWageLevel || "-"}
                      </div>
                    </div>
                    <div className="field-cell">
                      <div className="fc-label">PWD amount</div>
                      <div className={`fc-val ${caseData.pwdWageAmount === undefined ? "dim" : ""}`}>
                        {caseData.pwdWageAmount !== undefined
                          ? `${fmtCurrency(caseData.pwdWageAmount)} / yr`
                          : "-"}
                      </div>
                    </div>
                    <div className="field-cell">
                      <div className="fc-label">Expires</div>
                      <div className={`fc-val num ${!caseData.pwdExpirationDate ? "dim" : ""}`}>
                        {caseData.pwdExpirationDate ? (
                          <span className="text-data-warn-ink">
                            {fmtISODate(caseData.pwdExpirationDate)}
                          </span>
                        ) : "-"}
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
            </div>

            {!isMobile && (
              <div>
                <QuickStatsPanel caseData={caseData} />
              </div>
            )}
          </div>

          <JobDescriptionCard caseData={caseData} jobDescProps={jobDescProps} />

          {/* Recruitment Results — only after all recruitment is complete */}
          {onSaveRecruitmentText && isRecruitmentComplete(caseData) && (
            <div>
              <RecruitmentResultsCard
                caseData={caseData}
                onSaveCustomText={onSaveRecruitmentText}
              />
            </div>
          )}
        </div>
      </div>

      {/* Mobile-only: Timeline + QuickStats below main content */}
      {isMobile && (
        <div className="space-y-6">
          <div>
            <QuickStatsPanel caseData={caseData} />
          </div>
          <div>
            <VerticalTimeline caseData={caseData} />
          </div>
        </div>
      )}

      {/* Case Timeline (Gantt) */}
      <div>
        <div className="gantt-wrap">
          <div className="detail-card-head"><h2>Case timeline</h2></div>
          {/* The timeline scrolls its own months under a sticky stage column. */}
          <InlineCaseTimeline caseData={caseData} />
        </div>
      </div>

      {/* DOL decision card, at the foot of the Overview (owner, Oct 30 2026: "move this to the bottom"). */}
      <CaseEstimateSection caseData={caseData} />

    </div>
  );
}
