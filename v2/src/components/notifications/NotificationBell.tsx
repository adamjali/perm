"use client";

/**
 * NotificationBell Component
 * Header icon button with real-time unread count badge.
 *
 * Features:
 * - Real-time badge via Convex subscription (getUnreadCount)
 * - Radix UI Dropdown for accessible, positioned dropdown
 * - Neobrutalist styling matching header icons (ThemeToggle pattern)
 * - Badge hidden when count === 0
 * - Badge shows "99+" when count > 99
 * - Scale transition on badge appearance
 * - Bell icon with hover/active states
 *
 * Phase: 24 (Notifications)
 * Created: 2025-12-30
 */

import { Bell } from "lucide-react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
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
            // Base styles matching ThemeToggle
            "group relative flex h-10 w-10 cursor-pointer items-center justify-center",
            "rounded-none border-2 border-transparent bg-transparent",
            "text-white transition-all duration-200",
            // Hover/active states
            "hover:border-white/20 hover:bg-white/10",
            "active:bg-white/15",
            // Focus states for accessibility
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-black",
            className
          )}
        >
          {/* Bell Icon */}
          <Bell
            className={cn(
              "size-5 transition-transform duration-300 ease-out",
              // Hover animation matching ThemeToggle
              "group-hover:rotate-[15deg] group-hover:scale-110",
              "group-active:rotate-0 group-active:scale-95"
            )}
          />

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
                "bg-[#DC2626] text-white",
                // Typography
                "text-[10px] font-bold font-heading leading-none",
                // Border for contrast
                "border-2 border-black",
                // Animation: scale in
                "animate-in zoom-in-50 duration-200"
              )}
              aria-hidden="true"
            >
              {displayCount}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>

      {/* Dropdown Content - styled for neobrutalism */}
      <DropdownMenuContent
        align="end"
        sideOffset={8}
        onCloseAutoFocus={(e) => e.preventDefault()}
        className={cn(
          // Remove default shadcn rounded corners
          "rounded-none",
          // Neobrutalist styling - use design token for proper dark mode
          "border-2 border-black dark:border-white/50 bg-popover",
          "shadow-hard",
          // Size - let inner content handle overflow (no max-h here to avoid double scroll)
          // Override default padding
          "p-0",
          // GPU acceleration for snappy animations
          "will-change-transform"
        )}
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
