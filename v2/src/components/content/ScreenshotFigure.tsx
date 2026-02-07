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
}

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.4, 0, 0.2, 1] as const },
  },
};

export default function ScreenshotFigure({
  src,
  alt,
  caption,
  step,
  maxWidth = 800,
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
          height={Math.round(maxWidth * 0.5625)}
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
