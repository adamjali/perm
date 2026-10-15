/**
 * CalendarMobileList Component
 *
 * Mobile-optimized list view of upcoming deadlines.
 * Shows next 30 days of events grouped by week.
 *
 * Features:
 * - List view of deadlines (simpler than full calendar grid)
 * - Group by week with header separators
 * - Each item shows: deadline type, case name, date, urgency color
 * - Tap to navigate to case detail
 * - Touch-friendly 44px minimum touch targets
 */

"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  format,
  startOfWeek,
  endOfWeek,
  isToday,
  isTomorrow,
  addDays,
} from "date-fns";
import { CalendarIcon } from "@phosphor-icons/react/ssr";

import { cn } from "@/lib/utils";
import type { CalendarEvent } from "@/lib/calendar/types";
import { STAGE_COLORS } from "@/lib/calendar/types";
import { DaysChip } from "@/components/cases/DeadlineCountdown";
import type { CaseDataMap } from "./CalendarView";

// ============================================================================
// Types
// ============================================================================

interface CalendarMobileListProps {
  /** Calendar events to display */
  events: CalendarEvent[];
  /** Map of case ID to case data for display */
  caseDataMap?: CaseDataMap;
  /** Number of days to show (default: 30) */
  daysToShow?: number;
}

interface GroupedEvents {
  weekStart: Date;
  weekEnd: Date;
  weekLabel: string;
  events: CalendarEvent[];
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Group events by week
 */
function groupEventsByWeek(
  events: CalendarEvent[],
  daysToShow: number
): GroupedEvents[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const endDate = addDays(today, daysToShow);

  // Filter events within the date range
  const filteredEvents = events.filter((event) => {
    const eventDate = new Date(event.start);
    eventDate.setHours(0, 0, 0, 0);
    return eventDate >= today && eventDate <= endDate;
  });

  // Sort by date
  const sortedEvents = [...filteredEvents].sort(
    (a, b) => a.start.getTime() - b.start.getTime()
  );

  // Group by week
  const weekMap = new Map<string, GroupedEvents>();

  sortedEvents.forEach((event) => {
    const eventDate = event.start;
    const weekStartDate = startOfWeek(eventDate, { weekStartsOn: 0 });
    const weekEndDate = endOfWeek(eventDate, { weekStartsOn: 0 });
    const weekKey = format(weekStartDate, "yyyy-MM-dd");

    if (!weekMap.has(weekKey)) {
      // Format week label
      const startMonth = format(weekStartDate, "MMM d");
      const endMonth = format(weekEndDate, "MMM d");
      const year = format(weekEndDate, "yyyy");

      // Check if this is current week
      const isCurrentWeek =
        weekStartDate <= today && weekEndDate >= today;
      const weekLabel = isCurrentWeek
        ? `This week (${startMonth} - ${endMonth})`
        : `${startMonth} - ${endMonth}, ${year}`;

      weekMap.set(weekKey, {
        weekStart: weekStartDate,
        weekEnd: weekEndDate,
        weekLabel,
        events: [],
      });
    }

    weekMap.get(weekKey)!.events.push(event);
  });

  return Array.from(weekMap.values());
}

/**
 * Format date for display
 */
function formatEventDate(date: Date): string {
  if (isToday(date)) return "Today";
  if (isTomorrow(date)) return "Tomorrow";
  return format(date, "EEE, MMM d");
}

// ============================================================================
// Component
// ============================================================================

export function CalendarMobileList({
  events,
  caseDataMap,
  daysToShow = 30,
}: CalendarMobileListProps) {
  const router = useRouter();

  // Group events by week
  const groupedEvents = useMemo(
    () => groupEventsByWeek(events, daysToShow),
    [events, daysToShow]
  );

  // Handle tap on event - navigate to case detail
  const handleEventTap = (caseId: string) => {
    router.push(`/cases/${caseId}`);
  };

  // Empty state
  if (groupedEvents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
        <div className="mb-4 inline-block bg-tint p-4 border-2 shadow-hard border-border">
          <CalendarIcon className="size-10 text-muted-foreground" />
        </div>
        <h3 className="font-heading text-lg font-semibold mb-2">
          No upcoming deadlines
        </h3>{" "}
        <p className="text-sm text-muted-foreground max-w-[280px]">
          No deadlines in the next {daysToShow} days. Check back later or view
          the full calendar.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {groupedEvents.map((group) => (
        <section key={group.weekLabel} aria-label={group.weekLabel}>
          {/* The week, under one ink rule, held under the app's header while its rows scroll. */}
          <h3 className="sticky top-16 z-10 border-b-2 border-[var(--object-border)] bg-background py-2 font-heading text-base font-bold">
            {group.weekLabel}
          </h3>{" "}
          <ul>
            {group.events.map((event) => {
              const caseData = caseDataMap?.get(event.caseId as string);
              // Extracted to local variable (React Compiler disabled; kept for SWC safety)
              const employerName = caseData?.employerName;
              const stageColor = STAGE_COLORS[event.stage] ?? "#6B7280";
              return (
                <li key={event.id} className="relative border-b border-border">
                  {/* The stage's colour down the row's edge, as in the case list. */}
                  <span aria-hidden="true" className="absolute inset-y-0 left-0 w-1.5" style={{ backgroundColor: stageColor }} />
                  <button
                    type="button"
                    onClick={() => handleEventTap(event.caseId as string)}
                    className="flex min-h-16 w-full items-center gap-3 py-3 pl-4 pr-1 text-left hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                    aria-label={`${event.title}, ${employerName ?? "case"}, ${formatEventDate(event.start)}`}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="line-clamp-2 font-semibold leading-snug">{event.title}</span>{" "}
                      <span className="mt-0.5 block truncate text-sm text-muted-foreground">
                        {employerName ?? "Unknown case"}
                        {caseData?.positionTitle ? <span className="hidden sm:inline">{` - ${caseData.positionTitle}`}</span> : null}
                      </span>
                    </span>{" "}
                    <span className="flex shrink-0 flex-col items-end gap-1">
                      <span className="font-mono text-sm text-soft">{formatEventDate(event.start)}</span>{" "}
                      <DaysChip days={event.daysUntil} className="min-w-0 px-1.5 py-0.5" />
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
