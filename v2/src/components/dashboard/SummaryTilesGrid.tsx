"use client";

import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import SummaryTile, { type CornerVariant } from "./SummaryTile";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { useAuthContext } from "@/lib/contexts/AuthContext";
import { NavigableCard } from "@/components/ui/navigable-card";

interface SummaryTilesGridProps {
  /** Corner decoration variant for all tiles: "none" (default), "solid", "bar", or "tag" */
  cornerVariant?: CornerVariant;
}

function SummaryTilesGridContent({
  cornerVariant = "none",
}: SummaryTilesGridProps) {
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
  if (data === undefined) {
    return (
      <div>
        {/* Header skeleton */}
        <div className="flex items-center justify-between mb-6">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-12 w-28" />
        </div>

        {/* Grid skeleton */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-36" />
          ))}
        </div>
      </div>
    );
  }

  // Calculate total from all status counts
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
        <h2 className="font-heading text-2xl font-bold">Case Summary</h2>

        {/* Clickable total badge - neobrutalist style */}
        <NavigableCard
          href="/cases"
          loadingIndicator="spinner"
          className="group relative bg-primary text-primary-foreground border-2 border-black dark:border-white/20
                     shadow-hard-sm hover:shadow-hard hover:-translate-x-0.5 hover:-translate-y-0.5
                     active:translate-x-0 active:translate-y-0 active:shadow-none
                     transition-all duration-150 px-4 py-2 overflow-hidden"
        >
          <div className="flex items-center gap-2">
            <span className="mono text-2xl font-bold">{total}</span>
            <span className="text-xs font-semibold uppercase tracking-wide opacity-90">
              Total
            </span>
          </div>
          {/* Hover shine effect */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent
                          translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-500" />
        </NavigableCard>
      </div>

      {/* Tiles grid - 2 cols mobile, 3 cols tablet+ for wider rectangular tiles */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <SummaryTile
          status="pwd"
          label="PWD"
          count={data.pwd.count}
          subtext={data.pwd.subtext}
          href="/cases?status=pwd"
          cornerVariant={cornerVariant || "tag"}
          progress={data.pwd.progress}
        />
        <SummaryTile
          status="recruitment"
          label="Recruitment"
          count={data.recruitment.count}
          subtext={data.recruitment.subtext}
          href="/cases?status=recruitment"
          cornerVariant={cornerVariant || "tag"}
          progress={data.recruitment.progress}
        />
        <SummaryTile
          status="eta9089"
          label="ETA 9089"
          count={data.eta9089.count}
          subtext={data.eta9089.subtext}
          href="/cases?status=eta9089"
          cornerVariant={cornerVariant || "tag"}
          progress={data.eta9089.progress}
        />
        <SummaryTile
          status="i140"
          label="I-140"
          count={data.i140.count}
          subtext={data.i140.subtext}
          href="/cases?status=i140"
          cornerVariant={cornerVariant || "tag"}
          progress={data.i140.progress}
        />
        <SummaryTile
          status="complete"
          label="Complete"
          count={data.complete.count}
          subtext={data.complete.subtext}
          href="/cases?status=i140&progress=approved"
          cornerVariant={cornerVariant || "tag"}
          progress={data.complete.progress}
        />
        <SummaryTile
          status="closed"
          label="Closed"
          count={data.closed.count}
          subtext={data.closed.subtext}
          href="/cases?status=closed"
          cornerVariant={cornerVariant || "tag"}
          progress={data.closed.progress}
        />
        {/* Only show duplicates tile if there are any */}
        {data.duplicates.count > 0 && (
          <SummaryTile
            status="duplicates"
            label="Duplicates"
            count={data.duplicates.count}
            subtext={data.duplicates.subtext}
            href="/cases?duplicates=true"
            cornerVariant={cornerVariant || "tag"}
          />
        )}
      </div>
    </div>
  );
}

/**
 * SummaryTilesGrid wrapped with ErrorBoundary to gracefully handle query errors.
 */
export default function SummaryTilesGrid(props: SummaryTilesGridProps) {
  return (
    <ErrorBoundary>
      <SummaryTilesGridContent {...props} />
    </ErrorBoundary>
  );
}
