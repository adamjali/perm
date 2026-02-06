/**
 * MeshGradient Component
 * Animated CSS mesh gradient background using the app's stage colors.
 *
 * Creates a slow-cycling ambient gradient using conic + radial gradients
 * with lime green (#2ECC40), blue (#0066FF), and purple (#9333ea).
 *
 * Pure CSS animation -- no JS animation libraries.
 *
 * Usage:
 *   <MeshGradient />                         // subtle ambient bg
 *   <MeshGradient opacity={0.25} />           // stronger presence
 *   <MeshGradient animate={false} />          // static gradient
 *   <MeshGradient className="absolute inset-0 -z-10" /> // positioned behind content
 */

import { cn } from "@/lib/utils";

interface MeshGradientProps {
  /** Additional CSS classes */
  className?: string;
  /** Gradient opacity (0-1). Default 0.15 */
  opacity?: number;
  /** Whether to animate the gradient. Default true */
  animate?: boolean;
}

const KEYFRAMES = `
@keyframes mesh-gradient-shift {
  0% {
    background-position: 0% 0%, 0% 0%, 100% 100%, 50% 50%;
  }
  25% {
    background-position: 50% 25%, 30% 70%, 70% 30%, 20% 80%;
  }
  50% {
    background-position: 100% 50%, 60% 40%, 40% 60%, 80% 20%;
  }
  75% {
    background-position: 50% 75%, 80% 20%, 20% 80%, 40% 60%;
  }
  100% {
    background-position: 0% 100%, 50% 50%, 50% 50%, 60% 40%;
  }
}
`;

export function MeshGradient({
  className,
  opacity = 0.15,
  animate = true,
}: MeshGradientProps) {
  return (
    <div
      className={cn("pointer-events-none select-none", className)}
      aria-hidden="true"
      style={{
        opacity,
        background: [
          "conic-gradient(from 0deg at 30% 40%, #2ECC40 0deg, #0066FF 120deg, #9333ea 240deg, #2ECC40 360deg)",
          "radial-gradient(ellipse at 70% 20%, #0066FF 0%, transparent 50%)",
          "radial-gradient(ellipse at 20% 80%, #9333ea 0%, transparent 50%)",
          "radial-gradient(ellipse at 80% 70%, #2ECC40 0%, transparent 50%)",
        ].join(", "),
        backgroundSize: "200% 200%, 100% 100%, 100% 100%, 100% 100%",
        ...(animate
          ? {
              animation:
                "mesh-gradient-shift 32s ease-in-out infinite alternate",
            }
          : {}),
      }}
    >
      {animate && <style>{KEYFRAMES}</style>}
    </div>
  );
}

export default MeshGradient;
