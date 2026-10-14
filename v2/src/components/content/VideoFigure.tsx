"use client";

/**
 * VideoFigure
 *
 * A short silent recording inside an article: the video equivalent of
 * ScreenshotFigure, with the same frame, caption, credit and click-to-expand.
 *
 * It plays while it's on screen and loops, so it carries its own pause button
 * (WCAG 2.2.2: moving content that runs past five seconds needs a way to stop
 * it). A reader who has asked for reduced motion gets the poster frame and the
 * button, and the video waits for a press.
 */

import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { PauseIcon, PlayIcon } from "@phosphor-icons/react";
import { fadeUp } from "@/lib/content/animations";
import { Lightbox } from "@/components/ui/lightbox";

interface VideoFigureProps {
  /** Video source path (relative to public/) */
  src: string;
  /** What the recording shows, for screen readers */
  alt: string;
  /** Optional caption below the video */
  caption?: string;
  /** Optional step number badge (top-left corner) */
  step?: number;
  /** Optional max width constraint */
  maxWidth?: number;
  /** The first frame, shown before it plays and under reduced motion */
  poster?: string;
  /** Who made the recording, printed after the caption */
  credit?: string;
}

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
}

export default function VideoFigure({ src, alt, caption, step, maxWidth = 800, poster, credit }: VideoFigureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  // Set once the reader presses pause or play; from then on scrolling never
  // overrides their choice.
  const chosen = useRef(false);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (chosen.current || prefersReducedMotion()) continue;
          if (entry.isIntersecting) video.play().catch(() => {});
          else video.pause();
        }
      },
      { threshold: 0.3 },
    );
    observer.observe(video);
    return () => {
      observer.disconnect();
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
    };
  }, []);

  const toggle = () => {
    const video = videoRef.current;
    if (!video) return;
    chosen.current = true;
    if (video.paused) video.play().catch(() => {});
    else video.pause();
  };

  return (
    <motion.figure
      className="not-prose my-8"
      variants={fadeUp}
      initial={false}
      style={{ maxWidth }}
    >
      <div className="relative">
        <Lightbox videoSrc={src} alt={alt} caption={caption}>
          <div className="relative overflow-hidden border border-border">
            {step !== undefined && (
              <div className="absolute left-0 top-0 z-10 flex h-8 w-8 items-center justify-center border-b border-r border-border bg-primary font-mono text-sm font-bold text-black">
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
              preload="metadata"
              className="h-auto w-full"
              aria-label={alt}
            >
              <track kind="captions" />
            </video>
          </div>
        </Lightbox>{" "}
        <button
          type="button"
          onClick={toggle}
          aria-label={playing ? "Pause the recording" : "Play the recording"}
          className="absolute bottom-2 right-2 z-10 flex size-11 items-center justify-center border border-border bg-background text-foreground hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          {playing ? <PauseIcon className="size-5" weight="bold" aria-hidden="true" /> : <PlayIcon className="size-5" weight="bold" aria-hidden="true" />}
        </button>
      </div>

      {caption || credit ? (
        <figcaption className="mt-2 text-sm text-muted-foreground">
          {caption}
          {caption && credit ? " " : null}
          {credit ? <span>{credit}</span> : null}
        </figcaption>
      ) : null}
    </motion.figure>
  );
}
