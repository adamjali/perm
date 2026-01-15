/**
 * NotificationList Component
 * Full list of notifications with grouping by date and pagination.
 *
 * Features:
 * - Grouped by date: Today, Yesterday, This Week, This Month, Older
 * - 20 notifications per page with "Load More" pagination
 * - Each item shows: urgency color bar, icon, title, message, time
 * - Click to mark as read + navigate to case
 * - Dismiss (mark as read) vs Delete (remove) actions
 * - Empty state when no notifications match filters
 *
 * Phase: 24 (Notifications)
 * Created: 2025-12-31
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useAuthContext } from "@/lib/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { safeFormatDistanceToNow } from "@/lib/utils/date";
import {
  Bell,
  Calendar,
  AlertTriangle,
  RefreshCw,
  Info,
  Clock,
  Trash2,
  Check,
  Loader2,
  type LucideIcon,
} from "lucide-react";
import type { Id } from "../../../convex/_generated/dataModel";
import type { NotificationTabType } from "./NotificationTabs";

// Types
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

interface NotificationListProps {
  /** Current active filter tab */
  activeTab: NotificationTabType;
  /** Optional className for styling */
  className?: string;
}

// Icon mapping for notification types
const NOTIFICATION_ICONS: Record<NotificationType, LucideIcon> = {
  deadline_reminder: Calendar,
  status_change: RefreshCw,
  rfe_alert: AlertTriangle,
  rfi_alert: AlertTriangle,
  auto_closure: Clock,
  system: Info,
};

// Priority colors
function getPriorityColor(priority: NotificationPriority): string {
  switch (priority) {
    case "urgent":
      return "bg-[#DC2626]";
    case "high":
      return "bg-[#EA580C]";
    case "normal":
      return "bg-[#059669]";
    case "low":
    default:
      return "bg-gray-400";
  }
}

// Date grouping helper
function getDateGroup(timestamp: number): string {
  const now = new Date();
  const date = new Date(timestamp);
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    // Check if actually today (same calendar day)
    if (date.toDateString() === now.toDateString()) {
      return "Today";
    }
    return "Yesterday";
  }
  if (diffDays === 1 || (diffDays === 0 && date.toDateString() !== now.toDateString())) {
    return "Yesterday";
  }
  if (diffDays < 7) {
    return "This Week";
  }
  if (diffDays < 30) {
    return "This Month";
  }
  return "Older";
}

// Group notifications by date
function groupNotificationsByDate(
  notifications: Notification[]
): Map<string, Notification[]> {
  const groups = new Map<string, Notification[]>();
  const groupOrder = ["Today", "Yesterday", "This Week", "This Month", "Older"];

  // Initialize groups in order
  for (const group of groupOrder) {
    groups.set(group, []);
  }

  // Assign notifications to groups
  for (const notification of notifications) {
    const group = getDateGroup(notification.createdAt);
    const existing = groups.get(group) || [];
    existing.push(notification);
    groups.set(group, existing);
  }

  // Remove empty groups
  for (const [key, value] of groups) {
    if (value.length === 0) {
      groups.delete(key);
    }
  }

  return groups;
}

// Individual notification item
function NotificationListItem({
  notification,
  onMarkRead,
  onDelete,
  onNavigate,
}: {
  notification: Notification;
  onMarkRead: (id: Id<"notifications">) => void;
  onDelete: (id: Id<"notifications">) => void;
  onNavigate: (caseId?: Id<"cases">) => void;
}) {
  const IconComponent = NOTIFICATION_ICONS[notification.type];
  const priorityColor = getPriorityColor(notification.priority);

  const handleClick = () => {
    if (!notification.isRead) {
      onMarkRead(notification._id);
    }
    onNavigate(notification.caseId);
  };

  const handleMarkRead = (e: React.MouseEvent) => {
    e.stopPropagation();
    onMarkRead(notification._id);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete(notification._id);
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={(e) => {
        if ((e.key === "Enter" || e.key === " ") && e.target === e.currentTarget) {
          e.preventDefault();
          handleClick();
        }
      }}
      className={cn(
        "group w-full text-left relative cursor-pointer",
        "flex items-start gap-4 p-4",
        "border-b-2 border-black/10 dark:border-white/10 last:border-b-0",
        "transition-colors duration-150",
        "hover:bg-gray-50 dark:hover:bg-gray-800",
        "focus:outline-none focus:ring-2 focus:ring-primary focus:ring-inset",
        !notification.isRead && "bg-primary/5 dark:bg-primary/10"
      )}
    >
      {/* Urgency color bar */}
      <div
        className={cn("w-1.5 self-stretch rounded-full shrink-0", priorityColor)}
        aria-hidden="true"
      />

      {/* Icon */}
      <div
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center",
          "rounded-none border-2 border-black dark:border-white/50",
          "bg-white dark:bg-gray-800"
        )}
      >
        <IconComponent className="h-5 w-5 text-foreground" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-start justify-between gap-2">
          <p
            className={cn(
              "text-base leading-tight",
              notification.isRead
                ? "font-medium text-foreground/80"
                : "font-bold text-foreground font-heading"
            )}
          >
            {notification.title}
          </p>
          <span className="text-xs text-muted-foreground font-mono whitespace-nowrap shrink-0">
            {safeFormatDistanceToNow(notification.createdAt)}
          </span>
        </div>

        <p className="text-sm text-muted-foreground line-clamp-2">
          {notification.message}
        </p>

        {notification.caseInfo?.employerName && (
          <p className="text-xs text-muted-foreground/70 truncate">
            {notification.caseInfo.employerName}
            {notification.caseInfo.beneficiaryIdentifier &&
              ` - ${notification.caseInfo.beneficiaryIdentifier}`}
          </p>
        )}
      </div>

      {/* Actions (visible on hover) */}
      <div
        className={cn(
          "flex items-center gap-1 shrink-0",
          "opacity-0 group-hover:opacity-100 transition-opacity duration-150"
        )}
      >
        {!notification.isRead && (
          <button
            type="button"
            onClick={handleMarkRead}
            className={cn(
              "flex h-8 w-8 items-center justify-center",
              "border-2 border-transparent rounded-none",
              "text-muted-foreground",
              "hover:bg-primary/10 hover:text-primary hover:border-primary/20",
              "transition-all duration-150",
              "focus:outline-none focus:ring-1 focus:ring-primary"
            )}
            aria-label="Mark as read"
            title="Mark as read"
          >
            <Check className="h-4 w-4" />
          </button>
        )}
        <button
          type="button"
          onClick={handleDelete}
          className={cn(
            "flex h-8 w-8 items-center justify-center",
            "border-2 border-transparent rounded-none",
            "text-muted-foreground",
            "hover:bg-destructive/10 hover:text-destructive hover:border-destructive/20",
            "transition-all duration-150",
            "focus:outline-none focus:ring-1 focus:ring-destructive"
          )}
          aria-label="Delete notification"
          title="Delete"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

// Loading skeleton
function NotificationListSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton variant="line" className="h-6 w-24" />
      <div className="border-2 border-black dark:border-white/50 shadow-hard">
        {[...Array(3)].map((_, i) => (
          <div
            key={i}
            className="flex items-start gap-4 p-4 border-b-2 border-black/10 dark:border-white/10 last:border-b-0"
          >
            <Skeleton className="w-1.5 h-16" />
            <Skeleton className="h-10 w-10 shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton variant="line" className="h-5 w-3/4" />
              <Skeleton variant="line" className="h-4 w-full" />
              <Skeleton variant="line" className="h-3 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Empty state
function EmptyState({ activeTab }: { activeTab: NotificationTabType }) {
  const messages: Record<NotificationTabType, { title: string; description: string }> = {
    all: {
      title: "No notifications",
      description: "You're all caught up! No notifications to display.",
    },
    unread: {
      title: "No unread notifications",
      description: "You've read all your notifications. Great job staying on top of things!",
    },
    deadlines: {
      title: "No deadline notifications",
      description: "No deadline reminders at the moment.",
    },
    status: {
      title: "No status updates",
      description: "No case status changes to report.",
    },
    rfe_rfi: {
      title: "No RFE/RFI alerts",
      description: "No RFE or RFI alerts at the moment.",
    },
  };

  const { title, description } = messages[activeTab];

  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div
        className={cn(
          "flex h-16 w-16 items-center justify-center mb-4",
          "rounded-none border-2 border-black/20 dark:border-white/20",
          "bg-muted"
        )}
      >
        <Bell className="h-8 w-8 text-muted-foreground" />
      </div>
      <p className="text-lg font-heading font-bold text-foreground">{title}</p>
      <p className="text-sm text-muted-foreground mt-2 max-w-xs">{description}</p>
    </div>
  );
}

// Main component
export default function NotificationList({
  activeTab,
  className,
}: NotificationListProps) {
  const router = useRouter();
  const { isSigningOut } = useAuthContext();

  // Pagination state
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [allNotifications, setAllNotifications] = useState<Notification[]>([]);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // Build filter based on active tab
  const getFilters = useCallback(() => {
    switch (activeTab) {
      case "unread":
        return { isRead: false };
      case "deadlines":
        return { type: ["deadline_reminder" as const] };
      case "status":
        return { type: ["status_change" as const] };
      case "rfe_rfi":
        return { type: ["rfe_alert" as const, "rfi_alert" as const] };
      case "all":
      default:
        return {};
    }
  }, [activeTab]);

  // Query notifications with cursor
  const result = useQuery(
    api.notifications.getNotifications,
    isSigningOut ? "skip" : { limit: 20, cursor, filters: getFilters() }
  );

  // Reset pagination when tab changes
  useEffect(() => {
    setCursor(undefined);
    setAllNotifications([]);
    setIsLoadingMore(false);
  }, [activeTab]);

  // Accumulate notifications when new data arrives
  useEffect(() => {
    if (result?.notifications) {
      if (cursor === undefined) {
        // First page - replace all
        setAllNotifications(result.notifications as Notification[]);
      } else {
        // Subsequent pages - append unique notifications
        setAllNotifications((prev) => {
          const existingIds = new Set(prev.map((n) => n._id));
          const newNotifications = (result.notifications as Notification[]).filter(
            (n) => !existingIds.has(n._id)
          );
          return [...prev, ...newNotifications];
        });
      }
      setIsLoadingMore(false);
    }
  }, [result, cursor]);

  // Mutations
  const markAsRead = useMutation(api.notifications.markAsRead);
  const deleteNotification = useMutation(api.notifications.deleteNotification);

  // Handlers
  const handleMarkRead = async (notificationId: Id<"notifications">) => {
    try {
      await markAsRead({ notificationId });
    } catch (error) {
      console.error("Failed to mark notification as read:", error);
    }
  };

  const handleDelete = async (notificationId: Id<"notifications">) => {
    try {
      await deleteNotification({ notificationId });
    } catch (error) {
      console.error("Failed to delete notification:", error);
    }
  };

  const handleNavigate = (caseId?: Id<"cases">) => {
    if (caseId) {
      router.push(`/cases/${caseId}`);
    }
  };

  const handleLoadMore = () => {
    if (result?.nextCursor && !isLoadingMore) {
      setIsLoadingMore(true);
      setCursor(result.nextCursor);
    }
  };

  // Loading state (only for initial load)
  if (result === undefined && allNotifications.length === 0) {
    return <NotificationListSkeleton />;
  }

  // Empty state
  if (allNotifications.length === 0 && result?.notifications.length === 0) {
    return <EmptyState activeTab={activeTab} />;
  }

  // Group notifications by date
  const groupedNotifications = groupNotificationsByDate(allNotifications);

  return (
    <div className={cn("space-y-6", className)}>
      {Array.from(groupedNotifications.entries()).map(([group, notifications]) => (
        <div key={group}>
          {/* Group header */}
          <h3 className="text-sm font-heading font-bold uppercase tracking-wide text-muted-foreground mb-3">
            {group}
          </h3>

          {/* Notifications in group */}
          <div className="border-2 border-black dark:border-white/50 shadow-hard">
            {notifications.map((notification) => (
              <NotificationListItem
                key={notification._id}
                notification={notification}
                onMarkRead={handleMarkRead}
                onDelete={handleDelete}
                onNavigate={handleNavigate}
              />
            ))}
          </div>
        </div>
      ))}

      {/* Load more button */}
      {result?.hasMore && (
        <div className="flex justify-center pt-4">
          <Button
            variant="outline"
            size="lg"
            onClick={handleLoadMore}
            disabled={isLoadingMore}
            className="font-heading uppercase tracking-wide"
          >
            {isLoadingMore ? (
              <>
                <Loader2 className="size-4 mr-2 animate-spin" />
                Loading...
              </>
            ) : (
              "Load More"
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
