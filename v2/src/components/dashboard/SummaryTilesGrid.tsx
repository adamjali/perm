"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { useAuthContext } from "@/lib/contexts/AuthContext";
import { STAGE_VISUALS } from "@/components/status/stage-visuals";
import { cn } from "@/lib/utils";
import { WIDGET_CONTAINER_CLASSES, WidgetHeader, WidgetLink } from "./widget-primitives";

/**
 * The account's cases by stage, as one row of counts. Each count links to
 * those cases; the stage's colour is a dot beside its name.
 */

interface Cell {
  key: string;
  label: string;
  dot: string;
  count: number;
  note?: string;
  href: string;
}

function CountRow({ cells }: { cells: readonly Cell[] }) {
  return (
    <ul className="-mb-px -mr-px grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
      {cells.map((c) => (
        <li key={c.key} data-status={c.key} className="border-b border-r border-border">
          <Link
            href={c.href}
            className="group flex h-full min-h-24 flex-col p-4 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
          >
            <span className="flex items-center gap-2 text-sm font-semibold">
              <span aria-hidden="true" className={cn("size-2 shrink-0", c.dot)} />
              {c.label}
            </span>{" "}
            <span className="mt-1 font-heading text-2xl font-bold tabular-nums group-hover:text-primary-text">{c.count}</span>{" "}
            {c.note ? <span className="mt-0.5 text-sm text-muted-foreground">{c.note}</span> : null}
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** Loading: the real heading over six cells of the real height. */
export function SummaryTilesSkeleton() {
  return (
    <section className={cn(WIDGET_CONTAINER_CLASSES, "overflow-hidden")} aria-busy={true} aria-label="Cases by stage">
      <WidgetHeader title="Cases" />
      <div className="-mb-px -mr-px grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="min-h-24 border-b border-r border-border p-4">
            <Skeleton variant="line" className="h-5 w-20" />
            <Skeleton variant="line" className="mt-2 h-7 w-10" />
          </div>
        ))}
      </div>
    </section>
  );
}

function SummaryTilesGridContent() {
  const { isSigningOut } = useAuthContext();
  const data = useQuery(api.dashboard.getSummary, isSigningOut ? "skip" : undefined);
  if (data === undefined) return <SummaryTilesSkeleton />;

  const total =
    data.pwd.count + data.recruitment.count + data.eta9089.count + data.i140.count + data.complete.count + data.closed.count;

  const stage = (key: "pwd" | "recruitment" | "eta9089" | "i140"): Cell => ({
    key,
    label: STAGE_VISUALS[key].label,
    dot: STAGE_VISUALS[key].fill,
    count: data[key].count,
    note: data[key].subtext || undefined,
    href: `/cases?status=${key}`,
  });
  const cells: Cell[] = [
    stage("pwd"),
    stage("recruitment"),
    stage("eta9089"),
    stage("i140"),
    {
      key: "complete",
      label: "Complete",
      dot: "bg-data-good",
      count: data.complete.count,
      note: data.complete.subtext || undefined,
      href: "/cases?status=i140&progress=approved",
    },
    {
      key: "closed",
      label: STAGE_VISUALS.closed.label,
      dot: STAGE_VISUALS.closed.fill,
      count: data.closed.count,
      note: data.closed.subtext || undefined,
      href: "/cases?status=closed",
    },
    ...(data.duplicates.count > 0
      ? [
          {
            key: "duplicates",
            label: "Duplicates",
            dot: "bg-data-warn",
            count: data.duplicates.count,
            note: data.duplicates.subtext || undefined,
            href: "/cases?duplicates=true",
          },
        ]
      : []),
  ];

  return (
    <section data-tour="summary-tiles" aria-labelledby="cases-title" className={cn(WIDGET_CONTAINER_CLASSES, "overflow-hidden")}>
      <WidgetHeader id="cases-title" title="Cases" count={total} action={<WidgetLink href="/cases">All cases</WidgetLink>} />
      <CountRow cells={cells} />
    </section>
  );
}

/** Wrapped so a failed query shows the error state instead of the page. */
export default function SummaryTilesGrid() {
  return (
    <ErrorBoundary>
      <SummaryTilesGridContent />
    </ErrorBoundary>
  );
}
