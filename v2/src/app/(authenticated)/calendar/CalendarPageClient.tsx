
"use client";

import { useMemo, useState, useEffect } from "react";
import { useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "motion/react";
import { Calendar as CalendarIcon, Plus, Info, ExternalLink } from "lucide-react";

import { api } from "../../../../convex/_generated/api";
import { caseToCalendarEvents } from "@/lib/calendar/event-mapper";
import type { CalendarCaseData, DeadlineType } from "@/lib/calendar/types";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { CalendarView, type CaseDataMap, CalendarFilters } from "@/components/calendar";
import type { CaseForSelection } from "@/components/timeline";

// Import V1-style calendar CSS (Tippy.js theme, event styling)
import "@/app/calendar-v1.css";
// Import calendar animations and accessibility styles
import "@/app/calendar.css";

// ============================================================================
// Animation Constants
// ============================================================================

/**
 * Fade-in animation for page content
 */
const pageVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.3,
      ease: [0.165, 0.84, 0.44, 1] as const,
    },
  },
};

// ============================================================================
// Loading Skeleton
// ============================================================================

function CalendarSkeleton() {
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <Skeleton variant="line" className="w-32 h-10 mb-2" />
          <Skeleton variant="line" className="w-56 h-5" />
        </div>
      </div>

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

      {/* Calendar grid skeleton */}
      <div className="flex-1 border-2 border-border bg-card shadow-hard">
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
        <h1 className="font-heading text-3xl font-bold">Calendar</h1>
        <p className="text-muted-foreground mt-1">
          View your case deadlines and milestones
        </p>
      </div>

      {/* Empty state message */}
      <div className="flex-1 flex flex-col items-center justify-center py-16 px-4 border-2 border-dashed border-border bg-muted/20">
        <div className="text-center max-w-md">
          <div className="mb-4 p-4 bg-muted inline-block border-2 border-border shadow-hard">
            <CalendarIcon className="size-12 text-muted-foreground" />
          </div>
          <h2 className="font-heading text-xl font-semibold mb-2">
            No Deadlines to Display
          </h2>
          <p className="text-muted-foreground mb-6">
            Add cases with milestone dates to see them on the calendar. Each
            deadline will appear as an event color-coded by stage.
          </p>
          <Button
            onClick={() => router.push("/cases/new")}
            className="bg-primary text-primary-foreground font-semibold border-2 border-border shadow-hard hover:shadow-hard-lg transition-all"
          >
            <Plus className="size-4 mr-2" />
            Add Your First Case
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

      // Map to CalendarCaseData format expected by mapper
      const calendarCaseData: CalendarCaseData = {
        _id: caseData.id,
        employerName: caseData.employerName,
        beneficiaryIdentifier: caseData.beneficiaryIdentifier,
        positionTitle: caseData.positionTitle,
        caseStatus: caseData.caseStatus,
        progressStatus: caseData.progressStatus,
        // PWD dates
        pwdFilingDate: caseData.pwdFilingDate ?? null,
        pwdDeterminationDate: caseData.pwdDeterminationDate ?? null,
        pwdExpirationDate: caseData.pwdExpirationDate ?? null,
        // Recruitment dates
        sundayAdFirstDate: caseData.sundayAdFirstDate ?? null,
        sundayAdSecondDate: caseData.sundayAdSecondDate ?? null,
        jobOrderStartDate: caseData.jobOrderStartDate ?? null,
        jobOrderEndDate: caseData.jobOrderEndDate ?? null,
        noticeOfFilingEndDate: caseData.noticeOfFilingEndDate ?? null,
        // Additional recruitment (for professional occupations)
        additionalRecruitmentStartDate:
          caseData.additionalRecruitmentStartDate ?? null,
        additionalRecruitmentEndDate:
          caseData.additionalRecruitmentEndDate ?? null,
        // ETA 9089 dates
        eta9089FilingDate: caseData.eta9089FilingDate ?? null,
        eta9089CertificationDate: caseData.eta9089CertificationDate ?? null,
        eta9089ExpirationDate: caseData.eta9089ExpirationDate ?? null,
        // I-140 dates
        i140FilingDate: caseData.i140FilingDate ?? null,
        i140ApprovalDate: caseData.i140ApprovalDate ?? null,
        // RFI/RFE entries
        rfiEntries: caseData.rfiEntries ?? null,
        rfeEntries: caseData.rfeEntries ?? null,
      };

      return caseToCalendarEvents(calendarCaseData);
    });

    // Filter out hidden deadline types
    const filteredEvents = allEvents.filter(
      (event) => !hiddenTypes.has(event.deadlineType)
    );

    return { events: filteredEvents, caseDataMap: dataMap };
  }, [calendarCases, preferences]);

  // Redirect to login if not authenticated (in useEffect to avoid setState during render)
  // useQuery returns null when auth fails, undefined while loading
  useEffect(() => {
    if (calendarCases === null || preferences === null) {
      router.push("/login");
    }
  }, [calendarCases, preferences, router]);

  // Don't render while redirecting or checking auth
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
          <h1 className="font-heading text-3xl font-bold">Calendar</h1>
          <p className="text-muted-foreground mt-1">
            View your case deadlines and milestones
          </p>
        </div>

        {/* Calendar view with empty state message */}
        <div className="flex-1 flex flex-col items-center justify-center py-16 px-4 border-2 border-border bg-card shadow-hard">
          <div className="text-center max-w-md">
            <div className="mb-4 p-4 bg-muted inline-block border-2 border-border shadow-hard">
              <CalendarIcon className="size-12 text-muted-foreground" />
            </div>
            <h2 className="font-heading text-xl font-semibold mb-2">
              No Deadlines Visible
            </h2>
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
    <motion.div
      className="flex flex-col h-full"
      variants={pageVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Google Calendar Connection Banner - shown when not connected */}
      {!isGoogleConnected && (
        <div
          className="mb-4 flex items-center justify-between gap-4 px-4 py-3 bg-blue-50 dark:bg-blue-950/30 border-2 border-blue-200 dark:border-blue-800"
          style={{ boxShadow: "2px 2px 0px rgba(59,130,246,0.3)" }}
        >
          <div className="flex items-center gap-3">
            <div className="p-1.5 bg-blue-100 dark:bg-blue-900/50 border border-blue-200 dark:border-blue-700">
              <Info className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-blue-800 dark:text-blue-200">
                Sync deadlines to Google Calendar
              </p>
              <p className="text-xs text-blue-600 dark:text-blue-300">
                Connect your Google Calendar to automatically sync case deadlines
              </p>
            </div>
          </div>
          <Link
            href="/settings?tab=calendar-sync"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white border-2 border-black transition-colors"
            style={{ boxShadow: "2px 2px 0px #000" }}
          >
            Connect
            <ExternalLink className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}

      {/* Header */}
      <div className="mb-4">
        <h1 className="font-heading text-2xl sm:text-3xl font-bold">Calendar</h1>
        <p className="text-sm sm:text-base text-muted-foreground mt-1">
          {events.length} deadline{events.length !== 1 ? "s" : ""} across{" "}
          {calendarCases.length} case{calendarCases.length !== 1 ? "s" : ""}
        </p>
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
    </motion.div>
  );
}
