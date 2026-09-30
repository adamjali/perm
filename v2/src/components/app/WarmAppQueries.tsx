"use client";

import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useAuthContext } from "@/lib/contexts/AuthContext";

/**
 * Keeps the main pages' queries subscribed on every signed-in page, so moving
 * between the dashboard, the calendar and the timeline renders each one
 * filled in, not as skeletons that resolve one by one.
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
  // Calendar (its default filters) and the timeline's saved range.
  useQuery(api.calendar.getCalendarEvents, { showCompleted: false, showClosed: false });
  useQuery(api.calendar.getCalendarPreferences);
  useQuery(api.timeline.getPreferences);
  return null;
}
