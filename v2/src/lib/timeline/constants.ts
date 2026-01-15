/**
 * Constants for timeline components.
 * Responsive sidebar widths and Z-index layers.
 *
 * Phase: 24 (Timeline Visualization)
 * Created: 2026-01-09
 */

/**
 * Sidebar width classes for responsive design.
 * Matches TimelineGrid and TimelineRow sidebar widths.
 */
export const SIDEBAR_WIDTH_CLASSES =
  "w-[140px] min-w-[140px] max-w-[140px] " +
  "sm:w-[180px] sm:min-w-[180px] sm:max-w-[180px] " +
  "md:w-[250px] md:min-w-[250px] md:max-w-[250px]";

/**
 * Sidebar width values in pixels for calculations.
 */
export const SIDEBAR_WIDTHS = {
  mobile: 140,
  tablet: 180,
  desktop: 250,
} as const;

/**
 * Z-index layers for timeline elements.
 */
export const Z_INDEX = {
  base: 10,
  hovered: 50,
  tooltipHovered: 100,
} as const;

/**
 * Animation configuration for timeline staggered entrance.
 */
export const TIMELINE_ANIMATION = {
  staggerDelay: 0.03, // 30ms per row
  spring: {
    type: "spring" as const,
    stiffness: 500,
    damping: 30,
  },
} as const;
