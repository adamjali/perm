"use client";

/**
 * useNotificationToasts Hook
 *
 * Displays toast notifications when new notifications arrive in real-time.
 *
 * Features:
 * - Shows toast only for NEW notifications (not initial page load)
 * - Click toast → navigate to associated case + mark as read
 * - Auto-dismiss after 5 seconds
 * - Limits to 3 visible toasts (configured in sonner.tsx)
 * - Priority-based toast variants (info/warning/error for normal/high/urgent)
 * - Memory-efficient: Prunes seen IDs set to prevent unbounded growth
 *
 * Algorithm:
 * 1. Track seen notification IDs in useRef (no re-renders, survives re-renders)
 * 2. Skip initial load to avoid toasting existing notifications
 * 3. On query update, diff current vs. seen IDs
 * 4. For each new unread ID, show toast and add to seen set
 * 5. Prune seen set to only keep current notification IDs
 *
 * Phase: 25.2 (Toast Notifications)
 * Created: 2026-01-03
 */

import { useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation } from "convex/react";
import { useRouter } from "next/navigation";
import { toast } from "@/lib/toast";
import { api } from "../../convex/_generated/api";
import { useAuthContext } from "@/lib/contexts/AuthContext";
import type { Id } from "../../convex/_generated/dataModel";

// Map notification priority to Sonner toast type
type ToastVariant = "info" | "warning" | "error" | "success";

const PRIORITY_TO_TOAST_VARIANT: Record<string, ToastVariant> = {
  low: "info",
  normal: "info",
  high: "warning",
  urgent: "error",
};

// Notification type for type safety
type NotificationType =
  | "deadline_reminder"
  | "status_change"
  | "rfe_alert"
  | "rfi_alert"
  | "system"
  | "auto_closure";

type NotificationPriority = "low" | "normal" | "high" | "urgent";

/**
 * Notification data returned from getRecentNotifications query.
 * Includes optional caseInfo from the join with cases table.
 */
interface NotificationData {
  _id: Id<"notifications">;
  type: NotificationType;
  title: string;
  message: string;
  priority: NotificationPriority;
  caseId?: Id<"cases">;
  isRead: boolean;
  createdAt: number;
  caseInfo?: {
    employerName?: string;
    beneficiaryIdentifier?: string;
    caseStatus?: string;
  } | null;
}

/**
 * Hook to display toast notifications for newly arrived notifications.
 *
 * Mount this hook once in the authenticated layout (Header.tsx) to enable
 * toast notifications for all authenticated pages.
 */
export function useNotificationToasts(): void {
  const router = useRouter();
  const { isSigningOut } = useAuthContext();
  const markAsRead = useMutation(api.notifications.markAsRead);

  // Track which notification IDs we've already seen/toasted
  // Using useRef so it persists across re-renders but resets on unmount
  const seenNotificationIds = useRef<Set<string>>(new Set());

  // Track if initial data has been loaded (to skip toasting existing notifications)
  const hasInitialDataLoaded = useRef(false);

  // Subscribe to recent notifications (real-time updates via Convex)
  const notifications = useQuery(
    api.notifications.getRecentNotifications,
    isSigningOut ? "skip" : { limit: 5 }
  ) as NotificationData[] | undefined;

  // Handle toast click: mark as read and navigate to case
  const handleToastClick = useCallback(
    async (notification: NotificationData) => {
      // Mark as read
      try {
        await markAsRead({ notificationId: notification._id });
      } catch (error) {
        console.error("Failed to mark notification as read:", error);
        // Still navigate - the notification will show as unread in dropdown
      }

      // Navigate to case if it exists
      if (notification.caseId) {
        router.push(`/cases/${notification.caseId}`);
      }
    },
    [markAsRead, router]
  );

  useEffect(() => {
    // Skip if no notifications or still loading
    if (!notifications || notifications.length === 0) {
      return;
    }

    // Get current notification IDs for memory management
    const currentIds = new Set(notifications.map((n) => n._id));

    // On first data load, populate seen set and return without toasting
    if (!hasInitialDataLoaded.current) {
      hasInitialDataLoaded.current = true;
      notifications.forEach((n) => {
        seenNotificationIds.current.add(n._id);
      });
      return;
    }

    // Find new notifications (not in seen set, and not already read)
    const newNotifications = notifications.filter(
      (n) => !n.isRead && !seenNotificationIds.current.has(n._id)
    );

    // Show toast for each new notification
    for (const notification of newNotifications) {
      // Mark as seen immediately to prevent duplicate toasts
      seenNotificationIds.current.add(notification._id);

      // Determine toast variant based on priority
      const variant = PRIORITY_TO_TOAST_VARIANT[notification.priority] || "info";

      // Show toast with action button
      toast[variant](notification.title, {
        description: notification.message,
        duration: 5000, // Auto-dismiss after 5 seconds
        dismissible: true,
        action: notification.caseId
          ? {
              label: "View",
              onClick: () => handleToastClick(notification),
            }
          : undefined,
        // Unique ID to prevent duplicate toasts
        id: `notification-toast-${notification._id}`,
      });
    }

    // Memory management: Prune seen IDs to only keep current notification IDs
    // This prevents unbounded growth over time
    const seenArray = Array.from(seenNotificationIds.current);
    const prunedIds = seenArray.filter((id) => currentIds.has(id as Id<"notifications">));
    seenNotificationIds.current = new Set(prunedIds);
  }, [notifications, handleToastClick]);
}
