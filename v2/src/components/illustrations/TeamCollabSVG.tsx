/**
 * TeamCollabSVG - People around table with documents
 * Used in: about/trust section, testimonials, collaboration features
 * Style: Neobrutalist - bold strokes, lime green accents, black outlines
 */

interface TeamCollabSVGProps {
  className?: string;
  size?: number;
}

export function TeamCollabSVG({ className = "", size = 200 }: TeamCollabSVGProps) {
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
      {/* Table */}
      <rect x="30" y="110" width="140" height="12" fill="#8B6914" stroke="currentColor" strokeWidth="3" />
      {/* Table legs */}
      <line x1="40" y1="122" x2="40" y2="170" stroke="currentColor" strokeWidth="3" />
      <line x1="160" y1="122" x2="160" y2="170" stroke="currentColor" strokeWidth="3" />

      {/* Person 1 - left */}
      <g transform="translate(55, 65)">
        <circle cx="0" cy="0" r="15" fill="#0066FF" stroke="currentColor" strokeWidth="3" />
        {/* Face */}
        <circle cx="-4" cy="-3" r="2" fill="white" />
        <circle cx="4" cy="-3" r="2" fill="white" />
        <path d="M-5 4 Q0 8 5 4" fill="none" stroke="white" strokeWidth="1.5" />
        {/* Body */}
        <rect x="-12" y="18" width="24" height="30" fill="#0066FF" stroke="currentColor" strokeWidth="2" />
        {/* Arms */}
        <line x1="12" y1="25" x2="25" y2="40" stroke="currentColor" strokeWidth="3" />
      </g>

      {/* Person 2 - center */}
      <g transform="translate(100, 60)">
        <circle cx="0" cy="0" r="16" fill="#2ECC40" stroke="currentColor" strokeWidth="3" />
        {/* Face */}
        <circle cx="-5" cy="-3" r="2" fill="black" />
        <circle cx="5" cy="-3" r="2" fill="black" />
        <path d="M-5 4 Q0 9 5 4" fill="none" stroke="black" strokeWidth="1.5" />
        {/* Body */}
        <rect x="-14" y="19" width="28" height="32" fill="#2ECC40" stroke="currentColor" strokeWidth="2" />
      </g>

      {/* Person 3 - right */}
      <g transform="translate(145, 65)">
        <circle cx="0" cy="0" r="15" fill="#9333ea" stroke="currentColor" strokeWidth="3" />
        {/* Face */}
        <circle cx="-4" cy="-3" r="2" fill="white" />
        <circle cx="4" cy="-3" r="2" fill="white" />
        <path d="M-5 4 Q0 8 5 4" fill="none" stroke="white" strokeWidth="1.5" />
        {/* Body */}
        <rect x="-12" y="18" width="24" height="30" fill="#9333ea" stroke="currentColor" strokeWidth="2" />
        {/* Arms */}
        <line x1="-12" y1="25" x2="-25" y2="40" stroke="currentColor" strokeWidth="3" />
      </g>

      {/* Documents on table */}
      <rect x="70" y="100" width="25" height="15" fill="white" stroke="currentColor" strokeWidth="2" transform="rotate(-5, 82, 107)" />
      <rect x="100" y="100" width="25" height="15" fill="white" stroke="currentColor" strokeWidth="2" transform="rotate(3, 112, 107)" />

      {/* Pen */}
      <line x1="132" y1="100" x2="140" y2="108" stroke="#DC2626" strokeWidth="3" />

      {/* Speech/collaboration bubbles */}
      <g transform="translate(65, 28)" opacity="0.4">
        <circle cx="0" cy="0" r="4" fill="#2ECC40" />
      </g>
      <g transform="translate(135, 32)" opacity="0.3">
        <circle cx="0" cy="0" r="3" fill="#2ECC40" />
      </g>

      {/* Connection lines (collaboration) */}
      <path d="M68 62 Q100 40 132 62" fill="none" stroke="#2ECC40" strokeWidth="1.5" strokeDasharray="4 3" opacity="0.4" />

      {/* Floor line */}
      <line x1="15" y1="172" x2="185" y2="172" stroke="currentColor" strokeWidth="2" opacity="0.2" />
    </svg>
  );
}
