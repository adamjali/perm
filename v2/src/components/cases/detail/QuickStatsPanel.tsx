"use client";

import { useEffect, useRef, useState } from "react";
import { TrendingUp } from "lucide-react";
import type { CaseDetailData } from "./case-detail-types";

interface QuickStatsPanelProps {
  caseData: CaseDetailData;
}

function useCountUp(target: number, duration = 400): number {
  const [value, setValue] = useState(0);
  const frameRef = useRef<number>(0);

  useEffect(() => {
    const startTime = performance.now();
    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - (1 - progress) * (1 - progress);
      setValue(Math.round(eased * target));
      if (progress < 1) {
        frameRef.current = requestAnimationFrame(animate);
      }
    };
    frameRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frameRef.current);
  }, [target, duration]);

  return value;
}

function CountUpStat({ target, color, label, sub }: { target: number; color?: string; label: string; sub: string }) {
  const animated = useCountUp(target);
  return (
    <div className="stat">
      <div className="stat-val" style={color ? { color } : undefined}>{animated}</div>
      <div className="stat-label">{label}</div>
      <div className="stat-sub">{sub}</div>
    </div>
  );
}

export function QuickStatsPanel({ caseData }: QuickStatsPanelProps) {
  const todayStr = new Date().toISOString().split("T")[0] as string;

  // PWD Expiry Days
  let pwdExpiryDays = 0;
  if (caseData.pwdExpirationDate) {
    pwdExpiryDays = Math.max(
      0,
      Math.floor(
        (new Date(caseData.pwdExpirationDate).getTime() - new Date(todayStr).getTime()) /
          (1000 * 60 * 60 * 24)
      )
    );
  }

  // Case Age
  const caseAge = Math.floor(
    (new Date().getTime() - new Date(caseData.createdAt).getTime()) /
      (1000 * 60 * 60 * 24)
  );

  // Steps completed (count recruitment milestones)
  let stepsCompleted = 0;
  let totalSteps = 10;
  if (caseData.pwdFilingDate) stepsCompleted++;
  if (caseData.pwdDeterminationDate) stepsCompleted++;
  if (caseData.jobOrderStartDate) stepsCompleted++;
  if (caseData.jobOrderEndDate) stepsCompleted++;
  if (caseData.sundayAdFirstDate) stepsCompleted++;
  if (caseData.sundayAdSecondDate) stepsCompleted++;
  if (caseData.noticeOfFilingStartDate) stepsCompleted++;
  if (caseData.noticeOfFilingEndDate) stepsCompleted++;
  if (caseData.eta9089FilingDate) stepsCompleted++;
  if (caseData.eta9089CertificationDate) stepsCompleted++;
  totalSteps = 10;

  // Filing window days
  let filingWindowDays = 0;
  if (caseData.pwdExpirationDate) {
    filingWindowDays = Math.max(
      0,
      Math.floor(
        (new Date(caseData.pwdExpirationDate).getTime() - new Date(todayStr).getTime()) /
          (1000 * 60 * 60 * 24)
      )
    );
  }

  return (
    <div className="detail-card">
      <div className="detail-card-head ch-muted">
        <span className="flex items-center gap-1.5">
          <TrendingUp className="h-3.5 w-3.5" />
          Quick Stats
        </span>
      </div>
      <div className="stats-grid">
        <CountUpStat target={pwdExpiryDays} color="var(--stage-eta9089)" label="PWD Expiry" sub="days left" />
        <CountUpStat target={caseAge} label="Case Age" sub="days" />
        <CountUpStat target={stepsCompleted} color="var(--stage-recruitment)" label="Steps Done" sub={`of ${totalSteps}`} />
        <CountUpStat target={filingWindowDays} color="var(--stage-pwd)" label="Days to File" sub="filing window" />
      </div>
    </div>
  );
}
