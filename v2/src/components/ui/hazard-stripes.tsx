/**
 * HazardStripes Component
 * Diagonal yellow (#FACC15) and black stripes for urgency/warning indicators
 *
 * Visual Reference: design4 (Flash UI) - hazard-bg pattern
 *
 * Usage:
 * - "footer" variant (h-2): Bottom edge of overdue deadline cards
 * - "badge" variant (h-1): Small accent in badges
 * - "full" variant (h-full w-full): Full background coverage
 *
 * Pattern: Repeating linear gradient at -45deg
 * - Yellow (#FACC15): 10px stripes
 * - Black (#000000): 10px stripes
 *
 * Phase: 20 (Dashboard + Deadline Hub)
 * Created: 2025-12-23
 */

import { cn } from "@/lib/utils";

interface HazardStripesProps {
  /** CSS classes for additional styling */
  className?: string;
  /** Preset size variants */
  variant?: "footer" | "badge" | "full";
}

export default function HazardStripes({
  className,
  variant = "footer",
}: HazardStripesProps) {
  const variantClasses = {
    footer: "h-2 w-full",
    badge: "h-1 w-full",
    full: "h-full w-full",
  };

  return (
    <div
      className={cn(
        // Base hazard pattern
        "bg-[repeating-linear-gradient(-45deg,#FACC15,#FACC15_10px,#000000_10px,#000000_20px)]",
        // Variant size
        variantClasses[variant],
        // Custom overrides
        className
      )}
      aria-hidden="true"
    />
  );
}
