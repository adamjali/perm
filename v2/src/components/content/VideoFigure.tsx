"use client";

/**
 * VideoFigure
 *
 * Neobrutalist-styled video display for MDX articles.
 * The video equivalent of ScreenshotFigure, same animation,
 * step badges, captions, and Lightbox click-to-expand.
 * IntersectionObserver controls autoplay (play when visible, pause when not).
 */

import { useEffect, useRef } from "react";
import { motion } from "motion/react";
import { fadeUp } from "@/lib/content/animations";
import { Lightbox } from "@/components/ui/lightbox";

interface VideoFigureProps {
  /** Video source path (relative to public/) */
  src: string;
  /** Alt text for accessibility */
  alt: string;
  /** Optional caption below the video */
  caption?: string;
  /** Optional step number badge (top-left corner) */
  step?: number;
  /** Optional max width constraint */
  maxWidth?: number;
  /** Optional poster image URL (thumbnail before play) */
  poster?: string;
}

export default function VideoFigure({
  src,
  alt,
  caption,
  step,
  maxWidth = 800,
  poster,
}: VideoFigureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            video.play().catch(() => {});
          } else {
            video.pause();
          }
        });
      },
      { threshold: 0.3 },
    );

    observer.observe(video);

    return () => {
      observer.unobserve(video);
    };
  }, []);

  return (
    <motion.figure
      className="not-prose my-8"
      variants={fadeUp}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-40px" }}
      style={{ maxWidth }}
    >
      <Lightbox videoSrc={src} alt={alt} caption={caption}>
        <div className="relative border-2 border-border shadow-hard overflow-hidden">
          {step !== undefined && (
            <div className="absolute left-0 top-0 z-10 flex h-8 w-8 items-center justify-center border-b-2 border-r-2 border-border bg-primary font-mono text-sm font-bold text-black">
              {step}
            </div>
          )}

          <video
            ref={videoRef}
            src={src}
            poster={poster}
            muted
            playsInline
            loop
            className="w-full h-auto"
            aria-label={alt}
          >
            <track kind="captions" />
          </video>
        </div>
      </Lightbox>

      {caption && (
        <figcaption className="mt-2 font-mono text-xs text-muted-foreground">
          {caption}
        </figcaption>
      )}
    </motion.figure>
  );
}
