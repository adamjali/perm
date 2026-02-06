/**
 * SuccessCelebrationSVG - Trophy with confetti burst
 * Used in: success states, case completion, approval celebrations
 * Style: Neobrutalist - bold strokes, lime green accents, colorful confetti
 */

interface SuccessCelebrationSVGProps {
  className?: string;
  size?: number;
}

export function SuccessCelebrationSVG({ className = "", size = 200 }: SuccessCelebrationSVGProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 200 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {/* Confetti pieces */}
      {/* Rectangles */}
      <rect x="30" y="25" width="10" height="6" fill="#2ECC40" transform="rotate(25, 35, 28)" />
      <rect x="55" y="15" width="8" height="5" fill="#0066FF" transform="rotate(-15, 59, 17)" />
      <rect x="140" y="20" width="10" height="6" fill="#DC2626" transform="rotate(40, 145, 23)" />
      <rect x="160" y="35" width="8" height="5" fill="#FBBF24" transform="rotate(-30, 164, 37)" />
      <rect x="20" y="60" width="8" height="5" fill="#9333ea" transform="rotate(50, 24, 62)" />
      <rect x="170" y="65" width="10" height="6" fill="#2ECC40" transform="rotate(-20, 175, 68)" />

      {/* Circles */}
      <circle cx="45" cy="40" r="4" fill="#FBBF24" />
      <circle cx="155" cy="45" r="3" fill="#0066FF" />
      <circle cx="75" cy="20" r="3" fill="#DC2626" />
      <circle cx="130" cy="15" r="4" fill="#2ECC40" />

      {/* Stars */}
      <g transform="translate(35, 50)">
        <path d="M0 -5 L1.5 -1.5 L5 0 L1.5 1.5 L0 5 L-1.5 1.5 L-5 0 L-1.5 -1.5 Z" fill="#FBBF24" />
      </g>
      <g transform="translate(165, 55)">
        <path d="M0 -4 L1 -1 L4 0 L1 1 L0 4 L-1 1 L-4 0 L-1 -1 Z" fill="#2ECC40" />
      </g>

      {/* Trophy */}
      {/* Cup */}
      <path
        d="M65 60 L60 120 Q60 140 80 140 L120 140 Q140 140 140 120 L135 60 Z"
        fill="#FBBF24"
        stroke="currentColor"
        strokeWidth="3"
      />

      {/* Cup shine */}
      <path
        d="M75 65 L72 115 Q75 130 85 130"
        fill="none"
        stroke="white"
        strokeWidth="3"
        opacity="0.4"
      />

      {/* Left handle */}
      <path
        d="M65 75 Q40 75 40 95 Q40 115 65 115"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
      />

      {/* Right handle */}
      <path
        d="M135 75 Q160 75 160 95 Q160 115 135 115"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
      />

      {/* Star on trophy */}
      <g transform="translate(100, 95)">
        <path
          d="M0 -15 L5 -5 L16 -5 L7 2 L10 13 L0 6 L-10 13 L-7 2 L-16 -5 L-5 -5 Z"
          fill="white"
          stroke="currentColor"
          strokeWidth="2"
          opacity="0.8"
        />
      </g>

      {/* Stem */}
      <rect x="90" y="140" width="20" height="15" fill="#FBBF24" stroke="currentColor" strokeWidth="3" />

      {/* Base */}
      <rect x="70" y="155" width="60" height="12" fill="#2ECC40" stroke="currentColor" strokeWidth="3" />
      <rect x="60" y="167" width="80" height="10" fill="currentColor" stroke="currentColor" strokeWidth="3" />

      {/* #1 text */}
      <text
        x="100"
        y="175"
        textAnchor="middle"
        fill="white"
        fontSize="8"
        fontWeight="900"
        fontFamily="var(--font-heading), system-ui"
      >
        APPROVED
      </text>

      {/* Hard shadow */}
      <path
        d="M69 64 L64 124 Q64 144 84 144 L124 144 Q144 144 144 124 L139 64 Z"
        fill="currentColor"
        opacity="0.06"
      />
    </svg>
  );
}
