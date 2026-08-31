import Image from "next/image";

/**
 * A framed screenshot of the actual product.
 *
 * WHY A PHOTOGRAPH OF THE THING AND NOT A DIAGRAM. The sign-up and sign-in
 * pages each carried a hand-drawn SVG of a filing window - geometrically
 * correct, on-palette, and completely inert. Adam: "need... an actual media use
 * jina or something, like whats there rn is SO lazy and low effort and ai
 * slop." He is right, and the reason is not that the drawing was ugly. A
 * schematic ILLUSTRATES a claim the copy has already made. A screenshot of the
 * running app is EVIDENCE for it, and on the one page whose whole job is "here
 * is what an account gets you", evidence is the entire argument.
 *
 * NO STOCK PHOTOGRAPHY, and that is the same decision rather than a different
 * one. The house rule ranks a real photograph above a diagram, and the primary
 * source here is our own product - not a person at a laptop, which is the
 * actual slop this was in danger of becoming. `public/images/screenshots/`
 * already held these; nothing needed sourcing.
 *
 * THE CAPTION SAYS IT IS A DEMO ACCOUNT. Every one of these shots is the seeded
 * demo tenant - "Demo User", Acme Inc, Dario's Gelato - so the employers and
 * dates in them are invented. Showing invented data without saying so is the
 * kind of small dishonesty that costs more than it buys, and the caption is one
 * clause.
 *
 * `sizes` matters here: the frame is a 26rem-ish column on a laptop and full
 * width on a phone, so without it Next serves the 1200px asset to a 390px
 * screen. Both source files are the `-small` variants for the same reason - the
 * 2586px originals are 512KB and this is a decorative panel beside a form.
 */
export function ProductShot({
  src,
  alt,
  caption,
  width,
  height,
  priority = false,
  tone = "light",
}: {
  src: string;
  alt: string;
  caption: string;
  width: number;
  height: number;
  priority?: boolean;
  /**
   * `dark` when the shot sits on an ink band. A component that carries its own
   * background has to set every colour it overrides, and the frame's border and
   * the caption are both `--border`/`--muted-foreground` - tokens that assume
   * the page ground. On `bg-foreground` they land near-black on near-black.
   * This is the house rule that has produced five invisible-text bugs in one
   * session before now, so the tone is a parameter rather than an assumption.
   */
  tone?: "light" | "dark";
}) {
  const dark = tone === "dark";
  return (
    <figure>
      {/* The frame is the site's own card treatment rather than a browser
          chrome mock: this is a panel on our page, not a picture of a browser,
          and drawing a fake title bar around a real screenshot is the sort of
          decoration that makes a true thing look staged. */}
      <div
        className={
          dark
            ? "overflow-hidden border-2 border-current/40 bg-card"
            : "overflow-hidden border-2 border-border bg-card shadow-hard-sm"
        }
      >
        <Image
          src={src}
          alt={alt}
          width={width}
          height={height}
          sizes="(min-width: 1024px) 32rem, 100vw"
          className="h-auto w-full"
          priority={priority}
        />
      </div>{" "}
      <figcaption
        className={
          dark
            ? "mt-3 font-mono text-xs font-bold uppercase tracking-wider opacity-60"
            : "mt-3 border-t-2 border-border pt-3 font-mono text-xs font-bold uppercase tracking-wider text-muted-foreground"
        }
      >
        {caption}
      </figcaption>
    </figure>
  );
}
