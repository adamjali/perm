/**
 * RocketLaunchSVG - Rocket with exhaust trail
 * Used in: CTA sections, success states, get started buttons
 * Style: Neobrutalist - bold strokes, lime green accents, black outlines
 */

interface RocketLaunchSVGProps {
  className?: string;
  size?: number;
}

export function RocketLaunchSVG({ className = "", size = 200 }: RocketLaunchSVGProps) {
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
      {/* Exhaust trail */}
      <path
        d="M90 160 Q80 175 70 190"
        fill="none"
        stroke="#FBBF24"
        strokeWidth="4"
        opacity="0.6"
      />
      <path
        d="M100 155 Q100 175 100 195"
        fill="none"
        stroke="#DC2626"
        strokeWidth="5"
        opacity="0.5"
      />
      <path
        d="M110 160 Q120 175 130 190"
        fill="none"
        stroke="#FBBF24"
        strokeWidth="4"
        opacity="0.6"
      />

      {/* Exhaust flame */}
      <path
        d="M85 145 Q92 170 100 180 Q108 170 115 145"
        fill="#FBBF24"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        d="M90 145 Q95 160 100 168 Q105 160 110 145"
        fill="#DC2626"
      />

      {/* Rocket body */}
      <path
        d="M80 145 L80 80 Q80 30 100 15 Q120 30 120 80 L120 145 Z"
        fill="white"
        stroke="currentColor"
        strokeWidth="3"
      />

      {/* Rocket nose cone */}
      <path
        d="M80 80 Q80 30 100 15 Q120 30 120 80"
        fill="#2ECC40"
        stroke="currentColor"
        strokeWidth="3"
      />

      {/* Window */}
      <circle cx="100" cy="90" r="12" fill="#0066FF" stroke="currentColor" strokeWidth="3" />
      <circle cx="100" cy="90" r="7" fill="#4D9FFF" stroke="none" />
      {/* Window reflection */}
      <path d="M95 85 Q97 83 100 84" fill="none" stroke="white" strokeWidth="2" opacity="0.6" />

      {/* Rocket stripes */}
      <rect x="80" y="115" width="40" height="6" fill="#DC2626" stroke="currentColor" strokeWidth="1.5" />
      <rect x="80" y="126" width="40" height="6" fill="#DC2626" stroke="currentColor" strokeWidth="1.5" />

      {/* Left fin */}
      <path
        d="M80 125 L60 150 L80 145 Z"
        fill="#2ECC40"
        stroke="currentColor"
        strokeWidth="3"
      />

      {/* Right fin */}
      <path
        d="M120 125 L140 150 L120 145 Z"
        fill="#2ECC40"
        stroke="currentColor"
        strokeWidth="3"
      />

      {/* Speed lines */}
      <line x1="50" y1="60" x2="30" y2="65" stroke="currentColor" strokeWidth="2" opacity="0.2" />
      <line x1="55" y1="80" x2="35" y2="82" stroke="currentColor" strokeWidth="2" opacity="0.15" />
      <line x1="150" y1="60" x2="170" y2="65" stroke="currentColor" strokeWidth="2" opacity="0.2" />
      <line x1="145" y1="80" x2="165" y2="82" stroke="currentColor" strokeWidth="2" opacity="0.15" />

      {/* Sparkle stars */}
      <g transform="translate(40, 40)">
        <path d="M0 -5 L1.5 -1.5 L5 0 L1.5 1.5 L0 5 L-1.5 1.5 L-5 0 L-1.5 -1.5 Z" fill="#2ECC40" opacity="0.6" />
      </g>
      <g transform="translate(160, 45)">
        <path d="M0 -4 L1 -1 L4 0 L1 1 L0 4 L-1 1 L-4 0 L-1 -1 Z" fill="#2ECC40" opacity="0.4" />
      </g>
    </svg>
  );
}
