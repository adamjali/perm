/**
 * CalendarView Component
 *
 * Wraps react-big-calendar with PERM-specific configuration.
 * Displays case deadlines as calendar events with stage-based styling.
 *
 * Features:
 * - Month/Week/Day views with a custom toolbar
 * - Stage-based event coloring (PWD blue, Recruitment purple, etc.)
 * - Custom event rendering with urgency indicators
 * - Click to show event popover with case details
 * - "View Case" navigation from popover
 * - "Hide from Calendar" option in popover
 * - Range change callback for future optimization
 * - Responsive: Mobile list view (<768px), full calendar (768px+)
 * - Toggle between list/calendar view on any screen size
 */

"use client";

import { countdownWords } from "@/components/cases/case-card.utils";
import { useCallback, useMemo, useState } from "react";
import {
  Calendar,
  type View,
  type DateRange,
  type Components,
} from "react-big-calendar";
import "react-big-calendar/lib/css/react-big-calendar.css";

import { localizer } from "@/lib/calendar/localizer";
import type { CalendarEvent } from "@/lib/calendar/types";
import type { CaseStatus } from "@/lib/perm";
import type { Id } from "@convex/_generated/dataModel";
import { CalendarToolbar } from "./CalendarToolbar";
import { CalendarListToggleContext } from "./calendar-view-context";
import { CalendarEvent as CalendarEventComponent } from "./CalendarEvent";
import { CalendarEventPopover } from "./CalendarEventPopover";
import { CalendarMobileList } from "./CalendarMobileList";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { MOBILE_BREAKPOINT } from "@/hooks/useIsMobile";
import { GridNineIcon, ListIcon } from "@phosphor-icons/react/ssr";

// ============================================================================
// Types
// ============================================================================

/**
 * Case data for popover display
 */
export interface CaseDataForPopover {
  employerName: string;
  beneficiaryIdentifier: string;
  positionTitle: string;
  caseStatus: CaseStatus;
}

/**
 * Map of case ID to case data for quick lookup
 */
export type CaseDataMap = Map<string, CaseDataForPopover>;

// ============================================================================
// Props Interface
// ============================================================================

/**
 * View mode for responsive layout
 */
type ViewMode = "calendar" | "list";

interface CalendarViewProps {
  /** Calendar events to display */
  events: CalendarEvent[];
  /** Map of case ID to case data for popover display */
  caseDataMap?: CaseDataMap;
  /** Current hidden cases list (for updating preferences) */
  hiddenCases?: Id<"cases">[];
  /** Callback when date range changes (for future optimization) */
  onRangeChange?: (range: Date[] | { start: Date; end: Date }) => void;
  /** Default view (month, week, day) */
  defaultView?: View;
  /** Initial date to display */
  defaultDate?: Date;
  /** Force a specific view mode (overrides responsive behavior) */
  forceViewMode?: ViewMode;
}


// ============================================================================
// Component
// ============================================================================

export function CalendarView({
  events,
  caseDataMap,
  hiddenCases,
  onRangeChange,
  defaultView = "month",
  defaultDate = new Date(),
  forceViewMode,
}: CalendarViewProps) {
  // Controlled state for calendar navigation
  const [currentDate, setCurrentDate] = useState<Date>(defaultDate);
  const [currentView, setCurrentView] = useState<View>(defaultView);

  // State for selected event and popover visibility
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);

  // State for user's explicit view mode preference (null = use responsive default)
  const [userViewMode, setUserViewMode] = useState<ViewMode | null>(null);

  // Handle calendar navigation (controlled)
  const handleNavigate = useCallback((newDate: Date) => {
    setCurrentDate(newDate);
  }, []);

  // Handle view change (controlled)
  const handleViewChange = useCallback((newView: View) => {
    setCurrentView(newView);
  }, []);

  // Toggle between list and calendar view
  // Until the reader picks, a phone shows the list and a wider screen the
  // grid, so the toggle asks the screen which one is showing right now.
  const handleViewModeToggle = useCallback(() => {
    setUserViewMode((prev) => {
      const listShown =
        prev === "list" ||
        (prev === null && window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`).matches);
      return listShown ? "calendar" : "list";
    });
  }, []);

  // Calendar configuration - memoized for performance
  const { views, customComponents } = useMemo(
    () => ({
      views: ["month", "week", "day"] as View[],
      customComponents: {
        toolbar: CalendarToolbar,
        event: CalendarEventComponent,
      } as Components<CalendarEvent, object>,
    }),
    []
  );

  /**
   * Handle event selection - show event popover with details.
   */
  const handleSelectEvent = useCallback((event: CalendarEvent) => {
    setSelectedEvent(event);
    setIsPopoverOpen(true);
  }, []);

  /**
   * Close the event popover.
   */
  const handleClosePopover = useCallback(() => {
    setIsPopoverOpen(false);
    // Clear selected event after animation completes
    setTimeout(() => setSelectedEvent(null), 200);
  }, []);

  /**
   * Get case data for the selected event from the map.
   */
  const selectedCaseData = useMemo(() => {
    if (!selectedEvent || !caseDataMap) return undefined;
    return caseDataMap.get(selectedEvent.caseId as string);
  }, [selectedEvent, caseDataMap]);

  /**
   * Handle range change - notify parent for future optimization.
   */
  const handleRangeChange = useCallback(
    (range: Date[] | { start: Date; end: Date }) => {
      onRangeChange?.(range);
    },
    [onRangeChange]
  );

  /**
   * Format event title for display.
   * Shows deadline type and abbreviated beneficiary name.
   */
  const formats = useMemo(
    () => ({
      eventTimeRangeFormat: () => "",
      timeGutterFormat: "ha",
      dayFormat: "EEE d",
      monthHeaderFormat: "MMMM yyyy",
      dayHeaderFormat: "EEEE, MMMM d, yyyy",
      dayRangeHeaderFormat: ({ start, end }: DateRange) => {
        const startStr = start.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        });
        const endStr = end.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        });
        return `${startStr} - ${endStr}`;
      },
    }),
    []
  );

  // Determine effective view mode
  // Priority: forceViewMode > userViewMode > responsive default (CSS handles responsive)
  const effectiveViewMode = forceViewMode ?? userViewMode;

  // If user has explicitly chosen a view mode, show only that
  // Otherwise, use CSS-based responsive layout (list on mobile, calendar on desktop)
  const showListView = effectiveViewMode === "list";
  const showCalendarView = effectiveViewMode === "calendar";
  const useResponsiveLayout = effectiveViewMode === null;

  const list = <CalendarMobileList events={events} caseDataMap={caseDataMap} daysToShow={30} />;
  const grid = (
    <Calendar<CalendarEvent>
      localizer={localizer}
      events={events}
      views={views}
      view={currentView}
      date={currentDate}
      onNavigate={handleNavigate}
      onView={handleViewChange}
      components={customComponents}
      onSelectEvent={handleSelectEvent}
      onRangeChange={handleRangeChange}
      formats={formats}
      popup
      selectable={false}
      tooltipAccessor={(event) => `${event.title}\n${countdownWords(event.daysUntil)}`}
      style={{ minHeight: 700 }}
    />
  );

  return (
    <CalendarListToggleContext.Provider value={handleViewModeToggle}>
    <div className="w-full calendar-container">
      {/* View mode toggle. On desktop the calendar's toolbar carries "List"
          itself, so this row shows on phones and in list view. Until the
          reader picks, a phone is already showing the list. */}
      <div className={cn("mb-4 flex justify-end", userViewMode !== "list" && "md:hidden")}>
        <Button
          variant="outline"
          onClick={handleViewModeToggle}
          aria-label={userViewMode === "calendar" ? "Switch to list view" : "Switch to calendar view"}
        >
          {userViewMode === "calendar" ? (
            <>
              <ListIcon className="size-4" aria-hidden="true" />
              List
            </>
          ) : (
            <>
              <GridNineIcon className="size-4" aria-hidden="true" />
              Calendar
            </>
          )}
        </Button>
      </div>

      {/* Phones get the list by default and wider screens the grid, unless
          the reader has chosen one. */}
      {useResponsiveLayout ? (
        <>
          <div className="md:hidden">{list}</div>
          <div className="hidden md:block">{grid}</div>
        </>
      ) : showListView ? (
        list
      ) : showCalendarView ? (
        grid
      ) : null}

      {/* Event details popover - Only shown for calendar view */}
      <CalendarEventPopover
        event={selectedEvent}
        isOpen={isPopoverOpen}
        onClose={handleClosePopover}
        hiddenCases={hiddenCases}
        caseData={selectedCaseData}
      />

    </div>
    </CalendarListToggleContext.Provider>
  );
}
