/**
 * Dashboard Page Loading State
 * Suspense fallback for dashboard page.
 *
 * Shows skeleton placeholders for:
 * - Welcome header
 * - Deadline Hero Widget (full width)
 * - Summary Tiles Grid (6 tiles)
 * - Two-column layout: Upcoming Deadlines | Recent Activity
 * - Add Case Button
 *
 * Phase: 20 (Dashboard Complete)
 * Created: 2025-12-27
 */

import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardLoading() {
  return (
    <div className="space-y-8">
      {/* Welcome Header */}
      <div
        className="animate-in fade-in fill-mode-forwards"
        style={{ animationDuration: "0.2s" }}
      >
        <Skeleton variant="line" className="w-64 h-10 mb-2" />
        <Skeleton variant="line" className="w-48 h-6" />
      </div>

      {/* Deadline Hero Widget Skeleton */}
      <div
        className="rounded-lg border-4 border-border bg-card p-6 shadow-hard animate-in fade-in slide-in-from-bottom-2 fill-mode-forwards"
        style={{ animationDelay: "50ms", animationDuration: "0.3s" }}
      >
        <div className="flex items-center justify-between mb-4">
          <Skeleton variant="line" className="w-48 h-8" />
          <Skeleton variant="block" className="w-24 h-6" />
        </div>
        <div className="space-y-4">
          {/* Hero deadline item */}
          <div className="flex items-center gap-4 p-4 rounded-lg border-2 border-border bg-muted/30">
            <Skeleton variant="circle" className="w-12 h-12" />
            <div className="flex-1 space-y-2">
              <Skeleton variant="line" className="w-3/4 h-6" />
              <Skeleton variant="line" className="w-1/2 h-4" />
            </div>
            <Skeleton variant="block" className="w-20 h-8" />
          </div>
          {/* Secondary deadline items */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-lg border border-border">
                <Skeleton variant="circle" className="w-10 h-10" />
                <div className="flex-1 space-y-1">
                  <Skeleton variant="line" className="w-2/3 h-5" />
                  <Skeleton variant="line" className="w-1/3 h-4" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Summary Tiles Grid Skeleton (6 tiles in 2x3 grid on mobile, 3x2 on desktop) */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="rounded-lg border-2 border-border bg-card p-4 shadow-hard-sm animate-in fade-in slide-in-from-bottom-4 fill-mode-forwards"
            style={{ animationDelay: `${100 + i * 50}ms`, animationDuration: "0.3s" }}
          >
            <div className="flex items-center gap-3 mb-3">
              <Skeleton variant="circle" className="w-8 h-8" />
              <Skeleton variant="line" className="w-16 h-4" />
            </div>
            <Skeleton variant="line" className="w-12 h-8 mb-1" />
            <Skeleton variant="line" className="w-20 h-3" />
          </div>
        ))}
      </div>

      {/* Two-column layout: Upcoming Deadlines | Recent Activity */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Upcoming Deadlines Widget Skeleton */}
        <div
          className="rounded-lg border-2 border-border bg-card p-6 shadow-hard-sm animate-in fade-in slide-in-from-left-4 fill-mode-forwards"
          style={{ animationDelay: "400ms", animationDuration: "0.3s" }}
        >
          <div className="flex items-center justify-between mb-4">
            <Skeleton variant="line" className="w-40 h-7" />
            <Skeleton variant="block" className="w-20 h-8" />
          </div>
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-lg border border-border">
                <Skeleton variant="block" className="w-12 h-12" />
                <div className="flex-1 space-y-1">
                  <Skeleton variant="line" className="w-3/4 h-5" />
                  <Skeleton variant="line" className="w-1/2 h-4" />
                </div>
                <Skeleton variant="line" className="w-16 h-5" />
              </div>
            ))}
          </div>
        </div>

        {/* Recent Activity Widget Skeleton */}
        <div
          className="rounded-lg border-2 border-border bg-card p-6 shadow-hard-sm animate-in fade-in slide-in-from-right-4 fill-mode-forwards"
          style={{ animationDelay: "450ms", animationDuration: "0.3s" }}
        >
          <div className="flex items-center justify-between mb-4">
            <Skeleton variant="line" className="w-36 h-7" />
            <Skeleton variant="block" className="w-20 h-8" />
          </div>
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 py-3 border-b border-border last:border-0">
                <Skeleton variant="circle" className="w-8 h-8" />
                <div className="flex-1 space-y-1">
                  <Skeleton variant="line" className="w-4/5 h-5" />
                  <Skeleton variant="line" className="w-24 h-3" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Add Case Button Skeleton */}
      <div
        className="flex justify-center animate-in fade-in fill-mode-forwards"
        style={{ animationDelay: "500ms", animationDuration: "0.3s" }}
      >
        <Skeleton variant="block" className="w-40 h-12" />
      </div>
    </div>
  );
}
