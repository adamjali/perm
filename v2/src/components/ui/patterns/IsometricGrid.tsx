/**
 * IsometricGrid Component
 * CSS-only 3D isometric grid pattern via SVG data URIs.
 *
 * Three variants create different grid textures:
 *   - "dots"    : Offset dot grid evoking an isometric plane
 *   - "lines"   : Diagonal crosshatch lines for a wireframe feel
 *   - "crosses" : Small + marks on an offset grid
 *
 * Supports dark mode via the .dark class: stroke/fill colors
 * swap to light-on-dark automatically.
 *
 * Usage:
 *   <IsometricGrid />                                // dots, subtle
 *   <IsometricGrid variant="lines" opacity={0.1} />  // wireframe
 *   <IsometricGrid variant="crosses" />               // technical grid
 *   <IsometricGrid className="absolute inset-0 -z-10" />
 */

import { cn } from "@/lib/utils";

interface IsometricGridProps {
  /** Additional CSS classes */
  className?: string;
  /** Pattern opacity (0-1). Default 0.15 */
  opacity?: number;
  /** Grid variant. Default "dots" */
  variant?: "dots" | "lines" | "crosses";
}

// SVG data URIs for each variant.
// Light mode uses black strokes/fills, dark mode uses white.
// Encoded inline so there are zero network requests.

const PATTERNS = {
  dots: {
    light: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40'%3E%3Ccircle cx='10' cy='10' r='1.5' fill='%23000'/%3E%3Ccircle cx='30' cy='10' r='1.5' fill='%23000'/%3E%3Ccircle cx='20' cy='25' r='1.5' fill='%23000'/%3E%3Ccircle cx='0' cy='25' r='1.5' fill='%23000'/%3E%3Ccircle cx='40' cy='25' r='1.5' fill='%23000'/%3E%3C/svg%3E")`,
    dark: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40'%3E%3Ccircle cx='10' cy='10' r='1.5' fill='%23fff'/%3E%3Ccircle cx='30' cy='10' r='1.5' fill='%23fff'/%3E%3Ccircle cx='20' cy='25' r='1.5' fill='%23fff'/%3E%3Ccircle cx='0' cy='25' r='1.5' fill='%23fff'/%3E%3Ccircle cx='40' cy='25' r='1.5' fill='%23fff'/%3E%3C/svg%3E")`,
  },
  lines: {
    light: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40'%3E%3Cpath d='M0 40L40 0M-10 10L10 -10M30 50L50 30' stroke='%23000' stroke-width='0.5' fill='none'/%3E%3Cpath d='M40 40L0 0M50 10L30 -10M-10 30L10 50' stroke='%23000' stroke-width='0.5' fill='none'/%3E%3C/svg%3E")`,
    dark: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40'%3E%3Cpath d='M0 40L40 0M-10 10L10 -10M30 50L50 30' stroke='%23fff' stroke-width='0.5' fill='none'/%3E%3Cpath d='M40 40L0 0M50 10L30 -10M-10 30L10 50' stroke='%23fff' stroke-width='0.5' fill='none'/%3E%3C/svg%3E")`,
  },
  crosses: {
    light: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40'%3E%3Cpath d='M10 7v6M7 10h6' stroke='%23000' stroke-width='1' fill='none'/%3E%3Cpath d='M30 7v6M27 10h6' stroke='%23000' stroke-width='1' fill='none'/%3E%3Cpath d='M20 22v6M17 25h6' stroke='%23000' stroke-width='1' fill='none'/%3E%3Cpath d='M0 22v6M-3 25h6' stroke='%23000' stroke-width='1' fill='none'/%3E%3Cpath d='M40 22v6M37 25h6' stroke='%23000' stroke-width='1' fill='none'/%3E%3C/svg%3E")`,
    dark: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40'%3E%3Cpath d='M10 7v6M7 10h6' stroke='%23fff' stroke-width='1' fill='none'/%3E%3Cpath d='M30 7v6M27 10h6' stroke='%23fff' stroke-width='1' fill='none'/%3E%3Cpath d='M20 22v6M17 25h6' stroke='%23fff' stroke-width='1' fill='none'/%3E%3Cpath d='M0 22v6M-3 25h6' stroke='%23fff' stroke-width='1' fill='none'/%3E%3Cpath d='M40 22v6M37 25h6' stroke='%23fff' stroke-width='1' fill='none'/%3E%3C/svg%3E")`,
  },
} as const;

export function IsometricGrid({
  className,
  opacity = 0.15,
  variant = "dots",
}: IsometricGridProps) {
  const pattern = PATTERNS[variant];

  return (
    <>
      {/* Light mode layer */}
      <div
        className={cn(
          "pointer-events-none select-none dark:hidden",
          className
        )}
        aria-hidden="true"
        style={{
          opacity,
          backgroundImage: pattern.light,
          backgroundSize: "40px 40px",
        }}
      />
      {/* Dark mode layer */}
      <div
        className={cn(
          "pointer-events-none select-none hidden dark:block",
          className
        )}
        aria-hidden="true"
        style={{
          opacity,
          backgroundImage: pattern.dark,
          backgroundSize: "40px 40px",
        }}
      />
    </>
  );
}

export default IsometricGrid;
