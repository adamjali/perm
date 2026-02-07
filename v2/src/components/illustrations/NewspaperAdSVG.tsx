/**
 * NewspaperAdSVG - Newspaper with job ad and "HIRING" badge
 * Used in: journey section (Recruitment stage)
 * Style: Neobrutalist - bold strokes, lime green accents, black outlines
 */

interface NewspaperAdSVGProps {
  className?: string;
  size?: number;
}

export function NewspaperAdSVG({ className = "", size = 200 }: NewspaperAdSVGProps) {
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
      {/* Newspaper body */}
      <rect x="20" y="30" width="140" height="155" fill="white" stroke="currentColor" strokeWidth="3" />

      {/* Newspaper header bar */}
      <rect x="20" y="30" width="140" height="28" fill="currentColor" />
      <text
        x="90"
        y="49"
        textAnchor="middle"
        fill="white"
        fontSize="11"
        fontWeight="900"
        fontFamily="var(--font-heading), system-ui"
        letterSpacing="2"
      >
        SUNDAY NEWS
      </text>

      {/* Decorative rule lines under header */}
      <line x1="28" y1="64" x2="152" y2="64" stroke="currentColor" strokeWidth="1" opacity="0.3" />
      <line x1="28" y1="67" x2="152" y2="67" stroke="currentColor" strokeWidth="0.5" opacity="0.2" />

      {/* Job Ad box - highlighted */}
      <rect x="32" y="74" width="116" height="52" fill="#E8FFE8" stroke="#2ECC40" strokeWidth="2.5" />

      {/* Job ad header */}
      <text
        x="90"
        y="90"
        textAnchor="middle"
        fill="currentColor"
        fontSize="10"
        fontWeight="900"
        fontFamily="var(--font-heading), system-ui"
        letterSpacing="1.5"
      >
        HELP WANTED
      </text>

      {/* Job ad text lines */}
      <line x1="42" y1="100" x2="138" y2="100" stroke="currentColor" strokeWidth="1.5" opacity="0.25" />
      <line x1="42" y1="107" x2="128" y2="107" stroke="currentColor" strokeWidth="1.5" opacity="0.25" />
      <line x1="42" y1="114" x2="120" y2="114" stroke="currentColor" strokeWidth="1.5" opacity="0.25" />

      {/* Regular article text lines - left column */}
      <line x1="32" y1="136" x2="85" y2="136" stroke="currentColor" strokeWidth="1.5" opacity="0.15" />
      <line x1="32" y1="142" x2="85" y2="142" stroke="currentColor" strokeWidth="1.5" opacity="0.15" />
      <line x1="32" y1="148" x2="85" y2="148" stroke="currentColor" strokeWidth="1.5" opacity="0.15" />
      <line x1="32" y1="154" x2="80" y2="154" stroke="currentColor" strokeWidth="1.5" opacity="0.15" />
      <line x1="32" y1="160" x2="85" y2="160" stroke="currentColor" strokeWidth="1.5" opacity="0.15" />
      <line x1="32" y1="166" x2="70" y2="166" stroke="currentColor" strokeWidth="1.5" opacity="0.15" />

      {/* Right column text lines */}
      <line x1="95" y1="136" x2="148" y2="136" stroke="currentColor" strokeWidth="1.5" opacity="0.15" />
      <line x1="95" y1="142" x2="148" y2="142" stroke="currentColor" strokeWidth="1.5" opacity="0.15" />
      <line x1="95" y1="148" x2="148" y2="148" stroke="currentColor" strokeWidth="1.5" opacity="0.15" />
      <line x1="95" y1="154" x2="140" y2="154" stroke="currentColor" strokeWidth="1.5" opacity="0.15" />
      <line x1="95" y1="160" x2="148" y2="160" stroke="currentColor" strokeWidth="1.5" opacity="0.15" />
      <line x1="95" y1="166" x2="132" y2="166" stroke="currentColor" strokeWidth="1.5" opacity="0.15" />

      {/* Column divider */}
      <line x1="90" y1="132" x2="90" y2="172" stroke="currentColor" strokeWidth="0.75" opacity="0.15" />

      {/* "NOW HIRING" badge - overlapping top-right corner */}
      <g transform="translate(148, 52)">
        <rect x="-6" y="-14" width="52" height="28" fill="#2ECC40" stroke="currentColor" strokeWidth="3" />
        <text
          x="20"
          y="-3"
          textAnchor="middle"
          fill="black"
          fontSize="7"
          fontWeight="900"
          fontFamily="var(--font-heading), system-ui"
          letterSpacing="0.5"
        >
          NOW
        </text>
        <text
          x="20"
          y="7"
          textAnchor="middle"
          fill="black"
          fontSize="9"
          fontWeight="900"
          fontFamily="var(--font-heading), system-ui"
          letterSpacing="1"
        >
          HIRING
        </text>
      </g>

      {/* Hard shadow */}
      <rect x="24" y="34" width="140" height="155" fill="currentColor" opacity="0.06" transform="translate(4, 4)" />
    </svg>
  );
}
