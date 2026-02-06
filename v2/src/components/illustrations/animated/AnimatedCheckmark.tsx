"use client";

/**
 * AnimatedCheckmark - SVG checkmark that draws on with spring animation.
 * Green circle bg pops in, then checkmark path draws via strokeDashoffset.
 * Style: Neobrutalist - bold strokes, lime green #2ECC40, hard shadow.
 */

import { motion, useReducedMotion } from "motion/react";

interface AnimatedCheckmarkProps {
  className?: string;
  size?: number;
}

export function AnimatedCheckmark({
  className = "",
  size = 200,
}: AnimatedCheckmarkProps) {
  const prefersReducedMotion = useReducedMotion();

  const checkmarkLength = 85;

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
      <motion.circle
        cx="104"
        cy="104"
        r="70"
        fill="currentColor"
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 0.06 }}
        transition={
          prefersReducedMotion
            ? { duration: 0 }
            : { type: "spring", stiffness: 260, damping: 20, delay: 0.05 }
        }
      />

      {/* Green circle background */}
      <motion.circle
        cx="100"
        cy="100"
        r="70"
        fill="#2ECC40"
        stroke="currentColor"
        strokeWidth="3"
        initial={prefersReducedMotion ? { scale: 1 } : { scale: 0 }}
        animate={{ scale: 1 }}
        transition={
          prefersReducedMotion
            ? { duration: 0 }
            : { type: "spring", stiffness: 260, damping: 20 }
        }
      />

      {/* Inner ring accent */}
      <motion.circle
        cx="100"
        cy="100"
        r="60"
        fill="none"
        stroke="white"
        strokeWidth="2"
        opacity="0.2"
        initial={prefersReducedMotion ? { scale: 1 } : { scale: 0 }}
        animate={{ scale: 1 }}
        transition={
          prefersReducedMotion
            ? { duration: 0 }
            : { type: "spring", stiffness: 260, damping: 20, delay: 0.1 }
        }
      />

      {/* Checkmark path - draws on */}
      <motion.path
        d="M65 100 L90 130 L140 75"
        fill="none"
        stroke="white"
        strokeWidth="8"
        strokeLinecap="square"
        strokeLinejoin="miter"
        initial={
          prefersReducedMotion
            ? { strokeDashoffset: 0 }
            : { strokeDashoffset: checkmarkLength }
        }
        animate={{ strokeDashoffset: 0 }}
        transition={
          prefersReducedMotion
            ? { duration: 0 }
            : { type: "spring", stiffness: 100, damping: 20, delay: 0.35 }
        }
        strokeDasharray={checkmarkLength}
      />

      {/* Bold outline ring */}
      <motion.circle
        cx="100"
        cy="100"
        r="70"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        initial={prefersReducedMotion ? { scale: 1 } : { scale: 0 }}
        animate={{ scale: 1 }}
        transition={
          prefersReducedMotion
            ? { duration: 0 }
            : { type: "spring", stiffness: 260, damping: 20 }
        }
      />

      {/* Sparkle top-right */}
      <motion.path
        d="M160 40 L162 46 L168 48 L162 50 L160 56 L158 50 L152 48 L158 46 Z"
        fill="#2ECC40"
        initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, scale: 0 }}
        animate={{ opacity: 0.6, scale: 1 }}
        transition={
          prefersReducedMotion
            ? { duration: 0 }
            : { delay: 0.6, type: "spring", stiffness: 300, damping: 15 }
        }
      />

      {/* Sparkle bottom-left */}
      <motion.path
        d="M40 155 L41.5 159 L46 160 L41.5 161 L40 165 L38.5 161 L34 160 L38.5 159 Z"
        fill="#2ECC40"
        initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, scale: 0 }}
        animate={{ opacity: 0.4, scale: 1 }}
        transition={
          prefersReducedMotion
            ? { duration: 0 }
            : { delay: 0.7, type: "spring", stiffness: 300, damping: 15 }
        }
      />
    </svg>
  );
}
