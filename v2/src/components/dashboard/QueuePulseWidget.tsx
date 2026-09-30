"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { ArrowRightIcon } from "@phosphor-icons/react";

import { api } from "../../../convex/_generated/api";
import { analystReviewQueue } from "../../../convex/lib/dolProcessingTimes";
import { QueueTape } from "@/components/tools/QueueTape";
import { formatAsOf, formatMonth } from "@/lib/dolFormat";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * The first thing a signed-in user sees: where DOL's queue stands today.
 *
 * The dashboard used to open with the user's own tiles, which answer "what do
 * I owe" but never "did the world move". This strip answers the question that
 * brings people back — has DOL advanced — from the same snapshot the public
 * data pages read, so the app and the site can never disagree.
 *
 * While the snapshot loads it holds its own frame (QueuePulseSkeleton): it
 * used to render nothing and then arrive about 200px tall, pushing the whole
 * dashboard below it down. It still renders nothing if there is no frontier.
 */
export function QueuePulseWidget() {
  const snapshot = useQuery(api.dolProcessingTimes.getLatest);
  if (snapshot === undefined) return <QueuePulseSkeleton />;
  const analyst = snapshot ? analystReviewQueue(snapshot.permQueues) : undefined;
  const frontier = analyst?.priorityDate;
  if (!frontier) return null;

  return (
    <section
      aria-label="Live DOL queue position"
      className="border-2 border-border bg-card p-4 shadow-hard sm:p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
        <p className="text-sm leading-relaxed">
          <span className="font-mono text-sm font-bold uppercase tracking-wider text-muted-foreground">
            DOL queue
            {snapshot?.permAsOf ? ` · ${formatAsOf(snapshot.permAsOf)}` : null}
          </span>{" "}
          <span className="mt-1 block font-heading text-lg font-black">
            Deciding cases filed {formatMonth(frontier)}
          </span>
        </p>{" "}
        <Link
          href="/tools/perm-timeline-calculator"
          className="inline-flex min-h-[44px] items-center gap-2 border-2 border-border bg-background px-4 py-2 text-sm font-bold shadow-hard-sm transition-all duration-150 hover:-translate-y-[1px] hover:shadow-hard active:translate-y-0 active:shadow-hard-sm"
        >
          Estimate a decision
          <ArrowRightIcon className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>
      <QueueTape frontierMonth={frontier} monthsBehind={5} monthsAhead={7} className="mt-4" />
    </section>
  );
}

/** The strip's frame while the snapshot loads: two text lines, the button and
 *  the tape (its 28px label row plus the 12-month grid and its legend). */
export function QueuePulseSkeleton() {
  return (
    <section
      aria-label="Live DOL queue position"
      aria-busy={true}
      className="border-2 border-border bg-card p-4 shadow-hard sm:p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
        <div>
          <Skeleton variant="line" className="h-5 w-40" />
          <Skeleton variant="line" className="mt-1 h-7 w-64" />
        </div>
        <Skeleton variant="block" className="h-11 w-48" />
      </div>
      <div className="mt-4 pt-7">
        <Skeleton variant="block" className="h-[68px]" />
        <Skeleton variant="line" className="mt-3 h-5 w-72" />
      </div>
    </section>
  );
}
