/**
 * Skeleton Components
 *
 * Composable loading state skeletons built on base Skeleton primitive.
 * All components support consistent neobrutalist styling and dark mode.
 */

import * as React from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

// ============================================================================
// FIELD SKELETON
// ============================================================================

export interface FieldSkeletonProps {
  labelWidth?: string;
  inputHeight?: string;
  className?: string;
}

export function FieldSkeleton({
  labelWidth = "w-24",
  inputHeight = "h-11",
  className,
}: FieldSkeletonProps) {
  return (
    <div className={cn("space-y-2", className)}>
      <Skeleton variant="line" className={cn("h-4", labelWidth)} />
      <Skeleton variant="block" className={inputHeight} />
    </div>
  );
}

// ============================================================================
// FORM SECTION SKELETON
// ============================================================================

export interface FormSectionSkeletonProps {
  titleWidth?: string;
  inputCount?: number;
  columns?: 1 | 2 | 3;
  showIcon?: boolean;
  children?: React.ReactNode;
  className?: string;
}

export function FormSectionSkeleton({
  titleWidth = "w-32",
  inputCount = 4,
  columns = 2,
  showIcon = true,
  children,
  className,
}: FormSectionSkeletonProps) {
  const gridCols = {
    1: "",
    2: "md:grid-cols-2",
    3: "md:grid-cols-3",
  };

  return (
    <div
      className={cn(
        "rounded-lg border-2 border-border bg-card p-6 shadow-hard-sm",
        className
      )}
    >
      <div className="flex items-center gap-3 mb-4">
        {showIcon && <Skeleton variant="circle" className="h-5 w-5" />}
        <Skeleton variant="line" className={cn("h-6", titleWidth)} />
      </div>

      {children ?? (
        <div className={cn("grid grid-cols-1 gap-4", gridCols[columns])}>
          {Array.from({ length: inputCount }).map((_, i) => (
            <FieldSkeleton key={i} />
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// SECTION SKELETON (Detail Page)
// ============================================================================

export interface SectionSkeletonProps {
  rows?: number;
  cols?: number;
  showAction?: boolean;
  className?: string;
}

export function SectionSkeleton({
  rows = 2,
  cols = 2,
  showAction = true,
  className,
}: SectionSkeletonProps) {
  return (
    <div
      className={cn(
        "rounded-lg border-2 border-border bg-card p-4 shadow-hard-sm",
        className
      )}
    >
      <div className="flex items-center gap-3 mb-4">
        <Skeleton variant="circle" className="w-5 h-5" />
        <Skeleton variant="line" className="w-32 h-6" />
        <div className="flex-1" />
        {showAction && <Skeleton variant="circle" className="w-5 h-5" />}
      </div>

      <div className={cn("grid gap-4", cols === 2 ? "md:grid-cols-2" : "")}>
        {Array.from({ length: rows * cols }).map((_, i) => (
          <div key={i} className="space-y-1">
            <Skeleton variant="line" className="w-20 h-3" />
            <Skeleton variant="line" className="w-32 h-5" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// TOGGLE SKELETON
// ============================================================================

export interface ToggleSkeletonProps {
  labelWidth?: string;
  className?: string;
}

export function ToggleSkeleton({
  labelWidth = "w-28",
  className,
}: ToggleSkeletonProps) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <Skeleton variant="block" className="h-5 w-5 rounded" />
      <div className="flex-1 space-y-1">
        <Skeleton variant="line" className={cn("h-4", labelWidth)} />
        <Skeleton variant="line" className="h-3 w-48" />
      </div>
    </div>
  );
}

// ============================================================================
// BREADCRUMB SKELETON
// ============================================================================

export interface BreadcrumbSkeletonProps {
  items?: number;
  className?: string;
}

export function BreadcrumbSkeleton({
  items = 3,
  className,
}: BreadcrumbSkeletonProps) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      {Array.from({ length: items }).map((_, i) => (
        <React.Fragment key={i}>
          {i > 0 && <Skeleton variant="circle" className="h-4 w-4" />}
          <Skeleton
            variant="line"
            className={cn("h-4", i === items - 1 ? "w-24" : "w-16")}
          />
        </React.Fragment>
      ))}
    </div>
  );
}

// ============================================================================
// PAGE TITLE SKELETON
// ============================================================================

export interface PageTitleSkeletonProps {
  showAccent?: boolean;
  showDescription?: boolean;
  className?: string;
}

export function PageTitleSkeleton({
  showAccent = true,
  showDescription = true,
  className,
}: PageTitleSkeletonProps) {
  return (
    <div className={cn("relative", className)}>
      {showAccent && (
        <div className="absolute -top-2 -left-2 w-6 h-6 bg-primary border-2 border-foreground skeleton-pulse" />
      )}
      <div className={cn(showAccent && "pl-6", "space-y-2")}>
        <Skeleton variant="line" className="h-8 w-3/4" />
        {showDescription && <Skeleton variant="line" className="h-4 w-1/2" />}
      </div>
    </div>
  );
}

// ============================================================================
// BUTTON SKELETON
// ============================================================================

export interface ButtonSkeletonProps {
  size?: "sm" | "default" | "lg";
  width?: string;
  className?: string;
}

export function ButtonSkeleton({
  size = "default",
  width = "w-24",
  className,
}: ButtonSkeletonProps) {
  const heights = {
    sm: "h-9",
    default: "h-10",
    lg: "h-11",
  };

  return (
    <Skeleton
      variant="block"
      className={cn(heights[size], width, className)}
    />
  );
}

// ============================================================================
// STICKY FOOTER SKELETON
// ============================================================================

export interface StickyFooterSkeletonProps {
  className?: string;
}

export function StickyFooterSkeleton({ className }: StickyFooterSkeletonProps) {
  return (
    <div
      className={cn(
        "fixed bottom-0 left-0 right-0 bg-background/95 border-t-4 border-border p-4 z-10",
        className
      )}
    >
      <div className="flex items-center justify-between gap-4 max-w-4xl mx-auto">
        <div />
        <div className="flex items-center gap-4">
          <ButtonSkeleton size="lg" width="w-24" />
          <ButtonSkeleton size="lg" width="w-28" />
        </div>
      </div>
    </div>
  );
}
