
"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { useAuthContext } from "@/lib/contexts/AuthContext";
import {
  NotificationTabs,
  NotificationList,
  BulkActions,
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <PageHeading
            eyebrow="Alerts"
            title="Notifications"
            lede="Manage your notification history"
          />
        </div>
        <BulkActions />
      </div>

      {/* Notification Tabs */}
      <NotificationTabs
        activeTab={activeTab}
        onTabChange={setActiveTab}
        counts={tabCounts}
        className="mb-6"
      />

      {/* Notification List */}
      <NotificationList activeTab={activeTab} />
    </div>
  );
}
