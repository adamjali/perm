"use client";

/**
 * NotificationDropdown Component
 * Dropdown content for notification bell with recent notifications list.
 *
 * Features:
 * - Shows 5 most recent notifications via getRecentNotifications query
 * - "Mark All Read" button in header
 * - Each notification item with urgency color bar, icon, title, message, time
 * - Click to mark as read and navigate to case
 * - Delete button (X icon) appears on hover for each notification
 * - Footer always shows "View all" link (with "+X more" text if more exist)
 * - Empty state with bell icon and friendly message
 * - Loading skeleton while fetching
 *
 * Neobrutalist styling:
 * - Width: 360px (wider than default dropdown)
 * - Max-height: 400px with scroll
 * - 2px black border, 4px 4px shadow
 * - Space Grotesk for headers, Inter for body
 *
 * Phase: 24 (Notifications)
 * Created: 2025-12-30
 */

import { useState, useEffect } from "react";
import { toast } from "@/lib/toast";
import { Bell, Calendar, AlertTriangle, RefreshCw, Info, Clock, X, Loader2, type LucideIcon } from "lucide-react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useAuthContext } from "@/lib/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { safeFormatDistanceToNow } from "@/lib/utils/date";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import type { Id } from "../../../convex/_generated/dataModel";

// Type for notification from getRecentNotifications
type NotificationType =
  | "deadline_reminder"
  | "status_change"
  | "rfe_alert"
  | "rfi_alert"
  | "system"
  | "auto_closure";

type NotificationPriority = "low" | "normal" | "high" | "urgent";

interface Notification {
  _id: Id<"notifications">;
  _creationTime: number;
  userId: Id<"users">;
  caseId?: Id<"cases">;
  type: NotificationType;
  title: string;
  message: string;
  priority: NotificationPriority;
  deadlineDate?: string;
  deadlineType?: string;
  daysUntilDeadline?: bigint;
  isRead: boolean;
  readAt?: number;
  emailSent: boolean;
  emailSentAt?: number;
  createdAt: number;
  updatedAt: number;
  caseInfo?: {
    employerName?: string;
    beneficiaryIdentifier?: string;
    caseStatus?: string;
  } | null;
}

/**
 * Icon mapping for notification types
 */
const NOTIFICATION_ICONS: Record<NotificationType, LucideIcon> = {
  deadline_reminder: Calendar,
  status_change: RefreshCw,
  rfe_alert: AlertTriangle,
  rfi_alert: AlertTriangle,
  auto_closure: Clock,
  system: Info,
};

/**
 * Get urgency color based on priority
 */
function getPriorityColor(priority: NotificationPriority): string {
  switch (priority) {
    case "urgent":
      return "bg-[#DC2626]"; // Urgent red
    case "high":
      return "bg-[#EA580C]"; // High/soon orange
    case "normal":
      return "bg-[#059669]"; // Normal green
    case "low":
    default:
      return "bg-gray-400"; // Low gray
  }
}

/**
 * Individual notification item in the dropdown
 */
function NotificationItem({
  notification,
  onMarkRead,
  onNavigate,
  onDelete,
}: {
  notification: Notification;
  onMarkRead: (id: Id<"notifications">) => void;
  onNavigate: (caseId?: Id<"cases">) => void;
  onDelete: (id: Id<"notifications">) => void;
}) {
  const IconComponent = NOTIFICATION_ICONS[notification.type];
  const priorityColor = getPriorityColor(notification.priority);

  const handleClick = () => {
    // Mark as read if not already
    if (!notification.isRead) {
      onMarkRead(notification._id);
    }
    // Navigate to case if exists
    onNavigate(notification.caseId);
  };

  const handleDelete = (e: React.MouseEvent) => {
    // Stop propagation to prevent triggering the row click
    e.stopPropagation();
    onDelete(notification._id);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Allow Enter or Space to trigger click, but not if focus is on delete button
    if ((e.key === "Enter" || e.key === " ") && e.target === e.currentTarget) {
      e.preventDefault();
      handleClick();
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className={cn(
        "group w-full text-left relative cursor-pointer",
        "flex items-start gap-3 p-3",
        "border-b-2 border-black/10 dark:border-white/10 last:border-b-0",
        "transition-colors duration-150",
        "hover:bg-gray-50 dark:hover:bg-gray-800",
        "focus:outline-none focus:ring-2 focus:ring-primary focus:ring-inset",
        // Unread styling
        !notification.isRead && "bg-primary/5 dark:bg-primary/10"
      )}
    >
      {/* Urgency color bar */}
      <div
        className={cn(
          "w-1 self-stretch rounded-full shrink-0",
          priorityColor
        )}
        aria-hidden="true"
      />

      {/* Icon */}
      <div
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center",
          "rounded-none border-2 border-black dark:border-white/50",
          "bg-card"
        )}
      >
        <IconComponent className="h-4 w-4 text-foreground" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 space-y-0.5 pr-8">
        {/* Title - bold if unread */}
        <p
          className={cn(
            "text-sm leading-tight",
            notification.isRead
              ? "font-medium text-foreground/80"
              : "font-bold text-foreground font-heading"
          )}
        >
          {notification.title}
        </p>

        {/* Message - 2 line truncate */}
        <p className="text-xs text-muted-foreground line-clamp-2">
          {notification.message}
        </p>

        {/* Case info if available */}
        {notification.caseInfo?.employerName && (
          <p className="text-xs text-muted-foreground/70 truncate">
            {notification.caseInfo.employerName}
            {notification.caseInfo.beneficiaryIdentifier &&
              ` - ${notification.caseInfo.beneficiaryIdentifier}`}
          </p>
        )}
      </div>

      {/* Time and Delete button container */}
      <div className="shrink-0 flex flex-col items-end gap-1">
        <span className="text-[10px] text-muted-foreground font-mono whitespace-nowrap">
          {safeFormatDistanceToNow(notification.createdAt)}
        </span>

        {/* Delete button - appears on hover */}
        <button
          type="button"
          onClick={handleDelete}
          className={cn(
            "flex h-5 w-5 items-center justify-center",
            "rounded-sm border border-transparent",
            "text-muted-foreground/50",
            "opacity-0 group-hover:opacity-100",
            "hover:bg-destructive/10 hover:text-destructive hover:border-destructive/20",
            "transition-all duration-150",
            "focus:opacity-100 focus:outline-none focus:ring-1 focus:ring-destructive"
          )}
          aria-label="Delete notification"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}

/**
 * Loading skeleton for notification list
 */
function NotificationSkeleton() {
  return (
    <div className="p-3 flex items-start gap-3 border-b-2 border-black/10 dark:border-white/10 last:border-b-0">
      <Skeleton className="w-1 h-12" />
      <Skeleton className="h-8 w-8 shrink-0" />
      <div className="flex-1 space-y-2">
        <Skeleton variant="line" className="h-4 w-3/4" />
        <Skeleton variant="line" className="h-3 w-full" />
        <Skeleton variant="line" className="h-3 w-1/2" />
      </div>
      <Skeleton variant="line" className="h-3 w-12" />
    </div>
  );
}

/**
 * Empty state when no notifications exist
 */
function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
      <div
        className={cn(
          "flex h-14 w-14 items-center justify-center mb-3",
          "rounded-none border-2 border-black/20 dark:border-white/20",
          "bg-muted"
        )}
      >
        <Bell className="h-7 w-7 text-muted-foreground" />
      </div>
      <p className="text-sm font-heading font-bold text-foreground">
        No notifications
      </p>
      <p className="text-xs text-muted-foreground mt-1">
        You&apos;re all caught up!
      </p>
    </div>
  );
}

/**
 * Main NotificationDropdown component
 */
export default function NotificationDropdown() {
  const router = useRouter();
  const pathname = usePathname();
  const { isSigningOut } = useAuthContext();

  // Query for recent notifications (limit 5)
  const notifications = useQuery(
    api.notifications.getRecentNotifications,
    isSigningOut ? "skip" : { limit: 5 }
  ) as Notification[] | undefined;

  // Query for total count to show "+X more"
  const unreadCount = useQuery(
    api.notifications.getUnreadCount,
    isSigningOut ? "skip" : undefined
  );

  // Mutations
  const markAsRead = useMutation(api.notifications.markAsRead);
  const markAllAsRead = useMutation(api.notifications.markAllAsRead);
  const deleteNotification = useMutation(api.notifications.deleteNotification);

  // Loading state
  const isLoading = notifications === undefined;

  // Navigation loading state for "View all" link
  const [navigatingToAll, setNavigatingToAll] = useState(false);

  // Reset navigation loading state when pathname changes (navigation complete)
  useEffect(() => {
    setNavigatingToAll(false);
  }, [pathname]);

  // Check if already on notifications page
  const isOnNotificationsPage = pathname === "/notifications";

  // Calculate remaining count for footer
  const remainingCount = (unreadCount ?? 0) > 5 ? (unreadCount ?? 0) - 5 : 0;

  // Handlers
  const handleMarkAsRead = async (notificationId: Id<"notifications">) => {
    try {
      await markAsRead({ notificationId });
    } catch (error) {
      console.error("Failed to mark notification as read:", error);
      toast.error("Failed to mark notification as read");
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await markAllAsRead({});
    } catch (error) {
      console.error("Failed to mark all notifications as read:", error);
      toast.error("Failed to mark all notifications as read");
    }
  };

  const handleNavigate = (caseId?: Id<"cases">) => {
    if (caseId) {
      router.push(`/cases/${caseId}`);
    }
  };

  const handleDelete = async (notificationId: Id<"notifications">) => {
    try {
      await deleteNotification({ notificationId });
    } catch (error) {
      console.error("Failed to delete notification:", error);
      toast.error("Failed to delete notification");
    }
  };

  // Check if there are any unread notifications
  const hasUnread = notifications?.some((n) => !n.isRead) ?? false;

  return (
    <div className="w-[calc(100vw-2rem)] sm:w-[360px]">
      {/* Header */}
      <header
        className={cn(
          "flex items-center justify-between",
          "px-4 py-3",
          "border-b-2 border-black dark:border-white/50"
        )}
      >
        <h3 className="text-base font-heading font-bold text-foreground">
          Notifications
        </h3>
        {hasUnread && (
          <Button
            variant="ghost"
            size="xs"
            onClick={handleMarkAllAsRead}
            className="text-xs text-primary hover:text-primary hover:bg-primary/10"
          >
            Mark All Read
          </Button>
        )}
      </header>

      {/* Notification List */}
      <div className="max-h-[320px] overflow-y-auto overscroll-contain">
        {isLoading ? (
          // Loading skeletons
          <>
            <NotificationSkeleton />
            <NotificationSkeleton />
            <NotificationSkeleton />
          </>
        ) : notifications && notifications.length > 0 ? (
          // Notification items
          notifications.map((notification) => (
            <NotificationItem
              key={notification._id}
              notification={notification}
              onMarkRead={handleMarkAsRead}
              onNavigate={handleNavigate}
              onDelete={handleDelete}
            />
          ))
        ) : (
          // Empty state
          <EmptyState />
        )}
      </div>

      {/* Footer - always show View All link (disabled if already on notifications page) */}
      {!isLoading && (
        <footer
          className={cn(
            "border-t-2 border-black dark:border-white/50",
            "px-4 py-2.5 text-center"
          )}
        >
          {isOnNotificationsPage ? (
            // Already on notifications page - show informative message
            <span
              className={cn(
                "inline-flex items-center gap-1.5",
                "text-sm text-muted-foreground/60 tracking-wide",
                "font-medium cursor-default select-none"
              )}
            >
              <svg
                width="14"
                height="14"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                className="opacity-70"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2.5"
                  d="M5 13l4 4L19 7"
                />
              </svg>
              You&apos;re viewing all notifications
            </span>
          ) : (
            // Normal clickable link
            <Link
              href="/notifications"
              onClick={() => setNavigatingToAll(true)}
              className={cn(
                "group inline-flex items-center gap-1.5",
                "text-sm text-muted-foreground uppercase tracking-wide",
                "hover:text-primary transition-colors",
                "font-heading font-semibold",
                navigatingToAll && "pointer-events-none opacity-70"
              )}
            >
              {navigatingToAll ? "Loading..." : remainingCount > 0 ? `+${remainingCount} more` : "View all"}
              {navigatingToAll ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <svg
                  width="16"
                  height="16"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  className="transition-transform duration-150 group-hover:translate-x-1"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2.5"
                    d="M13 7l5 5m0 0l-5 5m5-5H6"
                  />
                </svg>
              )}
            </Link>
          )}
        </footer>
      )}
    </div>
  );
}
