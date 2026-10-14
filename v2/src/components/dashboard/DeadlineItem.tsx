"use client";

import type { DeadlineItem as DeadlineItemType } from "@convex/lib/dashboardTypes";
import { countdownWords, formatDeadlineDate } from "@/components/cases/case-card.utils";
import { WidgetRow } from "./widget-primitives";

/**
 * One deadline: the employer, what's due and the role, then how long until
 * it and the date. The whole row opens the case.
 */
export default function DeadlineItem({ deadline }: { deadline: DeadlineItemType }) {
  const overdue = deadline.urgency === "overdue";
  const role = deadline.positionTitle || deadline.beneficiaryName;
  return (
    <WidgetRow
      href={`/cases/${deadline.caseId}`}
      title={deadline.employerName}
      detail={role ? `${deadline.label} · ${role}` : deadline.label}
      aside={countdownWords(deadline.daysUntil)}
      asideClassName={overdue ? "text-destructive" : undefined}
      asideDetail={formatDeadlineDate(deadline.dueDate)}
      testId="deadline-item"
    />
  );
}
