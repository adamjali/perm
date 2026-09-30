/**
 * TimelineControls Component
 * Header controls for timeline visualization with neobrutalist styling.
 *
 * Features:
 * - Title "Timeline" on left
 * - Time range selector (3/6/12/24 months) using DropdownMenu
 * - Zoom control slider (50-200%)
 * - Case selector trigger button with count badge
 * - Neobrutalist styling with hard shadows
 *
 * Phase: 24 (Timeline Visualization)
 * Created: 2025-12-26
 * Updated: 2025-12-27 - Added zoom control
 */

"use client";

import { CalendarIcon, CaretDownIcon, FunnelIcon as Filter, MagnifyingGlassMinusIcon, MagnifyingGlassPlusIcon } from "@phosphor-icons/react/ssr";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { PageHeading } from "@/app/(authenticated)/components/PageHeading";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
  eyebrow?: ReactNode;
}

const TIME_RANGE_OPTIONS: { value: 3 | 6 | 12 | 24; label: string }[] = [
  { value: 3, label: "3 Months" },
  { value: 6, label: "6 Months" },
  { value: 12, label: "12 Months" },
  { value: 24, label: "24 Months" },
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
  eyebrow,
}: TimelineControlsProps) {
  const currentRangeLabel =
    TIME_RANGE_OPTIONS.find((opt) => opt.value === timeRange)?.label ??
    "12 Months";

  // Build badge text: "3/5" if specific selection, "All" if showing all
  const badgeText =
    totalCaseCount !== undefined && hasActiveSelection
      ? `${caseCount}/${totalCaseCount}`
      : caseCount > 0
        ? "All"
        : "0";

  return (
    <div className="flex w-full flex-col gap-4 lg:flex-row lg:items-end lg:justify-between lg:gap-3">
      {/* The same heading every app page opens with: count, then the title. */}
      <PageHeading eyebrow={eyebrow} title="Timeline" />

      {/* Controls: on a phone, zoom across the top and the range and cases side
          by side under it (two rows, not three full-width stacked boxes). */}
      <div className="grid w-full grid-cols-1 gap-2 [&>*]:min-w-0 min-[360px]:grid-cols-2 sm:flex sm:w-auto sm:items-center sm:gap-3">
        {/* Zoom Control */}
        {onZoomChange && (
          <div
            className="flex items-center justify-between gap-2 min-[360px]:col-span-2 px-3 py-2 border-2 border-border bg-background shadow-hard min-h-[44px] sm:justify-start"
            data-testid="zoom-control"
          >
            <MagnifyingGlassMinusIcon className="size-4 text-muted-foreground" />
            <input
              type="range"
              min={50}
              max={200}
              step={10}
              value={zoomLevel}
              onChange={(e) => onZoomChange(Number(e.target.value))}
              className="min-w-0 flex-1 accent-primary cursor-pointer sm:w-24 sm:flex-none"
              aria-label="Zoom level"
              data-testid="zoom-slider"
            />
            <MagnifyingGlassPlusIcon className="size-4 text-muted-foreground" />
            <span className="text-sm font-medium text-muted-foreground min-w-[3ch] text-right">
              {zoomLevel}%
            </span>
          </div>
        )}
        {/* Time Range Dropdown with neobrutalist styling */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="default"
              className="border-2 border-border bg-background shadow-hard hover:shadow-hard-lg hover:-translate-y-0.5 transition-all min-h-[44px] justify-between sm:justify-center"
            >
              <div className="flex items-center">
                <CalendarIcon className="size-4 mr-2" />
                <span className="hidden sm:inline">{currentRangeLabel}</span>{" "}
                <span className="sm:hidden">
                  {timeRange}M
                </span>
              </div>
              <CaretDownIcon className="size-4 ml-2 opacity-70" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="w-40 border-2 border-border bg-popover shadow-hard"
          >
            <DropdownMenuRadioGroup
              value={String(timeRange)}
              onValueChange={(value) =>
                onTimeRangeChange(Number(value) as 3 | 6 | 12 | 24)
              }
            >
              {TIME_RANGE_OPTIONS.map((option) => (
                <DropdownMenuRadioItem
                  key={option.value}
                  value={String(option.value)}
                  className="cursor-pointer min-h-[44px]"
                >
                  {option.label}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Case Selector Button with count badge */}
        <Button
          variant="outline"
          size="default"
          onClick={onOpenCaseSelector}
          className="border-2 border-border bg-background shadow-hard hover:shadow-hard-lg hover:-translate-y-0.5 transition-all min-h-[44px] justify-between xs:justify-center"
          data-testid="case-selector-button"
        >
          <div className="flex items-center">
            <Filter className="size-4 mr-2" />
            <span className="hidden sm:inline">Select cases</span>{" "}
            <span className="sm:hidden">Cases</span>
          </div>
          <span
            className="ml-2 px-2 py-0.5 bg-primary text-primary-foreground border-2 border-border text-sm font-bold min-w-[1.5rem] text-center"
            data-testid="case-count-badge"
          >
            {badgeText}
          </span>
        </Button>
      </div>
    </div>
  );
}
