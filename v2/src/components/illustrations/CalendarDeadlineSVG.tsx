/**
 * CalendarDeadlineSVG - Calendar with alarm and checkmarks
 * Used in: features grid (Smart Deadlines), dashboard empty, calendar page
 * Style: Neobrutalist - bold strokes, lime green accents, black outlines
 */

interface CalendarDeadlineSVGProps {
  className?: string;
  size?: number;
}

export function CalendarDeadlineSVG({ className = "", size = 200 }: CalendarDeadlineSVGProps) {
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
      <rect x="25" y="40" width="150" height="140" fill="white" stroke="currentColor" strokeWidth="3" />

      {/* Calendar header */}
      <rect x="25" y="40" width="150" height="35" fill="#2ECC40" stroke="currentColor" strokeWidth="3" />

      {/* Calendar rings */}
      <rect x="55" y="30" width="8" height="22" rx="0" fill="currentColor" />
      <rect x="90" y="30" width="8" height="22" rx="0" fill="currentColor" />
      <rect x="125" y="30" width="8" height="22" rx="0" fill="currentColor" />

      {/* Month text */}
      <text
        x="100"
        y="63"
        textAnchor="middle"
        fill="black"
        fontSize="14"
        fontWeight="900"
        fontFamily="var(--font-heading), system-ui"
      >
        DEADLINE
      </text>

      {/* Calendar grid */}
      {/* Row 1 */}
      <rect x="35" y="85" width="24" height="24" fill="#F5F5F5" stroke="currentColor" strokeWidth="1.5" />
      <rect x="63" y="85" width="24" height="24" fill="#F5F5F5" stroke="currentColor" strokeWidth="1.5" />
      <rect x="91" y="85" width="24" height="24" fill="#F5F5F5" stroke="currentColor" strokeWidth="1.5" />
      <rect x="119" y="85" width="24" height="24" fill="#F5F5F5" stroke="currentColor" strokeWidth="1.5" />
      <rect x="147" y="85" width="24" height="24" fill="#F5F5F5" stroke="currentColor" strokeWidth="1.5" />

      {/* Row 2 */}
      <rect x="35" y="113" width="24" height="24" fill="#F5F5F5" stroke="currentColor" strokeWidth="1.5" />
      <rect x="63" y="113" width="24" height="24" fill="#F5F5F5" stroke="currentColor" strokeWidth="1.5" />
      {/* Highlighted deadline day */}
      <rect x="91" y="113" width="24" height="24" fill="#DC2626" stroke="currentColor" strokeWidth="2.5" />
      <text x="103" y="130" textAnchor="middle" fill="white" fontSize="12" fontWeight="900" fontFamily="var(--font-heading), system-ui">15</text>
      <rect x="119" y="113" width="24" height="24" fill="#F5F5F5" stroke="currentColor" strokeWidth="1.5" />
      <rect x="147" y="113" width="24" height="24" fill="#F5F5F5" stroke="currentColor" strokeWidth="1.5" />

      {/* Row 3 */}
      <rect x="35" y="141" width="24" height="24" fill="#F5F5F5" stroke="currentColor" strokeWidth="1.5" />
      {/* Checkmarked day */}
      <rect x="63" y="141" width="24" height="24" fill="#E8FFE8" stroke="#2ECC40" strokeWidth="2" />
      <path d="M70 154 L76 160 L82 148" stroke="#2ECC40" strokeWidth="3" strokeLinecap="square" fill="none" />
      <rect x="91" y="141" width="24" height="24" fill="#F5F5F5" stroke="currentColor" strokeWidth="1.5" />
      <rect x="119" y="141" width="24" height="24" fill="#F5F5F5" stroke="currentColor" strokeWidth="1.5" />
      <rect x="147" y="141" width="24" height="24" fill="#F5F5F5" stroke="currentColor" strokeWidth="1.5" />

      {/* Alarm bell icon - top right */}
      <g transform="translate(160, 25)">
        <path
          d="M0 0 L-5 -12 Q0 -18 5 -12 L0 0"
          fill="#FBBF24"
          stroke="currentColor"
          strokeWidth="2"
        />
        <circle cx="0" cy="2" r="3" fill="currentColor" />
        {/* Sound waves */}
        <path d="M8 -8 Q14 -4 8 2" fill="none" stroke="#FBBF24" strokeWidth="2" opacity="0.7" />
        <path d="M12 -10 Q20 -4 12 4" fill="none" stroke="#FBBF24" strokeWidth="1.5" opacity="0.4" />
      </g>

      {/* Hard shadow */}
      <rect x="29" y="44" width="150" height="140" fill="currentColor" opacity="0.06" transform="translate(4, 4)" />
    </svg>
  );
}
