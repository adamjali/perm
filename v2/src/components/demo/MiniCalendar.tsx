/**
 * MiniCalendar Component
 *
 * Fully interactive neobrutalist calendar with month navigation,
 * color-coded deadline dots, and click-to-view event details.
 */

"use client";

import { useMemo, useState, useRef, useEffect, useCallback } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import type { DemoCase } from "@/lib/demo";
import type { CaseStatus } from "@/lib/perm";

interface MiniCalendarProps {
  cases: DemoCase[];
}

type DeadlineType = CaseStatus | "rfi";

interface DeadlineEvent {
  date: string;
  type: DeadlineType;
  label: string;
  caseId: string;
  caseName: string;
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
    const caseName = caseData.employerName;

    if (caseData.pwdExpirationDate) {
      events.push({
        date: caseData.pwdExpirationDate,
        type: "pwd",
        label: "PWD Expiration",
        caseId: caseData.id,
        caseName,
      });
    }
    if (caseData.jobOrderEndDate) {
      events.push({
        date: caseData.jobOrderEndDate,
        type: "recruitment",
        label: "Job Order End",
        caseId: caseData.id,
        caseName,
      });
    }
    if (caseData.noticeOfFilingEndDate) {
      events.push({
        date: caseData.noticeOfFilingEndDate,
        type: "recruitment",
        label: "NOF End",
        caseId: caseData.id,
        caseName,
      });
    }
    if (caseData.eta9089ExpirationDate) {
      events.push({
        date: caseData.eta9089ExpirationDate,
        type: "eta9089",
        label: "ETA 9089 Expiration",
        caseId: caseData.id,
        caseName,
      });
    }
    if (caseData.i140ApprovalDate) {
      events.push({
        date: caseData.i140ApprovalDate,
        type: "i140",
        label: "I-140 Approval",
        caseId: caseData.id,
        caseName,
      });
    }
    if (caseData.rfiDueDate && !caseData.rfiSubmittedDate) {
      events.push({
        date: caseData.rfiDueDate,
        type: "rfi",
        label: "RFI Due",
        caseId: caseData.id,
        caseName,
      });
    }
    if (caseData.rfeDueDate && !caseData.rfeSubmittedDate) {
      events.push({
        date: caseData.rfeDueDate,
        type: "rfi",
        label: "RFE Due",
        caseId: caseData.id,
        caseName,
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

function formatEventDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function MiniCalendar({ cases }: MiniCalendarProps) {
  const today = new Date();
  const todayYear = today.getFullYear();
  const todayMonth = today.getMonth();
  const todayDay = today.getDate();

  const [viewYear, setViewYear] = useState(todayYear);
  const [viewMonth, setViewMonth] = useState(todayMonth);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const monthName = new Date(viewYear, viewMonth).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  const calendarDays = useMemo(
    () => getCalendarDays(viewYear, viewMonth),
    [viewYear, viewMonth]
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

  const selectedEvents = useMemo(
    () => (selectedDate ? eventsByDate.get(selectedDate) || [] : []),
    [selectedDate, eventsByDate]
  );

  const goToPrevMonth = useCallback(() => {
    setSelectedDate(null);
    setViewMonth((prev) => {
      if (prev === 0) {
        setViewYear((y) => y - 1);
        return 11;
      }
      return prev - 1;
    });
  }, []);

  const goToNextMonth = useCallback(() => {
    setSelectedDate(null);
    setViewMonth((prev) => {
      if (prev === 11) {
        setViewYear((y) => y + 1);
        return 0;
      }
      return prev + 1;
    });
  }, []);

  const goToToday = useCallback(() => {
    setSelectedDate(null);
    setViewYear(todayYear);
    setViewMonth(todayMonth);
  }, [todayYear, todayMonth]);

  const handleDateClick = useCallback(
    (day: number) => {
      const dateStr = formatDate(viewYear, viewMonth, day);
      const events = eventsByDate.get(dateStr);
      if (events && events.length > 0) {
        setSelectedDate((prev) => (prev === dateStr ? null : dateStr));
      } else {
        setSelectedDate(null);
      }
    },
    [viewYear, viewMonth, eventsByDate]
  );

  // Close popover on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setSelectedDate(null);
      }
    }
    if (selectedDate) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [selectedDate]);

  const isCurrentMonthView = viewYear === todayYear && viewMonth === todayMonth;

  // Count events in current view for indicator
  const eventsInView = useMemo(() => {
    let count = 0;
    for (const day of calendarDays) {
      if (day !== null) {
        const dateStr = formatDate(viewYear, viewMonth, day);
        const events = eventsByDate.get(dateStr);
        if (events) count += events.length;
      }
    }
    return count;
  }, [calendarDays, viewYear, viewMonth, eventsByDate]);

  return (
    <div className="border-3 border-border bg-background shadow-hard overflow-hidden" ref={popoverRef}>
      {/* Header with navigation */}
      <div className="flex items-center justify-between border-b-2 border-border bg-muted px-3 py-2.5">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-primary" />
          <h3 className="font-heading text-sm font-bold">{monthName}</h3>
          {eventsInView > 0 && (
            <span className="inline-flex items-center bg-primary px-1.5 py-0 text-[10px] font-black text-black">
              {eventsInView}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {!isCurrentMonthView && (
            <button
              type="button"
              onClick={goToToday}
              className="mr-1 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider border border-border hover:bg-background transition-colors"
            >
              Today
            </button>
          )}
          <button
            type="button"
            onClick={goToPrevMonth}
            className="flex h-7 w-7 items-center justify-center border-2 border-border bg-background transition-colors hover:bg-muted"
            aria-label="Previous month"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={goToNextMonth}
            className="flex h-7 w-7 items-center justify-center border-2 border-border bg-background transition-colors hover:bg-muted"
            aria-label="Next month"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
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

            const dateStr = formatDate(viewYear, viewMonth, day);
            const events = eventsByDate.get(dateStr) || [];
            const isToday = isCurrentMonthView && day === todayDay;
            const hasEvents = events.length > 0;
            const isSelected = selectedDate === dateStr;
            const uniqueTypes = Array.from(new Set(events.map((e) => e.type)));

            return (
              <button
                key={day}
                type="button"
                onClick={() => handleDateClick(day)}
                className={`
                  relative flex aspect-square flex-col items-center justify-center text-xs transition-all duration-150
                  ${
                    isSelected
                      ? "border-2 border-foreground bg-foreground font-black text-background shadow-hard-sm"
                      : isToday
                        ? "border-2 border-border bg-primary font-black text-black shadow-hard-sm"
                        : hasEvents
                          ? "cursor-pointer font-bold hover:bg-muted border-2 border-transparent hover:border-border"
                          : "text-muted-foreground hover:bg-muted/50 border border-transparent"
                  }
                `}
                aria-label={`${day}${hasEvents ? `, ${events.length} deadline${events.length > 1 ? "s" : ""}` : ""}`}
              >
                <span>{day}</span>

                {/* Event Dots */}
                {hasEvents && (
                  <div className="absolute bottom-0.5 flex gap-0.5">
                    {uniqueTypes.slice(0, 3).map((type, i) => (
                      <span
                        key={`${day}-${type}-${i}`}
                        className={`h-1 w-1.5 ${isSelected ? "bg-background" : STAGE_COLORS[type]}`}
                      />
                    ))}
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Selected Date Events Panel */}
        {selectedDate && selectedEvents.length > 0 && (
          <div className="mt-3 border-2 border-border bg-muted/50 p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="font-heading text-xs font-bold">
                {formatEventDate(selectedDate)}
              </span>
              <span className="font-mono text-[10px] text-muted-foreground">
                {selectedEvents.length} deadline{selectedEvents.length > 1 ? "s" : ""}
              </span>
            </div>
            <div className="space-y-2">
              {selectedEvents.map((event, i) => (
                <div
                  key={`${event.caseId}-${event.label}-${i}`}
                  className="flex items-start gap-2 border-l-3 pl-2"
                  style={{
                    borderColor: `var(--stage-${event.type === "rfi" ? "i140" : event.type})`,
                  }}
                >
                  <div className={`mt-0.5 h-2 w-2 shrink-0 ${STAGE_COLORS[event.type]}`} />
                  <div className="min-w-0">
                    <p className="text-xs font-bold leading-tight">{event.label}</p>
                    <p className="truncate text-[10px] text-muted-foreground">
                      {event.caseName}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* No events message for selected date */}
        {selectedDate && selectedEvents.length === 0 && (
          <div className="mt-3 border-2 border-dashed border-border p-3 text-center">
            <span className="text-xs text-muted-foreground">No deadlines on this date</span>
          </div>
        )}

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
