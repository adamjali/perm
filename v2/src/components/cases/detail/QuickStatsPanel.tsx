"use client";

import { useEffect, useRef, useState } from "react";
import { Clock, Calendar, CheckCircle2, Timer } from "lucide-react";
import type { CaseDetailData } from "./case-detail-types";

interface QuickStatsPanelProps {
  caseData: CaseDetailData;
}

interface StatConfig {
  label: string;
  value: number;
  suffix: string;
  icon: typeof Clock;
  color: string;
}

function useCountUp(target: number, duration = 400): number {
  const [value, setValue] = useState(0);
  const frameRef = useRef<number>(0);

  useEffect(() => {
    const startTime = performance.now();
    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease-out quad
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

function StatCard({ label, value, suffix, icon: Icon, color }: StatConfig) {
  const animatedValue = useCountUp(value);

  return (
    <div className="border-2 border-border bg-card p-3 shadow-hard-sm space-y-1">
      <div className="flex items-center gap-2">
        <Icon className="h-3.5 w-3.5" style={{ color }} />
        <span className="font-mono text-[0.625rem] uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
      </div>
      <div className="flex items-baseline gap-1">
        <span className="font-heading text-2xl font-bold count-up">
          {animatedValue}
        </span>
        <span className="font-mono text-xs text-muted-foreground">{suffix}</span>
      </div>
    </div>
  );
}

export function QuickStatsPanel({ caseData }: QuickStatsPanelProps) {
  const today = new Date();
  const todayStr = today.toISOString().split("T")[0] as string;

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

  // Case Age (days since creation)
  const caseAge = Math.floor(
    (today.getTime() - new Date(caseData.createdAt).getTime()) /
      (1000 * 60 * 60 * 24)
  );

  // Recruitment steps completed
  let stepsCompleted = 0;
  if (caseData.jobOrderStartDate) stepsCompleted++;
  if (caseData.jobOrderEndDate) stepsCompleted++;
  if (caseData.sundayAdFirstDate) stepsCompleted++;
  if (caseData.sundayAdSecondDate) stepsCompleted++;
  if (caseData.noticeOfFilingStartDate) stepsCompleted++;
  if (caseData.noticeOfFilingEndDate) stepsCompleted++;

  // Filing window days
  let filingWindowDays = 0;
  if (caseData.eta9089ExpirationDate && caseData.eta9089CertificationDate && !caseData.i140FilingDate) {
    filingWindowDays = Math.max(
      0,
      Math.floor(
        (new Date(caseData.eta9089ExpirationDate).getTime() - new Date(todayStr).getTime()) /
          (1000 * 60 * 60 * 24)
      )
    );
  }

  const stats: StatConfig[] = [
    {
      label: "PWD Expiry",
      value: pwdExpiryDays,
      suffix: "days",
      icon: Timer,
      color: "var(--stage-pwd)",
    },
    {
      label: "Case Age",
      value: caseAge,
      suffix: "days",
      icon: Calendar,
      color: "var(--muted-foreground)",
    },
    {
      label: "Rec. Steps",
      value: stepsCompleted,
      suffix: "/ 6",
      icon: CheckCircle2,
      color: "var(--stage-recruitment)",
    },
    {
      label: "Filing Window",
      value: filingWindowDays,
      suffix: "days",
      icon: Clock,
      color: "var(--stage-eta9089)",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3">
      {stats.map((stat) => (
        <StatCard key={stat.label} {...stat} />
      ))}
    </div>
  );
}
