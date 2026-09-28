/**
 * A labor certification form with the CERTIFIED stamp on it: the outcome the
 * whole PERM path works toward, drawn in the app's own material (paper, 2px
 * ink, a hard offset shadow, the lime ink for the stamp). Colours come from
 * the theme tokens, so it reads in both modes.
 */
import { cn } from "@/lib/utils";

interface CertifiedFormArtProps {
  className?: string;
}

export function CertifiedFormArt({ className }: CertifiedFormArtProps) {
  return (
    <svg
      viewBox="0 0 240 180"
      role="img"
      aria-label="A labor certification form stamped certified"
      className={cn("h-auto w-56", className)}
    >
      {/* Hard shadow, then the sheet */}
      <rect x="38" y="16" width="156" height="156" className="fill-foreground dark:fill-foreground/15" />
      <rect x="30" y="8" width="156" height="156" className="fill-card stroke-foreground" strokeWidth="2" />

      {/* Form header band */}
      <rect x="30" y="8" width="156" height="26" className="fill-foreground" />
      <text x="42" y="26" className="fill-background" style={{ font: "700 12px var(--font-mono)" }}>
        ETA-9089
      </text>
      <rect x="150" y="16" width="26" height="10" className="fill-background" />

      {/* Fields */}
      {[50, 70, 90].map((y) => (
        <g key={y}>
          <rect x="42" y={y} width="40" height="6" className="fill-muted-foreground/60" />
          <rect x="88" y={y - 2} width="86" height="10" className="fill-none stroke-foreground" strokeWidth="1.5" />
        </g>
      ))}
      <rect x="42" y="112" width="132" height="4" className="fill-muted-foreground/40" />
      <rect x="42" y="122" width="96" height="4" className="fill-muted-foreground/40" />
      {/* Signature line */}
      <path d="M42 150 C 56 140, 64 156, 78 146 S 96 142, 104 150" className="fill-none stroke-foreground" strokeWidth="2" strokeLinecap="square" />
      <rect x="42" y="152" width="70" height="2" className="fill-foreground" />

      {/* The stamp */}
      <g transform="rotate(-9 168 118)">
        <rect x="112" y="92" width="112" height="50" className="fill-background stroke-primary-text" strokeWidth="3" />
        <rect x="117" y="97" width="102" height="40" className="fill-primary/15 stroke-primary-text" strokeWidth="1.5" />
        <text x="168" y="119" textAnchor="middle" className="fill-primary-text" style={{ font: "800 15px var(--font-heading)", letterSpacing: "0.06em" }}>
          CERTIFIED
        </text>
        <text x="168" y="132" textAnchor="middle" className="fill-primary-text" style={{ font: "700 9px var(--font-mono)" }}>
          PERM
        </text>
      </g>
    </svg>
  );
}
