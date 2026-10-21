"use client";

/**
 * VideoFigure
 *
 * A short silent recording inside an article: the video equivalent of
 * ScreenshotFigure, with the same frame, caption, credit and click-to-expand.
 *
 * It waits on its poster until the reader presses play, then loops, and
 * the same button pauses it (WCAG 2.2.2). Nothing on the page starts moving
 * by itself. The button sits bottom-left: on a phone the page's own back-to-top
 * button is fixed to the bottom-right corner and sat on top of it.
 */

import { useEffect, useRef, useState } from "react";
import { PauseIcon, PlayIcon } from "@phosphor-icons/react";
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
  /** The first frame, shown until the reader presses play */
  poster?: string;
  /** Who made the recording, printed after the caption */
  credit?: string;
}

export default function VideoFigure({ src, alt, caption, step, maxWidth = 800, poster, credit }: VideoFigureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    return () => {
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
    };
  }, []);

  const toggle = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) video.play().catch(() => {});
    else video.pause();
  };

  return (
    <figure className="not-prose my-8" style={{ maxWidth }}>
      <div className="relative">
        <Lightbox videoSrc={src} alt={alt} caption={caption}>
          <div className="relative overflow-hidden border-border border">
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
          className="absolute bottom-2 left-2 z-10 flex size-11 items-center justify-center border-input bg-card text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring border"
        >
          {playing ? <PauseIcon className="size-5" weight="bold" aria-hidden="true" /> : <PlayIcon className="size-5" weight="bold" aria-hidden="true" />}
        </button>
      </div>

      {caption || credit ? (
        <figcaption className="mt-2 text-sm text-muted-foreground">
          {caption}
          {caption && credit ? " " : null}
          {credit ? <span className="block">{credit}</span> : null}
        </figcaption>
      ) : null}
    </figure>
  );
}
