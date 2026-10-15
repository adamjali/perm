
"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { useAuthContext } from "@/lib/contexts/AuthContext";
import {
  NotificationTabs,
  NotificationList,
  BulkActions,
  NOTIFICATION_PANEL_ID,
  type NotificationTabType,
} from "@/components/notifications";
import { PageHeading } from "../components/PageHeading";

export function NotificationsPageClient() {
  const { isSigningOut } = useAuthContext();

  // Active tab state
  const [activeTab, setActiveTab] = useState<NotificationTabType>("all");

  // Get notification stats for tab counts
  const stats = useQuery(
    api.notifications.getNotificationStats,
    isSigningOut ? "skip" : undefined
  );

  // Calculate tab counts from stats
  const tabCounts: Partial<Record<NotificationTabType, number>> = {
    all: stats?.total ?? 0,
    unread: stats?.unread ?? 0,
    deadlines: stats?.byType?.deadline_reminder ?? 0,
    status: stats?.byType?.status_change ?? 0,
    rfe_rfi:
      (stats?.byType?.rfe_alert ?? 0) + (stats?.byType?.rfi_alert ?? 0),
  };

  return (
    <div className="mx-auto w-full max-w-4xl">
      {/* Page Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <PageHeading title="Notifications" />
        <BulkActions />
      </div>

      {/* Notification Tabs */}
      <NotificationTabs
        activeTab={activeTab}
        onTabChange={setActiveTab}
        counts={tabCounts}
        className="mb-6"
      />

      {stats?.capped && (
        <p className="-mt-3 mb-6 text-sm text-muted-foreground">
          These counts cover your newest {stats.total.toLocaleString()} notifications. The list
          below still reaches every one.
        </p>
      )}

      <div role="tabpanel" id={NOTIFICATION_PANEL_ID} aria-labelledby={`notification-tab-${activeTab}`}>
        <NotificationList activeTab={activeTab} />
      </div>
    </div>
  );
}
