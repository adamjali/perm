/**
 * DocumentStackSVG - Stack of legal documents with stamp
 * Used in: empty states, features grid, legal references
 * Style: Neobrutalist - bold strokes, lime green accents, black outlines
 */

interface DocumentStackSVGProps {
  className?: string;
  size?: number;
}

export function DocumentStackSVG({ className = "", size = 200 }: DocumentStackSVGProps) {
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
      {/* Back document - offset */}
      <rect x="45" y="20" width="120" height="155" fill="#F5F5F5" stroke="currentColor" strokeWidth="3" />
      <line x1="65" y1="45" x2="145" y2="45" stroke="currentColor" strokeWidth="2" opacity="0.3" />
      <line x1="65" y1="60" x2="145" y2="60" stroke="currentColor" strokeWidth="2" opacity="0.3" />
      <line x1="65" y1="75" x2="120" y2="75" stroke="currentColor" strokeWidth="2" opacity="0.3" />

      {/* Middle document */}
      <rect x="32" y="30" width="120" height="155" fill="#FAFAFA" stroke="currentColor" strokeWidth="3" />
      <line x1="52" y1="55" x2="132" y2="55" stroke="currentColor" strokeWidth="2" opacity="0.4" />
      <line x1="52" y1="70" x2="132" y2="70" stroke="currentColor" strokeWidth="2" opacity="0.4" />
      <line x1="52" y1="85" x2="110" y2="85" stroke="currentColor" strokeWidth="2" opacity="0.4" />
      <line x1="52" y1="100" x2="125" y2="100" stroke="currentColor" strokeWidth="2" opacity="0.4" />

      {/* Front document */}
      <rect x="20" y="40" width="120" height="155" fill="white" stroke="currentColor" strokeWidth="3" />

      {/* Document header bar */}
      <rect x="20" y="40" width="120" height="20" fill="#2ECC40" stroke="currentColor" strokeWidth="3" />

      {/* Text lines on front doc */}
      <line x1="35" y1="80" x2="125" y2="80" stroke="currentColor" strokeWidth="2.5" />
      <line x1="35" y1="95" x2="125" y2="95" stroke="currentColor" strokeWidth="2" opacity="0.6" />
      <line x1="35" y1="110" x2="100" y2="110" stroke="currentColor" strokeWidth="2" opacity="0.6" />
      <line x1="35" y1="125" x2="115" y2="125" stroke="currentColor" strokeWidth="2" opacity="0.4" />
      <line x1="35" y1="140" x2="90" y2="140" stroke="currentColor" strokeWidth="2" opacity="0.4" />

      {/* Approval stamp */}
      <g transform="translate(95, 130) rotate(-15)">
        <rect x="-30" y="-18" width="60" height="36" rx="0" fill="none" stroke="#2ECC40" strokeWidth="3" />
        <text
          x="0"
          y="5"
          textAnchor="middle"
          fill="#2ECC40"
          fontSize="14"
          fontWeight="900"
          fontFamily="var(--font-heading), system-ui"
        >
          PERM
        </text>
      </g>

      {/* Hard shadow */}
      <rect x="24" y="44" width="120" height="155" fill="currentColor" opacity="0.08" transform="translate(4, 4)" />
    </svg>
  );
}
