"use client";

/**
 * LottieAnimation Component
 *
 * Lazy-loaded wrapper around lottie-react.
 * Respects reduced motion (shows static first frame).
 */

import * as React from "react";
import dynamic from "next/dynamic";
import { useReducedMotion } from "@/lib/animations";

const Lottie = dynamic(() => import("lottie-react"), { ssr: false });

interface LottieAnimationProps {
  /** Path to the Lottie JSON file in /public */
  src: string;
  /** CSS class for the container */
  className?: string;
  /** Whether to loop the animation (default: true) */
  loop?: boolean;
  /** Whether to autoplay (default: true) */
  autoplay?: boolean;
}

export function LottieAnimation({
  src,
  className = "",
  loop = true,
  autoplay = true,
}: LottieAnimationProps) {
  const reducedMotion = useReducedMotion();
  const [animationData, setAnimationData] = React.useState<unknown>(null);

  React.useEffect(() => {
    fetch(src)
      .then((res) => res.json())
      .then(setAnimationData)
      .catch(console.error);
  }, [src]);

  if (!animationData) {
    return <div className={`${className} animate-pulse bg-muted`} />;
  }

  return (
    <Lottie
      animationData={animationData}
      loop={reducedMotion ? false : loop}
      autoplay={reducedMotion ? false : autoplay}
      className={className}
    />
  );
}
