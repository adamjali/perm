"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { ArrowRight } from "@phosphor-icons/react";

import { api } from "../../../convex/_generated/api";
import { analystReviewQueue } from "../../../convex/lib/dolProcessingTimes";
import { QueueTape } from "@/components/tools/QueueTape";
import { formatAsOf, formatMonth } from "@/lib/dolFormat";

/**
 * The first thing a signed-in user sees: where DOL's queue stands today.
 *
 * The dashboard used to open with the user's own tiles, which answer "what do
 * I owe" but never "did the world move". This strip answers the question that
 * brings people back — has DOL advanced — from the same snapshot the public
 * data pages read, so the app and the site can never disagree.
 *
 * Renders nothing while the snapshot loads or if the query fails; the
 * dashboard's own content never waits on it.
 */
export function QueuePulseWidget() {
  const snapshot = useQuery(api.dolProcessingTimes.getLatest);
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
          <span className="font-mono text-xs font-bold uppercase tracking-wider text-muted-foreground">
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
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>
      <QueueTape frontierMonth={frontier} monthsBehind={5} monthsAhead={7} className="mt-4" />
    </section>
  );
}
