/**
 * CalendarSyncSVG - Calendar with sync arrows
 * Used in: features grid (Calendar Sync)
 * Style: Neobrutalist - bold strokes, lime green accents, black outlines
 */

interface CalendarSyncSVGProps {
  className?: string;
  size?: number;
}

export function CalendarSyncSVG({ className = "", size = 200 }: CalendarSyncSVGProps) {
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
      {/* Calendar body */}
      <rect x="20" y="38" width="130" height="130" fill="white" stroke="currentColor" strokeWidth="3" />

      {/* Calendar header */}
      <rect x="20" y="38" width="130" height="32" fill="#2ECC40" stroke="currentColor" strokeWidth="3" />

      {/* Calendar rings */}
      <rect x="48" y="28" width="8" height="22" rx="0" fill="currentColor" />
      <rect x="80" y="28" width="8" height="22" rx="0" fill="currentColor" />
      <rect x="112" y="28" width="8" height="22" rx="0" fill="currentColor" />

      {/* Header text */}
      <text
        x="85"
        y="60"
        textAnchor="middle"
        fill="black"
        fontSize="12"
        fontWeight="900"
        fontFamily="var(--font-heading), system-ui"
        letterSpacing="1"
      >
        SYNC
      </text>

      {/* Calendar grid - Row 1 */}
      <rect x="30" y="80" width="22" height="22" fill="#F5F5F5" stroke="currentColor" strokeWidth="1.5" />
      <rect x="56" y="80" width="22" height="22" fill="#F5F5F5" stroke="currentColor" strokeWidth="1.5" />
      <rect x="82" y="80" width="22" height="22" fill="#F5F5F5" stroke="currentColor" strokeWidth="1.5" />
      <rect x="108" y="80" width="22" height="22" fill="#F5F5F5" stroke="currentColor" strokeWidth="1.5" />

      {/* Calendar grid - Row 2 */}
      <rect x="30" y="106" width="22" height="22" fill="#F5F5F5" stroke="currentColor" strokeWidth="1.5" />
      {/* Highlighted synced day */}
      <rect x="56" y="106" width="22" height="22" fill="#E8FFE8" stroke="#2ECC40" strokeWidth="2" />
      <path d="M62 118 L66 122 L74 113" stroke="#2ECC40" strokeWidth="2.5" strokeLinecap="square" fill="none" />
      <rect x="82" y="106" width="22" height="22" fill="#F5F5F5" stroke="currentColor" strokeWidth="1.5" />
      <rect x="108" y="106" width="22" height="22" fill="#F5F5F5" stroke="currentColor" strokeWidth="1.5" />

      {/* Calendar grid - Row 3 */}
      <rect x="30" y="132" width="22" height="22" fill="#F5F5F5" stroke="currentColor" strokeWidth="1.5" />
      <rect x="56" y="132" width="22" height="22" fill="#F5F5F5" stroke="currentColor" strokeWidth="1.5" />
      {/* Another synced day */}
      <rect x="82" y="132" width="22" height="22" fill="#E8FFE8" stroke="#2ECC40" strokeWidth="2" />
      <path d="M88 144 L92 148 L100 139" stroke="#2ECC40" strokeWidth="2.5" strokeLinecap="square" fill="none" />
      <rect x="108" y="132" width="22" height="22" fill="#F5F5F5" stroke="currentColor" strokeWidth="1.5" />

      {/* Sync arrows circle - overlapping bottom-right */}
      <g transform="translate(148, 140)">
        {/* Background circle */}
        <circle cx="0" cy="0" r="36" fill="white" stroke="currentColor" strokeWidth="3" />

        {/* Top arrow (clockwise) */}
        <path
          d="M-18 -8 A 22 22 0 0 1 14 -16"
          fill="none"
          stroke="#2ECC40"
          strokeWidth="4"
          strokeLinecap="square"
        />
        <polygon points="14,-24 20,-14 8,-14" fill="#2ECC40" stroke="currentColor" strokeWidth="1.5" />

        {/* Bottom arrow (counter-clockwise) */}
        <path
          d="M18 8 A 22 22 0 0 1 -14 16"
          fill="none"
          stroke="#2ECC40"
          strokeWidth="4"
          strokeLinecap="square"
        />
        <polygon points="-14,24 -20,14 -8,14" fill="#2ECC40" stroke="currentColor" strokeWidth="1.5" />
      </g>

      {/* Small connection dots */}
      <circle cx="130" cy="120" r="2.5" fill="#2ECC40" />
      <circle cx="138" cy="128" r="2" fill="#2ECC40" opacity="0.6" />

      {/* Hard shadow */}
      <rect x="24" y="42" width="130" height="130" fill="currentColor" opacity="0.06" transform="translate(4, 4)" />
    </svg>
  );
}
