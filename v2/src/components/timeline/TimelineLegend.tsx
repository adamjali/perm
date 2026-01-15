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
 * - Colored bars with gradient and border
 * - Fixed/sticky footer positioning
 * - Neobrutalist styling
 *
 * Phase: 24 (Timeline Visualization)
 * Created: 2025-12-26
 */

"use client";

interface StageColor {
  name: string;
  /** Primary color */
  primary: string;
  /** Secondary gradient color */
  secondary: string;
}

const STAGE_COLORS: StageColor[] = [
  { name: "PWD", primary: "#0066FF", secondary: "#3b82f6" },
  { name: "Recruitment", primary: "#9333ea", secondary: "#a855f7" },
  { name: "ETA 9089", primary: "#ea580c", secondary: "#f59e0b" },
  { name: "I-140", primary: "#16a34a", secondary: "#22c55e" },
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
        border-t-3 border-t-border
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
            {/* Colored bar with gradient and border */}
            <div
              className="w-6 h-2 shrink-0 border-[2px] border-foreground/80 dark:border-foreground/60"
              style={{
                background: `linear-gradient(135deg, ${stage.primary}, ${stage.secondary})`,
              }}
              role="presentation"
              aria-hidden="true"
            />
            {/* Stage label */}
            <span className="text-sm font-semibold text-foreground whitespace-nowrap">
              {stage.name}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * TimelineLegendCompact - A more compact version for inline use
 */
export function TimelineLegendCompact({ className = "" }: { className?: string }) {
  return (
    <div className={`flex flex-wrap gap-4 ${className}`}>
      {STAGE_COLORS.map((stage) => (
        <div
          key={stage.name}
          className="flex items-center gap-1.5"
        >
          <div
            className="w-4 h-1.5 border border-foreground/50"
            style={{
              background: `linear-gradient(135deg, ${stage.primary}, ${stage.secondary})`,
            }}
            aria-hidden="true"
          />
          <span className="text-xs font-medium text-muted-foreground">
            {stage.name}
          </span>
        </div>
      ))}
    </div>
  );
}
