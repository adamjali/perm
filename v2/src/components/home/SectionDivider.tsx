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
