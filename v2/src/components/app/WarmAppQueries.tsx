"use client";

import { useMemo } from "react";
import { usePathname } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { useAuthContext } from "@/lib/contexts/AuthContext";
import { defaultCaseListQueryArgs } from "@/app/(authenticated)/cases/cases-storage";

/**
 * Keeps the main pages' queries subscribed on every signed-in page, so moving
 * between the dashboard, the case list, the calendar and the timeline renders
 * each one filled in, not as skeletons that resolve one by one. (Measured on
 * production: a warm page opens with no skeleton at all; a cold one shows
 * one for 0.7 to 1.2 seconds on every visit.)
 *
 * Convex shares one subscription per (query, arguments) pair across the whole
 * client, so these cost nothing extra while the dashboard is open, and on any
 * other page they keep the answers current (the server pushes changes). The
 * arguments must match the widgets' own calls EXACTLY, "skip" and all, or
 * they are a second subscription that warms nothing. Renders nothing.
 */
export function WarmAppQueries() {
  const { isSigningOut } = useAuthContext();
  const skip = isSigningOut ? "skip" : undefined;
  // DeadlineHeroWidget, SummaryTilesGrid, AutoClosureAlertBanner
  useQuery(api.dashboard.getDeadlines, skip);
  useQuery(api.dashboard.getSummary, skip);
  useQuery(api.deadlineEnforcement.getAutoClosureAlerts, skip);
  // Called without a skip argument by their widgets, so the same here; after
  // sign-out the whole tree unmounts and takes these with it.
  useQuery(api.dashboard.getUpcomingDeadlines, { days: 30 });
  useQuery(api.dashboard.getRecentActivity);
  useQuery(api.dolProcessingTimes.getLatest);
  useQuery(api.deadlineEnforcement.isEnforcementEnabled);
  // Calendar (its default filters).
  useQuery(api.calendar.getCalendarEvents, { showCompleted: false, showClosed: false });
  useQuery(api.calendar.getCalendarPreferences);
  // The timeline at its saved range, asked exactly as the page asks.
  const timelinePrefs = useQuery(api.timeline.getPreferences);
  useQuery(
    api.timeline.getCasesForTimeline,
    timelinePrefs === undefined ? "skip" : { timeRange: timelinePrefs?.timeRange ?? 6 },
  );
  // The case list as it opens with no URL parameters: saved filters, sort and
  // page size. Re-read on every navigation, because leaving the list is when
  // a changed filter has just been saved.
  const pathname = usePathname();
  const caseListArgs = useMemo(
    () => defaultCaseListQueryArgs(),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- storage is re-read per navigation
    [pathname],
  );
  useQuery(api.cases.listFiltered, isSigningOut ? "skip" : caseListArgs);
  return null;
}
