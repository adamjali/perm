"use client";

/**
 * Shared primitives for dashboard widgets
 *
 * Provides reusable loading, empty, and header states to maintain consistency
 * across dashboard widgets while reducing duplication.
 */

import { type ReactNode } from "react";
import Link from "next/link";
import { Loader2, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

// Widget container base styles
export const WIDGET_CONTAINER_CLASSES =
  "bg-card border-4 border-black dark:border-white/20 shadow-hard overflow-hidden";

// ============================================================================
// WidgetHeader
// ============================================================================

interface WidgetHeaderProps {
  /** Header icon */
  icon: LucideIcon;
  /** Icon color class override */
  iconClassName?: string;
  /** Title text */
  title: string;
  /** Optional count badge */
  count?: number;
  /** Badge variant */
  badgeVariant?: "default" | "secondary" | "destructive";
  /** Optional action button/link on the right */
  action?: ReactNode;
  /** Whether header has bottom border */
  hasBorder?: boolean;
}

export function WidgetHeader({
  icon: Icon,
  iconClassName,
  title,
  count,
  badgeVariant = "default",
  action,
  hasBorder = true,
}: WidgetHeaderProps): ReactNode {
  return (
    <div
      className={cn(
        "flex items-center justify-between p-5",
        hasBorder && "border-b-2 border-black dark:border-white/20"
      )}
    >
      <div className="flex items-center gap-3">
        <Icon className={cn("size-6", iconClassName ?? "text-foreground")} />
        <h3 className="text-2xl font-bold font-heading">{title}</h3>
        {count !== undefined && count > 0 && (
          <Badge variant={badgeVariant} className="text-sm px-3 py-1">
            {count}
          </Badge>
        )}
      </div>
      {action}
    </div>
  );
}

// ============================================================================
// WidgetHeaderAction - Standard action link with loading state
// ============================================================================

interface WidgetHeaderActionProps {
  /** Link destination */
  href: string;
  /** Button label */
  label: string;
  /** Loading label (shown during navigation) */
  loadingLabel?: string;
  /** Accessible label for screen readers */
  ariaLabel?: string;
  /** Whether currently navigating */
  isNavigating: boolean;
  /** Click handler */
  onClick: () => void;
}

export function WidgetHeaderAction({
  label,
  loadingLabel = "Loading...",
  ariaLabel,
  isNavigating,
  onClick,
}: WidgetHeaderActionProps): ReactNode {
  return (
    <button
      onClick={onClick}
      disabled={isNavigating}
      aria-label={ariaLabel}
      className={cn(
        "text-base font-semibold text-foreground hover:text-primary hover:underline",
        "transition-colors duration-200 flex items-center gap-2",
        isNavigating && "opacity-70 cursor-wait"
      )}
    >
      {isNavigating ? (
        <>
          <Loader2 className="size-4 animate-spin" />
          {loadingLabel}
        </>
      ) : (
        label
      )}
    </button>
  );
}

// ============================================================================
// WidgetLoadingSkeleton - Configurable skeleton for loading states
// ============================================================================

interface WidgetLoadingSkeletonProps {
  /** Number of skeleton items to show */
  itemCount?: number;
  /** Custom render for each item (receives index) */
  renderItem?: (index: number) => ReactNode;
  /** Whether to include header skeleton */
  showHeader?: boolean;
  /** Optional header skeleton */
  headerSkeleton?: ReactNode;
}

export function WidgetLoadingSkeleton({
  itemCount = 3,
  renderItem,
  showHeader = true,
  headerSkeleton,
}: WidgetLoadingSkeletonProps): ReactNode {
  const defaultRenderItem = (index: number) => (
    <div key={index} className="p-3 border-2 border-border">
      <Skeleton className="h-4 w-full mb-2" />
      <Skeleton className="h-3 w-3/4" />
    </div>
  );

  const defaultHeaderSkeleton = (
    <div className="flex items-center justify-between mb-4">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-6 w-20" />
    </div>
  );

  return (
    <div className={cn(WIDGET_CONTAINER_CLASSES, "p-6")}>
      {showHeader && (headerSkeleton ?? defaultHeaderSkeleton)}
      <div className="space-y-2">
        {Array.from({ length: itemCount }).map((_, i) =>
          renderItem ? renderItem(i) : defaultRenderItem(i)
        )}
      </div>
    </div>
  );
}

// ============================================================================
// WidgetEmptyState - Consistent empty state with optional CTA
// ============================================================================

interface WidgetEmptyStateProps {
  /** Icon to display */
  icon: LucideIcon;
  /** Primary message */
  message: string;
  /** Secondary/description text */
  description?: string;
  /** CTA button/link */
  cta?: {
    href: string;
    label: string;
  };
}

export function WidgetEmptyState({
  icon: Icon,
  message,
  description,
  cta,
}: WidgetEmptyStateProps): ReactNode {
  return (
    <div className="p-10 text-center" role="status" aria-label={message}>
      <Icon
        className="w-12 h-12 mx-auto mb-2 text-muted-foreground opacity-30"
        aria-hidden="true"
      />
      <p className="text-base text-muted-foreground mb-2">{message}</p>
      {description && (
        <p className="text-sm text-muted-foreground mb-6">{description}</p>
      )}
      {cta && (
        <Link
          href={cta.href}
          className={cn(
            "inline-block px-6 py-3",
            "bg-primary text-primary-foreground",
            "border-4 border-black dark:border-white/20",
            "shadow-hard hover:shadow-hard-lg",
            "hover:-translate-x-0.5 hover:-translate-y-0.5",
            "transition-all duration-200",
            "font-heading font-bold text-sm uppercase"
          )}
        >
          {cta.label}
        </Link>
      )}
    </div>
  );
}
