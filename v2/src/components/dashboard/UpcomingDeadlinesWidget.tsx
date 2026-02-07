/**
 * UpcomingDeadlinesWidget Component
 *
 * Displays upcoming deadlines in the next 30 days.
 *
 * @see v2/docs/DESIGN_SYSTEM.md
 */

"use client";

import { type ReactNode } from "react";
import { useQuery } from "convex/react";
import { Calendar } from "lucide-react";
import { useNavigationLoading } from "@/hooks/useNavigationLoading";

import { api } from "../../../convex/_generated/api";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import UpcomingDeadlineItem from "./UpcomingDeadlineItem";
import {
  WidgetHeader,
  WidgetHeaderAction,
  WidgetEmptyState,
  WIDGET_CONTAINER_CLASSES,
} from "./widget-primitives";

// ============================================================================
// Sub-components
// ============================================================================

function UpcomingDeadlinesLoadingSkeleton(): ReactNode {
  return (
    <div className={cn(WIDGET_CONTAINER_CLASSES, "p-6")}>
      <div className="flex items-center justify-between mb-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-6 w-20" />
      </div>
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="p-3 border-2 border-border">
            <Skeleton className="h-4 w-full mb-2" />
            <Skeleton className="h-3 w-3/4" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export default function UpcomingDeadlinesWidget(): ReactNode {
  const { isNavigating, navigateTo } = useNavigationLoading();
  const deadlines = useQuery(api.dashboard.getUpcomingDeadlines, { days: 30 });

  if (deadlines === undefined) {
    return <UpcomingDeadlinesLoadingSkeleton />;
  }

  const count = deadlines.length;
  const hasDeadlines = count > 0;

  function handleNavigate(): void {
    navigateTo("/calendar");
  }

  return (
    <div data-tour="upcoming-deadlines" className={WIDGET_CONTAINER_CLASSES}>
      <WidgetHeader
        icon={Calendar}
        title="Next 30 Days"
        count={hasDeadlines ? count : undefined}
        badgeVariant="default"
        action={
          <WidgetHeaderAction
            href="/calendar"
            label="Calendar →"
            isNavigating={isNavigating}
            onClick={handleNavigate}
          />
        }
      />

      {hasDeadlines ? (
        <div className="max-h-96 overflow-y-auto p-5">
          <ul className="space-y-3">
            {deadlines.map((deadline) => (
              <li key={deadline.caseId}>
                <UpcomingDeadlineItem deadline={deadline} />
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <WidgetEmptyState
          icon={Calendar}
          message="No deadlines in next 30 days"
          description="You're all caught up!"
        />
      )}
    </div>
  );
}
