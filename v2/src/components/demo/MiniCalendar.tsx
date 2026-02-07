/**
 * MiniCalendar Component
 *
 * Neobrutalist calendar view with color-coded deadline dots.
 * Matches the real product's calendar styling with bold borders,
 * hard shadows, and stage-colored indicators.
 */

"use client";

import { useMemo } from "react";
import { CalendarDays } from "lucide-react";
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

const STAGE_COLORS: Record<DeadlineType, string> = {
  pwd: "bg-stage-pwd",
  recruitment: "bg-stage-recruitment",
  eta9089: "bg-stage-eta9089",
  i140: "bg-stage-i140",
  rfi: "bg-urgency-urgent",
  closed: "bg-stage-closed",
};

const WEEKDAY_HEADERS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function extractDeadlinesFromCases(cases: DemoCase[]): DeadlineEvent[] {
  const events: DeadlineEvent[] = [];

  for (const caseData of cases) {
    if (caseData.pwdExpirationDate) {
      events.push({
        date: caseData.pwdExpirationDate,
        type: "pwd",
        label: "PWD Expiration",
        caseId: caseData.id,
      });
    }
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
    if (caseData.eta9089ExpirationDate) {
      events.push({
        date: caseData.eta9089ExpirationDate,
        type: "eta9089",
        label: "ETA 9089 Expiration",
        caseId: caseData.id,
      });
    }
    if (caseData.i140ApprovalDate) {
      events.push({
        date: caseData.i140ApprovalDate,
        type: "i140",
        label: "I-140 Approval",
        caseId: caseData.id,
      });
    }
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

function getCalendarDays(year: number, month: number): (number | null)[] {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();
  const startingDayOfWeek = firstDay.getDay();

  const days: (number | null)[] = [];

  for (let i = 0; i < startingDayOfWeek; i++) {
    days.push(null);
  }

  for (let day = 1; day <= daysInMonth; day++) {
    days.push(day);
  }

  return days;
}

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
    <div className="border-3 border-border bg-background shadow-hard overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 border-b-2 border-border bg-muted px-4 py-3">
        <CalendarDays className="h-4 w-4 text-primary" />
        <h3 className="font-heading text-sm font-bold">{monthName}</h3>
      </div>

      <div className="p-4">
        {/* Weekday Headers */}
        <div className="mb-2 grid grid-cols-7 gap-1 text-center">
          {WEEKDAY_HEADERS.map((day) => (
            <div
              key={day}
              className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground"
            >
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7 gap-1">
          {calendarDays.map((day, index) => {
            if (day === null) {
              return <div key={`empty-${index}`} className="aspect-square" />;
            }

            const dateStr = formatDate(currentYear, currentMonth, day);
            const events = eventsByDate.get(dateStr) || [];
            const isToday = day === currentDay;
            const hasEvents = events.length > 0;
            const uniqueTypes = Array.from(new Set(events.map((e) => e.type)));

            return (
              <button
                key={day}
                type="button"
                onClick={() => handleDateClick(day)}
                className={`
                  relative flex aspect-square flex-col items-center justify-center text-xs transition-all duration-150
                  ${
                    isToday
                      ? "border-2 border-border bg-primary font-black text-black shadow-hard-sm"
                      : hasEvents
                        ? "cursor-pointer font-bold hover:bg-muted border border-transparent hover:border-border"
                        : "text-muted-foreground hover:bg-muted/50"
                  }
                `}
                aria-label={`${day}${hasEvents ? `, ${events.length} event${events.length > 1 ? "s" : ""}` : ""}`}
              >
                <span>{day}</span>

                {/* Event Dots — square to match neobrutalist */}
                {hasEvents && (
                  <div className="absolute bottom-0.5 flex gap-0.5">
                    {uniqueTypes.slice(0, 3).map((type, i) => (
                      <span
                        key={`${day}-${type}-${i}`}
                        className={`h-1 w-1.5 ${STAGE_COLORS[type]}`}
                      />
                    ))}
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Legend */}
        <div className="mt-4 flex flex-wrap gap-3 border-t-2 border-dashed border-border pt-3">
          {[
            { color: "bg-stage-pwd", label: "PWD" },
            { color: "bg-stage-recruitment", label: "Recruitment" },
            { color: "bg-stage-eta9089", label: "ETA 9089" },
            { color: "bg-stage-i140", label: "I-140" },
            { color: "bg-urgency-urgent", label: "RFI/RFE" },
          ].map((item) => (
            <div key={item.label} className="flex items-center gap-1.5">
              <span className={`h-2 w-2 ${item.color}`} />
              <span className="font-mono text-[10px] text-muted-foreground">{item.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
