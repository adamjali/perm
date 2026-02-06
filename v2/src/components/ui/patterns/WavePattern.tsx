/**
 * WavePattern Component
 * Animated SVG wave section divider with two layers for depth.
 *
 * Two independent wave paths animate at different speeds,
 * creating a layered parallax-like effect. Uses CSS keyframes
 * for smooth infinite horizontal translation.
 *
 * Usage:
 *   <WavePattern />                              // top divider
 *   <WavePattern flip />                          // bottom divider (flipped)
 *   <WavePattern color="var(--stage-pwd)" />      // custom color
 *   <WavePattern className="h-24" />              // taller wave
 */

import { cn } from "@/lib/utils";

interface WavePatternProps {
  /** Additional CSS classes */
  className?: string;
  /** Flip vertically for bottom placement. Default false */
  flip?: boolean;
  /** Wave fill color (CSS value). Default "var(--primary)" */
  color?: string;
}

const KEYFRAMES = `
@keyframes wave-drift {
  0% {
    d: path("M0,60 C150,120 350,0 600,60 C850,120 1050,0 1200,60 L1200,120 L0,120 Z");
  }
  100% {
    d: path("M0,80 C200,20 400,100 600,40 C800,100 1000,20 1200,80 L1200,120 L0,120 Z");
  }
}

@keyframes wave-drift-fast {
  0% {
    d: path("M0,80 C200,40 400,100 600,80 C800,60 1000,100 1200,80 L1200,120 L0,120 Z");
  }
  100% {
    d: path("M0,50 C150,100 350,30 600,70 C850,30 1050,100 1200,50 L1200,120 L0,120 Z");
  }
}

@media (prefers-reduced-motion: reduce) {
  .wave-back,
  .wave-front {
    animation: none !important;
  }
}
`;

export function WavePattern({
  className,
  flip = false,
  color = "var(--primary)",
}: WavePatternProps) {
  return (
    <div
      className={cn(
        "w-full overflow-hidden leading-[0]",
        flip && "rotate-180",
        className
      )}
      aria-hidden="true"
    >
      <style>{KEYFRAMES}</style>
      <svg
        className="relative block w-full h-16"
        viewBox="0 0 1200 120"
        preserveAspectRatio="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Back wave -- slower, more transparent */}
        <path
          className="wave-back"
          d="M0,60 C150,120 350,0 600,60 C850,120 1050,0 1200,60 L1200,120 L0,120 Z"
          fill={color}
          opacity={0.3}
          style={{
            animation: "wave-drift 12s ease-in-out infinite alternate",
          }}
        />
        {/* Front wave -- faster, solid */}
        <path
          className="wave-front"
          d="M0,80 C200,40 400,100 600,80 C800,60 1000,100 1200,80 L1200,120 L0,120 Z"
          fill={color}
          opacity={0.6}
          style={{
            animation:
              "wave-drift-fast 8s ease-in-out infinite alternate-reverse",
          }}
        />
      </svg>
    </div>
  );
}

export default WavePattern;
