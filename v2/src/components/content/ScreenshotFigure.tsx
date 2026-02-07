"use client";

/**
 * ScreenshotFigure
 *
 * Neobrutalist-styled screenshot display for MDX articles.
 * Shows app screenshots with optional step badges and captions.
 * Framer Motion whileInView fade-up entrance animation.
 */

import Image from "next/image";
import { motion } from "framer-motion";
import { fadeUp } from "@/lib/content/animations";

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
}

export default function ScreenshotFigure({
  src,
  alt,
  caption,
  step,
  maxWidth = 800,
  aspectRatio = 16 / 9,
}: ScreenshotFigureProps) {
  return (
    <motion.figure
      className="not-prose my-8"
      variants={fadeUp}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-40px" }}
      style={{ maxWidth }}
    >
      <div className="relative border-2 border-border shadow-hard overflow-hidden">
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

      {caption && (
        <figcaption className="mt-2 font-mono text-xs text-muted-foreground">
          {caption}
        </figcaption>
      )}
    </motion.figure>
  );
}
