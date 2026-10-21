import { SPOT_PICTURES, type SpotPictureName } from "@/lib/spotPictures";
import { cn } from "@/lib/utils";

/**
 * One of the site's still isometric pictures (scripts/spot-pictures/build.mjs), as image files:
 * an <img> SVG can't see the site's `.dark` class, so a picture drawn for both themes ships two
 * files, and the one for the other theme is `display: none`. Both load lazily, and a lazy image
 * with no box is never fetched, so a visitor downloads one of the two. A picture that sits on a
 * band dark in both themes ships the dark file alone.
 *
 * `alt` is required so every use decides: "" for a picture beside a heading or a sentence that
 * already says everything it shows (it's then hidden from screen readers), or a sentence saying
 * what's drawn. `className` sizes the wrapper; the image fills its width.
 */
export function SpotPicture({ name, alt, className }: { name: SpotPictureName; alt: string; className?: string }) {
  const p = SPOT_PICTURES[name];
  const decorative = alt === "";
  const img = { width: p.width, height: p.height, alt, loading: "lazy" as const, decoding: "async" as const, draggable: false };
  return (
    <span className={cn("block", className)} aria-hidden={decorative ? true : undefined} data-spot={name}>
      {"light" in p ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element -- a static SVG drawn for this site */}
          <img src={p.light} className="block h-auto w-full dark:hidden" {...img} />
          {/* eslint-disable-next-line @next/next/no-img-element -- a static SVG drawn for this site */}
          <img src={p.dark} className="hidden h-auto w-full dark:block" {...img} />
        </>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element -- a static SVG drawn for this site
        <img src={p.dark} className="block h-auto w-full" {...img} />
      )}
    </span>
  );
}
