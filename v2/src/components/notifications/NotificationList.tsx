"use client";

// `convex/react` is a CLIENT-ONLY module: its hooks reach `React.createContext`,
// which exists only in React's client build. Declared here rather
// than inherited from whichever importer happened to cross a boundary first.
// Without it this module works until the chunk graph shifts, then fails with
// `TypeError: (0 , d.createContext) is not a function` naming webpack bootstrap
// and no source file. See components/layout/Footer.tsx.

/**
 * NotificationList Component
 * Full list of notifications with grouping by date and pagination.
 *
 * Features:
 * - Grouped by date: Today, Yesterday, This Week, This Month, Older
 * - 20 notifications per page with "Load More" pagination
 * - Each item shows: an icon coloured by priority, title, message, time
 * - Click to mark as read + navigate to case
 * - Dismiss (mark as read) vs Delete (remove) actions
 * - Empty state when no notifications match filters
 */

"use client";

import { useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { MS_PER_DAY } from "@/lib/time";
import { api } from "@convex/_generated/api";
import { useAuthContext } from "@/lib/contexts/AuthContext";
import { Button, buttonVariants } from "@/components/ui/button";
import { Pager } from "@/components/ui/pager";
import { Skeleton } from "@/components/ui/skeleton";
import { SpotPicture } from "@/components/ui/spot-picture";
import { handleOperationError } from "@/lib/errors";
import { cn } from "@/lib/utils";
import { safeFormatDistanceToNow } from "@/lib/utils/date";
import { ArrowsClockwiseIcon as RefreshCw, CalendarIcon, CheckIcon, CircleNotchIcon, ClockIcon, InfoIcon, TrashIcon as Trash2, WarningIcon as AlertTriangle } from "@phosphor-icons/react/ssr";
import type { Icon as PhosphorIcon } from "@phosphor-icons/react";
import type { Id } from "@convex/_generated/dataModel";
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
    positionTitle?: string;
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
const NOTIFICATION_ICONS: Record<NotificationType, PhosphorIcon> = {
  deadline_reminder: CalendarIcon,
  status_change: RefreshCw,
  rfe_alert: AlertTriangle,
  rfi_alert: AlertTriangle,
  auto_closure: ClockIcon,
  system: InfoIcon,
};

// How loud each priority's icon is: the two that need action get a colour.
const PRIORITY_INK: Record<NotificationPriority, string> = {
  urgent: "text-destructive",
  high: "text-data-warn-ink",
  normal: "text-muted-foreground",
  low: "text-muted-foreground",
};

// Date grouping helper
function getDateGroup(timestamp: number): string {
  const now = new Date();
  const date = new Date(timestamp);
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / MS_PER_DAY);

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
    return "This week";
  }
  if (diffDays < 30) {
    return "This month";
  }
  return "Older";
}

// Group notifications by date
function groupNotificationsByDate(
  notifications: Notification[]
): Map<string, Notification[]> {
  const groups = new Map<string, Notification[]>();
  const groupOrder = ["Today", "Yesterday", "This week", "This month", "Older"];

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
  const caseLine = notification.caseInfo?.employerName
    ? [notification.caseInfo.employerName, notification.caseInfo.positionTitle || notification.caseInfo.beneficiaryIdentifier]
        .filter(Boolean)
        .join(" - ")
    : null;

  const handleClick = () => {
    if (!notification.isRead) {
      onMarkRead(notification._id);
    }
    onNavigate(notification.caseId);
  };

  const iconButton =
    "relative z-10 flex size-11 items-center justify-center text-muted-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

  // The title is the row's one button, stretched over the whole row, so the
  // row opens the case and the two small actions stay separate buttons.
  return (
    <li className="group relative flex items-start gap-3 border-b border-border py-3 pl-4 pr-1 hover:bg-accent has-[:focus-visible]:bg-accent">
      {/* An unread notice carries the lime down its edge, as a case row carries its stage. */}
      {!notification.isRead ? <span aria-hidden="true" className="absolute inset-y-0 left-0 w-1.5 bg-primary" /> : null}
      <IconComponent
        className={cn("mt-0.5 size-5 shrink-0", PRIORITY_INK[notification.priority])}
        aria-hidden="true"
      />

      <div className="min-w-0 flex-1 space-y-1">
        <button
          type="button"
          onClick={handleClick}
          className={cn(
            "line-clamp-2 text-left text-base after:absolute after:inset-0 focus-visible:outline-none",
            notification.isRead ? "text-soft" : "font-semibold text-foreground",
          )}
          title={notification.title}
        >
          {!notification.isRead && <span className="sr-only">Unread: </span>}
          {notification.title}
        </button>

        <p className="line-clamp-2 break-words text-sm text-muted-foreground" title={notification.message}>
          {notification.message}
        </p>{" "}

        <p className="flex justify-between gap-3 text-sm text-muted-foreground">
          <span className="min-w-0 truncate" title={caseLine ?? undefined}>{caseLine}</span>{" "}
          <span className="shrink-0 whitespace-nowrap tabular-nums">{safeFormatDistanceToNow(notification.createdAt)}</span>
        </p>
      </div>

      {/* Always there on a phone; on a desk, shown on hover or keyboard focus */}
      <div className="-my-2 flex shrink-0 flex-col md:flex-row md:items-center md:opacity-0 md:group-hover:opacity-100 md:group-has-[:focus-visible]:opacity-100">
        {!notification.isRead && (
          <button
            type="button"
            onClick={() => onMarkRead(notification._id)}
            className={cn(iconButton, "hover:text-primary-text")}
            aria-label="Mark as read"
            title="Mark as read"
          >
            <CheckIcon className="size-4" />
          </button>
        )}
        <button
          type="button"
          onClick={() => onDelete(notification._id)}
          className={cn(iconButton, "hover:text-destructive-text")}
          aria-label="Delete notification"
          title="Delete"
        >
          <Trash2 className="size-4" />
        </button>
      </div>
    </li>
  );
}

// Loading skeleton: the list's own shape
function NotificationListSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton variant="line" className="h-5 w-24" />
      <div className="border-t-2 border-[var(--object-border)]">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="flex items-start gap-3 border-b border-border px-4 py-3 last:border-b-0">
            <Skeleton className="size-5 shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton variant="line" className="h-5 w-3/4" />
              <Skeleton variant="line" className="h-4 w-full" />
              <Skeleton variant="line" className="h-4 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Empty state
export function EmptyState({ activeTab }: { activeTab: NotificationTabType }) {
  const messages: Record<NotificationTabType, { title: string; description: string }> = {
    all: {
      title: "No notifications",
      description: "Deadline reminders and case updates appear here.",
    },
    unread: {
      title: "No unread notifications",
      description: "You’ve read every notification.",
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
    <div className="bg-tint px-4 py-12 text-center">
      {/* A quiet desk bell, decorative beside the words that say there's nothing new. */}
      <SpotPicture name="empty-notifications" alt="" className="mx-auto mb-3 w-28" />{" "}
      <p className="font-heading text-lg font-bold text-foreground">{title}</p>{" "}
      <p className="mx-auto mt-2 max-w-xs text-sm text-muted-foreground">{description}</p>
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

  // Pages, not an endless list (owner, Oct 21 2026: "pagination not endless scroll"): twenty a page, the
  // server's cursor for each page kept in a stack so Previous goes back exactly. A new tab starts at page 1.
  const [stack, setStack] = useState<Array<string | undefined>>([undefined]);
  const cursor = stack[stack.length - 1];
  const top = useRef<HTMLDivElement>(null);

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

  // A new tab starts at the first page.
  const [tabSeen, setTabSeen] = useState(activeTab);
  if (tabSeen !== activeTab) {
    setTabSeen(activeTab);
    setStack([undefined]);
  }

  // The last page shown stays on screen while the next one loads, so a press never blanks the list.
  const fresh = result?.notifications as Notification[] | undefined;
  const [lastShown, setLastShown] = useState<Notification[]>([]);
  if (fresh && fresh !== lastShown) setLastShown(fresh);
  const loading = result === undefined;

  // Mutations
  const markAsRead = useMutation(api.notifications.markAsRead);
  const deleteNotification = useMutation(api.notifications.deleteNotification);

  // Handlers
  const handleMarkRead = async (notificationId: Id<"notifications">) => {
    try {
      await markAsRead({ notificationId });
    } catch (error) {
      handleOperationError(error, { userMessage: "Couldn’t mark as read. Try again." });
    }
  };

  const handleDelete = async (notificationId: Id<"notifications">) => {
    try {
      await deleteNotification({ notificationId });
    } catch (error) {
      handleOperationError(error, { userMessage: "Couldn’t delete the notification. Try again." });
    }
  };

  const handleNavigate = (caseId?: Id<"cases">) => {
    if (caseId) {
      router.push(`/cases/${caseId}`);
    }
  };

  const goNext = () => {
    const next = result?.nextCursor;
    if (next && !loading) setStack((st) => [...st, next]);
  };
  const goPrevious = () => setStack((st) => (st.length > 1 ? st.slice(0, -1) : st));

  const shown = fresh ?? lastShown;

  if (result === undefined && shown.length === 0) {
    return <NotificationListSkeleton />;
  }

  // Empty state: only when the server has nothing further to look through.
  // A filtered tab can come back with an empty page while older rows remain
  // unchecked, and "no deadline notifications" would then be false.
  if (shown.length === 0 && result?.notifications.length === 0 && !result.hasMore) {
    return <EmptyState activeTab={activeTab} />;
  }

  if (shown.length === 0 && result?.hasMore) {
    return (
      <div className={cn("flex flex-col items-center gap-4 py-12 text-center", className)}>
        <p className="max-w-sm text-sm text-muted-foreground">
          None of your newest notifications match this tab. Older ones haven&apos;t been checked yet.
        </p>
        <Button variant="outline" size="lg" onClick={goNext} disabled={loading}>
          {loading ? (
            <>
              <CircleNotchIcon className="size-4 mr-2 animate-spin" />
              Looking...
            </>
          ) : (
            "Look further back"
          )}
        </Button>
      </div>
    );
  }

  // Group notifications by date
  const groupedNotifications = groupNotificationsByDate(shown);

  return (
    <div ref={top} className={cn("scroll-mt-28 space-y-6", className)}>
      {Array.from(groupedNotifications.entries()).map(([group, notifications]) => (
        <div key={group}>
          {/* Group header */}
          <h2 className="border-b-2 border-[var(--object-border)] pb-2 font-heading text-base font-bold">{group}</h2>

          {/* Notifications in group */}
          <ul>
            {notifications.map((notification) => (
              <NotificationListItem
                key={notification._id}
                notification={notification}
                onMarkRead={handleMarkRead}
                onDelete={handleDelete}
                onNavigate={handleNavigate}
              />
            ))}
          </ul>
        </div>
      ))}

      {stack.length > 1 || result?.hasMore ? (
        <Pager
          id="notifications-pages"
          page={stack.length}
          hasPrevious={stack.length > 1}
          hasNext={!!result?.hasMore}
          loading={loading}
          onPrevious={goPrevious}
          onNext={goNext}
          noun="notifications"
          previousLabel="Newer"
          nextLabel="Older"
          buttonClassName={buttonVariants({ variant: "outline", size: "lg" })}
          scrollTo={top}
          className="pt-4"
        />
      ) : null}
    </div>
  );
}
