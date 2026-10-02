"use client";

import Image from "next/image";
import { useState } from "react";

/**
 * The film's thumbnail as a play button; the browser's own player only once
 * pressed. The thumbnail carries the title and running time, and the native
 * control bar would sit over its bottom edge, so it stays hidden until the
 * film plays. Nothing of the film downloads before then.
 */
export function FilmPlayer({
  src,
  poster,
  title,
  duration,
}: {
  src: string;
  poster: string;
  title: string;
  /** Seconds. */
  duration: number;
}) {
  const [playing, setPlaying] = useState(false);
  const time = `${Math.floor(duration / 60)}:${String(duration % 60).padStart(2, "0")}`;

  if (playing) {
    return (
      <video
        controls
        autoPlay
        playsInline
        poster={poster}
        width={1280}
        height={720}
        className="block aspect-video h-auto w-full"
        aria-label={title}
      >
        <source src={src} type="video/mp4" />
      </video>
    );
  }

  // The play button is drawn into the thumbnail itself (bottom left, clear
  // of the screenshot), so the whole image is the button and nothing is laid
  // over it.
  return (
    <button
      type="button"
      onClick={() => setPlaying(true)}
      aria-label={`Play the film: ${title}, ${time}`}
      className="block w-full transition-[filter] duration-150 hover:brightness-[1.04] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring"
    >
      <Image src={poster} alt="" width={1280} height={720} unoptimized loading="lazy" className="block aspect-video h-auto w-full" />
    </button>
  );
}
