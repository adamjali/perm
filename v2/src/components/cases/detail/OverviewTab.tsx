"use client";

import { motion } from "motion/react";
import { format, parseISO } from "date-fns";
import { Flag, Briefcase, CalendarMinus, CalendarPlus } from "lucide-react";
import { NextUpSection } from "./NextUpSection";
import { InlineCaseTimeline } from "./InlineCaseTimeline";
import { QuickStatsPanel } from "./QuickStatsPanel";
import { VerticalTimeline } from "./VerticalTimeline";
import { Button } from "@/components/ui/button";
import { type ProgressStatus } from "@/lib/perm";
import type { Id } from "@/../convex/_generated/dataModel";
import type { CaseDetailData } from "./case-detail-types";

function fmtDate(d?: string | null) {
  if (!d) return "\u2014";
  try { return format(parseISO(d), "MMM d, yyyy"); } catch { return d; }
}

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: "spring" as const, stiffness: 300, damping: 24 },
  },
};

interface OverviewTabProps {
  caseId: Id<"cases">;
  caseData: CaseDetailData;
  stageColor: string;
  isMobile: boolean;
  isOnTimeline: boolean;
  isUpdating: boolean;
  onToggleTimeline: () => void;
}

export function OverviewTab({
  caseId,
  caseData,
  isMobile,
  isOnTimeline,
  isUpdating,
  onToggleTimeline,
}: OverviewTabProps) {
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={{ visible: { transition: { staggerChildren: 0.06 } } }}
      className="space-y-6"
    >
      {/* Next Up Section */}
      <motion.div variants={itemVariants}>
        <NextUpSection
          caseId={caseId}
          showStageProgress={false}
          caseData={{
            caseStatus: caseData.caseStatus,
            progressStatus: caseData.progressStatus as ProgressStatus,
            pwdFilingDate: caseData.pwdFilingDate,
            pwdDeterminationDate: caseData.pwdDeterminationDate,
            pwdExpirationDate: caseData.pwdExpirationDate,
            jobOrderStartDate: caseData.jobOrderStartDate,
            jobOrderEndDate: caseData.jobOrderEndDate,
            sundayAdFirstDate: caseData.sundayAdFirstDate,
            sundayAdSecondDate: caseData.sundayAdSecondDate,
            noticeOfFilingStartDate: caseData.noticeOfFilingStartDate,
            noticeOfFilingEndDate: caseData.noticeOfFilingEndDate,
            eta9089FilingDate: caseData.eta9089FilingDate,
            eta9089CertificationDate: caseData.eta9089CertificationDate,
            eta9089ExpirationDate: caseData.eta9089ExpirationDate,
            i140FilingDate: caseData.i140FilingDate,
            i140ApprovalDate: caseData.i140ApprovalDate,
            i140DenialDate: caseData.i140DenialDate,
            rfiEntries: caseData.rfiEntries,
            rfeEntries: caseData.rfeEntries,
            isProfessionalOccupation: caseData.isProfessionalOccupation,
            additionalRecruitmentMethods: caseData.additionalRecruitmentMethods,
          }}
        />
      </motion.div>

      {/* 2-Column Layout: Timeline Sidebar + Main (matching mockup) */}
      <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
        {/* Sidebar: Vertical Timeline */}
        {!isMobile && (
          <div className="space-y-6">
            <motion.div variants={itemVariants}>
              <VerticalTimeline caseData={caseData} />
            </motion.div>
          </div>
        )}

        {/* Main column */}
        <div className="space-y-6">
          {/* PWD + Quick Stats side by side (mockup: 1.8fr 1fr) */}
          <div className="grid gap-6 md:grid-cols-[1.8fr_1fr]">
            <motion.div variants={itemVariants}>
              <div className="detail-card">
                <div className="detail-card-head ch-pwd">
                  <span className="flex items-center gap-1.5">
                    <Flag className="h-3.5 w-3.5" />
                    Prevailing Wage
                  </span>
                  {caseData.pwdDeterminationDate && (
                    <span className="head-badge">Complete</span>
                  )}
                </div>
                <div className="field-grid" style={{ padding: 0 }}>
                  <div className="field-cell">
                    <div className="fc-label">PWD Case #</div>
                    <div className={`fc-val mono ${!caseData.pwdCaseNumber ? "dim" : ""}`}>
                      {caseData.pwdCaseNumber || "\u2014"}
                    </div>
                  </div>
                  <div className="field-cell">
                    <div className="fc-label">Filed</div>
                    <div className={`fc-val mono ${!caseData.pwdFilingDate ? "dim" : ""}`}>
                      {fmtDate(caseData.pwdFilingDate)}
                    </div>
                  </div>
                  <div className="field-cell">
                    <div className="fc-label">Determined</div>
                    <div className={`fc-val mono ${!caseData.pwdDeterminationDate ? "dim" : ""}`}>
                      {fmtDate(caseData.pwdDeterminationDate)}
                    </div>
                  </div>
                  <div className="field-cell">
                    <div className="fc-label">Wage Level</div>
                    <div className={`fc-val ${!caseData.pwdWageLevel ? "dim" : ""}`}>
                      {caseData.pwdWageLevel || "\u2014"}
                    </div>
                  </div>
                  <div className="field-cell">
                    <div className="fc-label">PWD Amount</div>
                    <div className={`fc-val ${caseData.pwdWageAmount === undefined ? "dim" : ""}`}>
                      {caseData.pwdWageAmount !== undefined
                        ? `${new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(Number(caseData.pwdWageAmount))} / yr`
                        : "\u2014"}
                    </div>
                  </div>
                  <div className="field-cell">
                    <div className="fc-label">Expires</div>
                    <div className={`fc-val mono ${!caseData.pwdExpirationDate ? "dim" : ""}`}>
                      {caseData.pwdExpirationDate ? (
                        <span style={{ color: "var(--stage-eta9089)" }}>
                          {fmtDate(caseData.pwdExpirationDate)}
                        </span>
                      ) : "\u2014"}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>

            <motion.div variants={itemVariants}>
              <QuickStatsPanel caseData={caseData} />
            </motion.div>
          </div>

          {/* Job Description */}
          {(caseData.jobDescription || caseData.jobDescriptionPositionTitle) && (
            <motion.div variants={itemVariants}>
              <div className="detail-card">
                <div className="detail-card-head ch-yellow">
                  <span className="flex items-center gap-1.5">
                    <Briefcase className="h-3.5 w-3.5" />
                    Job Description
                  </span>
                </div>
                <div className="field-grid" style={{ padding: 0 }}>
                  <div className="field-cell">
                    <div className="fc-label">Position</div>
                    <div className={`fc-val ${!caseData.jobDescriptionPositionTitle ? "dim" : ""}`}>
                      {caseData.jobDescriptionPositionTitle || "\u2014"}
                    </div>
                  </div>
                  <div className="field-cell">
                    <div className="fc-label">SOC Code</div>
                    <div className={`fc-val mono ${!caseData.socCode ? "dim" : ""}`}>
                      {caseData.socCode || "\u2014"}
                    </div>
                  </div>
                  <div className="field-cell">
                    <div className="fc-label">Wage Offered</div>
                    <div className={`fc-val ${caseData.pwdWageAmount === undefined ? "dim" : ""}`}>
                      {caseData.pwdWageAmount !== undefined
                        ? `${new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(Number(caseData.pwdWageAmount))} / yr`
                        : "\u2014"}
                    </div>
                  </div>
                </div>
                {caseData.jobDescription && (
                  <div className="detail-card-body" style={{ borderTop: "3px solid var(--border)" }}>
                    <div style={{ border: "3px solid var(--border)", background: "var(--card)", padding: 16 }}>
                      <div style={{ fontFamily: "var(--font-mono)", fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--muted-foreground)", marginBottom: 8 }}>Requirements</div>
                      <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: 6, padding: 0, margin: 0 }}>
                        {caseData.jobDescription.split("\n").filter(Boolean).map((line, i) => (
                          <li key={i} className="req-item">
                            <span className="req-bullet">&gt;</span> {line.replace(/^[-•*]\s*/, "")}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </div>
      </div>

      {/* Mobile-only: Timeline + QuickStats below main content */}
      {isMobile && (
        <div className="space-y-6">
          <motion.div variants={itemVariants}>
            <QuickStatsPanel caseData={caseData} />
          </motion.div>
          <motion.div variants={itemVariants}>
            <VerticalTimeline caseData={caseData} />
          </motion.div>
        </div>
      )}

      {/* Case Timeline (Gantt) */}
      <motion.div variants={itemVariants}>
        <div className="gantt-wrap">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "12px 16px", borderBottom: "3px solid var(--border)", background: "var(--muted)" }}>
            <span className="flex items-center gap-1.5" style={{ fontFamily: "var(--font-mono)", fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Case Timeline
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={onToggleTimeline}
              disabled={isUpdating}
              className="gap-2"
            >
              {isOnTimeline ? (
                <>
                  <CalendarMinus className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Remove</span>
                </>
              ) : (
                <>
                  <CalendarPlus className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Add to Timeline</span>
                </>
              )}
            </Button>
          </div>
          <div style={{ overflowX: "auto" }}>
            <InlineCaseTimeline
              caseData={caseData}
              className="min-w-[500px] sm:min-w-0"
            />
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
