/**
 * Dashboard Page
 * Main dashboard view for authenticated users.
 *
 * Features:
 * - Welcome header with user name
 * - Auto-closure alert banner (when cases are auto-closed)
 * - Deadline enforcement check on login
 * - DeadlineHeroWidget (crown jewel, most prominent)
 * - Summary tiles grid showing case counts by stage
 * - Two-column layout: Upcoming Deadlines | Recent Activity
 * - Add Case button (call to action)
 *
 * Layout:
 * 1. Welcome header
 * 2. Auto-closure alert banner (if any)
 * 3. Deadline Hero Widget (full width)
 * 4. Summary Tiles Grid
 * 5. Two-column: UpcomingDeadlinesWidget | RecentActivityWidget
 * 6. AddCaseButton (full width)
 *
 * Phase: 20 (Dashboard Complete)
 * Created: 2025-12-23
 */

import type { Metadata } from "next";
import { DashboardPageClient } from "./DashboardPageClient";

export const metadata: Metadata = {
  title: "Dashboard",
  robots: { index: false, follow: false },
};

export default function DashboardPage() {
  return <DashboardPageClient />;
}
