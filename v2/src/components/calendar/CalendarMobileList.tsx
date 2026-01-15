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
 * - Neobrutalist styling
 *
 * Phase: 23.1 (Calendar UI)
 * Created: 2025-12-28
 */

"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import {
  format,
  startOfWeek,
  endOfWeek,
  isToday,
  isTomorrow,
  addDays,
} from "date-fns";
import {
  Calendar,
  ChevronRight,
  AlertCircle,
  Clock,
  CheckCircle2,
} from "lucide-react";

import { cn } from "@/lib/utils";
import type { CalendarEvent } from "@/lib/calendar/types";
import { STAGE_COLORS, URGENCY_COLORS } from "@/lib/calendar/types";
import type { CaseDataMap } from "./CalendarView";

// ============================================================================
// Animation Constants
// ============================================================================

/**
 * Spring config for snappy list item animations
 */
const springTransition = {
  type: "spring" as const,
  stiffness: 500,
  damping: 30,
};

/**
 * Stagger animation for list items
 */
const listItemVariants = {
  hidden: { opacity: 0, x: -12 },
  visible: (i: number) => ({
    opacity: 1,
    x: 0,
    transition: {
      delay: i * 0.03,
      duration: 0.2,
      ease: [0.165, 0.84, 0.44, 1] as const,
    },
  }),
};

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
        ? `This Week (${startMonth} - ${endMonth})`
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

/**
 * Get urgency icon
 */
function UrgencyIcon({ urgency }: { urgency: CalendarEvent["urgency"] }) {
  switch (urgency) {
    case "overdue":
    case "urgent":
      return <AlertCircle className="size-4" />;
    case "soon":
      return <Clock className="size-4" />;
    case "normal":
      return <CheckCircle2 className="size-4" />;
  }
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
        <div className="mb-4 p-4 bg-muted inline-block border-2 border-border shadow-hard">
          <Calendar className="size-10 text-muted-foreground" />
        </div>
        <h3 className="font-heading text-lg font-semibold mb-2">
          No Upcoming Deadlines
        </h3>
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
        <div key={group.weekLabel} className="space-y-2">
          {/* Week Header */}
          <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm py-2">
            <h3 className="font-heading text-sm font-bold text-muted-foreground uppercase tracking-wide px-1">
              {group.weekLabel}
            </h3>
          </div>

          {/* Events in week with stagger animation */}
          <div className="space-y-2">
            {group.events.map((event, eventIndex) => {
              const caseData = caseDataMap?.get(event.caseId as string);
              const stageColor = STAGE_COLORS[event.stage] ?? "#6B7280";
              const urgencyColor = URGENCY_COLORS[event.urgency] ?? "#059669";
              const isOverdueOrUrgent =
                event.urgency === "overdue" || event.urgency === "urgent";

              return (
                <motion.button
                  key={event.id}
                  custom={eventIndex}
                  variants={listItemVariants}
                  initial="hidden"
                  animate="visible"
                  whileHover={{ x: -4, y: -4 }}
                  whileTap={{ x: 2, y: 2 }}
                  transition={springTransition}
                  type="button"
                  onClick={() => handleEventTap(event.caseId as string)}
                  className={cn(
                    "w-full min-h-[68px] p-3 flex items-center gap-3",
                    "bg-card border-2 border-border shadow-hard",
                    "hover:shadow-hard-lg",
                    "active:shadow-none",
                    "text-left",
                    "focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
                  )}
                  aria-label={`${event.title} - ${caseData?.employerName ?? "Case"} - ${formatEventDate(event.start)}`}
                >
                  {/* Stage color indicator */}
                  <div
                    className="w-1.5 h-12 shrink-0 border border-border"
                    style={{ backgroundColor: stageColor }}
                    aria-hidden="true"
                  />

                  {/* Event content */}
                  <div className="flex-1 min-w-0">
                    {/* Deadline type */}
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-heading text-sm font-bold truncate">
                        {event.title}
                      </span>
                    </div>

                    {/* Case name */}
                    <p className="text-sm text-muted-foreground truncate">
                      {caseData?.employerName ?? "Unknown Case"}
                      {caseData?.positionTitle && (
                        <span className="hidden sm:inline">
                          {" "}
                          - {caseData.positionTitle}
                        </span>
                      )}
                    </p>
                  </div>

                  {/* Date and urgency */}
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span
                      className={cn(
                        "text-sm font-semibold",
                        isOverdueOrUrgent && "text-destructive"
                      )}
                    >
                      {formatEventDate(event.start)}
                    </span>
                    <div
                      className="flex items-center gap-1 text-xs"
                      style={{ color: urgencyColor }}
                    >
                      <UrgencyIcon urgency={event.urgency} />
                      <span className="font-medium">
                        {event.daysUntil === 0
                          ? "Due today"
                          : event.daysUntil < 0
                            ? `${Math.abs(event.daysUntil)}d overdue`
                            : `${event.daysUntil}d`}
                      </span>
                    </div>
                  </div>

                  {/* Chevron indicator */}
                  <ChevronRight
                    className="size-5 text-muted-foreground shrink-0"
                    aria-hidden="true"
                  />
                </motion.button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

export default CalendarMobileList;
