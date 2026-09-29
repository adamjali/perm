"use client";

import { TrendUpIcon as TrendingUp } from "@phosphor-icons/react";
import { parseISO, differenceInDays } from "date-fns";
import { buildDeadlineInput, extractActiveDeadlines, isDeadlineActive, type LooseDeadlineCaseData } from "@/lib/perm";
import { extractMilestones } from "@/lib/timeline/milestones";
import { countDueDeadlines } from "./next-up-section.utils";
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

  // The PWD's expiry counts only while the central rules say it still matters
  // (until the ETA 9089 is filed). After that, the clock that matters is how
  // long the filing has been with DOL.
  const input = buildDeadlineInput(caseData as LooseDeadlineCaseData);
  const pwdMatters = isDeadlineActive("pwd_expiration", input).isActive;
  // The central list's own count, so this matches the dashboard to the day.
  // (Subtracting now from a midnight date dropped a day after midnight.)
  const pwdDeadline = extractActiveDeadlines(input).find((d) => d.type === "pwd_expiration");
  const pwdExpiryDays = Math.max(0, pwdDeadline?.daysUntil ?? 0);
  const etaFiledDays = caseData.eta9089FilingDate
    ? Math.max(0, differenceInDays(now, parseISO(caseData.eta9089FilingDate)))
    : null;

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

  // Deadlines due within 30 days, from the same central list as the next-up box
  // above (which already shows the single nearest one).
  const { due, late } = countDueDeadlines(caseData);

  return (
    <div className="detail-card">
      <div className="detail-card-head ch-muted">
        <span className="flex items-center gap-1.5">
          <TrendingUp className="h-3.5 w-3.5" />
          Quick stats
        </span>
      </div>
      <div className="stats-grid">
        {!pwdMatters && etaFiledDays !== null ? (
          <CountUpStat target={etaFiledDays} color="var(--stage-eta9089-ink)" label="ETA 9089 filed" sub="days with DOL" />
        ) : (
          <CountUpStat
            target={pwdExpiryDays}
            color={caseData.pwdExpirationDate && pwdExpiryDays <= 30 ? "var(--data-warn-ink)" : "var(--stage-pwd-ink)"}
            label="PWD expires"
            sub={caseData.pwdExpirationDate ? "days left" : "no date yet"}
          />
        )}
        <CountUpStat target={daysInProcess} label="In process" sub={caseData.pwdFilingDate ? "days since PWD filed" : "days since added"} />
        <CountUpStat target={completedMilestones} color="var(--primary-text)" label="Milestones" sub={`of ${allMilestones.length} done`} />
        <CountUpStat
          target={due}
          color={late > 0 ? "var(--destructive-text)" : due > 0 ? "var(--data-warn-ink)" : undefined}
          label="Due in 30 days"
          sub={late > 0 ? `${late} already late` : due === 1 ? "deadline" : "deadlines"}
        />
      </div>
    </div>
  );
}
