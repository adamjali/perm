"use client";

import { useMemo } from "react";
import { motion } from "motion/react";
import { format, parseISO, differenceInDays, addDays } from "date-fns";
import { ChartBar, Check, Clock, FileText, Flag, Info, Newspaper, Users } from "@phosphor-icons/react";
import Link from "next/link";
import { getMethodLabel } from "@/lib/recruitment";
import { isBusinessDay, getFederalHolidays, getFirstRecruitmentDate, getLastRecruitmentDate, isBasicRecruitmentComplete, isProfessionalRecruitmentComplete, FILING_WINDOW_WAIT_DAYS } from "@/lib/perm";
import { buildEditUrl, buildEditSectionUrl } from "@/lib/cases/editDeepLinks";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import type { CaseDetailData } from "./case-detail-types";
import { itemVariants, tabContainerVariants, fmtISODate, fmtISOShort, computeWindowStatus } from "./case-detail-utils";
import { WindowCard } from "./WindowCard";

// NOF mini-calendar using central business day logic from @/lib/perm
function NOFMiniCalendar({ start, end }: { start: string; end: string }) {
  const startD = parseISO(start);
  const endD = parseISO(end);
  const startMonth = new Date(startD.getFullYear(), startD.getMonth(), 1);
  const endMonth = new Date(endD.getFullYear(), endD.getMonth(), 1);
  const months: Date[] = [];
  const cur = new Date(startMonth);
  while (cur <= endMonth) {
    months.push(new Date(cur));
    cur.setMonth(cur.getMonth() + 1);
  }
  const HDRS = ["M","T","W","T","F","S","S"];

  // Build holiday lookup for all months in range
  const holidaysByYear = new Map<number, Map<string, string>>();
  for (const m of months) {
    const yr = m.getFullYear();
    if (!holidaysByYear.has(yr)) {
      const hols = getFederalHolidays(yr);
      holidaysByYear.set(yr, new Map(hols.map(h => [h.date, h.name])));
    }
  }

  function getDayInfo(d: Date): { cls: string; tooltip?: string } {
    const dateStr = format(d, "yyyy-MM-dd");
    const dayOfWeek = d.getDay();
    const isWknd = dayOfWeek === 0 || dayOfWeek === 6;
    const inRange = d >= startD && d <= endD;
    const bizDay = isBusinessDay(dateStr);
    const holName = holidaysByYear.get(d.getFullYear())?.get(dateStr);
    const dayName = dayOfWeek === 0 ? "Sunday" : dayOfWeek === 6 ? "Saturday" : "";

    // Business day within posting range — posted
    if (inRange && bizDay) {
      return { cls: "nof-day posted", tooltip: `Posted · ${format(d, "MMM d")}` };
    }

    // Weekend (may also be a holiday — combine both reasons)
    if (isWknd) {
      const reasons = [dayName];
      if (holName) reasons.push(holName);
      return { cls: "nof-day weekend", tooltip: reasons.join(" · ") };
    }

    // Weekday holiday (in or out of range — not a business day)
    if (holName) {
      return {
        cls: inRange ? "nof-day weekend" : "nof-day outside",
        tooltip: `${holName} (Holiday)`,
      };
    }

    // Outside posting period
    if (!inRange) {
      return { cls: "nof-day outside", tooltip: "Outside posting period" };
    }

    return { cls: "nof-day" };
  }

  return (
    <div className="nof-months">
      {months.map((m) => {
        const yr = m.getFullYear();
        const mo = m.getMonth();
        const daysInMonth = new Date(yr, mo + 1, 0).getDate();
        const firstDow = (new Date(yr, mo, 1).getDay() + 6) % 7; // Monday=0
        const label = format(m, "MMM yyyy");
        return (
          <div key={label}>
            <div className="nof-month-label">{label}</div>
            <div className="nof-calendar">
              {HDRS.map((h, i) => <div key={i} className="nof-hdr">{h}</div>)}
              {Array.from({ length: firstDow }, (_, i) => <div key={`e${i}`} className="nof-day empty">&nbsp;</div>)}
              {Array.from({ length: daysInMonth }, (_, i) => {
                const day = new Date(yr, mo, i + 1);
                const info = getDayInfo(day);
                return (
                  <div
                    key={i + 1}
                    className={info.cls}
                    {...(info.tooltip ? { "data-tooltip": info.tooltip } : {})}
                  >
                    {i + 1}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function StatusTooltip({ color, message }: { color: "amber" | "emerald"; message: string }) {
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="shrink-0 cursor-help">
            <Info className={`h-3 w-3 ${color === "amber" ? "text-data-warn-ink" : "text-primary"}`} />
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[240px] text-sm">
          {message}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

interface RecruitmentTabProps {
  caseData: CaseDetailData;
}

export function RecruitmentTab({ caseData }: RecruitmentTabProps) {
  // PWD validity period (determination -> expiration)
  const windowStart = caseData.pwdDeterminationDate;
  const windowEnd = caseData.pwdExpirationDate;
  const ws = computeWindowStatus(windowStart, windowEnd);

  const hasJobOrder = !!caseData.jobOrderStartDate;
  const hasSundayAds = !!caseData.sundayAdFirstDate;
  const hasNOF = !!caseData.noticeOfFilingStartDate;
  const methods = caseData.additionalRecruitmentMethods || [];

  // Use canonical recruitment date functions from @/lib/perm
  const recruitStartDate = getFirstRecruitmentDate(caseData);
  const recruitEndDate = getLastRecruitmentDate(caseData, caseData.isProfessionalOccupation ?? false);
  const recruitmentComplete = isBasicRecruitmentComplete(caseData) && (!caseData.isProfessionalOccupation || isProfessionalRecruitmentComplete(caseData));

  const quietPeriodEndDate = useMemo(() => {
    if (!recruitEndDate) return null;
    try {
      return format(addDays(parseISO(recruitEndDate), FILING_WINDOW_WAIT_DAYS), "yyyy-MM-dd");
    } catch {
      return null;
    }
  }, [recruitEndDate]);

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={tabContainerVariants}
      className="space-y-6"
    >
      {/* Recruitment Window Card */}
      {ws && (
        <WindowCard
          ws={ws}
          title="Recruitment Window"
          stageColor="var(--stage-recruitment)"
          startDate={windowStart}
          endDate={windowEnd}
        />
      )}

      {/* Recruitment Steps — 2x2 grid */}
      <motion.div variants={itemVariants}>
        <div className="recruit-grid">
          {/* Job Order */}
          <Link href={buildEditUrl(caseData._id, "jobOrderStartDate")} className="detail-card-link" title="Edit in case form">
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
                      <span className="recruit-range-date">{fmtISOShort(caseData.jobOrderStartDate)}</span>
                      <div className="recruit-range-fill" style={{ background: "var(--stage-recruitment)" }} />
                      <span className="recruit-range-date">{fmtISODate(caseData.jobOrderEndDate)}</span>
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
          </Link>

          {/* Sunday Ads */}
          <Link href={buildEditUrl(caseData._id, "sundayAdFirstDate")} className="detail-card-link" title="Edit in case form">
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
                      <div className="min-w-0">
                        <div className="recruit-ad-date">{fmtISODate(caseData.sundayAdFirstDate)}</div>
                        {caseData.sundayAdNewspaper && (
                          <div className="recruit-ad-pub" title={caseData.sundayAdNewspaper}>{caseData.sundayAdNewspaper}</div>
                        )}
                      </div>
                    </div>
                    {caseData.sundayAdSecondDate && (
                      <div className="recruit-ad-entry">
                        <div className="recruit-ad-num">2</div>
                        <div className="min-w-0">
                          <div className="recruit-ad-date">{fmtISODate(caseData.sundayAdSecondDate)}</div>
                          {caseData.sundayAdNewspaper && (
                            <div className="recruit-ad-pub" title={caseData.sundayAdNewspaper}>{caseData.sundayAdNewspaper}</div>
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
          </Link>

          {/* Notice of Filing */}
          <Link href={buildEditUrl(caseData._id, "noticeOfFilingStartDate")} className="detail-card-link" title="Edit in case form">
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
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                    <div className="recruit-posting-info" style={{ marginBottom: 10, textAlign: "center" }}>
                      10 consecutive business days &middot; {fmtISOShort(caseData.noticeOfFilingStartDate)} to {fmtISODate(caseData.noticeOfFilingEndDate)}
                    </div>
                    {caseData.noticeOfFilingStartDate && caseData.noticeOfFilingEndDate && (
                      <NOFMiniCalendar start={caseData.noticeOfFilingStartDate} end={caseData.noticeOfFilingEndDate} />
                    )}
                  </div>
                ) : (
                  <div className="detail-empty-state">
                    <div className="detail-empty-state-title">Not started</div>
                    <div className="detail-empty-state-desc">Notice of Filing dates will appear here.</div>
                  </div>
                )}
              </div>
            </div>
          </Link>

          {/* Additional Methods */}
          <Link href={buildEditSectionUrl(caseData._id, "recruitment")} className="detail-card-link" title="Edit in case form">
            <div className="detail-card">
              <div className="detail-card-head ch-rec">
                <span className="flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5" />
                  Additional Methods
                </span>{" "}
                <span className="head-badge">{methods.length} / {caseData.isProfessionalOccupation ? Math.max(3, methods.length) : methods.length}</span>
              </div>
              <div className="detail-card-body" style={{ padding: 0 }}>
                {methods.length > 0 ? (
                  methods.map((method, i) => {
                  const hasDate = !!(method.date || method.startDate || (method.subEntries && method.subEntries.length > 0));
                  const dateDisplay = method.startDate && method.endDate
                    ? `${fmtISOShort(method.startDate)} to ${fmtISOShort(method.endDate)}`
                    : method.date
                      ? fmtISODate(method.date)
                      : null;
                  return (
                    <div key={i} className="recruit-row">
                      <div className={`recruit-icon ${hasDate ? "done" : "pending"}`}>
                        {hasDate ? (
                          <Check className="h-3.5 w-3.5" />
                        ) : (
                          <Clock className="h-3.5 w-3.5" />
                        )}
                      </div>
                      <div className="recruit-info">
                        <div className="recruit-title" title={getMethodLabel(method.method)}>{getMethodLabel(method.method)}</div>
                        {method.description && (
                          <div className="recruit-detail" title={method.description}>{method.description}</div>
                        )}
                        {method.subEntries && method.subEntries.length > 0 && (
                          <div className="recruit-sub-entries">
                            {method.subEntries.map((sub, j) => (
                              <div key={j} className="recruit-sub-entry">
                                {sub.date && <span className="recruit-sub-date">{fmtISODate(sub.date)}</span>}
                                {sub.description && <span className="recruit-sub-desc" title={sub.description}>{sub.description}</span>}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      {dateDisplay && (
                        <span className="recruit-date">{dateDisplay}</span>
                      )}
                    </div>
                  );
                })
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
          </Link>
        </div>
      </motion.div>

      {/* Summary */}
      <motion.div variants={itemVariants}>
        <div className="detail-card">
          <div className="detail-card-head ch-muted">
            <span className="flex items-center gap-1.5">
              <ChartBar className="h-3.5 w-3.5" />
              Summary
            </span>
          </div>
          <div className="field-grid" style={{ padding: 0, borderBottom: "3px solid var(--border)" }}>
            <div className="field-cell">
              <div className="fc-label">Applicants</div>
              <div className="fc-val">{caseData.recruitmentApplicantsCount || "-"}</div>
            </div>
            <div className="field-cell">
              <div className="fc-label flex items-center gap-1">
                Recruitment Period{!recruitmentComplete && recruitStartDate && " (Projected)"}
                {!recruitmentComplete && recruitStartDate && (
                  <StatusTooltip color="amber" message="Based on current dates. Complete all recruitment activities for final dates." />
                )}
                {recruitmentComplete && (
                  <StatusTooltip color="emerald" message="Recruitment complete. Dates are final." />
                )}
              </div>
              <div className="fc-val mono">
                {recruitStartDate && recruitEndDate
                  ? `${fmtISOShort(recruitStartDate)} to ${fmtISOShort(recruitEndDate)}`
                  : "-"}
              </div>
            </div>
            <div className="field-cell">
              <div className="fc-label flex items-center gap-1">
                Quiet Period Ends{!recruitmentComplete && recruitEndDate && " (Projected)"}
                {!recruitmentComplete && recruitEndDate && (
                  <StatusTooltip color="amber" message="Based on current dates. Complete all recruitment activities for final dates." />
                )}
                {recruitmentComplete && recruitEndDate && (
                  <StatusTooltip color="emerald" message="Recruitment complete. Dates are final." />
                )}
              </div>
              <div className="fc-val mono">
                {quietPeriodEndDate ? fmtISODate(quietPeriodEndDate) : "-"}
              </div>
            </div>
          </div>
          {(caseData.recruitmentNotes || caseData.recruitmentSummaryCustom) && (
            <div style={{ padding: "16px 20px" }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: "10px", textTransform: "uppercase", color: "var(--muted-foreground)", marginBottom: 6 }}>Result</div>
              <div className="line-clamp-4" style={{ fontSize: "0.88rem", lineHeight: 1.55 }} title={caseData.recruitmentSummaryCustom || caseData.recruitmentNotes || undefined}>
                {caseData.recruitmentSummaryCustom || caseData.recruitmentNotes}
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
