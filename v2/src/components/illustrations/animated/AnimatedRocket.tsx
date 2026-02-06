"use client";

/**
 * AnimatedRocket - Rocket with flickering exhaust.
 * On hover/trigger, rocket lifts up with spring physics. Exhaust flame pulses.
 * Style: Neobrutalist - bold strokes, lime green nose/fins, red stripes.
 */

import { motion, useReducedMotion } from "motion/react";
import { useState } from "react";

interface AnimatedRocketProps {
  className?: string;
  size?: number;
  animate?: boolean;
}

export function AnimatedRocket({
  className = "",
  size = 200,
  animate: triggerAnimate = false,
}: AnimatedRocketProps) {
  const prefersReducedMotion = useReducedMotion();
  const [hovered, setHovered] = useState(false);

  const isLifted = triggerAnimate || hovered;
  const noMotion = !!prefersReducedMotion;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 200 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Exhaust flame group - flickers */}
      <motion.g
        animate={
          noMotion
            ? { opacity: 1 }
            : {
                opacity: isLifted ? [0.6, 1, 0.7, 1, 0.5] : 0.8,
                y: isLifted ? -8 : 0,
              }
        }
        transition={
          noMotion
            ? { duration: 0 }
            : isLifted
              ? { opacity: { repeat: Infinity, duration: 0.3 }, y: { type: "spring", stiffness: 200, damping: 20 } }
              : { duration: 0.3 }
        }
      >
        {/* Outer flame */}
        <path
          d="M85 145 Q92 175 100 188 Q108 175 115 145"
          fill="#FBBF24"
          stroke="currentColor"
          strokeWidth="2"
        />
        {/* Inner flame */}
        <path
          d="M90 145 Q95 165 100 175 Q105 165 110 145"
          fill="#DC2626"
        />
        {/* Exhaust trails */}
        <path d="M90 160 Q80 180 70 195" fill="none" stroke="#FBBF24" strokeWidth="3" opacity="0.5" />
        <path d="M100 165 Q100 182 100 198" fill="none" stroke="#DC2626" strokeWidth="4" opacity="0.4" />
        <path d="M110 160 Q120 180 130 195" fill="none" stroke="#FBBF24" strokeWidth="3" opacity="0.5" />
      </motion.g>

      {/* Rocket body group - lifts up */}
      <motion.g
        animate={
          noMotion
            ? {}
            : { y: isLifted ? -12 : 0 }
        }
        transition={
          noMotion
            ? { duration: 0 }
            : { type: "spring", stiffness: 200, damping: 15 }
        }
      >
        {/* Rocket body */}
        <path
          d="M80 145 L80 80 Q80 30 100 15 Q120 30 120 80 L120 145 Z"
          fill="white"
          stroke="currentColor"
          strokeWidth="3"
        />

        {/* Nose cone */}
        <path
          d="M80 80 Q80 30 100 15 Q120 30 120 80"
          fill="#2ECC40"
          stroke="currentColor"
          strokeWidth="3"
        />

        {/* Window */}
        <circle cx="100" cy="90" r="12" fill="#0066FF" stroke="currentColor" strokeWidth="3" />
        <circle cx="100" cy="90" r="7" fill="#4D9FFF" />
        <path d="M95 85 Q97 83 100 84" fill="none" stroke="white" strokeWidth="2" opacity="0.6" />

        {/* Stripes */}
        <rect x="80" y="115" width="40" height="6" fill="#DC2626" stroke="currentColor" strokeWidth="1.5" />
        <rect x="80" y="126" width="40" height="6" fill="#DC2626" stroke="currentColor" strokeWidth="1.5" />

        {/* Left fin */}
        <path d="M80 125 L60 150 L80 145 Z" fill="#2ECC40" stroke="currentColor" strokeWidth="3" />

        {/* Right fin */}
        <path d="M120 125 L140 150 L120 145 Z" fill="#2ECC40" stroke="currentColor" strokeWidth="3" />
      </motion.g>

      {/* Speed lines - appear on lift */}
      <motion.g
        animate={noMotion ? { opacity: 0.2 } : { opacity: isLifted ? 0.4 : 0.15 }}
        transition={{ duration: 0.2 }}
      >
        <line x1="50" y1="60" x2="25" y2="67" stroke="currentColor" strokeWidth="2" />
        <line x1="55" y1="80" x2="30" y2="84" stroke="currentColor" strokeWidth="2" />
        <line x1="150" y1="60" x2="175" y2="67" stroke="currentColor" strokeWidth="2" />
        <line x1="145" y1="80" x2="170" y2="84" stroke="currentColor" strokeWidth="2" />
      </motion.g>

      {/* Sparkle */}
      <motion.g
        animate={
          noMotion
            ? { opacity: 0.5 }
            : { opacity: isLifted ? [0.3, 0.8, 0.3] : 0.5, rotate: isLifted ? 45 : 0 }
        }
        transition={
          noMotion
            ? { duration: 0 }
            : { opacity: { repeat: Infinity, duration: 1.2 }, rotate: { duration: 0.4 } }
        }
        style={{ originX: "40px", originY: "40px" }}
      >
        <path
          d="M40 32 L42 38 L48 40 L42 42 L40 48 L38 42 L32 40 L38 38 Z"
          fill="#2ECC40"
        />
      </motion.g>
    </svg>
  );
}
