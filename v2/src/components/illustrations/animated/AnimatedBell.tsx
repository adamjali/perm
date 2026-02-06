"use client";

/**
 * AnimatedBell - Bell that rocks side-to-side when triggered.
 * Sound wave arcs expand outward. Notification dot bounces in.
 * Style: Neobrutalist - bold strokes, yellow bell, lime green waves.
 */

import { motion, useReducedMotion, useAnimation } from "motion/react";
import { useEffect } from "react";

interface AnimatedBellProps {
  className?: string;
  size?: number;
  animate?: boolean;
}

export function AnimatedBell({
  className = "",
  size = 200,
  animate: triggerAnimate = false,
}: AnimatedBellProps) {
  const prefersReducedMotion = useReducedMotion();
  const bellControls = useAnimation();
  const waveControls = useAnimation();
  const dotControls = useAnimation();

  useEffect(() => {
    if (!triggerAnimate) return;
    if (prefersReducedMotion) return;

    const sequence = async () => {
      await bellControls.start({
        rotate: [0, 12, -10, 8, -6, 3, 0],
        transition: { duration: 0.8, ease: "easeInOut" },
      });
      waveControls.start({
        opacity: [0, 0.7, 0],
        scale: [0.8, 1.2],
        transition: { duration: 0.6 },
      });
      dotControls.start({
        scale: [0, 1.3, 1],
        transition: { type: "spring", stiffness: 400, damping: 12 },
      });
    };

    sequence();
  }, [triggerAnimate, prefersReducedMotion, bellControls, waveControls, dotControls]);

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 200 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {/* Hard shadow */}
      <path
        d="M64 104 Q64 54 104 44 Q144 54 144 104 L149 134 L59 134 Z"
        fill="currentColor"
        opacity="0.06"
      />

      {/* Bell group - rocks from top pivot */}
      <motion.g
        animate={bellControls}
        style={{ originX: "100px", originY: "38px" }}
      >
        {/* Bell body */}
        <path
          d="M60 100 Q60 50 100 40 Q140 50 140 100 L145 130 L55 130 Z"
          fill="#FBBF24"
          stroke="currentColor"
          strokeWidth="3"
        />

        {/* Bell rim */}
        <rect
          x="45"
          y="128"
          width="110"
          height="14"
          fill="#FBBF24"
          stroke="currentColor"
          strokeWidth="3"
        />

        {/* Bell clapper */}
        <circle cx="100" cy="150" r="8" fill="currentColor" />

        {/* Bell top knob */}
        <circle cx="100" cy="38" r="6" fill="currentColor" />

        {/* Handle arc */}
        <path
          d="M88 38 Q88 25 100 25 Q112 25 112 38"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
        />
      </motion.g>

      {/* Left sound wave arcs */}
      <motion.path
        d="M45 85 Q30 95 45 110"
        fill="none"
        stroke="#2ECC40"
        strokeWidth="3"
        strokeLinecap="square"
        initial={{ opacity: triggerAnimate ? 0 : 0.7 }}
        animate={waveControls}
      />
      <motion.path
        d="M35 75 Q15 95 35 120"
        fill="none"
        stroke="#2ECC40"
        strokeWidth="2"
        strokeLinecap="square"
        initial={{ opacity: triggerAnimate ? 0 : 0.4 }}
        animate={waveControls}
      />

      {/* Right sound wave arcs */}
      <motion.path
        d="M155 85 Q170 95 155 110"
        fill="none"
        stroke="#2ECC40"
        strokeWidth="3"
        strokeLinecap="square"
        initial={{ opacity: triggerAnimate ? 0 : 0.7 }}
        animate={waveControls}
      />
      <motion.path
        d="M165 75 Q185 95 165 120"
        fill="none"
        stroke="#2ECC40"
        strokeWidth="2"
        strokeLinecap="square"
        initial={{ opacity: triggerAnimate ? 0 : 0.4 }}
        animate={waveControls}
      />

      {/* Notification dot */}
      <motion.g
        initial={
          prefersReducedMotion
            ? { scale: 1 }
            : { scale: triggerAnimate ? 0 : 1 }
        }
        animate={dotControls}
      >
        <circle
          cx="135"
          cy="50"
          r="12"
          fill="#DC2626"
          stroke="currentColor"
          strokeWidth="2"
        />
        <text
          x="135"
          y="55"
          textAnchor="middle"
          fill="white"
          fontSize="12"
          fontWeight="900"
          fontFamily="var(--font-heading), system-ui"
        >
          !
        </text>
      </motion.g>
    </svg>
  );
}
