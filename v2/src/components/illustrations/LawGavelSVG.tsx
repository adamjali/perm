/**
 * LawGavelSVG - Gavel with document for legal references
 * Used in: footer, legal page headers, about section
 * Style: Neobrutalist - bold strokes, lime green accents, black outlines
 */

interface LawGavelSVGProps {
  className?: string;
  size?: number;
}

export function LawGavelSVG({ className = "", size = 200 }: LawGavelSVGProps) {
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
      {/* Sound block / base */}
      <rect x="30" y="155" width="140" height="20" fill="#2ECC40" stroke="currentColor" strokeWidth="3" />
      <rect x="50" y="145" width="100" height="14" fill="white" stroke="currentColor" strokeWidth="3" />

      {/* Gavel head */}
      <g transform="translate(100, 70) rotate(-30)">
        <rect x="-35" y="-15" width="70" height="30" fill="#8B6914" stroke="currentColor" strokeWidth="3" />
        {/* Metal bands */}
        <rect x="-35" y="-15" width="10" height="30" fill="#A0A0A0" stroke="currentColor" strokeWidth="2" />
        <rect x="25" y="-15" width="10" height="30" fill="#A0A0A0" stroke="currentColor" strokeWidth="2" />
      </g>

      {/* Gavel handle */}
      <line
        x1="100"
        y1="70"
        x2="100"
        y2="140"
        stroke="#8B6914"
        strokeWidth="8"
        strokeLinecap="square"
      />
      <line
        x1="100"
        y1="70"
        x2="100"
        y2="140"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="square"
        fill="none"
        opacity="0.3"
      />

      {/* Impact lines */}
      <line x1="60" y1="145" x2="45" y2="130" stroke="#2ECC40" strokeWidth="3" opacity="0.6" />
      <line x1="140" y1="145" x2="155" y2="130" stroke="#2ECC40" strokeWidth="3" opacity="0.6" />
      <line x1="100" y1="145" x2="100" y2="125" stroke="#2ECC40" strokeWidth="2" opacity="0.4" />

      {/* Document behind gavel */}
      <g transform="translate(145, 30)">
        <rect x="0" y="0" width="40" height="55" fill="white" stroke="currentColor" strokeWidth="2" />
        <line x1="6" y1="10" x2="34" y2="10" stroke="currentColor" strokeWidth="1.5" opacity="0.3" />
        <line x1="6" y1="18" x2="34" y2="18" stroke="currentColor" strokeWidth="1.5" opacity="0.3" />
        <line x1="6" y1="26" x2="28" y2="26" stroke="currentColor" strokeWidth="1.5" opacity="0.3" />
        <line x1="6" y1="34" x2="32" y2="34" stroke="currentColor" strokeWidth="1.5" opacity="0.3" />
        {/* Seal */}
        <circle cx="28" cy="45" r="6" fill="#2ECC40" opacity="0.5" stroke="currentColor" strokeWidth="1" />
      </g>

      {/* Motion blur arcs */}
      <path d="M55 40 Q80 20 105 40" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.2" strokeDasharray="4 3" />
      <path d="M60 50 Q82 32 105 50" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.15" strokeDasharray="4 3" />
    </svg>
  );
}
