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
// 120px on phones (was 140): at 320px wide, 140 left three months of dates
// and clipped the "no dates" note. Keep TimelineGrid's --tl-label in step.
export const SIDEBAR_WIDTH_CLASSES =
  "w-[120px] min-w-[120px] max-w-[120px] " +
  "sm:w-[180px] sm:min-w-[180px] sm:max-w-[180px] " +
  "md:w-[250px] md:min-w-[250px] md:max-w-[250px]";

/**
 * Sidebar width values in pixels for calculations.
 */
export const SIDEBAR_WIDTHS = {
  mobile: 120,
  tablet: 180,
  desktop: 250,
} as const;

/**
 * Z-index layers for timeline elements.
 * Note: Using numeric values for inline styles (Tailwind z-100 etc don't exist)
 */
export const Z_INDEX = {
  /** Base layer for range bars */
  rangeBar: 10,
  /** Range bar when hovered */
  rangeBarHovered: 30,
  /** Base layer for milestone markers (above range bars) */
  milestone: 20,
  /** Milestone when hovered (above everything) */
  milestoneHovered: 40,
  /**
   * The sticky case / stage label column. Above every bar, marker, the "no dates"
   * note and the Today line (20 and 30), so dates scrolled sideways pass UNDER
   * the names; below a hovered marker (40), so its tooltip can still show over
   * them. The date area must not open its own stacking context, or its whole
   * layer is compared with this one as a unit: that is how every marker once
   * painted over the names on a phone (Sep 30 2026).
   */
  stickyLabel: 35,
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
