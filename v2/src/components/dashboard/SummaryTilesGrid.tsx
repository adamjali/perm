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

/**
 * The split at a glance: one slim bar, each stage's share of the cases in its
 * own colour, then each stage's count under a band of the same colour (the
 * deadline hub's language). Duplicates overlap the stages, so they get a
 * count and no share of the bar.
 */
function StageSplit({ cells }: { cells: readonly Cell[] }) {
  const shares = cells.filter((c) => c.key !== "duplicates" && c.count > 0);
  const total = shares.reduce((n, c) => n + c.count, 0);
  if (total === 0) return null;
  return (
    <div className="flex h-3 w-full overflow-hidden" role="img" aria-label={shares.map((c) => `${c.label} ${c.count}`).join(", ")}>
      {shares.map((c) => (
        <span key={c.key} className={cn("h-full", c.dot)} style={{ width: `${(c.count / total) * 100}%` }} title={`${c.label}: ${c.count}`} />
      ))}
    </div>
  );
}

function CountRow({ cells }: { cells: readonly Cell[] }) {
  return (
    <ul className="grid grid-cols-2 gap-2 [&>*]:min-w-0 sm:grid-cols-3 lg:grid-cols-[repeat(auto-fit,minmax(8.5rem,1fr))] max-sm:[&>*:last-child:nth-child(odd)]:col-span-2">
      {cells.map((c) => (
        <li key={c.key} data-status={c.key} className="bg-tint">
          <Link
            href={c.href}
            className="group flex h-full min-h-24 flex-col px-3 pb-3 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
          >
            <span aria-hidden="true" className={cn("-mx-3 mb-2.5 block h-1", c.dot)} />
            <span className="text-sm font-semibold">{c.label}</span>{" "}
            <span className="mt-0.5 font-heading text-3xl font-bold leading-none tabular-nums group-hover:underline">{c.count}</span>{" "}
            {c.note ? <span className="mt-1.5 text-sm leading-snug text-soft">{c.note}</span> : null}
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function SummaryTilesSkeleton() {
  return (
    <section className={cn(WIDGET_CONTAINER_CLASSES, "overflow-hidden")} aria-busy={true} aria-label="Cases by stage">
      <WidgetHeader title="Cases" />
      <div className="space-y-4 p-4">
        <Skeleton variant="line" className="h-3 w-full" />
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="min-h-24 bg-tint px-3 pb-3 pt-4">
              <Skeleton variant="line" className="h-5 w-20" />
              <Skeleton variant="line" className="mt-2 h-8 w-10" />
            </div>
          ))}
        </div>
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
      <div className="space-y-4 p-4">
        <StageSplit cells={cells} />
        <CountRow cells={cells} />
      </div>
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
