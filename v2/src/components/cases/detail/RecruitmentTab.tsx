"use client";

import { motion } from "motion/react";
import { format, parseISO, differenceInDays } from "date-fns";
import { Check, Flag, Newspaper, FileText, Users, BarChart3, Clock } from "lucide-react";
import { getMethodLabel } from "@/lib/recruitment";
import type { CaseDetailData } from "./case-detail-types";

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: "spring" as const, stiffness: 300, damping: 24 },
  },
};

function fmt(d?: string | null) {
  if (!d) return "\u2014";
  try { return format(parseISO(d), "MMM d, yyyy"); } catch { return d; }
}

function fmtShort(d?: string | null) {
  if (!d) return "\u2014";
  try { return format(parseISO(d), "MMM d"); } catch { return d; }
}

interface RecruitmentTabProps {
  caseData: CaseDetailData;
}

export function RecruitmentTab({ caseData }: RecruitmentTabProps) {
  // Recruitment window calculation
  const windowStart = caseData.pwdDeterminationDate;
  const windowEnd = caseData.pwdExpirationDate;
  let windowDays = 0;
  let windowLabel = "";
  let windowPct = 0;
  if (windowStart && windowEnd) {
    const total = differenceInDays(parseISO(windowEnd), parseISO(windowStart));
    const elapsed = differenceInDays(new Date(), parseISO(windowStart));
    const remaining = differenceInDays(parseISO(windowEnd), new Date());
    windowDays = remaining > 0 ? remaining : Math.abs(remaining);
    windowLabel = remaining > 0 ? "remaining in window" : "past expiration";
    windowPct = total > 0 ? Math.min(100, Math.max(0, (elapsed / total) * 100)) : 0;
  }

  const hasJobOrder = !!caseData.jobOrderStartDate;
  const hasSundayAds = !!caseData.sundayAdFirstDate;
  const hasNOF = !!caseData.noticeOfFilingStartDate;
  const methods = caseData.additionalRecruitmentMethods || [];
  const completedMethods = methods.filter((m) => !!m.date).length;

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={{ visible: { transition: { staggerChildren: 0.06 } } }}
      className="space-y-6"
    >
      {/* Recruitment Window Card */}
      {windowStart && windowEnd && (
        <motion.div variants={itemVariants}>
          <div className="win-card">
            <div className="win-accent" style={{ background: "var(--stage-recruitment)" }} />
            <div className="win-inner">
              <div className="win-header">
                <span className="win-title">Recruitment Window</span>
                <span
                  className="win-chip"
                  style={
                    windowLabel.includes("remaining")
                      ? { background: "rgba(46,204,64,0.1)", color: "var(--primary)" }
                      : { background: "var(--destructive)", color: "#fff" }
                  }
                >
                  {windowLabel.includes("remaining") ? "Active" : "Expired"}
                </span>
              </div>
              <div className="win-hero">
                <div>
                  <span className="win-hero-num" style={{ color: "var(--stage-recruitment)" }}>
                    {windowDays}
                  </span>
                  <span className="win-hero-unit">days</span>
                </div>
                <div className="win-hero-label">{windowLabel}</div>
              </div>
              <div className="win-progress">
                <span className="win-date">{fmtShort(windowStart)}</span>
                <div className="win-bar">
                  <div
                    className="win-bar-fill"
                    style={{ width: `${windowPct}%`, background: "var(--stage-recruitment)" }}
                  />
                </div>
                <span className="win-date">{fmtShort(windowEnd)}</span>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Recruitment Steps — 2x2 grid */}
      <motion.div variants={itemVariants}>
        <div className="recruit-grid">
          {/* Job Order */}
          <div className="detail-card">
            <div className="detail-card-head ch-rec">
              <span className="flex items-center gap-1.5">
                <Flag className="h-3.5 w-3.5" />
                Job Order (SWA)
              </span>
              {hasJobOrder && (
                <span className="head-badge">
                  <Check className="h-2.5 w-2.5" /> Done
                </span>
              )}
            </div>
            <div className="detail-card-body">
              {hasJobOrder ? (
                <>
                  <div className="recruit-range-bar">
                    <span className="recruit-range-date">{fmtShort(caseData.jobOrderStartDate)}</span>
                    <div className="recruit-range-fill" style={{ background: "var(--stage-recruitment)" }} />
                    <span className="recruit-range-date">{fmt(caseData.jobOrderEndDate)}</span>
                  </div>
                  <div className="recruit-range-meta">
                    {caseData.jobOrderStartDate && caseData.jobOrderEndDate && (
                      <span className="recruit-range-duration">
                        {differenceInDays(parseISO(caseData.jobOrderEndDate), parseISO(caseData.jobOrderStartDate))} days
                      </span>
                    )}
                    {caseData.jobOrderState && (
                      <span
                        style={{
                          fontFamily: "var(--font-mono)",
                          fontSize: "0.58rem",
                          fontWeight: 700,
                          textTransform: "uppercase",
                          padding: "2px 8px",
                          border: "2px solid var(--border)",
                          background: "var(--muted)",
                        }}
                      >
                        {caseData.jobOrderState}
                      </span>
                    )}
                  </div>
                </>
              ) : (
                <div className="detail-empty-state">
                  <div className="detail-empty-state-title">Not started</div>
                  <div className="detail-empty-state-desc">Job order dates will appear here.</div>
                </div>
              )}
            </div>
          </div>

          {/* Sunday Ads */}
          <div className="detail-card">
            <div className="detail-card-head ch-rec">
              <span className="flex items-center gap-1.5">
                <Newspaper className="h-3.5 w-3.5" />
                Sunday Ads
              </span>
              {hasSundayAds && caseData.sundayAdSecondDate && (
                <span className="head-badge">
                  <Check className="h-2.5 w-2.5" /> Done
                </span>
              )}
            </div>
            <div className="detail-card-body">
              {hasSundayAds ? (
                <div>
                  <div className="recruit-ad-entry">
                    <div className="recruit-ad-num">1</div>
                    <div>
                      <div className="recruit-ad-date">{fmt(caseData.sundayAdFirstDate)}</div>
                      {caseData.sundayAdNewspaper && (
                        <div className="recruit-ad-pub">{caseData.sundayAdNewspaper}</div>
                      )}
                    </div>
                  </div>
                  {caseData.sundayAdSecondDate && (
                    <div className="recruit-ad-entry">
                      <div className="recruit-ad-num">2</div>
                      <div>
                        <div className="recruit-ad-date">{fmt(caseData.sundayAdSecondDate)}</div>
                        {caseData.sundayAdNewspaper && (
                          <div className="recruit-ad-pub">{caseData.sundayAdNewspaper}</div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="detail-empty-state">
                  <div className="detail-empty-state-title">Not started</div>
                  <div className="detail-empty-state-desc">Sunday ad dates will appear here.</div>
                </div>
              )}
            </div>
          </div>

          {/* Notice of Filing */}
          <div className="detail-card">
            <div className="detail-card-head ch-rec">
              <span className="flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5" />
                Notice of Filing
              </span>
              {hasNOF && caseData.noticeOfFilingEndDate && (
                <span className="head-badge">
                  <Check className="h-2.5 w-2.5" /> Done
                </span>
              )}
            </div>
            <div className="detail-card-body">
              {hasNOF ? (
                <div>
                  <div className="recruit-posting-info" style={{ marginBottom: 10 }}>
                    10 consecutive business days &middot; {fmt(caseData.noticeOfFilingStartDate)} &ndash; {fmt(caseData.noticeOfFilingEndDate)}
                  </div>
                </div>
              ) : (
                <div className="detail-empty-state">
                  <div className="detail-empty-state-title">Not started</div>
                  <div className="detail-empty-state-desc">Notice of Filing dates will appear here.</div>
                </div>
              )}
            </div>
          </div>

          {/* Additional Methods */}
          <div className="detail-card">
            <div className="detail-card-head ch-rec">
              <span className="flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5" />
                Additional Methods
              </span>
              <span className="head-badge">{completedMethods} / {methods.length || (caseData.isProfessionalOccupation ? 3 : 0)}</span>
            </div>
            <div className="detail-card-body" style={{ padding: 0 }}>
              {methods.length > 0 ? (
                methods.map((method, i) => (
                  <div key={i} className="recruit-row">
                    <div className={`recruit-icon ${method.date ? "done" : "pending"}`}>
                      {method.date ? (
                        <Check className="h-3.5 w-3.5" />
                      ) : (
                        <Clock className="h-3.5 w-3.5" />
                      )}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: "0.875rem" }}>{getMethodLabel(method.method)}</div>
                      {method.date && (
                        <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.72rem", color: "var(--muted-foreground)" }}>{fmt(method.date)}</div>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="detail-empty-state">
                  <div className="detail-empty-state-title">No methods</div>
                  <div className="detail-empty-state-desc">
                    {caseData.isProfessionalOccupation ? "Professional occupations require 3+ additional methods." : "Additional methods not required."}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </motion.div>

      {/* Summary */}
      <motion.div variants={itemVariants}>
        <div className="detail-card">
          <div className="detail-card-head ch-muted">
            <span className="flex items-center gap-1.5">
              <BarChart3 className="h-3.5 w-3.5" />
              Summary
            </span>
          </div>
          <div className="field-grid" style={{ padding: 0, borderBottom: "3px solid var(--border)" }}>
            <div className="field-cell">
              <div className="fc-label">Applicants</div>
              <div className="fc-val">{caseData.recruitmentApplicantsCount || "\u2014"}</div>
            </div>
            <div className="field-cell">
              <div className="fc-label">Recruitment Period</div>
              <div className="fc-val mono">
                {caseData.additionalRecruitmentStartDate && caseData.additionalRecruitmentEndDate
                  ? `${fmtShort(caseData.additionalRecruitmentStartDate)} \u2013 ${fmtShort(caseData.additionalRecruitmentEndDate)}`
                  : "\u2014"}
              </div>
            </div>
            <div className="field-cell">
              <div className="fc-label">Quiet Period Ends</div>
              <div className="fc-val mono">
                {caseData.additionalRecruitmentEndDate
                  ? fmt(
                      format(
                        new Date(
                          parseISO(caseData.additionalRecruitmentEndDate).getTime() + 30 * 24 * 60 * 60 * 1000
                        ),
                        "yyyy-MM-dd"
                      )
                    )
                  : "\u2014"}
              </div>
            </div>
          </div>
          {(caseData.recruitmentNotes || caseData.recruitmentSummaryCustom) && (
            <div style={{ padding: "16px 20px" }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: "10px", textTransform: "uppercase", color: "var(--muted-foreground)", marginBottom: 6 }}>Result</div>
              <div style={{ fontSize: "0.88rem", lineHeight: 1.55 }}>
                {caseData.recruitmentSummaryCustom || caseData.recruitmentNotes}
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
