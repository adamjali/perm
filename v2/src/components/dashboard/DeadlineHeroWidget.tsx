/**
 * DeadlineHeroWidget Component
 *
 * Horizontal 4-column grid layout for deadline display grouped by urgency.
 * Columns: Overdue, This Week, This Month, Later.
 *
 * @see v2/docs/DESIGN_SYSTEM.md
 * @see perm_flow.md (Deadlines/Windows section)
 */

"use client";

import { type ReactNode } from "react";
import { useQuery } from "convex/react";
import { useState, useEffect, useCallback } from "react";
import { usePathname } from "next/navigation";
import { RefreshCw, AlertTriangle } from "lucide-react";

import { api } from "../../../convex/_generated/api";
import { useAuthContext } from "@/lib/contexts/AuthContext";
import { formatRelativeTime } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import UrgencyGroup from "./UrgencyGroup";

// Container styles shared across all states
const CONTAINER_CLASSES =
  "overflow-hidden rounded-none border-[3px] border-black dark:border-white/20 shadow-hard";

// ============================================================================
// Sub-components
// ============================================================================

function DeadlineHeroLoadingSkeleton(): ReactNode {
  return (
    <div className={CONTAINER_CLASSES}>
      <div className="hazard-strip-red" aria-hidden="true" />
      <div className="space-y-4 bg-card p-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-9 w-24" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className={`p-4 min-h-[120px] ${i < 3 ? "md:border-r-2 border-black dark:border-white/20" : ""}`}
            >
              <Skeleton className="h-6 w-24 mb-3" />
              <Skeleton className="h-16 mb-2" />
              <Skeleton className="h-16" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

interface DeadlineHeroHeaderProps {
  totalCount: number;
  hasOverdue: boolean;
  lastRefresh: number;
  isRefreshing: boolean;
  onRefresh: () => void;
}

function DeadlineHeroHeader({
  totalCount,
  hasOverdue,
  lastRefresh,
  isRefreshing,
  onRefresh,
}: DeadlineHeroHeaderProps): ReactNode {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 border-b-2 border-black dark:border-white/20">
      <div className="flex items-center gap-2">
        <AlertTriangle
          className={`size-6 ${hasOverdue ? "text-destructive" : "text-muted-foreground"}`}
        />
        <h2 className="text-2xl font-bold font-heading">Deadline Hub</h2>
        <Badge variant={hasOverdue ? "destructive" : "secondary"}>
          {totalCount}
        </Badge>
      </div>
      <div className="flex items-center gap-4">
        <span className="text-sm text-muted-foreground">
          Updated {formatRelativeTime(lastRefresh)}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={onRefresh}
          loading={isRefreshing}
          aria-label="Refresh deadlines"
        >
          <RefreshCw className={isRefreshing ? "animate-spin" : ""} />
          Refresh
        </Button>
      </div>
    </div>
  );
}

interface DeadlineHeroEmptyStateProps {
  lastRefresh: number;
  isRefreshing: boolean;
  onRefresh: () => void;
}

function DeadlineHeroEmptyState({
  lastRefresh,
  isRefreshing,
  onRefresh,
}: DeadlineHeroEmptyStateProps): ReactNode {
  return (
    <div className={CONTAINER_CLASSES}>
      <div className="hazard-strip-red" aria-hidden="true" />
      <div className="space-y-4 bg-card p-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <AlertTriangle className="size-7 text-muted-foreground" />
            <h2 className="text-3xl font-bold font-heading">Deadline Hub</h2>
            <Badge variant="secondary" className="text-sm px-3 py-1">
              0
            </Badge>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-base text-muted-foreground">
              Updated {formatRelativeTime(lastRefresh)}
            </span>
            <Button
              variant="outline"
              size="default"
              onClick={onRefresh}
              loading={isRefreshing}
              aria-label="Refresh deadlines"
            >
              <RefreshCw className={isRefreshing ? "animate-spin" : ""} />
              Refresh
            </Button>
          </div>
        </div>
        <div className="flex flex-col items-center justify-center rounded-none border-2 border-border bg-background p-12 text-center">
          <p className="mb-4 text-lg text-muted-foreground">
            No upcoming deadlines
          </p>
          <p className="text-sm text-muted-foreground">
            Create a case to start tracking deadlines
          </p>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export default function DeadlineHeroWidget(): ReactNode {
  const { isSigningOut } = useAuthContext();
  const pathname = usePathname();

  const data = useQuery(
    api.dashboard.getDeadlines,
    isSigningOut ? "skip" : undefined
  );

  const [lastRefresh, setLastRefresh] = useState<number>(() => Date.now());
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Track which case is currently being navigated to (for loading state coordination)
  const [loadingCaseId, setLoadingCaseId] = useState<string | null>(null);

  // Reset loading state when navigation completes (pathname changes)
  useEffect(() => {
    setLoadingCaseId(null);
  }, [pathname]);

  const handleCaseClick = useCallback((caseId: string) => {
    setLoadingCaseId(caseId);
  }, []);

  // Auto-refresh every 5 minutes
  useEffect(() => {
    const interval = setInterval(() => {
      setLastRefresh(Date.now());
    }, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  function handleRefresh(): void {
    setIsRefreshing(true);
    setLastRefresh(Date.now());
    setTimeout(() => setIsRefreshing(false), 500);
  }

  if (data === undefined) {
    return <DeadlineHeroLoadingSkeleton />;
  }

  const totalCount =
    data.overdue.length +
    data.thisWeek.length +
    data.thisMonth.length +
    data.later.length;

  if (totalCount === 0) {
    return (
      <DeadlineHeroEmptyState
        lastRefresh={lastRefresh}
        isRefreshing={isRefreshing}
        onRefresh={handleRefresh}
      />
    );
  }

  const hasOverdue = data.overdue.length > 0;

  return (
    <div className="overflow-hidden rounded-none border-3 border-black dark:border-white/20 shadow-hard">
      <div className="hazard-strip-red" aria-hidden="true" />
      <div className="bg-card">
        <DeadlineHeroHeader
          totalCount={totalCount}
          hasOverdue={hasOverdue}
          lastRefresh={lastRefresh}
          isRefreshing={isRefreshing}
          onRefresh={handleRefresh}
        />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
          <UrgencyGroup title="Overdue" urgency="overdue" items={data.overdue} loadingCaseId={loadingCaseId} onCaseClick={handleCaseClick} />
          <UrgencyGroup title="This Week" urgency="thisWeek" items={data.thisWeek} loadingCaseId={loadingCaseId} onCaseClick={handleCaseClick} />
          <UrgencyGroup title="This Month" urgency="thisMonth" items={data.thisMonth} loadingCaseId={loadingCaseId} onCaseClick={handleCaseClick} />
          <UrgencyGroup title="Later" urgency="later" items={data.later} isLast loadingCaseId={loadingCaseId} onCaseClick={handleCaseClick} />
        </div>
      </div>
    </div>
  );
}
