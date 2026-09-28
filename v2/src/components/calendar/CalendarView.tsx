/**
 * CalendarView Component
 *
 * Wraps react-big-calendar with PERM-specific configuration.
 * Displays case deadlines as calendar events with stage-based styling.
 *
 * Features:
 * - Month/Week/Day views with custom neobrutalist toolbar
 * - Stage-based event coloring (PWD blue, Recruitment purple, etc.)
 * - Custom event rendering with urgency indicators
 * - Click to show event popover with case details
 * - "View Case" navigation from popover
 * - "Hide from Calendar" option in popover
 * - Range change callback for future optimization
 * - Responsive: Mobile list view (<768px), full calendar (768px+)
 * - Toggle between list/calendar view on any screen size
 *
 * Phase: 23.1 (Calendar UI)
 * Created: 2025-12-28
 */

"use client";

import { useCallback, useMemo, useState } from "react";
import {
  Calendar,
  type View,
  type DateRange,
  type Components,
} from "react-big-calendar";
import "react-big-calendar/lib/css/react-big-calendar.css";
import { motion, AnimatePresence } from "motion/react";

import { localizer } from "@/lib/calendar/localizer";
import { springTransition, fadeVariants, fadeTransition } from "@/lib/calendar/animations";
import { createEventPropGetter } from "@/lib/calendar/eventStyles";
import type { CalendarEvent } from "@/lib/calendar/types";
import type { CaseStatus } from "@/lib/perm";
import type { Id } from "../../../convex/_generated/dataModel";
import { CalendarToolbar } from "./CalendarToolbar";
import { CalendarEvent as CalendarEventComponent } from "./CalendarEvent";
import { CalendarEventPopover } from "./CalendarEventPopover";
import { CalendarMobileList } from "./CalendarMobileList";
import { Button } from "@/components/ui/button";
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
  const handleViewModeToggle = useCallback(() => {
    setUserViewMode((prev) => (prev === "list" ? "calendar" : "list"));
  }, []);

  // Calendar configuration - memoized for performance
  const { views, customComponents, eventPropGetter } = useMemo(
    () => ({
      views: ["month", "week", "day"] as View[],
      customComponents: {
        toolbar: CalendarToolbar,
        event: CalendarEventComponent,
      } as Components<CalendarEvent, object>,
      eventPropGetter: createEventPropGetter(),
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

  return (
    <div className="w-full calendar-container">
      {/* View Mode Toggle Button - Always visible */}
      <div className="flex justify-end mb-4">
        <motion.div
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          transition={springTransition}
        >
          <Button
            variant="outline"
            size="sm"
            onClick={handleViewModeToggle}
            className="gap-2 min-h-[44px] hover-lift"
            aria-label={
              userViewMode === "list" ? "Switch to calendar view" : "Switch to list view"
            }
          >
            {userViewMode === "list" ? (
              <>
                <GridNineIcon className="size-4" />
                <span className="hidden sm:inline">Calendar View</span>{" "}
                <span className="sm:hidden">Calendar</span>
              </>
            ) : (
              <>
                <ListIcon className="size-4" />
                <span className="hidden sm:inline">List View</span>{" "}
                <span className="sm:hidden">List</span>
              </>
            )}
          </Button>
        </motion.div>
      </div>

      {/* Mobile List View - Shown on mobile by default, or when user explicitly selects list */}
      <AnimatePresence mode="wait">
        {useResponsiveLayout ? (
          // CSS-based responsive: show list on mobile (<768px), calendar on desktop
          <motion.div
            key="responsive"
            variants={fadeVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={fadeTransition}
          >
            <div className="md:hidden">
              <CalendarMobileList
                events={events}
                caseDataMap={caseDataMap}
                daysToShow={30}
              />
            </div>
            <div className="hidden md:block">
              <Calendar<CalendarEvent>
                localizer={localizer}
                events={events}
                views={views}
                view={currentView}
                date={currentDate}
                onNavigate={handleNavigate}
                onView={handleViewChange}
                components={customComponents}
                eventPropGetter={eventPropGetter}
                onSelectEvent={handleSelectEvent}
                onRangeChange={handleRangeChange}
                formats={formats}
                popup
                selectable={false}
                tooltipAccessor={(event) =>
                  `${event.title}\n${event.daysUntil >= 0 ? `${event.daysUntil} days` : `${Math.abs(event.daysUntil)} days ago`}`
                }
                style={{ minHeight: 700 }}
              />
            </div>
          </motion.div>
        ) : showListView ? (
          // User explicitly chose list view
          <motion.div
            key="list"
            variants={fadeVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={fadeTransition}
          >
            <CalendarMobileList
              events={events}
              caseDataMap={caseDataMap}
              daysToShow={30}
            />
          </motion.div>
        ) : showCalendarView ? (
          // User explicitly chose calendar view
          <motion.div
            key="calendar"
            variants={fadeVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={fadeTransition}
          >
            <Calendar<CalendarEvent>
              localizer={localizer}
              events={events}
              views={views}
              view={currentView}
              date={currentDate}
              onNavigate={handleNavigate}
              onView={handleViewChange}
              components={customComponents}
              eventPropGetter={eventPropGetter}
              onSelectEvent={handleSelectEvent}
              onRangeChange={handleRangeChange}
              formats={formats}
              popup
              selectable={false}
              tooltipAccessor={(event) =>
                `${event.title}\n${event.daysUntil >= 0 ? `${event.daysUntil} days` : `${Math.abs(event.daysUntil)} days ago`}`
              }
              style={{ minHeight: 700 }}
            />
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* Event details popover - Only shown for calendar view */}
      <CalendarEventPopover
        event={selectedEvent}
        isOpen={isPopoverOpen}
        onClose={handleClosePopover}
        hiddenCases={hiddenCases}
        caseData={selectedCaseData}
      />

      {/* Custom styles to override react-big-calendar defaults - V1 style with white background */}
      <style jsx global>{`
        /* ================================================================
           V1-STYLE CALENDAR (Clean white background, colorful pills)
           ================================================================ */

        /* Calendar container - border, shadow, and spacing */
        .calendar-container {
          margin-bottom: 60px;
        }

        /* The actual calendar wrapper with border */
        .calendar-container .rbc-calendar {
          font-family: "Inter", sans-serif;
          background: var(--card);
          border: 2px solid var(--border);
          box-shadow: var(--shadow-hard);
          border-radius: 0 !important;
          margin-right: 8px;
          margin-bottom: 8px;
        }

        /* Remove all rounded corners globally */
        .calendar-container * {
          border-radius: 0 !important;
        }

        /* Header row (day names) - V1 style centered */
        .calendar-container .rbc-header {
          font-family: "Space Grotesk", sans-serif;
          font-weight: 700;
          font-size: 0.875rem;
          text-transform: uppercase;
          letter-spacing: 0.025em;
          padding: 12px 8px;
          text-align: center;
          border-bottom: 2px solid var(--border);
          background: color-mix(in srgb, var(--foreground) 6%, var(--card));
          color: var(--foreground);
        }

        .calendar-container .rbc-header + .rbc-header {
          border-left: 2px solid var(--border);
        }

        /* Month view */
        .calendar-container .rbc-month-view {
          border: none;
        }

        .calendar-container .rbc-month-row {
          border-bottom: 2px solid color-mix(in srgb, var(--foreground) 14%, transparent);
          min-height: 135px;
        }

        .calendar-container .rbc-month-row + .rbc-month-row {
          border-top: none;
        }

        /* Day cells in month view - V1 style with white background */
        .calendar-container .rbc-day-bg {
          border-right: 2px solid color-mix(in srgb, var(--foreground) 14%, transparent);
          background: var(--card);
          transition: background-color 0.15s ease-out;
        }

        .calendar-container .rbc-day-bg:last-child {
          border-right: none;
        }

        /* Today: a lime tint, the app's accent (was a stray light blue) */
        .calendar-container .rbc-day-bg.rbc-today {
          background-color: color-mix(in srgb, var(--primary) 14%, var(--card)) !important;
        }

        /* Weekend cells - slightly gray like v1 */
        .calendar-container .rbc-day-bg:nth-child(1),
        .calendar-container .rbc-day-bg:nth-child(7) {
          background-color: color-mix(in srgb, var(--foreground) 3%, var(--card));
        }

        /* Off-range (previous/next month) cells - V1 style muted */
        .calendar-container .rbc-day-bg.rbc-off-range-bg {
          background-color: color-mix(in srgb, var(--foreground) 6%, var(--card));
        }

        /* Month row - ensure background layer fills full height */
        .calendar-container .rbc-month-row {
          position: relative;
        }

        .calendar-container .rbc-row-bg {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          display: flex;
          z-index: 0;
        }

        .calendar-container .rbc-day-bg {
          flex: 1;
          height: 100%;
        }

        /* Make each day column hoverable via the background layer */
        .calendar-container .rbc-day-bg:hover {
          background-color: color-mix(in srgb, var(--primary) 6%, var(--card)) !important;
        }

        /* Preserve today styling on hover */
        .calendar-container .rbc-day-bg.rbc-today:hover {
          background-color: color-mix(in srgb, var(--primary) 24%, var(--card)) !important;
        }

        /* Preserve off-range styling - muted hover */
        .calendar-container .rbc-day-bg.rbc-off-range-bg:hover {
          background-color: var(--accent) !important;
        }

        /* Date numbers in cells - V1 style positioned top-right */
        .calendar-container .rbc-date-cell {
          padding: 8px;
          font-weight: 600;
          font-size: 0.875rem;
          text-align: right;
          position: relative;
          z-index: 1;
        }

        .calendar-container .rbc-date-cell.rbc-now {
          font-weight: 800;
          color: var(--foreground);
        }

        .calendar-container .rbc-date-cell.rbc-off-range {
          color: var(--muted-foreground);
        }

        /* ================================================================
           EVENT STYLING - Transparent wrapper, inner .calendar-event handles all
           ================================================================ */
        .calendar-container .rbc-event {
          background: transparent !important;
          border: none !important;
          box-shadow: none !important;
          padding: 0 !important;
          margin: 0 !important;
          border-radius: 0 !important;
        }

        .calendar-container .rbc-event:focus {
          outline: 2px solid var(--ring);
          outline-offset: 2px;
        }

        /* Make inner calendar-event fill the full wrapper */
        .calendar-container .rbc-event .calendar-event {
          width: 100%;
          height: 100%;
          margin: 0;
          display: flex;
          align-items: center;
        }

        /* Event hover - full coverage with smooth transition */
        .calendar-container .rbc-event:hover .calendar-event {
          opacity: 0.95;
          transform: translateY(-1px);
          box-shadow: var(--shadow-hard-sm);
        }

        /* Selected event - style the inner element */
        .calendar-container .rbc-event.rbc-selected .calendar-event {
          box-shadow: var(--shadow-hard) !important;
          border-color: var(--ring) !important;
          transform: translateY(-2px);
        }

        /* Event content wrapper */
        .calendar-container .rbc-event-label,
        .calendar-container .rbc-event-content {
          overflow: hidden;
          text-overflow: ellipsis;
          width: 100%;
        }

        /* Show more link - V1 style */
        .calendar-container .rbc-show-more {
          font-weight: 700;
          font-size: 0.7rem;
          color: var(--foreground);
          background: color-mix(in srgb, var(--foreground) 6%, var(--card));
          padding: 5px 10px;
          margin: 6px 8px;
          border: 2px solid var(--border);
          text-align: center;
          transition: all 0.15s ease;
          cursor: pointer;
        }

        .calendar-container .rbc-show-more:hover {
          background: var(--foreground);
          color: var(--background);
          transform: translateY(-1px);
        }

        /* Row segments - provides spacing between events */
        .calendar-container .rbc-row-segment {
          padding: 5px 8px;
        }

        /* Row content - allow hover to pass through to background layer */
        .calendar-container .rbc-row-content {
          padding: 0 0 10px 0;
          pointer-events: none;
          position: relative;
          z-index: 1;
        }

        /* But keep events and show-more clickable */
        .calendar-container .rbc-row-content .rbc-event,
        .calendar-container .rbc-row-content .rbc-show-more {
          pointer-events: auto;
        }

        /* Only the date number link itself is clickable, not the whole cell */
        .calendar-container .rbc-date-cell button,
        .calendar-container .rbc-date-cell a {
          pointer-events: auto;
          cursor: pointer;
          padding: 2px 6px;
          transition: background-color 0.15s ease;
        }

        .calendar-container .rbc-date-cell button:hover,
        .calendar-container .rbc-date-cell a:hover {
          background-color: var(--accent);
        }

        /* Hide default toolbar - we use CalendarToolbar */
        .calendar-container .rbc-toolbar {
          display: none;
        }

        /* Overlay (popup) for multiple events - V1 modal style */
        /* Note: rbc-overlay may render in a portal, so we use global selectors */
        .rbc-overlay {
          border: 2px solid var(--border) !important;
          border-radius: 0 !important;
          box-shadow: var(--shadow-hard) !important;
          background: var(--card) !important;
          color: var(--foreground) !important;
          padding: 0 !important;
          max-width: 320px;
          max-height: 400px;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          z-index: 100;
        }

        .rbc-overlay-header {
          font-family: "Space Grotesk", sans-serif !important;
          font-weight: 700 !important;
          border-bottom: 2px solid var(--border) !important;
          padding: 12px 16px !important;
          background: color-mix(in srgb, var(--foreground) 6%, var(--card)) !important;
          color: var(--foreground) !important;
          flex-shrink: 0;
        }

        /* Overlay event list area - scrollable */
        .rbc-overlay > * {
          padding: 8px;
        }

        .rbc-overlay > .rbc-overlay-header {
          padding: 12px 16px !important;
        }

        /* Scrollable event container */
        .rbc-overlay > *:not(.rbc-overlay-header) {
          overflow-y: auto;
          flex: 1;
          min-height: 0;
        }

        /* Custom scrollbar styling */
        .rbc-overlay ::-webkit-scrollbar {
          width: 8px;
        }

        .rbc-overlay ::-webkit-scrollbar-track {
          background: color-mix(in srgb, var(--foreground) 6%, var(--card));
        }

        .rbc-overlay ::-webkit-scrollbar-thumb {
          background: var(--muted-foreground);
          border: 2px solid color-mix(in srgb, var(--foreground) 14%, transparent);
        }

        .rbc-overlay ::-webkit-scrollbar-thumb:hover {
          background: var(--foreground);
        }

        /* Events inside overlay need spacing */
        .rbc-overlay .rbc-event {
          margin-bottom: 6px;
        }

        .rbc-overlay .rbc-event:last-child {
          margin-bottom: 0;
        }

        /* ================================================================
           WEEK AND DAY VIEW STYLES
           ================================================================ */
        .calendar-container .rbc-time-view {
          border: none;
          background: var(--card);
        }

        .calendar-container .rbc-time-header {
          border-bottom: 2px solid var(--border);
        }

        .calendar-container .rbc-time-header-content {
          border-left: 2px solid color-mix(in srgb, var(--foreground) 14%, transparent);
        }

        .calendar-container .rbc-time-content {
          border-top: none;
        }

        .calendar-container .rbc-timeslot-group {
          border-bottom: 1px solid color-mix(in srgb, var(--foreground) 14%, transparent);
        }

        .calendar-container .rbc-time-gutter {
          font-weight: 500;
          background: color-mix(in srgb, var(--foreground) 3%, var(--card));
        }

        .calendar-container .rbc-day-slot .rbc-time-slot {
          border-top: 1px solid color-mix(in srgb, var(--foreground) 14%, transparent);
        }

        .calendar-container .rbc-time-column {
          border-left: 2px solid color-mix(in srgb, var(--foreground) 14%, transparent);
        }

        .calendar-container .rbc-time-column:first-child {
          border-left: none;
        }

        /* Current time indicator */
        .calendar-container .rbc-current-time-indicator {
          background-color: var(--urgency-urgent);
          height: 2px;
        }

        /* All day section */
        .calendar-container .rbc-allday-cell {
          border-bottom: 2px solid color-mix(in srgb, var(--foreground) 14%, transparent);
        }

        /* ================================================================
           AGENDA VIEW STYLES
           ================================================================ */
        .calendar-container .rbc-agenda-view {
          border: none;
        }

        .calendar-container .rbc-agenda-table {
          border-collapse: separate;
          border-spacing: 0;
        }

        .calendar-container .rbc-agenda-table thead th {
          font-family: "Space Grotesk", sans-serif;
          font-weight: 700;
          border-bottom: 2px solid var(--border);
          padding: 12px 8px;
          background: color-mix(in srgb, var(--foreground) 6%, var(--card));
        }

        .calendar-container .rbc-agenda-table tbody tr {
          border-bottom: 1px solid color-mix(in srgb, var(--foreground) 14%, transparent);
        }

        .calendar-container .rbc-agenda-table td {
          padding: 8px;
          border-left: 2px solid color-mix(in srgb, var(--foreground) 14%, transparent);
        }

        .calendar-container .rbc-agenda-table td:first-child {
          border-left: none;
        }

        .calendar-container .rbc-agenda-event-cell {
          font-weight: 600;
        }
      `}</style>
    </div>
  );
}

export default CalendarView;
