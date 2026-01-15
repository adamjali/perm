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

import { Calendar, Filter, ChevronDown, ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "@/components/ui/button";
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
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between w-full gap-4 sm:gap-3">
      {/* Title on left */}
      <h1 className="font-heading text-2xl sm:text-3xl font-bold text-foreground">
        Timeline
      </h1>

      {/* Controls - stack vertically on mobile, row on sm+ */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 w-full sm:w-auto">
        {/* Zoom Control */}
        {onZoomChange && (
          <div
            className="flex items-center gap-2 px-3 py-2 border-2 border-border bg-background shadow-hard min-h-[44px]"
            data-testid="zoom-control"
          >
            <ZoomOut className="size-4 text-muted-foreground" />
            <input
              type="range"
              min={50}
              max={200}
              step={10}
              value={zoomLevel}
              onChange={(e) => onZoomChange(Number(e.target.value))}
              className="w-20 sm:w-24 accent-primary cursor-pointer"
              aria-label="Zoom level"
              data-testid="zoom-slider"
            />
            <ZoomIn className="size-4 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground min-w-[3ch] text-right">
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
                <Calendar className="size-4 mr-2" />
                <span className="hidden sm:inline">{currentRangeLabel}</span>
                <span className="sm:hidden">
                  {timeRange}M
                </span>
              </div>
              <ChevronDown className="size-4 ml-2 opacity-70" />
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
            <span className="hidden sm:inline">Select Cases</span>
            <span className="sm:hidden">Cases</span>
          </div>
          <span
            className="ml-2 px-2 py-0.5 bg-primary text-primary-foreground border-2 border-border text-xs font-bold min-w-[1.5rem] text-center"
            data-testid="case-count-badge"
          >
            {badgeText}
          </span>
        </Button>
      </div>
    </div>
  );
}
