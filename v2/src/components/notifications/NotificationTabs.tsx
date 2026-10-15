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
 */

"use client";

import { cn } from "@/lib/utils";
import { choiceVariants } from "@/components/ui/choice";

/** The one list the tabs filter; the page gives it this id. */
export const NOTIFICATION_PANEL_ID = "notification-panel";

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
      // Three to a row on a phone, every one the same width; one row from sm.
      className={cn("grid grid-cols-3 gap-2 sm:flex sm:flex-wrap", className)}
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
            id={`notification-tab-${tab.id}`}
            aria-selected={isActive}
            aria-controls={isActive ? NOTIFICATION_PANEL_ID : undefined}
            onClick={() => onTabChange(tab.id)}
            className={cn(choiceVariants({ on: isActive }), "justify-center px-2 sm:px-4")}
          >
            {tab.label}
            {count !== undefined && count > 0 && (
              <span className="text-muted-foreground tabular-nums">
                {" "}
                {count > 99 ? "99+" : count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
