
"use client";

import { useMemo, useState, useEffect } from "react";
import { useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowSquareOutIcon, CalendarIcon as CalendarIcon, InfoIcon, PlusIcon } from "@phosphor-icons/react";

import { api } from "@convex/_generated/api";
import { caseToCalendarEvents } from "@/lib/calendar/event-mapper";
import { RECORDED_EVENT_TYPES, type DeadlineType } from "@/lib/calendar/types";
import { toCalendarCaseData } from "@/lib/calendar/fromQuery";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { CalendarView, type CaseDataMap, CalendarFilters } from "@/components/calendar";
import type { CaseForSelection } from "@/components/timeline";
import { PageHeading } from "../components/PageHeading";
import { CaseCapNotice } from "@/components/cases/CaseCapNotice";

// The event pill and the react-big-calendar theming
import "@/app/calendar.css";

// ============================================================================
// Loading Skeleton
// ============================================================================

/**
 * The calendar while its events load, in the page's own order: heading, the
 * filter row, then the calendar (a grid from md, the list below it, as the
 * real view switches). Shared with calendar/loading.tsx, which used to draw
 * its own version, so a click showed two skeletons before the page.
 */
export function CalendarSkeleton() {
  return (
    <div className="flex flex-col h-full" aria-busy={true}>
      {/* Header: the real title; only the count under it waits. */}
      <div className="mb-4">
        <PageHeading
          meta={<Skeleton variant="line" className="inline-block h-4 w-56 align-middle" />}
          title="Calendar"
        />
      </div>

      {/* Filter row: the real one is a bordered box around a row of 44px
          controls, 80px in all (measured on production, Sep 30 2026). */}
      <div className="mb-4 bg-tint p-4 border-2 border-border">
        <Skeleton variant="block" className="h-11" />
      </div>

      {/* Phones get the list view, as the real calendar does. */}
      <div className="space-y-3 md:hidden">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} variant="block" className="h-16" />
        ))}
      </div>

      <div className="hidden min-h-[870px] flex-col md:flex">

      {/* Toolbar skeleton */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-4">
        <div className="flex items-center gap-2">
          <Skeleton variant="block" className="w-20 h-10" />
          <Skeleton variant="block" className="w-24 h-10" />
          <Skeleton variant="block" className="w-20 h-10" />
        </div>
        <Skeleton variant="line" className="w-40 h-8" />
        <div className="flex items-center gap-2">
          <Skeleton variant="block" className="w-20 h-10" />
          <Skeleton variant="block" className="w-20 h-10" />
          <Skeleton variant="block" className="w-20 h-10" />
        </div>
      </div>

      {/* Calendar grid skeleton, the real calendar's 700px minimum */}
      <div className="min-h-[700px] flex-1 border-border bg-card border">
        {/* Month header row */}
        <div className="grid grid-cols-7 border-b-2 border-border bg-muted">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
            <div
              key={day}
              className="p-3 text-center border-r border-border last:border-r-0"
            >
              <Skeleton variant="line" className="w-8 h-5 mx-auto" />
            </div>
          ))}
        </div>

        {/* Calendar weeks */}
        {Array.from({ length: 5 }).map((_, weekIndex) => (
          <div
            key={weekIndex}
            className="grid grid-cols-7 border-b border-border last:border-b-0"
          >
            {Array.from({ length: 7 }).map((_, dayIndex) => (
              <div
                key={dayIndex}
                className="min-h-24 p-2 border-r border-border last:border-r-0"
              >
                <Skeleton variant="line" className="w-6 h-5 mb-2" />
                {/* Random event placeholders */}
                {(weekIndex + dayIndex) % 3 === 0 && (
                  <Skeleton variant="block" className="w-full h-6 mb-1" />
                )}
                {(weekIndex + dayIndex) % 5 === 0 && (
                  <Skeleton variant="block" className="w-full h-6" />
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
      </div>
    </div>
  );
}

// ============================================================================
// Empty State
// ============================================================================

function CalendarEmptyState() {
  const router = useRouter();

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="mb-6">
        <PageHeading
          title="Calendar"
        />
      </div>

      {/* Empty state message */}
      <div className="flex-1 flex flex-col items-center justify-center py-16 px-4 border-2 border-dashed border-border bg-muted/20">
        <div className="text-center max-w-md">
          <div className="mb-4 p-4 inline-block bg-tint border-2 shadow-hard border-border">
            <CalendarIcon className="size-12 text-muted-foreground" />
          </div>
          <h2 className="font-heading text-xl font-semibold mb-2">
            No deadlines to display
          </h2>{" "}
          <p className="text-muted-foreground mb-6">
            Add cases with milestone dates to see them on the calendar. Each
            deadline will appear as an event color-coded by stage.
          </p>
          <Button
            onClick={() => router.push("/cases/new")}
            className="bg-primary text-primary-foreground font-semibold border-border transition-colors border"
          >
            <PlusIcon className="size-4 mr-2" />
            Add your first case
          </Button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function CalendarPageClient() {
  const router = useRouter();

  // State for visibility toggles (control query params)
  const [showCompleted, setShowCompleted] = useState(false);
  const [showClosed, setShowClosed] = useState(false);

  // Query calendar events (cases with deadline fields)
  const calendarCases = useQuery(api.calendar.getCalendarEvents, {
    showCompleted,
    showClosed,
  });

  // Query user's calendar preferences (hidden cases/deadline types)
  const preferences = useQuery(api.calendar.getCalendarPreferences);

  // Query user profile to check Google Calendar connection status
  const userProfile = useQuery(api.users.currentUserProfile);
  const isGoogleConnected = userProfile?.googleCalendarConnected ?? false;

  // Transform cases for case selection modal (all cases, not filtered)
  const allCasesForSelection: CaseForSelection[] = useMemo(() => {
    if (!calendarCases) return [];
    return calendarCases.map((c, index) => ({
      _id: String(c.id),
      employerName: c.employerName,
      positionTitle: c.positionTitle,
      caseStatus: c.caseStatus,
      progressStatus: c.progressStatus,
      createdAt: index, // Not available in calendar query, use index as stable fallback for sorting
    }));
  }, [calendarCases]);

  // Transform cases to calendar events and apply filters
  const { events, caseDataMap } = useMemo(() => {
    if (!calendarCases || !preferences)
      return { events: [], caseDataMap: new Map() };

    // Filter out hidden cases
    const hiddenCaseIds = new Set(preferences.hiddenCases.map(String));
    const hiddenTypes = new Set(preferences.hiddenDeadlineTypes);

    // Build case data map for popover display
    const dataMap: CaseDataMap = new Map();

    // Transform each case to calendar events
    const allEvents = calendarCases.flatMap((caseData) => {
      // Skip hidden cases
      if (hiddenCaseIds.has(String(caseData.id))) {
        return [];
      }

      // Add to case data map for popover
      dataMap.set(caseData.id, {
        employerName: caseData.employerName,
        beneficiaryIdentifier: caseData.beneficiaryIdentifier,
        positionTitle: caseData.positionTitle,
        caseStatus: caseData.caseStatus,
      });

      // Every field the row carries, as the event mapper reads it
      const calendarCaseData = toCalendarCaseData(caseData);

      return caseToCalendarEvents(calendarCaseData);
    });

    // Filter out hidden deadline types
    const filteredEvents = allEvents.filter(
      (event) => !hiddenTypes.has(event.deadlineType)
    );

    return { events: filteredEvents, caseDataMap: dataMap };
  }, [calendarCases, preferences]);

  // The header counts deadlines only; recorded dates (a filed PWD, a placed
  // ad) sit on the calendar too but are not something still to meet.
  const openDeadlines = events.filter((e) => !RECORDED_EVENT_TYPES.has(e.deadlineType)).length;

  // Redirect to login if not authenticated (in useEffect to avoid setState during render)
  // useQuery returns null when auth fails, undefined while loading
  useEffect(() => {
    if (calendarCases === null || preferences === null) {
      router.push("/login");
    }
  }, [calendarCases, preferences, router]);

  // Don’t render while redirecting or checking auth
  if (calendarCases === null || preferences === null) {
    return null;
  }

  // Loading state
  if (calendarCases === undefined || preferences === undefined) {
    return <CalendarSkeleton />;
  }

  // Empty state - no cases at all
  if (calendarCases.length === 0) {
    return <CalendarEmptyState />;
  }

  // No events after filtering (all hidden or no dates set)
  if (events.length === 0) {
    return (
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="mb-6">
          <PageHeading
            title="Calendar"
          />
        </div>

        {/* Calendar view with empty state message */}
        <div className="flex flex-1 flex-col items-center justify-center bg-tint px-4 py-16 border-2 shadow-hard border-border">
          <div className="text-center max-w-md">
            <div className="mb-4 inline-block bg-background p-4 border-2 shadow-hard border-border">
              <CalendarIcon className="size-12 text-muted-foreground" />
            </div>
            <h2 className="font-heading text-xl font-semibold mb-2">
              No deadlines visible
            </h2>{" "}
            <p className="text-muted-foreground">
              Your cases exist but don&apos;t have milestone dates set, or all
              deadline types are hidden. Update your cases with dates to see
              them on the calendar.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      data-tour="calendar-view"
      className="flex flex-col h-full"
    >
      <CaseCapNotice className="mb-4" />

      {/* Google Calendar Connection Banner - shown when not connected */}
      {!isGoogleConnected && (
        <div className="mb-4 flex items-center justify-between gap-4 bg-tint px-4 py-3">
          <div className="flex items-center gap-3">
            <InfoIcon className="size-5 shrink-0 text-foreground" aria-hidden="true" />
            <div>
              <p className="text-sm font-medium text-foreground">
                Sync deadlines to Google Calendar
              </p>{" "}
              <p className="text-sm text-muted-foreground">
                Connect your Google Calendar to automatically sync case deadlines
              </p>
            </div>
          </div>
          <Link
            href="/settings?tab=calendar-sync"
            className="inline-flex min-h-11 shrink-0 items-center gap-1.5 bg-primary px-3 text-sm font-semibold text-primary-foreground transition-[color,background-color,border-color,box-shadow,transform] hover:bg-primary/90 border-2 motion-safe:hover:-translate-x-0.5 motion-safe:hover:-translate-y-0.5 border-border"
          >
            Connect
            <ArrowSquareOutIcon className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}

      {/* Header */}
      <div className="mb-4">
        <PageHeading
          meta={`${openDeadlines} deadline${openDeadlines !== 1 ? "s" : ""} across ${calendarCases.length} case${calendarCases.length !== 1 ? "s" : ""}`}
          title="Calendar"
        />
      </div>

      {/* Filters */}
      <div className="mb-4">
        <CalendarFilters
          allCases={allCasesForSelection}
          hiddenCases={preferences.hiddenCases}
          hiddenDeadlineTypes={preferences.hiddenDeadlineTypes as DeadlineType[]}
          showCompleted={showCompleted}
          onShowCompletedChange={setShowCompleted}
          showClosed={showClosed}
          onShowClosedChange={setShowClosed}
        />
      </div>

      {/* Calendar */}
      <div className="flex-1">
        <CalendarView
          events={events}
          defaultView="month"
          caseDataMap={caseDataMap}
          hiddenCases={preferences.hiddenCases}
        />
      </div>
    </div>
  );
}
