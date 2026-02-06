/**
 * NotificationBellSVG - Bell with sound waves
 * Used in: notification features, empty notification state, alerts
 * Style: Neobrutalist - bold strokes, lime green accents, black outlines
 */

interface NotificationBellSVGProps {
  className?: string;
  size?: number;
  sleeping?: boolean;
}

export function NotificationBellSVG({ className = "", size = 200, sleeping = false }: NotificationBellSVGProps) {
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
      {/* Bell body */}
      <path
        d="M60 100 Q60 50 100 40 Q140 50 140 100 L145 130 L55 130 Z"
        fill="#FBBF24"
        stroke="currentColor"
        strokeWidth="3"
      />

      {/* Bell rim */}
      <rect x="45" y="128" width="110" height="14" fill="#FBBF24" stroke="currentColor" strokeWidth="3" />

      {/* Bell clapper */}
      <circle cx="100" cy="150" r="8" fill="currentColor" stroke="currentColor" strokeWidth="2" />

      {/* Bell top knob */}
      <circle cx="100" cy="38" r="6" fill="currentColor" />

      {/* Handle arc */}
      <path
        d="M88 38 Q88 25 100 25 Q112 25 112 38"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
      />

      {sleeping ? (
        /* ZZZ for sleeping state */
        <>
          <text x="140" y="50" fill="currentColor" fontSize="20" fontWeight="900" fontFamily="var(--font-heading), system-ui" opacity="0.6">Z</text>
          <text x="152" y="35" fill="currentColor" fontSize="16" fontWeight="900" fontFamily="var(--font-heading), system-ui" opacity="0.4">Z</text>
          <text x="160" y="22" fill="currentColor" fontSize="12" fontWeight="900" fontFamily="var(--font-heading), system-ui" opacity="0.2">Z</text>
        </>
      ) : (
        /* Sound waves - active state */
        <>
          {/* Left waves */}
          <path d="M45 85 Q30 95 45 110" fill="none" stroke="#2ECC40" strokeWidth="3" strokeLinecap="square" />
          <path d="M35 75 Q15 95 35 120" fill="none" stroke="#2ECC40" strokeWidth="2" strokeLinecap="square" opacity="0.5" />

          {/* Right waves */}
          <path d="M155 85 Q170 95 155 110" fill="none" stroke="#2ECC40" strokeWidth="3" strokeLinecap="square" />
          <path d="M165 75 Q185 95 165 120" fill="none" stroke="#2ECC40" strokeWidth="2" strokeLinecap="square" opacity="0.5" />

          {/* Notification dot */}
          <circle cx="135" cy="50" r="12" fill="#DC2626" stroke="currentColor" strokeWidth="2" />
          <text x="135" y="55" textAnchor="middle" fill="white" fontSize="12" fontWeight="900" fontFamily="var(--font-heading), system-ui">3</text>
        </>
      )}

      {/* Hard shadow */}
      <path
        d="M64 104 Q64 54 104 44 Q144 54 144 104 L149 134 L59 134 Z"
        fill="currentColor"
        opacity="0.06"
      />
    </svg>
  );
}
