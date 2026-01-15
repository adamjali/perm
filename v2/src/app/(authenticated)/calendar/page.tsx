/**
 * Calendar Page
 *
 * Full calendar view for PERM case deadlines using react-big-calendar.
 * Displays case milestones with stage-based color coding.
 *
 * Features:
 * - Month/Week/Day views
 * - Stage-based event coloring
 * - Click to navigate to case detail
 * - Filter out hidden cases based on preferences
 * - Deadline type filtering with grouped toggles
 * - Case selection modal for visibility control
 * - Loading skeleton while data loads
 * - Empty state when no cases
 *
 * Phase: 23.1 (Calendar UI)
 * Created: 2025-12-28
 */

import type { Metadata } from "next";
import { CalendarPageClient } from "./CalendarPageClient";

export const metadata: Metadata = {
  title: "Calendar",
  robots: { index: false, follow: false },
};

export default function CalendarPage() {
  return <CalendarPageClient />;
}
