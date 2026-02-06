/**
 * GlobePassportSVG - Globe with passport and plane path
 * Used in: hero section, journey section, immigration references
 * Style: Neobrutalist - bold strokes, lime green accents, black outlines
 */

interface GlobePassportSVGProps {
  className?: string;
  size?: number;
}

export function GlobePassportSVG({ className = "", size = 200 }: GlobePassportSVGProps) {
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
      {/* Globe */}
      <circle cx="100" cy="90" r="65" fill="#F0FFF0" stroke="currentColor" strokeWidth="3" />

      {/* Globe meridians */}
      <ellipse cx="100" cy="90" rx="30" ry="65" fill="none" stroke="currentColor" strokeWidth="2" opacity="0.3" />
      <ellipse cx="100" cy="90" rx="50" ry="65" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.2" />

      {/* Globe parallels */}
      <line x1="40" y1="65" x2="160" y2="65" stroke="currentColor" strokeWidth="1.5" opacity="0.2" />
      <line x1="35" y1="90" x2="165" y2="90" stroke="currentColor" strokeWidth="2" opacity="0.3" />
      <line x1="40" y1="115" x2="160" y2="115" stroke="currentColor" strokeWidth="1.5" opacity="0.2" />

      {/* Continent shapes (simplified) */}
      <path
        d="M75 60 L85 55 L95 58 L105 52 L115 55 L120 65 L115 75 L105 72 L95 78 L85 70 Z"
        fill="#2ECC40"
        opacity="0.3"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M65 85 L75 82 L80 90 L85 95 L80 105 L70 108 L60 100 L58 92 Z"
        fill="#2ECC40"
        opacity="0.3"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M110 90 L120 85 L130 88 L135 95 L130 105 L120 110 L110 105 Z"
        fill="#2ECC40"
        opacity="0.25"
        stroke="currentColor"
        strokeWidth="1.5"
      />

      {/* Plane path - dotted arc */}
      <path
        d="M50 50 Q100 10 150 50"
        fill="none"
        stroke="#2ECC40"
        strokeWidth="2"
        strokeDasharray="6 4"
        opacity="0.7"
      />

      {/* Plane icon */}
      <g transform="translate(145, 48) rotate(30)">
        <path
          d="M0 -3 L8 0 L0 3 L2 0 Z"
          fill="#2ECC40"
          stroke="currentColor"
          strokeWidth="1.5"
        />
        <line x1="-2" y1="0" x2="-6" y2="0" stroke="#2ECC40" strokeWidth="2" />
      </g>

      {/* Passport - overlapping globe bottom-right */}
      <g transform="translate(125, 120)">
        {/* Passport body */}
        <rect x="0" y="0" width="55" height="72" fill="#0066FF" stroke="currentColor" strokeWidth="3" />

        {/* Passport inner rectangle */}
        <rect x="8" y="8" width="39" height="56" fill="none" stroke="white" strokeWidth="1.5" opacity="0.5" />

        {/* Passport emblem circle */}
        <circle cx="27.5" cy="30" r="12" fill="none" stroke="white" strokeWidth="2" opacity="0.6" />
        <circle cx="27.5" cy="30" r="6" fill="none" stroke="white" strokeWidth="1.5" opacity="0.4" />

        {/* PASSPORT text */}
        <text
          x="27.5"
          y="55"
          textAnchor="middle"
          fill="white"
          fontSize="7"
          fontWeight="700"
          fontFamily="var(--font-heading), system-ui"
          letterSpacing="1.5"
        >
          PASSPORT
        </text>

        {/* Hard shadow */}
        <rect x="4" y="4" width="55" height="72" fill="currentColor" opacity="0.1" />
      </g>

      {/* Globe stand/base */}
      <path
        d="M85 155 L100 160 L115 155"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="square"
      />
      <line x1="100" y1="155" x2="100" y2="162" stroke="currentColor" strokeWidth="3" />
    </svg>
  );
}
