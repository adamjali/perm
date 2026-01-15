/**
 * MiniCalendar Component
 *
 * Compact month view calendar showing current month with deadline indicators.
 * Days with deadlines show colored dots based on deadline type.
 *
 * Features:
 * - 7-column grid (Sun-Sat headers)
 * - Today highlighted with primary color
 * - Color-coded dots by deadline type (PWD blue, recruitment purple, etc.)
 * - Dark mode support via CSS variables
 *
 */

"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DemoCase } from "@/lib/demo";
import type { CaseStatus } from "@/lib/perm";

interface MiniCalendarProps {
  cases: DemoCase[];
  onDateClick?: (date: string) => void;
}

type DeadlineType = CaseStatus | "rfi";

interface DeadlineEvent {
  date: string;
  type: DeadlineType;
  label: string;
  caseId: string;
}

/**
 * Stage color mapping for deadline dots
 */
const STAGE_COLORS: Record<DeadlineType, string> = {
  pwd: "bg-stage-pwd",
  recruitment: "bg-stage-recruitment",
  eta9089: "bg-stage-eta9089",
  i140: "bg-stage-i140",
  rfi: "bg-urgency-urgent",
  closed: "bg-stage-closed",
};

const WEEKDAY_HEADERS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/**
 * Extract all deadline dates from cases for calendar display
 */
function extractDeadlinesFromCases(cases: DemoCase[]): DeadlineEvent[] {
  const events: DeadlineEvent[] = [];

  for (const caseData of cases) {
    // PWD expiration (blue)
    if (caseData.pwdExpirationDate) {
      events.push({
        date: caseData.pwdExpirationDate,
        type: "pwd",
        label: "PWD Expiration",
        caseId: caseData.id,
      });
    }

    // Recruitment dates (purple)
    if (caseData.jobOrderEndDate) {
      events.push({
        date: caseData.jobOrderEndDate,
        type: "recruitment",
        label: "Job Order End",
        caseId: caseData.id,
      });
    }
    if (caseData.noticeOfFilingEndDate) {
      events.push({
        date: caseData.noticeOfFilingEndDate,
        type: "recruitment",
        label: "NOF End",
        caseId: caseData.id,
      });
    }

    // ETA 9089 (orange)
    if (caseData.eta9089ExpirationDate) {
      events.push({
        date: caseData.eta9089ExpirationDate,
        type: "eta9089",
        label: "ETA 9089 Expiration",
        caseId: caseData.id,
      });
    }

    // I-140 (green)
    if (caseData.i140ApprovalDate) {
      events.push({
        date: caseData.i140ApprovalDate,
        type: "i140",
        label: "I-140 Approval",
        caseId: caseData.id,
      });
    }

    // RFI/RFE due dates (red/urgent)
    if (caseData.rfiDueDate && !caseData.rfiSubmittedDate) {
      events.push({
        date: caseData.rfiDueDate,
        type: "rfi",
        label: "RFI Due",
        caseId: caseData.id,
      });
    }
    if (caseData.rfeDueDate && !caseData.rfeSubmittedDate) {
      events.push({
        date: caseData.rfeDueDate,
        type: "rfi",
        label: "RFE Due",
        caseId: caseData.id,
      });
    }
  }

  return events;
}

/**
 * Get calendar days for a month, including padding for first week
 */
function getCalendarDays(year: number, month: number): (number | null)[] {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();
  const startingDayOfWeek = firstDay.getDay();

  const days: (number | null)[] = [];

  // Add padding for first week
  for (let i = 0; i < startingDayOfWeek; i++) {
    days.push(null);
  }

  // Add actual days
  for (let day = 1; day <= daysInMonth; day++) {
    days.push(day);
  }

  return days;
}

/**
 * Format date as YYYY-MM-DD
 */
function formatDate(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function MiniCalendar({ cases, onDateClick }: MiniCalendarProps) {
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth();
  const currentDay = today.getDate();

  const monthName = today.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  const calendarDays = useMemo(
    () => getCalendarDays(currentYear, currentMonth),
    [currentYear, currentMonth]
  );

  const deadlineEvents = useMemo(() => extractDeadlinesFromCases(cases), [cases]);

  // Group events by date for quick lookup
  const eventsByDate = useMemo(() => {
    const map = new Map<string, DeadlineEvent[]>();
    for (const event of deadlineEvents) {
      const existing = map.get(event.date) || [];
      existing.push(event);
      map.set(event.date, existing);
    }
    return map;
  }, [deadlineEvents]);

  const handleDateClick = (day: number | null) => {
    if (day && onDateClick) {
      onDateClick(formatDate(currentYear, currentMonth, day));
    }
  };

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">{monthName}</CardTitle>
      </CardHeader>
      <CardContent className="pb-4">
        {/* Weekday Headers */}
        <div className="mb-1 grid grid-cols-7 gap-0.5 text-center">
          {WEEKDAY_HEADERS.map((day) => (
            <div
              key={day}
              className="text-[10px] font-semibold text-muted-foreground"
            >
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7 gap-0.5">
          {calendarDays.map((day, index) => {
            if (day === null) {
              return <div key={`empty-${index}`} className="aspect-square" />;
            }

            const dateStr = formatDate(currentYear, currentMonth, day);
            const events = eventsByDate.get(dateStr) || [];
            const isToday = day === currentDay;
            const hasEvents = events.length > 0;

            // Get unique event types for this day (for multiple dots)
            const uniqueTypes = Array.from(new Set(events.map((e) => e.type)));

            return (
              <button
                key={day}
                type="button"
                onClick={() => handleDateClick(day)}
                className={`
                  relative flex aspect-square flex-col items-center justify-center
                  text-xs transition-colors
                  ${
                    isToday
                      ? "bg-primary font-bold text-primary-foreground"
                      : hasEvents
                        ? "cursor-pointer font-medium hover:bg-muted"
                        : "text-muted-foreground hover:bg-muted/50"
                  }
                `}
                aria-label={`${day}${hasEvents ? `, ${events.length} event${events.length > 1 ? "s" : ""}` : ""}`}
              >
                <span>{day}</span>

                {/* Event Dots */}
                {hasEvents && (
                  <div className="absolute bottom-0.5 flex gap-0.5">
                    {uniqueTypes.slice(0, 3).map((type, i) => (
                      <span
                        key={`${day}-${type}-${i}`}
                        className={`size-1 rounded-full ${STAGE_COLORS[type]}`}
                      />
                    ))}
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Legend */}
        <div className="mt-3 flex flex-wrap gap-2 border-t border-border pt-2">
          <div className="flex items-center gap-1">
            <span className="size-2 rounded-full bg-stage-pwd" />
            <span className="text-[10px] text-muted-foreground">PWD</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="size-2 rounded-full bg-stage-recruitment" />
            <span className="text-[10px] text-muted-foreground">Recruitment</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="size-2 rounded-full bg-stage-eta9089" />
            <span className="text-[10px] text-muted-foreground">ETA</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="size-2 rounded-full bg-urgency-urgent" />
            <span className="text-[10px] text-muted-foreground">RFI</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
