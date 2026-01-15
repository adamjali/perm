/**
 * Timeline Page
 * Multi-case Gantt chart visualization for case progress.
 *
 * Features:
 * - Time range control (3/6/12/24 months)
 * - Case selector for filtering visible cases
 * - Interactive timeline grid with stages
 * - Stage-based color coding with legend
 * - Click-to-filter single case preview mode
 * - Zoom control (50-200%)
 * - Auto-resize row heights based on case count
 *
 * Layout:
 * 1. Header with controls (time range, case selector, zoom)
 * 2. Main timeline grid (scrollable)
 * 3. Legend footer
 *
 * Phase: 24 (Timeline Visualization)
 * Created: 2025-12-26
 * Updated: 2025-12-27 - Added click behaviors, zoom, auto-resize
 */

import type { Metadata } from "next";
import { TimelinePageClient } from "./TimelinePageClient";

export const metadata: Metadata = {
  title: "Timeline",
  robots: { index: false, follow: false },
};

export default function TimelinePage() {
  return <TimelinePageClient />;
}
