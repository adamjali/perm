/**
 * TimelineLegend Component
 * Color-coded legend for timeline stages with neobrutalist styling.
 *
 * Stage colors (from FRONTEND_DESIGN_SKILL.md and globals.css):
 * - PWD: #0066FF (Blue)
 * - Recruitment: #9333ea (Purple)
 * - ETA 9089: #ea580c (Orange)
 * - I-140: #16a34a (Green)
 *
 * Features:
 * - Horizontal flex layout (wraps to 2x2 grid on mobile)
 * - Flat stage swatches, framed like the timeline markers
 * - Fixed/sticky footer positioning
 * - Neobrutalist styling
 *
 * Phase: 24 (Timeline Visualization)
 * Created: 2025-12-26
 */

"use client";

import { STAGE_COLORS as SHARED_STAGE_COLORS } from "@/lib/timeline/types";

interface StageColor {
  name: string;
  /** Stage colour (from the shared map) */
  primary: string;
}

const STAGE_COLORS: StageColor[] = [
  { name: "PWD", primary: SHARED_STAGE_COLORS.pwd },
  { name: "Recruitment", primary: SHARED_STAGE_COLORS.recruitment },
  { name: "ETA 9089", primary: SHARED_STAGE_COLORS.eta9089 },
  { name: "I-140", primary: SHARED_STAGE_COLORS.i140 },
];

interface TimelineLegendProps {
  /** Additional className for the container */
  className?: string;
  /** Whether the legend is sticky at the bottom */
  sticky?: boolean;
}

export function TimelineLegend({ className = "", sticky = false }: TimelineLegendProps) {
  return (
    <div
      className={`
        ${sticky ? "sticky bottom-0 z-10" : ""}
        bg-muted/50 dark:bg-muted/30 backdrop-blur-sm
        border-t-2 border-t-border
        px-4 py-3
        ${className}
      `.trim()}
    >
      {/* Legend items container - 2x2 grid on mobile, flex row on sm+ */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-2 sm:flex sm:flex-wrap sm:justify-center sm:gap-x-6 md:gap-x-8">
        {STAGE_COLORS.map((stage) => (
          <div
            key={stage.name}
            className="flex items-center gap-2 min-h-[36px]"
          >
            {/* A flat swatch in the stage colour, framed like the markers */}
            <div
              className="size-4 shrink-0 border-2 border-foreground"
              style={{ backgroundColor: stage.primary }}
              role="presentation"
              aria-hidden="true"
              data-legend-swatch
            />
            {/* Stage label */}
            <span className="text-sm font-semibold text-foreground whitespace-nowrap">
              {stage.name}
            </span>
          </div>
        ))}
        {/* What the two other shapes mean: a band is a date range, a dashed
            marker a date computed from the others (not entered). */}
        <div className="flex items-center gap-2 min-h-[36px]">
          <div
            className="h-3 w-6 shrink-0 border-2 border-muted-foreground bg-muted-foreground/25"
            aria-hidden="true"
          />
          <span className="text-sm font-semibold text-foreground whitespace-nowrap">Date range</span>
        </div>
        <div className="flex items-center gap-2 min-h-[36px]">
          <div className="size-4 shrink-0 border-2 border-dashed border-foreground" aria-hidden="true" />
          <span className="text-sm font-semibold text-foreground whitespace-nowrap">Calculated</span>
        </div>
        <div className="flex items-center gap-2 min-h-[36px]">
          <GroupSwatch />
          <span className="text-sm font-semibold text-foreground whitespace-nowrap">Dates close together</span>
        </div>
      </div>
    </div>
  );
}

/** A square holding several dates, as the timelines draw one (see groupMarkers). */
function GroupSwatch() {
  return (
    <span
      className="flex size-[22px] shrink-0 items-center justify-center border-2 border-foreground bg-background text-sm font-bold leading-none text-foreground"
      aria-hidden="true"
    >
      3
    </span>
  );
}

/**
 * TimelineLegendCompact - A more compact version for inline use
 */
export function TimelineLegendCompact({ className = "" }: { className?: string }) {
  return (
    <div className={`flex flex-wrap items-center gap-x-4 gap-y-2 ${className}`}>
      {STAGE_COLORS.map((stage) => (
        <div
          key={stage.name}
          className="flex items-center gap-1.5"
        >
          <div
            className="size-3 border-2 border-foreground"
            style={{ backgroundColor: stage.primary }}
            aria-hidden="true"
          />
          <span className="text-sm font-semibold text-foreground">
            {stage.name}
          </span>
        </div>
      ))}
      <div className="flex items-center gap-1.5">
        <GroupSwatch />
        <span className="text-sm font-semibold text-foreground">Dates close together</span>
      </div>
    </div>
  );
}
