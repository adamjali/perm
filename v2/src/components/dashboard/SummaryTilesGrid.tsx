"use client";

import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { useAuthContext } from "@/lib/contexts/AuthContext";
import { NavigableCard } from "@/components/ui/navigable-card";
import { PermPath, StatBlock } from "@/components/visuals/PermPath";
import { STAGE_VISUALS } from "@/components/status/stage-visuals";
import { CheckCircleIcon, CopyIcon } from "@phosphor-icons/react";

/**
 * Loading: the real heading (it never changes) and the stat blocks in the
 * real grid. The second row used to be `md:grid-cols-3 gap-4` against the
 * real `sm:grid-cols-4 sm:gap-6`, so its blocks changed width on arrival.
 * The dashboard's loading.tsx renders this same component.
 */
export function SummaryTilesSkeleton() {
  return (
    <div aria-busy={true}>
      <div className="mb-6 flex items-center justify-between">
        <h2 className="font-heading text-2xl font-bold">Case summary</h2>
        <Skeleton variant="block" className="h-[52px] w-28" />
      </div>
      {/* 155px: the path's and the outcome blocks' real height at desktop
          (measured on production, Sep 30 2026). */}
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} variant="block" className="h-[155px]" />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-6">
        {Array.from({ length: 2 }).map((_, i) => (
          <Skeleton key={i} variant="block" className="h-[155px]" />
        ))}
      </div>
    </div>
  );
}

function SummaryTilesGridContent() {
  // Get signing out state to skip queries during sign out
  const { isSigningOut } = useAuthContext();

  // Skip query when signing out to prevent auth errors
  const data = useQuery(
    api.dashboard.getSummary,
    isSigningOut ? "skip" : undefined
  );

  // Loading state (undefined means still loading)
  // Note: Convex queries return undefined while loading, then the actual data.
  // Query errors are thrown and caught by the ErrorBoundary wrapper.
  if (data === undefined) return <SummaryTilesSkeleton />;

  const total =
    data.pwd.count +
    data.recruitment.count +
    data.eta9089.count +
    data.i140.count +
    data.complete.count +
    data.closed.count;

  return (
    <div data-tour="summary-tiles">
      {/* Section header with total badge */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="font-heading text-2xl font-bold">Case summary</h2>

        {/* Clickable total badge - neobrutalist style */}
        <NavigableCard
          href="/cases"
          loadingIndicator="spinner"
          className="group relative bg-primary text-primary-foreground border-2 border-border shadow-hard-sm hover:shadow-hard hover:-translate-x-0.5 hover:-translate-y-0.5
                     active:translate-x-0 active:translate-y-0 active:shadow-none
                     transition-all duration-150 px-4 py-2 overflow-hidden"
        >
          <div className="flex items-center gap-2">
            <span className="mono text-2xl font-bold">{total}</span>{" "}
            <span className="text-sm font-semibold uppercase tracking-wide opacity-90">
              Total
            </span>
          </div>
        </NavigableCard>
      </div>

      {/* The four working stages as the PERM path, each linking to its cases. */}
      <PermPath
        label="Cases by stage"
        className="mb-4"
        steps={[
          { stage: "pwd", count: data.pwd.count, note: data.pwd.subtext, href: "/cases?status=pwd" },
          { stage: "recruitment", count: data.recruitment.count, note: data.recruitment.subtext, href: "/cases?status=recruitment" },
          { stage: "eta9089", count: data.eta9089.count, note: data.eta9089.subtext, href: "/cases?status=eta9089" },
          { stage: "i140", count: data.i140.count, note: data.i140.subtext, href: "/cases?status=i140" },
        ]}
      />

      {/* Where cases end up, drawn in the same blocks as the path above. */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-6">
        <div data-status="complete">
          <StatBlock
            fill="bg-primary"
            onFill="text-primary-foreground"
            icon={CheckCircleIcon}
            label="Complete"
            count={data.complete.count}
            note={data.complete.subtext}
            href="/cases?status=i140&progress=approved"
          />
        </div>
        <div data-status="closed">
          <StatBlock
            fill={STAGE_VISUALS.closed.fill}
            onFill={STAGE_VISUALS.closed.onFill}
            icon={STAGE_VISUALS.closed.icon}
            label="Closed"
            count={data.closed.count}
            note={data.closed.subtext}
            href="/cases?status=closed"
          />
        </div>
        {/* Only while there are any */}
        {data.duplicates.count > 0 && (
          <div data-status="duplicates">
            <StatBlock
              fill="bg-data-warn"
              onFill="text-black"
              icon={CopyIcon}
              label="Duplicates"
              count={data.duplicates.count}
              note={data.duplicates.subtext}
              href="/cases?duplicates=true"
            />
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * SummaryTilesGrid wrapped with ErrorBoundary to gracefully handle query errors.
 */
export default function SummaryTilesGrid() {
  return (
    <ErrorBoundary>
      <SummaryTilesGridContent />
    </ErrorBoundary>
  );
}
