"use client";

import Link from "next/link";
import { useQuery } from "convex/react";

import { api } from "@convex/_generated/api";
import { analystReviewQueue } from "@convex/lib/dolProcessingTimes";
import { formatAsOf, formatMonth } from "@/lib/dolFormat";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Where DOL's queue stands, as one line: the month it's deciding, on DOL's
 * own date, from the same snapshot the public pages read, so the app and the
 * site never disagree. Nothing when there's no frontier.
 */
export function QueuePulseWidget() {
  const snapshot = useQuery(api.dolProcessingTimes.getLatest);
  if (snapshot === undefined) return <QueuePulseSkeleton />;
  const frontier = snapshot ? analystReviewQueue(snapshot.permQueues)?.priorityDate : undefined;
  if (!frontier) return null;

  return (
    <p aria-label="DOL's queue" className="flex min-h-11 flex-wrap items-center gap-x-3 gap-y-1 text-base">
      <span>
        DOL is deciding PERM cases filed in <strong>{formatMonth(frontier)}</strong>
        {snapshot?.permAsOf ? <span className="text-muted-foreground"> (as of {formatAsOf(snapshot.permAsOf)})</span> : null}.
      </span>{" "}
      <Link href="/tools/perm-timeline-calculator" className="link">
        Estimate a decision
      </Link>
    </p>
  );
}

/** The line's own height while the snapshot loads. */
export function QueuePulseSkeleton() {
  return (
    <div aria-busy={true} aria-label="DOL's queue" className="flex min-h-11 items-center">
      <Skeleton variant="line" className="h-5 w-full max-w-md" />
    </div>
  );
}
