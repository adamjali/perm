"use client";

/**
 * RecentActivityWidget Component
 *
 * Dashboard widget displaying up to 4 most recent case activities.
 *
 * @see v2/docs/DESIGN_SYSTEM.md
 */

import { type ReactNode } from "react";
import Link from "next/link";
import { useQuery } from "convex/react";
import { History } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "../../../convex/_generated/api";
import RecentActivityCard from "./RecentActivityCard";
import { useNavigationLoading } from "@/hooks/useNavigationLoading";
import {
  WidgetHeader,
  WidgetHeaderAction,
  WidgetEmptyState,
  WIDGET_CONTAINER_CLASSES,
} from "./widget-primitives";

const MAX_DISPLAY_ITEMS = 4;

// ============================================================================
// Sub-components
// ============================================================================

function RecentActivityLoadingSkeleton(): ReactNode {
  return (
    <section
      className={cn(WIDGET_CONTAINER_CLASSES, "p-7")}
      aria-label="Recent Activity"
      aria-busy={true}
    >
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <History className="w-7 h-7 text-foreground" aria-hidden="true" />
          <h2 className="text-3xl font-heading font-bold text-foreground">
            Recent Activity
          </h2>
        </div>
      </div>
      <div className="space-y-4" role="status" aria-label="Loading recent activity">
        {Array.from({ length: MAX_DISPLAY_ITEMS }, (_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton variant="line" className="w-3/4" />
            <Skeleton variant="line" className="w-1/2" />
            <Skeleton variant="line" className="w-full" />
            {i < MAX_DISPLAY_ITEMS - 1 && <div className="border-t border-border mt-4" />}
          </div>
        ))}
      </div>
    </section>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export default function RecentActivityWidget(): ReactNode {
  const activities = useQuery(api.dashboard.getRecentActivity);
  const { isNavigating, navigateTo } = useNavigationLoading();

  const isLoading = activities === undefined || activities === null;
  const isEmpty = Array.isArray(activities) && activities.length === 0;
  const totalCount = Array.isArray(activities) ? activities.length : 0;
  const displayedActivities = Array.isArray(activities)
    ? activities.slice(0, MAX_DISPLAY_ITEMS)
    : [];
  const overflowCount = totalCount - MAX_DISPLAY_ITEMS;

  if (isLoading) {
    return <RecentActivityLoadingSkeleton />;
  }

  return (
    <section
      className={cn(WIDGET_CONTAINER_CLASSES, "p-7")}
      aria-label="Recent Activity"
    >
      <WidgetHeader
        icon={History}
        title="Recent Activity"
        hasBorder={false}
        action={
          !isEmpty && (
            <WidgetHeaderAction
              href="/cases?sort=updated"
              label="View all →"
              ariaLabel="View all recent activity"
              isNavigating={isNavigating}
              onClick={() => navigateTo("/cases?sort=updated")}
            />
          )
        }
      />

      {isEmpty ? (
        <WidgetEmptyState
          icon={History}
          message="No recent activity"
          description="Get started by creating your first case"
          cta={{ href: "/cases/new", label: "Create your first case" }}
        />
      ) : (
        <div className="space-y-2 mt-6">
          {displayedActivities.map((activity) => (
            <RecentActivityCard key={activity.id} activity={activity} />
          ))}
          {overflowCount > 0 && (
            <Link
              href="/cases?sort=updated"
              className="block text-center py-2 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"
            >
              +{overflowCount} more
            </Link>
          )}
        </div>
      )}
    </section>
  );
}
