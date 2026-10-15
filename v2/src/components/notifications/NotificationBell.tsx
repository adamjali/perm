"use client";

/**
 * NotificationBell Component
 * Header icon button with real-time unread count badge.
 *
 * Features:
 * - Real-time badge via Convex subscription (getUnreadCount)
 * - Radix UI Dropdown for accessible, positioned dropdown
 * - A quiet icon button in the header's own colours
 * - Badge hidden when count === 0
 * - Badge shows "99+" when count > 99
 * - Scale transition on badge appearance
 * - Bell icon with hover/active states
 */

import { BellIcon } from "@phosphor-icons/react";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { useAuthContext } from "@/lib/contexts/AuthContext";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface NotificationBellProps {
  /** Optional className for the trigger button */
  className?: string;
  /** Content to render in the dropdown (passed as children) */
  children?: React.ReactNode;
}

export default function NotificationBell({ className, children }: NotificationBellProps) {
  const { isSigningOut } = useAuthContext();

  // Real-time subscription to unread count
  // Returns 0 during sign-out for graceful degradation
  const unreadCount = useQuery(
    api.notifications.getUnreadCount,
    isSigningOut ? "skip" : undefined
  );

  // Format count for display (99+ if over 99)
  const displayCount = unreadCount !== undefined
    ? unreadCount > 99
      ? "99+"
      : String(unreadCount)
    : null;

  // Whether to show the badge
  const showBadge = unreadCount !== undefined && unreadCount > 0;

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`Notifications${showBadge ? ` (${unreadCount} unread)` : ""}`}
          className={cn(
            "relative flex size-11 cursor-pointer items-center justify-center text-soft transition-colors",
            "hover:bg-accent hover:text-foreground",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            className
          )}
        >
          <BellIcon className="size-5" aria-hidden="true" />

          {/* Unread Count Badge */}
          {showBadge && (
            <span
              className={cn(
                // Positioning: top-right corner
                "absolute -right-0.5 -top-0.5",
                // Size and shape: circular
                "flex items-center justify-center",
                "min-w-[18px] h-[18px] px-1",
                "rounded-full",
                // Colors: red badge with white text
                "bg-urgency-urgent text-white",
                // Typography
                "text-sm font-bold font-heading leading-none",
                // A ring in the bar's own colour carves the badge off the icon
                "border border-background"
              )}
              aria-hidden="true"
            >
              {displayCount}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        sideOffset={8}
        onCloseAutoFocus={(e) => e.preventDefault()}
        className="border border-border bg-popover p-0 shadow-overlay"
      >
        {children || (
          <div className="p-4 text-center text-sm text-muted-foreground">
            No notifications
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
