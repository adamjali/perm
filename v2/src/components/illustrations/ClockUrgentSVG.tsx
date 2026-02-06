/**
 * ClockUrgentSVG - Clock with warning/urgency flash
 * Used in: deadline warnings, urgency indicators, overdue states
 * Style: Neobrutalist - bold strokes, red/yellow warning colors
 */

interface ClockUrgentSVGProps {
  className?: string;
  size?: number;
}

export function ClockUrgentSVG({ className = "", size = 200 }: ClockUrgentSVGProps) {
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
      {/* Clock face */}
      <circle cx="100" cy="100" r="70" fill="white" stroke="currentColor" strokeWidth="3" />

      {/* Inner ring */}
      <circle cx="100" cy="100" r="62" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.1" />

      {/* Hour markers */}
      {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((angle) => {
        const rad = (angle - 90) * (Math.PI / 180);
        const x1 = 100 + 55 * Math.cos(rad);
        const y1 = 100 + 55 * Math.sin(rad);
        const x2 = 100 + 62 * Math.cos(rad);
        const y2 = 100 + 62 * Math.sin(rad);
        const isMajor = angle % 90 === 0;
        return (
          <line
            key={angle}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke="currentColor"
            strokeWidth={isMajor ? 3 : 2}
          />
        );
      })}

      {/* Hour hand - pointing to ~11 */}
      <line
        x1="100"
        y1="100"
        x2="80"
        y2="60"
        stroke="currentColor"
        strokeWidth="5"
        strokeLinecap="square"
      />

      {/* Minute hand - pointing to ~59 */}
      <line
        x1="100"
        y1="100"
        x2="98"
        y2="42"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="square"
      />

      {/* Center dot */}
      <circle cx="100" cy="100" r="5" fill="currentColor" />

      {/* Red urgency zone (last 5 minutes) */}
      <path
        d="M100 38 A62 62 0 0 1 145 52"
        fill="none"
        stroke="#DC2626"
        strokeWidth="6"
        strokeLinecap="square"
        opacity="0.7"
      />

      {/* Warning triangle - top right */}
      <g transform="translate(155, 30)">
        <path
          d="M0 -18 L16 12 L-16 12 Z"
          fill="#FBBF24"
          stroke="currentColor"
          strokeWidth="3"
        />
        <text
          x="0"
          y="8"
          textAnchor="middle"
          fill="black"
          fontSize="18"
          fontWeight="900"
          fontFamily="var(--font-heading), system-ui"
        >
          !
        </text>
      </g>

      {/* Lightning bolt - urgency indicator */}
      <g transform="translate(40, 35)">
        <path
          d="M10 0 L0 12 L7 12 L3 24 L15 10 L8 10 Z"
          fill="#FBBF24"
          stroke="currentColor"
          strokeWidth="2"
        />
      </g>

      {/* Pulse rings - urgency */}
      <circle cx="100" cy="100" r="78" fill="none" stroke="#DC2626" strokeWidth="2" opacity="0.2" />
      <circle cx="100" cy="100" r="85" fill="none" stroke="#DC2626" strokeWidth="1.5" opacity="0.1" />

      {/* Hard shadow */}
      <circle cx="104" cy="104" r="70" fill="currentColor" opacity="0.06" />
    </svg>
  );
}
