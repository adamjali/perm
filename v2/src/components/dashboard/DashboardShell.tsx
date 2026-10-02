"use client";

import AddCaseButton from "@/components/dashboard/AddCaseButton";
import { DeadlineHeroLoadingSkeleton } from "@/components/dashboard/DeadlineHeroWidget";
import { QueuePulseSkeleton } from "@/components/dashboard/QueuePulseWidget";
import { SummaryTilesSkeleton } from "@/components/dashboard/SummaryTilesGrid";
import { UpcomingDeadlinesLoadingSkeleton } from "@/components/dashboard/UpcomingDeadlinesWidget";
import { RecentActivityLoadingSkeleton } from "@/components/dashboard/RecentActivityWidget";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * The dashboard's heading. `firstName` undefined means the user is still
 * loading: only the greeting line waits, as a bar the height of the heading.
 * The eyebrow, the lede and the button never change, so they never wait.
 */
export function DashboardHeading({
  firstName,
  isNewAccount = false,
}: {
  firstName: string | null | undefined;
  isNewAccount?: boolean;
}) {
  const greeting = isNewAccount ? "Welcome" : "Welcome back";
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <p className="font-mono text-sm font-semibold uppercase tracking-[0.1em] text-muted-foreground">
          Dashboard
        </p>{" "}
        {firstName === undefined ? (
          // The heading's own line box: text-3xl (1.875rem) and sm:text-4xl
          // (2.25rem) at leading-[1.08].
          <div className="mt-2 flex h-[2.025rem] items-center sm:h-[2.43rem]">
            <Skeleton variant="line" className="h-7 w-64 sm:h-8" />
          </div>
        ) : (
          <h1 className="mt-2 font-heading text-3xl font-black leading-[1.08] tracking-[-0.03em] sm:text-4xl">
            {firstName ? `${greeting}, ${firstName}` : greeting}
          </h1>
        )}{" "}
        <p className="mt-3 max-w-[52ch] text-base leading-relaxed text-foreground/70">
          Every filing window, wage expiration and audit deadline in your
          cases, computed from the dates you have entered.
        </p>
      </div>
      <div className="shrink-0">
        <AddCaseButton />
      </div>
    </div>
  );
}

/**
 * The whole dashboard while its data loads, built from each widget's OWN
 * loading component in the page's own layout. dashboard/loading.tsx renders
 * this, and the page renders the same widgets, which show the same skeletons
 * until their data lands. So the route's loading state and the page's first
 * paint are one picture.
 */
export function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <DashboardHeading firstName={undefined} />
      <DeadlineHeroLoadingSkeleton />
      <QueuePulseSkeleton />
      <SummaryTilesSkeleton />
      <div className="grid grid-cols-1 gap-6 [&>*]:min-w-0 md:grid-cols-2">
        <UpcomingDeadlinesLoadingSkeleton />
        <RecentActivityLoadingSkeleton />
      </div>
    </div>
  );
}
