/**
 * DiagonalLines Component
 * Neobrutalist diagonal line pattern using repeating-linear-gradient.
 *
 * Variants:
 *   - "thin"   : Fine 1px lines -- subtle background texture
 *   - "bold"   : Thick 3px lines -- heavy graphic presence
 *   - "hazard" : Yellow (#FACC15) and black (#000) warning stripes
 *
 * Usage:
 *   <DiagonalLines />                                      // thin default
 *   <DiagonalLines variant="bold" color="var(--primary)" />// green bold stripes
 *   <DiagonalLines variant="hazard" />                      // warning pattern
 *   <DiagonalLines spacing={12} />                          // tighter spacing
 *   <DiagonalLines className="absolute inset-0 -z-10" />   // positioned bg
 */

import { cn } from "@/lib/utils";

interface DiagonalLinesProps {
  /** Additional CSS classes */
  className?: string;
  /** Line pattern variant. Default "thin" */
  variant?: "thin" | "bold" | "hazard";
  /** Line color (CSS value). Default "currentColor". Ignored for "hazard". */
  color?: string;
  /** Spacing between lines in px. Default 20. Ignored for "hazard". */
  spacing?: number;
}

function buildGradient(
  variant: "thin" | "bold" | "hazard",
  color: string,
  spacing: number
): string {
  if (variant === "hazard") {
    return `repeating-linear-gradient(
      -45deg,
      #FACC15 0px,
      #FACC15 ${spacing / 2}px,
      #000000 ${spacing / 2}px,
      #000000 ${spacing}px
    )`;
  }

  const lineWidth = variant === "bold" ? 3 : 1;

  return `repeating-linear-gradient(
    -45deg,
    ${color} 0px,
    ${color} ${lineWidth}px,
    transparent ${lineWidth}px,
    transparent ${spacing}px
  )`;
}

export function DiagonalLines({
  className,
  variant = "thin",
  color = "currentColor",
  spacing = 20,
}: DiagonalLinesProps) {
  const gradient = buildGradient(variant, color, spacing);

  return (
    <div
      className={cn("pointer-events-none select-none", className)}
      aria-hidden="true"
      style={{ background: gradient }}
    />
  );
}

export default DiagonalLines;
