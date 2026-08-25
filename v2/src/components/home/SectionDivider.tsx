/**
 * Hard geometric seam between full-bleed bands.
 *
 * DIVIDER DOCTRINE, and the measurement that changed it. The rule has always
 * been "only on a seam with real contrast, because a shape on a light-to-light
 * join reads as a rendering fault". Measured on 2026-08-25, the home page was
 * failing its own rule in the other direction: `--muted` against
 * `--background` is #F5F5F5 on #FAFAFA, a contrast ratio of **1.04:1** in
 * light and 1.14:1 in dark. Two of the three dividers on the page were not
 * subtle, they were invisible, and adding more silhouettes at the same fill
 * would only have added more invisible SVG.
 *
 * THE FIX IS AN EDGE, NOT A FILL. Every other layer in this system is defined
 * by a hard border rather than by its background, so a divider is too: the
 * silhouette is stroked in `--border` and the fill merely tints whatever the
 * arriving band is. That makes all variants legible at any fill contrast, in
 * both themes, and it puts dividers in the same visual language as the cards
 * and plates around them.
 *
 * `vector-effect="non-scaling-stroke"` is load-bearing. The viewBox is
 * stretched with `preserveAspectRatio="none"`, so at a 390px viewport the x
 * scale is 0.27 and the y scale is 0.875; without it a vertical riser would
 * stroke at 0.8px while a horizontal shelf stroked at 2.6px, and the seam
 * would look broken rather than drawn.
 *
 * Each silhouette encodes something about the bands it joins. A shape that
 * encodes nothing is decoration and does not belong here.
 */

/**
 * Open top silhouettes, left edge to right edge. The filled shape is derived
 * by closing each one down to the bottom of the viewBox, so the outline and
 * the fill can never drift apart.
 */
const EDGES = {
  /** A shelf that steps up and back down. Generic seam, no claim. */
  step: "M0,40 L360,40 L360,12 L860,12 L860,44 L1440,44",
  /** One long diagonal. A hand-off, not a measurement. */
  slant: "M0,64 L1440,6",
  /** The queue tape's own silhouette: regular notches, one flag riser. */
  tape: "M0,36 L120,36 L120,22 L240,22 L240,36 L360,36 L360,22 L480,22 L480,36 L600,36 L600,8 L640,8 L640,36 L760,36 L760,22 L880,22 L880,36 L1000,36 L1000,22 L1120,22 L1120,36 L1240,36 L1240,22 L1360,22 L1360,36 L1440,36",
  /** A survey-sheet ledger: long low shelf with one raised plateau. */
  ledger: "M0,46 L900,46 L900,20 L1200,20 L1200,46 L1440,46",
  /**
   * Even graduations, major and minor, like the edge of a rule. Belongs on a
   * seam where the page moves into something that measures: the calculators,
   * the tape, the wait ledger.
   */
  comb: "M0,44 L60,44 L60,18 L100,18 L100,44 L220,44 L220,28 L260,28 L260,44 L380,44 L380,28 L420,28 L420,44 L540,44 L540,18 L580,18 L580,44 L700,44 L700,28 L740,28 L740,44 L860,44 L860,28 L900,28 L900,44 L1020,44 L1020,18 L1060,18 L1060,44 L1180,44 L1180,28 L1220,28 L1220,44 L1340,44 L1340,28 L1380,28 L1380,44 L1440,44",
  /**
   * One deep cut in an otherwise flat shelf. A cutoff: the band below is
   * where something is lost if a date is missed.
   */
  notch: "M0,20 L640,20 L720,58 L800,20 L1440,20",
} as const;

export type SectionDividerKind = keyof typeof EDGES;

/** Closes an open top edge into a filled band down to the viewBox floor. */
export function fillPath(edge: string): string {
  return `${edge} L1440,64 L0,64 Z`;
}

export function SectionDivider({
  kind = "step",
  fill,
  className,
}: {
  kind?: SectionDividerKind;
  /** CSS colour of the band BELOW the seam. */
  fill: string;
  className?: string;
}) {
  const edge = EDGES[kind];
  return (
    <div className={className} aria-hidden="true" style={{ lineHeight: 0 }}>
      <svg
        viewBox="0 0 1440 64"
        preserveAspectRatio="none"
        className="block h-10 w-full sm:h-14"
      >
        <path d={fillPath(edge)} fill={fill} />
        <path
          d={edge}
          fill="none"
          stroke="var(--border)"
          strokeWidth={3}
          strokeLinejoin="miter"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </div>
  );
}
