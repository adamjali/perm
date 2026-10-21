"use client";

/**
 * ScreenshotFigure
 *
 * A picture inside an article (a capture of the site, a page of a form, a
 * photograph) with an optional step number, caption and credit. A click
 * opens it full size.
 */

import Image from "next/image";
import { Lightbox } from "@/components/ui/lightbox";

interface ScreenshotFigureProps {
  /** Image source path (relative to public/) */
  src: string;
  /** Alt text for accessibility */
  alt: string;
  /** Optional caption below the image */
  caption?: string;
  /** Optional step number badge (top-left corner) */
  step?: number;
  /** Optional max width constraint */
  maxWidth?: number;
  /** Aspect ratio (width/height). Defaults to 16/9. */
  aspectRatio?: number;
  /** Who made the picture, printed after the caption ("Photo: Harris & Ewing, Library of Congress") */
  credit?: string;
  /** Where the picture comes from; the credit links to it */
  creditHref?: string;
}

export default function ScreenshotFigure({
  src,
  alt,
  caption,
  step,
  maxWidth = 800,
  aspectRatio = 16 / 9,
  credit,
  creditHref,
}: ScreenshotFigureProps) {
  return (
    <figure className="not-prose my-8" style={{ maxWidth }}>
      <Lightbox src={src} alt={alt} caption={caption}>
        <div className="relative border-border overflow-hidden border">
          {/* Step badge */}
          {step !== undefined && (
            <div className="absolute left-0 top-0 z-10 flex h-8 w-8 items-center justify-center border-b-2 border-r-2 border-border bg-primary font-mono text-sm font-bold text-black">
              {step}
            </div>
          )}

          <Image
            src={src}
            alt={alt}
            width={maxWidth}
            height={Math.round(maxWidth / aspectRatio)}
            className="w-full h-auto"
            sizes="(max-width: 768px) 100vw, 800px"
          />
        </div>
      </Lightbox>

      {caption || credit ? (
        <figcaption className="mt-2 text-sm text-muted-foreground">
          {caption}
          {caption && credit ? " " : null}
          {credit ? (
            // The credit on its own line, so it never reads as the caption's last sentence.
            creditHref ? (
              <a href={creditHref} rel="noopener" target="_blank" className="link flex w-fit min-h-11 items-center">
                {credit}
              </a>
            ) : (
              <span className="block">{credit}</span>
            )
          ) : null}
        </figcaption>
      ) : null}
    </figure>
  );
}
