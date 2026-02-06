/**
 * ShieldCheckSVG - Shield with checkmark for compliance/security
 * Used in: trust strip, compliance features, security references
 * Style: Neobrutalist - bold strokes, lime green accents, black outlines
 */

interface ShieldCheckSVGProps {
  className?: string;
  size?: number;
}

export function ShieldCheckSVG({ className = "", size = 200 }: ShieldCheckSVGProps) {
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
      {/* Shield body */}
      <path
        d="M100 15 L170 45 L170 100 Q170 155 100 185 Q30 155 30 100 L30 45 Z"
        fill="white"
        stroke="currentColor"
        strokeWidth="3"
      />

      {/* Shield inner highlight */}
      <path
        d="M100 30 L155 55 L155 100 Q155 145 100 170 Q45 145 45 100 L45 55 Z"
        fill="#F0FFF0"
        stroke="currentColor"
        strokeWidth="2"
        opacity="0.5"
      />

      {/* Green top section */}
      <path
        d="M100 15 L170 45 L170 70 L30 70 L30 45 Z"
        fill="#2ECC40"
        stroke="currentColor"
        strokeWidth="3"
      />

      {/* Large checkmark */}
      <path
        d="M70 100 L90 125 L130 80"
        fill="none"
        stroke="#2ECC40"
        strokeWidth="8"
        strokeLinecap="square"
        strokeLinejoin="miter"
      />

      {/* DOL text in header */}
      <text
        x="100"
        y="58"
        textAnchor="middle"
        fill="black"
        fontSize="16"
        fontWeight="900"
        fontFamily="var(--font-heading), system-ui"
        letterSpacing="3"
      >
        DOL
      </text>

      {/* Decorative stars */}
      <circle cx="55" cy="55" r="3" fill="black" />
      <circle cx="145" cy="55" r="3" fill="black" />

      {/* Hard shadow */}
      <path
        d="M104 19 L174 49 L174 104 Q174 159 104 189 Q34 159 34 104 L34 49 Z"
        fill="currentColor"
        opacity="0.06"
      />
    </svg>
  );
}
