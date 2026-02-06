/**
 * FolderOpenSVG - Open manila folder with sparkles
 * Used in: empty cases state, onboarding, getting started
 * Style: Neobrutalist - bold strokes, manila colors, lime green accents
 */

interface FolderOpenSVGProps {
  className?: string;
  size?: number;
}

export function FolderOpenSVG({ className = "", size = 200 }: FolderOpenSVGProps) {
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
      {/* Folder back panel */}
      <path
        d="M25 60 L25 170 L175 170 L175 60 Z"
        fill="#E8D4A8"
        stroke="currentColor"
        strokeWidth="3"
      />

      {/* Folder tab */}
      <path
        d="M25 60 L60 60 L75 45 L120 45 L120 60"
        fill="#F5E6C8"
        stroke="currentColor"
        strokeWidth="3"
      />

      {/* Folder front panel (open, tilted) */}
      <path
        d="M20 90 L35 170 L175 170 L185 90 Z"
        fill="#F5E6C8"
        stroke="currentColor"
        strokeWidth="3"
      />

      {/* Papers sticking out */}
      <rect x="55" y="70" width="90" height="30" fill="white" stroke="currentColor" strokeWidth="2" transform="rotate(-3, 100, 85)" />
      <line x1="65" y1="78" x2="135" y2="76" stroke="currentColor" strokeWidth="1.5" opacity="0.3" />
      <line x1="65" y1="86" x2="130" y2="84" stroke="currentColor" strokeWidth="1.5" opacity="0.3" />

      <rect x="50" y="75" width="85" height="25" fill="#FAFAFA" stroke="currentColor" strokeWidth="2" transform="rotate(2, 92, 87)" />
      <line x1="60" y1="83" x2="125" y2="84" stroke="currentColor" strokeWidth="1.5" opacity="0.3" />
      <line x1="60" y1="90" x2="120" y2="91" stroke="currentColor" strokeWidth="1.5" opacity="0.3" />

      {/* Folder crease */}
      <line x1="25" y1="90" x2="175" y2="90" stroke="currentColor" strokeWidth="1" opacity="0.2" />

      {/* Sparkles - lime green */}
      {/* Star 1 - top right */}
      <g transform="translate(155, 35)">
        <path d="M0 -8 L2 -2 L8 0 L2 2 L0 8 L-2 2 L-8 0 L-2 -2 Z" fill="#2ECC40" />
      </g>

      {/* Star 2 - top left */}
      <g transform="translate(40, 28)">
        <path d="M0 -6 L1.5 -1.5 L6 0 L1.5 1.5 L0 6 L-1.5 1.5 L-6 0 L-1.5 -1.5 Z" fill="#2ECC40" opacity="0.7" />
      </g>

      {/* Star 3 - right */}
      <g transform="translate(178, 75)">
        <path d="M0 -5 L1 -1 L5 0 L1 1 L0 5 L-1 1 L-5 0 L-1 -1 Z" fill="#2ECC40" opacity="0.5" />
      </g>

      {/* Plus signs */}
      <g transform="translate(170, 50)" opacity="0.4">
        <line x1="0" y1="-5" x2="0" y2="5" stroke="#2ECC40" strokeWidth="2" />
        <line x1="-5" y1="0" x2="5" y2="0" stroke="#2ECC40" strokeWidth="2" />
      </g>

      {/* Folder label */}
      <rect x="75" y="125" width="50" height="20" fill="white" stroke="currentColor" strokeWidth="2" />
      <text
        x="100"
        y="139"
        textAnchor="middle"
        fill="currentColor"
        fontSize="8"
        fontWeight="700"
        fontFamily="var(--font-heading), system-ui"
        opacity="0.5"
      >
        CASES
      </text>

      {/* Hard shadow */}
      <path
        d="M24 94 L39 174 L179 174 L189 94 Z"
        fill="currentColor"
        opacity="0.06"
      />
    </svg>
  );
}
