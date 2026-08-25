/**
 * Hard geometric seam between full-bleed bands.
 *
 * Divider doctrine, applied: only on seams with real contrast (a shape on a
 * light-to-light join reads as a rendering fault), decisive amplitude (a
 * shallow slope reads as a splinter), and the fill is the ARRIVING band's
 * colour so the shape reads as that band cutting upward.
 */

const PATHS = {
  step: "M0,64 L0,40 L360,40 L360,12 L860,12 L860,44 L1440,44 L1440,64 Z",
  slant: "M0,64 L1440,6 L1440,64 Z",
  // The queue tape's own silhouette: regular notches, one flag riser.
  tape: "M0,64 L0,36 L120,36 L120,22 L240,22 L240,36 L360,36 L360,22 L480,22 L480,36 L600,36 L600,8 L640,8 L640,36 L760,36 L760,22 L880,22 L880,36 L1000,36 L1000,22 L1120,22 L1120,36 L1240,36 L1240,22 L1360,22 L1360,36 L1440,36 L1440,64 Z",
  // A survey-sheet ledger: long low shelf with one raised plateau.
  ledger: "M0,64 L0,46 L900,46 L900,20 L1200,20 L1200,46 L1440,46 L1440,64 Z",
} as const;

export function SectionDivider({
  kind = "step",
  fill,
  className,
}: {
  kind?: keyof typeof PATHS;
  /** CSS colour of the band BELOW the seam. */
  fill: string;
  className?: string;
}) {
  return (
    <div className={className} aria-hidden="true" style={{ lineHeight: 0 }}>
      <svg
        viewBox="0 0 1440 64"
        preserveAspectRatio="none"
        className="block h-10 w-full sm:h-14"
      >
        <path d={PATHS[kind]} fill={fill} />
      </svg>
    </div>
  );
}
