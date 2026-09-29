"use client";

import { TrendUpIcon as TrendingUp } from "@phosphor-icons/react";
import { parseISO, differenceInDays } from "date-fns";
import { extractMilestones } from "@/lib/timeline/milestones";
import { calculateNextDeadline } from "./next-up-section.utils";
import type { CaseDetailData } from "./case-detail-types";

interface QuickStatsPanelProps {
  caseData: CaseDetailData;
}

// The figure itself, at once. A count-up used to start when the panel scrolled
// into view and reset to 0 whenever the case data arrived after that, with its
// observer already gone, so the panel could sit at "0 days left" for good.
function CountUpStat({ target, color, label, sub }: { target: number; color?: string; label: string; sub: string }) {
  return (
    <div className="stat">
      <div className="stat-val" style={color ? { color } : undefined}>{target}</div>
      <div className="stat-label">{label}</div>
      <div className="stat-sub">{sub}</div>
    </div>
  );
}

export function QuickStatsPanel({ caseData }: QuickStatsPanelProps) {
  const now = new Date();

  // PWD Expiry Days — use parseISO to avoid timezone shift
  let pwdExpiryDays = 0;
  if (caseData.pwdExpirationDate) {
    pwdExpiryDays = Math.max(0, differenceInDays(parseISO(caseData.pwdExpirationDate), now));
  }

  // Time in process, counted from the PWD filing (the start of the PERM path),
  // or from when the case was added here while no PWD date is recorded.
  const processStart = caseData.pwdFilingDate ? parseISO(caseData.pwdFilingDate) : new Date(caseData.createdAt);
  const daysInProcess = Math.max(0, differenceInDays(now, processStart));

  // Milestones completed vs total
  const allMilestones = extractMilestones(caseData);
  const todayStr = now.toISOString().split("T")[0] as string;
  const completedMilestones = allMilestones.filter(
    (m) => m.date && m.date <= todayStr && !m.isCalculated
  ).length;

  // Next deadline — use canonical extractActiveDeadlines (same as NextUp section)
  const nextDeadline = calculateNextDeadline(caseData);
  const nextDeadlineDays = nextDeadline ? Math.max(0, nextDeadline.daysUntil) : 0;
  const nextDeadlineLabel = nextDeadline ? nextDeadline.label : "no deadline";

  return (
    <div className="detail-card">
      <div className="detail-card-head ch-muted">
        <span className="flex items-center gap-1.5">
          <TrendingUp className="h-3.5 w-3.5" />
          Quick stats
        </span>
      </div>
      <div className="stats-grid">
        <CountUpStat target={pwdExpiryDays} color="var(--stage-pwd-ink)" label="PWD expires" sub="days left" />
        <CountUpStat target={daysInProcess} label="In process" sub={caseData.pwdFilingDate ? "days since PWD filed" : "days since added"} />
        <CountUpStat target={completedMilestones} color="var(--primary-text)" label="Milestones" sub={`of ${allMilestones.length} done`} />
        <CountUpStat
          target={nextDeadlineDays}
          color={nextDeadline && nextDeadlineDays <= 30 ? "var(--data-warn-ink)" : undefined}
          label="Next deadline"
          sub={nextDeadlineLabel}
        />
      </div>
    </div>
  );
}
