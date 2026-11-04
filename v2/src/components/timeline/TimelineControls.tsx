/**
 * TimelineControls Component
 * Header controls for the timeline: one row of plain controls.
 *
 * Features:
 * - Title "Timeline" on left
 * - Time range selector (3/6/12/24 months) using DropdownMenu
 * - Zoom control slider (50-200%)
 * - Case selector trigger button with the count it shows
 */

"use client";

import { FunnelIcon as Filter, MagnifyingGlassMinusIcon, MagnifyingGlassPlusIcon } from "@phosphor-icons/react/ssr";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { PageHeading } from "@/app/(authenticated)/components/PageHeading";
import { ChoiceRow } from "@/components/ui/choice-row";

interface TimelineControlsProps {
  timeRange: 3 | 6 | 12 | 24;
  onTimeRangeChange: (range: 3 | 6 | 12 | 24) => void;
  onOpenCaseSelector: () => void;
  caseCount: number;
  /** Total number of available cases for selection */
  totalCaseCount?: number;
  /** Whether a specific selection is active (vs showing all) */
  hasActiveSelection?: boolean;
  /** Current zoom level (50-200, default 100) */
  zoomLevel?: number;
  /** Callback when zoom level changes */
  onZoomChange?: (zoom: number) => void;
  /** The line above the title (how many cases are shown), as on every app page. */
  meta?: ReactNode;
}

const TIME_RANGE_OPTIONS: { value: 3 | 6 | 12 | 24; label: string }[] = [
  { value: 3, label: "3 months" },
  { value: 6, label: "6 months" },
  { value: 12, label: "12 months" },
  { value: 24, label: "24 months" },
];

export function TimelineControls({
  timeRange,
  onTimeRangeChange,
  onOpenCaseSelector,
  caseCount,
  totalCaseCount,
  hasActiveSelection = false,
  zoomLevel = 100,
  onZoomChange,
  meta,
}: TimelineControlsProps) {
  // What the cases button says it shows: "3/5" for a choice, "All" for all
  const badgeText =
    totalCaseCount !== undefined && hasActiveSelection
      ? `${caseCount}/${totalCaseCount}`
      : caseCount > 0
        ? "All"
        : "0";

  return (
    <div className="flex w-full flex-col gap-4 lg:flex-row lg:items-end lg:justify-between lg:gap-3">
      {/* The same heading every app page opens with: count, then the title. */}
      <PageHeading meta={meta} title="Timeline" />

      {/* Controls: on a phone, zoom across the top and the range and cases side
          by side under it (two rows, not three full-width stacked boxes). */}
      <div className="grid w-full grid-cols-1 gap-2 [&>*]:min-w-0 min-[360px]:grid-cols-2 sm:flex sm:w-auto sm:items-center sm:gap-3">
        {onZoomChange && (
          <div
            className="flex min-h-11 items-center justify-between gap-2 min-[360px]:col-span-2 sm:justify-start border-2 shadow-hard px-3 py-2 bg-background border-border"
            data-testid="zoom-control"
          >
            <MagnifyingGlassMinusIcon className="size-4 text-muted-foreground" aria-hidden="true" />
            <input
              type="range"
              min={50}
              max={200}
              step={10}
              value={zoomLevel}
              onChange={(e) => onZoomChange(Number(e.target.value))}
              className="min-w-0 flex-1 cursor-pointer accent-primary-text sm:w-24 sm:flex-none"
              aria-label="Zoom level"
              data-testid="zoom-slider"
            />
            <MagnifyingGlassPlusIcon className="size-4 text-muted-foreground" aria-hidden="true" />
            <span className="min-w-[4ch] text-right text-sm text-muted-foreground tabular-nums">{zoomLevel}%</span>
          </div>
        )}

        {/* Four ranges, one tap each, the one shown lime (a menu hid them behind a second tap). */}
        <ChoiceRow
          className="flex items-center gap-2 min-[360px]:col-span-2 sm:col-span-1"
          label="Months"
          labelClassName="text-sm font-semibold text-muted-foreground"
          rowClassName="mt-0 flex-nowrap gap-1"
          options={TIME_RANGE_OPTIONS.map((o) => ({ value: String(o.value), label: String(o.value), ariaLabel: o.label }))}
          value={String(timeRange)}
          onChange={(v) => onTimeRangeChange(Number(v) as 3 | 6 | 12 | 24)}
        />{" "}
        <Button
          variant="outline"
          onClick={onOpenCaseSelector}
          className="justify-between sm:justify-center motion-safe:hover:-translate-y-0.5 transition-[color,background-color,border-color,box-shadow,transform]"
          data-testid="case-selector-button"
        >
          <Filter className="size-4" aria-hidden="true" />
          Cases
          <span className="text-muted-foreground" data-testid="case-count-badge">
            {badgeText}
          </span>
        </Button>
      </div>
    </div>
  );
}
