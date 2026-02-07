"use client";

/**
 * VideoPlayerInner
 *
 * The actual Remotion Player instance. Only loaded client-side
 * via next/dynamic from VideoPlayer.tsx (ssr: false).
 */

import { Player } from "@remotion/player";
import { ProductDemo } from "@/remotion/compositions/ProductDemo";
import { PERMExplainer } from "@/remotion/compositions/PERMExplainer";

type VideoId = "ProductDemo" | "PERMExplainer";

interface VideoPlayerInnerProps {
  videoId: VideoId;
  config: {
    durationInFrames: number;
    fps: number;
    width: number;
    height: number;
  };
  autoPlay?: boolean;
  loop?: boolean;
}

const COMPONENTS: Record<VideoId, React.FC<{ brandColor: string }>> = {
  ProductDemo,
  PERMExplainer,
};

export default function VideoPlayerInner({
  videoId,
  config,
  autoPlay = false,
  loop = false,
}: VideoPlayerInnerProps) {
  const Component = COMPONENTS[videoId];

  return (
    <div className="aspect-video">
      <Player
        component={Component}
        inputProps={{ brandColor: "#2ECC40" }}
        durationInFrames={config.durationInFrames}
        fps={config.fps}
        compositionWidth={config.width}
        compositionHeight={config.height}
        style={{ width: "100%", height: "100%" }}
        controls
        autoPlay={autoPlay}
        loop={loop}
      />
    </div>
  );
}
