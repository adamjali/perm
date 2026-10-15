"use client";

/**
 * The dashboard's deadlines: one sentence naming the next one (or the late
 * ones), then every deadline in four groups by when it falls. Convex keeps
 * the query live, so the list is always current.
 *
 * @see perm_flow.md (Deadlines/Windows section)
 */

import { type ReactNode } from "react";
import { useQuery } from "convex/react";

import { api } from "@convex/_generated/api";
import type { DeadlineGroups, DeadlineItem } from "@convex/lib/dashboardTypes";
import { useAuthContext } from "@/lib/contexts/AuthContext";
import { countdownWords, formatDeadlineDate } from "@/components/cases/case-card.utils";
import { Skeleton } from "@/components/ui/skeleton";
import UrgencyGroup from "./UrgencyGroup";
import { WidgetHeader, WidgetLink } from "./widget-primitives";

const GROUPS = [
  { key: "overdue", title: "Overdue" },
  { key: "thisWeek", title: "This week" },
  { key: "thisMonth", title: "This month" },
  { key: "later", title: "Later" },
] as const;

/**
 * Open cases are every case the deadline list reads: all but closed ones.
 * "complete" (I-140 approved) is still an open case there.
 */
export function openCaseCount(
  summary:
    | Record<"pwd" | "recruitment" | "eta9089" | "i140" | "complete", { count: number }>
    | undefined,
): number | undefined {
  if (summary === undefined) return undefined;
  return (
    summary.pwd.count +
    summary.recruitment.count +
    summary.eta9089.count +
    summary.i140.count +
    summary.complete.count
  );
}

function soonest(items: readonly DeadlineItem[]): DeadlineItem | undefined {
  return items.reduce<DeadlineItem | undefined>((a, b) => (a === undefined || b.daysUntil < a.daysUntil ? b : a), undefined);
}

/** The one sentence the dashboard leads with. */
export function deadlineAnswer(data: Pick<DeadlineGroups, "overdue" | "thisWeek" | "thisMonth" | "later">, openCases: number | undefined): string {
  const late = data.overdue.length;
  const next = soonest([...data.thisWeek, ...data.thisMonth, ...data.later]);
  const nextLine = next
    ? `Next: ${next.label} for ${next.employerName}, ${formatDeadlineDate(next.dueDate)} (${countdownWords(next.daysUntil).toLowerCase()}).`
    : "";
  if (late > 0) {
    const first = soonest(data.overdue)!;
    const lead = `${late} ${late === 1 ? "deadline is" : "deadlines are"} late, the earliest ${first.label} for ${first.employerName}.`;
    return next ? `${lead} ${nextLine}` : lead;
  }
  if (next) return nextLine;
  if (openCases !== undefined && openCases > 0) {
    return `Nothing is due on your ${openCases.toLocaleString("en-US")} open ${openCases === 1 ? "case" : "cases"}. Deadlines appear as you add dates.`;
  }
  return "Add a case and its deadlines appear here, worked out from its dates.";
}

export function DeadlineHeroLoadingSkeleton(): ReactNode {
  return (
    <section className="object" aria-busy={true} aria-label="Deadlines">
      <WidgetHeader title="Deadlines" />
      <div className="p-5">
        <Skeleton variant="line" className="h-7 w-full max-w-xl" />
        <div className="mt-6 grid grid-cols-1 gap-x-8 gap-y-6 md:grid-cols-2 xl:grid-cols-4">
          {GROUPS.map((g) => (
            <div key={g.key}>
              <Skeleton variant="line" className="h-6 w-28" />
              <Skeleton variant="block" className="mt-3 h-14" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default function DeadlineHeroWidget(): ReactNode {
  const { isSigningOut } = useAuthContext();
  const data = useQuery(api.dashboard.getDeadlines, isSigningOut ? "skip" : undefined);
  // The dashboard reads the summary with these arguments too, so this shares
  // its subscription.
  const summary = useQuery(api.dashboard.getSummary, isSigningOut ? "skip" : undefined);

  if (data === undefined) return <DeadlineHeroLoadingSkeleton />;

  const total = data.overdue.length + data.thisWeek.length + data.thisMonth.length + data.later.length;

  return (
    <section
      id="deadlines"
      data-tour="deadline-hero"
      aria-labelledby="deadlines-title"
      className="object"
    >
      <WidgetHeader id="deadlines-title" title="Deadlines" count={total} action={<WidgetLink href="/calendar">Calendar</WidgetLink>} />
      <div className="p-5">
        <p className="text-base font-semibold sm:text-lg">{deadlineAnswer(data, openCaseCount(summary))}</p>
        {total > 0 ? (
          <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            {GROUPS.map((g) => (
              <UrgencyGroup key={g.key} title={g.title} urgency={g.key} items={data[g.key]} />
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}
