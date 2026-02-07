/**
 * StatsGrid Component
 *
 * Dashboard-style stat cards matching the real product's deadline hub.
 * Neobrutalist styling with stage-colored accents and bold typography.
 */

"use client";

import { useMemo } from "react";
import {
  Briefcase,
  CalendarClock,
  CalendarDays,
  AlertTriangle,
} from "lucide-react";
import type { DemoCase } from "@/lib/demo";

interface StatsGridProps {
  cases: DemoCase[];
}

interface StatCardProps {
  value: number;
  label: string;
  icon: React.ReactNode;
  accentColor: string;
  sublabel?: string;
}

function StatCard({ value, label, icon, accentColor, sublabel }: StatCardProps) {
  return (
    <div className="group relative border-3 border-border bg-background overflow-hidden shadow-hard transition-all duration-200 hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-hard-lg">
      {/* Top accent bar */}
      <div
        className="absolute inset-x-0 top-0 h-1"
        style={{ backgroundColor: accentColor }}
        aria-hidden="true"
      />

      <div className="flex items-center gap-4 p-5">
        {/* Icon */}
        <div
          className="flex h-12 w-12 shrink-0 items-center justify-center border-2 border-border"
          style={{ backgroundColor: accentColor, color: "#000" }}
        >
          {icon}
        </div>

        {/* Content */}
        <div className="min-w-0">
          <div className="font-heading text-3xl font-black tracking-tight">
            {value}
          </div>
          <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
            {label}
          </div>
          {sublabel && (
            <div className="mt-0.5 text-[10px] text-muted-foreground/70">
              {sublabel}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Get all deadline dates from a case that are relevant for tracking
 */
function getUpcomingDeadlines(caseData: DemoCase): string[] {
  const deadlines: string[] = [];

  if (caseData.pwdExpirationDate) {
    deadlines.push(caseData.pwdExpirationDate);
  }
  if (caseData.jobOrderEndDate) {
    deadlines.push(caseData.jobOrderEndDate);
  }
  if (caseData.noticeOfFilingEndDate) {
    deadlines.push(caseData.noticeOfFilingEndDate);
  }
  if (caseData.rfiDueDate && !caseData.rfiSubmittedDate) {
    deadlines.push(caseData.rfiDueDate);
  }
  if (caseData.rfeDueDate && !caseData.rfeSubmittedDate) {
    deadlines.push(caseData.rfeDueDate);
  }
  if (caseData.eta9089ExpirationDate) {
    deadlines.push(caseData.eta9089ExpirationDate);
  }

  return deadlines;
}

function parseUTCDate(dateStr: string): Date {
  return new Date(dateStr + "T00:00:00Z");
}

function getTodayUTC(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
}

export function StatsGrid({ cases }: StatsGridProps) {
  const stats = useMemo(() => {
    const today = getTodayUTC();
    const oneWeekFromNow = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);

    let activeDeadlines = 0;
    let thisWeek = 0;
    let overdue = 0;

    for (const caseData of cases) {
      const deadlines = getUpcomingDeadlines(caseData);

      for (const deadlineStr of deadlines) {
        const deadline = parseUTCDate(deadlineStr);

        if (deadline.getTime() < today.getTime()) {
          overdue++;
        } else if (deadline.getTime() <= oneWeekFromNow.getTime()) {
          thisWeek++;
          activeDeadlines++;
        } else {
          activeDeadlines++;
        }
      }
    }

    return {
      totalCases: cases.length,
      activeDeadlines,
      thisWeek,
      overdue,
    };
  }, [cases]);

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
      <StatCard
        value={stats.totalCases}
        label="Total Cases"
        icon={<Briefcase className="h-5 w-5" />}
        accentColor="var(--primary)"
        sublabel="All stages"
      />
      <StatCard
        value={stats.activeDeadlines}
        label="Active"
        icon={<CalendarClock className="h-5 w-5" />}
        accentColor="var(--stage-pwd)"
        sublabel="Upcoming deadlines"
      />
      <StatCard
        value={stats.thisWeek}
        label="This Week"
        icon={<CalendarDays className="h-5 w-5" />}
        accentColor="var(--stage-recruitment)"
        sublabel="Due within 7 days"
      />
      <StatCard
        value={stats.overdue}
        label="Overdue"
        icon={<AlertTriangle className="h-5 w-5" />}
        accentColor={stats.overdue > 0 ? "var(--urgency-urgent)" : "var(--stage-closed)"}
        sublabel={stats.overdue > 0 ? "Needs attention" : "All clear"}
      />
    </div>
  );
}
