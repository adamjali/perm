/**
 * Notifications Page
 * Full notification history with filtering, grouping, and bulk actions.
 *
 * Features:
 * - Page header with title, description, and bulk action buttons
 * - Tab navigation for filtering by type (All, Unread, Deadlines, Status, RFE/RFI)
 * - Notifications grouped by date (Today, Yesterday, This Week, This Month, Older)
 * - 20 notifications per page with "Load More" pagination
 * - Real-time updates via Convex subscriptions
 *
 * Layout:
 * 1. Page header with bulk actions
 * 2. Notification tabs
 * 3. Notification list with date grouping
 *
 * Phase: 24 (Notifications)
 * Created: 2025-12-31
 */

import type { Metadata } from "next";
import { NotificationsPageClient } from "./NotificationsPageClient";

export const metadata: Metadata = {
  title: "Notifications",
  robots: { index: false, follow: false },
};

export default function NotificationsPage() {
  return <NotificationsPageClient />;
}
