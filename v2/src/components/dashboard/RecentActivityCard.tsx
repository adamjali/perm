"use client";

import { safeFormatDistanceToNow } from "@/lib/utils/date";
import { STAGE_VISUALS } from "@/components/status/stage-visuals";
import type { RecentActivityItem } from "@convex/lib/dashboardTypes";
import { WidgetRow } from "./widget-primitives";

/** One recent change: the case, what changed and its stage, and when. */
export default function RecentActivityCard({ activity }: { activity: RecentActivityItem }) {
  const stage = STAGE_VISUALS[activity.caseStatus]?.label;
  return (
    <WidgetRow
      href={`/cases/${activity.id}`}
      title={activity.employerName}
      detail={[activity.action, activity.positionTitle, stage].filter(Boolean).join(" · ")}
      asideDetail={
        <time dateTime={new Date(activity.timestamp).toISOString()} data-testid="activity-timestamp">
          {safeFormatDistanceToNow(activity.timestamp)}
        </time>
      }
    />
  );
}
