/**
 * CornerLabel Component
 * Small labeled box positioned at card corners for counts/metrics
 *
 * Visual Reference: design5 - corner number labels
 *
 * Features:
 * - Mono font (JetBrains Mono)
 * - 4px black border
 * - Positioned at corners (top-left, top-right, bottom-left, bottom-right)
 * - Small text size
 * - Background color customizable
 *
 * Usage:
 * <div className="relative">
 *   <CornerLabel value={42} position="top-right" />
 *   <Card>...</Card>
 * </div>
 *
 * Phase: 20 (Dashboard + Deadline Hub)
 * Created: 2025-12-23
 */

import { cn } from "@/lib/utils";

interface CornerLabelProps {
  /** The value to display (number or string) */
  value: string | number;
  /** Corner position */
  position?: "top-left" | "top-right" | "bottom-left" | "bottom-right";
  /** Background color (default: background) */
  color?: string;
  /** Additional CSS classes */
  className?: string;
}

export default function CornerLabel({
  value,
  position = "top-right",
  color = "bg-background",
  className,
}: CornerLabelProps) {
  const positionClasses = {
    "top-left": "-left-3 -top-3",
    "top-right": "-right-3 -top-3",
    "bottom-left": "-bottom-3 -left-3",
    "bottom-right": "-bottom-3 -right-3",
  };

  return (
    <div
      className={cn(
        // Base styles
        "absolute z-10 border-4 border-black px-2 py-1",
        // Typography
        "mono text-xs font-medium",
        // Position
        positionClasses[position],
        // Color
        color,
        // Custom overrides
        className
      )}
    >
      {value}
    </div>
  );
}
