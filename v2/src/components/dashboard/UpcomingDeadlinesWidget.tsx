"use client";

// `convex/react` is a CLIENT-ONLY module: its hooks reach `React.createContext`,
// which exists only in React's client build. Declared here (2026-09-01) rather
// than inherited from whichever importer happened to cross a boundary first.
// Without it this module works until the chunk graph shifts, then fails with
// `TypeError: (0 , d.createContext) is not a function` naming webpack bootstrap
// and no source file. See components/layout/Footer.tsx for the incident.

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
import { CalendarIcon } from "@phosphor-icons/react/ssr";
import { useNavigationLoading } from "@/hooks/useNavigationLoading";

import { api } from "../../../convex/_generated/api";
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

/**
 * The widget as it looks loading: its real header (the title and icon never
 * change) over the real body padding, so only the rows change when the data
 * lands. The dashboard's loading.tsx renders this same component.
 */
export function UpcomingDeadlinesLoadingSkeleton(): ReactNode {
  return (
    <div className={WIDGET_CONTAINER_CLASSES} aria-busy={true}>
      <WidgetHeader
        icon={CalendarIcon}
        title="Next 30 days"
        action={<Skeleton variant="line" className="h-6 w-24" />}
      />
      <div className="p-5">
        <ul className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <li key={i} className="border-2 border-border p-3">
              <Skeleton variant="line" className="mb-2 h-5 w-2/3" />
              <Skeleton variant="line" className="h-4 w-1/2" />
            </li>
          ))}
        </ul>
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
        icon={CalendarIcon}
        title="Next 30 days"
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
          icon={CalendarIcon}
          message="No deadlines in next 30 days"
          description="Nothing due in the next 30 days"
        />
      )}
    </div>
  );
}
