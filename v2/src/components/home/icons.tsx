/**
 * Phosphor icons, inlined.
 *
 * `@phosphor-icons/react` is NOT a dependency of this project and package.json
 * is owned by other work in flight, so the sanctioned alternative is used:
 * the real path data, copied verbatim from Phosphor's own source files.
 *
 * PROVENANCE. Every path below was fetched from the upstream repository on
 * 2026-08-25 and pasted unaltered:
 *
 *   https://raw.githubusercontent.com/phosphor-icons/core/main/assets/regular/arrow-right.svg
 *   https://raw.githubusercontent.com/phosphor-icons/core/main/assets/regular/arrow-up-right.svg
 *
 * Nothing here is drawn, traced, approximated or transformed. If a glyph is
 * needed that is not in this file, fetch it from that same directory rather
 * than reaching for a shape that looks close enough: a hand-drawn phone
 * handset once shipped in this fleet under a docstring promising Phosphor.
 *
 * Phosphor "regular" is a 16-unit stroke already converted to outlines on a
 * 256 viewBox, so these render with `fill="currentColor"` and NO stroke. That
 * is not a mismatch with stroke-drawn icons elsewhere; it is how the family
 * ships. Size comes from the caller's font-size via `1em`, which keeps a
 * glyph optically matched to the text it sits beside.
 */

type IconProps = {
  className?: string;
  /** Decorative by default. Pass a label only when the icon is the sole content. */
  title?: string;
};

function Glyph({ d, className, title }: IconProps & { d: string }) {
  return (
    <svg
      viewBox="0 0 256 256"
      width="1em"
      height="1em"
      fill="currentColor"
      stroke="none"
      className={className}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      focusable="false"
    >
      {title ? <title>{title}</title> : null}
      <path d={d} />
    </svg>
  );
}

const ARROW_RIGHT =
  "M221.66,133.66l-72,72a8,8,0,0,1-11.32-11.32L196.69,136H40a8,8,0,0,1,0-16H196.69L138.34,61.66a8,8,0,0,1,11.32-11.32l72,72A8,8,0,0,1,221.66,133.66Z";

const ARROW_UP_RIGHT =
  "M200,64V168a8,8,0,0,1-16,0V83.31L69.66,197.66a8,8,0,0,1-11.32-11.32L172.69,72H88a8,8,0,0,1,0-16H192A8,8,0,0,1,200,64Z";

export function ArrowRight(props: IconProps) {
  return <Glyph d={ARROW_RIGHT} {...props} />;
}

export function ArrowUpRight(props: IconProps) {
  return <Glyph d={ARROW_UP_RIGHT} {...props} />;
}
