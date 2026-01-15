/**
 * NotificationTabs Component
 * Tab navigation for filtering notifications by type.
 *
 * Tabs:
 * - All: All notifications
 * - Unread: Only unread notifications
 * - Deadlines: deadline_reminder type
 * - Status: status_change type
 * - RFE/RFI: rfe_alert and rfi_alert types
 *
 * Each tab shows a count badge for the number of notifications in that category.
 *
 * Phase: 24 (Notifications)
 * Created: 2025-12-31
 */

"use client";

import { cn } from "@/lib/utils";

// Tab configuration
export type NotificationTabType = "all" | "unread" | "deadlines" | "status" | "rfe_rfi";

interface NotificationTabsProps {
  /** Currently active tab */
  activeTab: NotificationTabType;
  /** Callback when tab changes */
  onTabChange: (tab: NotificationTabType) => void;
  /** Counts for each tab (optional) */
  counts?: Partial<Record<NotificationTabType, number>>;
  /** Optional className for styling */
  className?: string;
}

const TABS: { id: NotificationTabType; label: string }[] = [
  { id: "all", label: "All" },
  { id: "unread", label: "Unread" },
  { id: "deadlines", label: "Deadlines" },
  { id: "status", label: "Status" },
  { id: "rfe_rfi", label: "RFE/RFI" },
];

export default function NotificationTabs({
  activeTab,
  onTabChange,
  counts = {},
  className,
}: NotificationTabsProps) {
  return (
    <div
      className={cn(
        "flex flex-wrap gap-2 border-b-2 border-black dark:border-white/50 pb-4",
        className
      )}
      role="tablist"
      aria-label="Notification filters"
    >
      {TABS.map((tab) => {
        const isActive = activeTab === tab.id;
        const count = counts[tab.id];

        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            aria-controls={`notification-panel-${tab.id}`}
            onClick={() => onTabChange(tab.id)}
            className={cn(
              // Base styles
              "flex items-center gap-2 px-4 py-2",
              "text-sm font-heading font-bold uppercase tracking-wide",
              "border-2 transition-all duration-150",
              // Active state
              isActive
                ? "border-black bg-black text-white dark:border-white dark:bg-white dark:text-black"
                : "border-transparent text-muted-foreground hover:border-black/50 hover:text-foreground dark:hover:border-white/50",
              // Focus state
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            )}
          >
            <span>{tab.label}</span>
            {count !== undefined && count > 0 && (
              <span
                className={cn(
                  "flex items-center justify-center",
                  "min-w-[20px] h-5 px-1.5",
                  "text-[10px] font-bold rounded-full",
                  isActive
                    ? "bg-white text-black dark:bg-black dark:text-white"
                    : "bg-muted text-muted-foreground"
                )}
              >
                {count > 99 ? "99+" : count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
