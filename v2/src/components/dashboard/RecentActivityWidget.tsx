"use client";

/**
 * The cases changed most recently, newest first (RECENT_ACTIVITY_SHOWN of them).
 */

import { type ReactNode } from "react";
import { useQuery } from "convex/react";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@convex/_generated/api";
import { RECENT_ACTIVITY_SHOWN } from "@convex/lib/dashboardTypes";
import RecentActivityCard from "./RecentActivityCard";
import { WIDGET_CONTAINER_CLASSES, WidgetEmptyState, WidgetHeader, WidgetLink } from "./widget-primitives";


/** Loading: the real heading over rows of the real height. */
export function RecentActivityLoadingSkeleton(): ReactNode {
  return (
    <section className={WIDGET_CONTAINER_CLASSES} aria-label="Recent changes" aria-busy={true}>
      <WidgetHeader title="Recent changes" />
      <div className="divide-y divide-border px-5">
        {Array.from({ length: RECENT_ACTIVITY_SHOWN }, (_, i) => (
          <div key={i} className="flex min-h-14 flex-col justify-center gap-1.5 py-3">
            <Skeleton variant="line" className="h-4 w-1/2" />
            <Skeleton variant="line" className="h-4 w-3/4" />
          </div>
        ))}
      </div>
    </section>
  );
}

export default function RecentActivityWidget(): ReactNode {
  const activities = useQuery(api.dashboard.getRecentActivity);
  if (!Array.isArray(activities)) return <RecentActivityLoadingSkeleton />;

  return (
    <section
      id="recent-activity"
      data-tour="recent-activity"
      aria-labelledby="recent-activity-title"
      className={WIDGET_CONTAINER_CLASSES}
    >
      <WidgetHeader
        id="recent-activity-title"
        title="Recent changes"
        action={activities.length > 0 ? <WidgetLink href="/cases?sort=updated">All cases</WidgetLink> : undefined}
      />
      {activities.length === 0 ? (
        <WidgetEmptyState message="No changes yet" description="Changes to your cases show here, newest first." />
      ) : (
        <div className="divide-y divide-border px-5">
          {activities.map((activity) => (
            <RecentActivityCard key={activity.id} activity={activity} />
          ))}
        </div>
      )}
    </section>
  );
}
