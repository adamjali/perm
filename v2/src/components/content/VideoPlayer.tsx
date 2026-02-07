"use client";

/**
 * VideoPlayer
 *
 * Lazy-loaded Remotion Player wrapper for embedding videos in content pages.
 * Uses next/dynamic to avoid SSR issues with Remotion's browser-only APIs.
 */

import dynamic from "next/dynamic";

type VideoId = "ProductDemo" | "PERMExplainer";

interface VideoPlayerProps {
  videoId: VideoId;
  className?: string;
  autoPlay?: boolean;
  loop?: boolean;
}

const VIDEO_CONFIG: Record<
  VideoId,
  { durationInFrames: number; fps: number; width: number; height: number }
> = {
  ProductDemo: { durationInFrames: 450, fps: 30, width: 1920, height: 1080 },
  PERMExplainer: { durationInFrames: 600, fps: 30, width: 1920, height: 1080 },
};

/**
 * Dynamically loaded inner player (no SSR).
 * Isolated so @remotion/player is never imported server-side.
 */
const DynamicPlayer = dynamic(() => import("./VideoPlayerInner"), {
  ssr: false,
  loading: () => (
    <div className="flex aspect-video items-center justify-center bg-muted">
      <div className="flex flex-col items-center gap-3">
        <div className="h-12 w-12 animate-pulse border-2 border-border bg-primary" />
        <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
          Loading video...
        </span>
      </div>
    </div>
  ),
});

export default function VideoPlayer({
  videoId,
  className = "",
  autoPlay = false,
  loop = false,
}: VideoPlayerProps) {
  const config = VIDEO_CONFIG[videoId];

  return (
    <div
      className={`relative overflow-hidden border-2 border-border bg-card shadow-hard ${className}`}
    >
      <DynamicPlayer videoId={videoId} config={config} autoPlay={autoPlay} loop={loop} />
    </div>
  );
}
