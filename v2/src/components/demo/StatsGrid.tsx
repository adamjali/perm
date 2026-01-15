/**
 * StatsGrid Component
 *
 * Displays 4 stat cards summarizing demo case data.
 * Responsive: 2x2 on mobile, 4-column on desktop.
 *
 * Stats:
 * - Total Cases: cases.length
 * - Active Deadlines: cases with any upcoming deadline
 * - This Week: deadlines within 7 days
 * - Overdue: past deadlines
 *
 */

"use client";

import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import type { DemoCase } from "@/lib/demo";

interface StatsGridProps {
  cases: DemoCase[];
}

interface StatCardProps {
  value: number;
  label: string;
  colorClass?: string;
}

function StatCard({ value, label, colorClass = "text-foreground" }: StatCardProps) {
  return (
    <Card className="text-center">
      <CardContent className="flex flex-col items-center justify-center gap-1 py-4">
        <span
          className={`font-heading text-3xl font-black ${colorClass}`}
        >
          {value}
        </span>
        <span className="text-sm font-semibold text-muted-foreground">
          {label}
        </span>
      </CardContent>
    </Card>
  );
}

/**
 * Get all deadline dates from a case that are relevant for tracking
 */
function getUpcomingDeadlines(caseData: DemoCase): string[] {
  const deadlines: string[] = [];

  // PWD expiration
  if (caseData.pwdExpirationDate) {
    deadlines.push(caseData.pwdExpirationDate);
  }

  // Job order end
  if (caseData.jobOrderEndDate) {
    deadlines.push(caseData.jobOrderEndDate);
  }

  // Notice of filing end
  if (caseData.noticeOfFilingEndDate) {
    deadlines.push(caseData.noticeOfFilingEndDate);
  }

  // RFI due date
  if (caseData.rfiDueDate && !caseData.rfiSubmittedDate) {
    deadlines.push(caseData.rfiDueDate);
  }

  // RFE due date
  if (caseData.rfeDueDate && !caseData.rfeSubmittedDate) {
    deadlines.push(caseData.rfeDueDate);
  }

  // ETA 9089 expiration
  if (caseData.eta9089ExpirationDate) {
    deadlines.push(caseData.eta9089ExpirationDate);
  }

  return deadlines;
}

/**
 * Parse a YYYY-MM-DD string as a UTC date to avoid timezone issues.
 * new Date('2024-01-15') parses as UTC but comparison with local time can shift days.
 */
function parseUTCDate(dateStr: string): Date {
  return new Date(dateStr + "T00:00:00Z");
}

/**
 * Get today's date as UTC midnight for consistent comparison.
 */
function getTodayUTC(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
}

export function StatsGrid({ cases }: StatsGridProps) {
  const stats = useMemo(() => {
    // Use UTC dates consistently to avoid timezone issues
    const today = getTodayUTC();
    const oneWeekFromNow = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);

    let activeDeadlines = 0;
    let thisWeek = 0;
    let overdue = 0;

    for (const caseData of cases) {
      const deadlines = getUpcomingDeadlines(caseData);

      for (const deadlineStr of deadlines) {
        // Parse deadline as UTC to match our UTC comparison dates
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
      />
      <StatCard
        value={stats.activeDeadlines}
        label="Active Deadlines"
        colorClass="text-stage-pwd"
      />
      <StatCard
        value={stats.thisWeek}
        label="This Week"
        colorClass="text-urgency-soon"
      />
      <StatCard
        value={stats.overdue}
        label="Overdue"
        colorClass="text-urgency-urgent"
      />
    </div>
  );
}
