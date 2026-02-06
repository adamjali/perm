"use client";

/**
 * AnimatedGlobe - Globe with rotating meridians and plane path draw-on.
 * Gentle continuous rotation of globe lines. Dotted plane path draws in.
 * Style: Neobrutalist - bold strokes, lime green continents, black outlines.
 */

import { motion, useReducedMotion } from "motion/react";

interface AnimatedGlobeProps {
  className?: string;
  size?: number;
}

export function AnimatedGlobe({
  className = "",
  size = 200,
}: AnimatedGlobeProps) {
  const prefersReducedMotion = useReducedMotion();
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
    >
      {/* Globe circle */}
      <circle cx="100" cy="95" r="65" fill="#F0FFF0" stroke="currentColor" strokeWidth="3" />

      {/* Meridian 1 - shifts horizontally for rotation effect */}
      <motion.ellipse
        cx="100"
        cy="95"
        rx="25"
        ry="65"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        opacity="0.25"
        animate={noMotion ? {} : { rx: [25, 45, 25, 5, 25] }}
        transition={
          noMotion
            ? { duration: 0 }
            : { repeat: Infinity, duration: 8, ease: "easeInOut" }
        }
      />

      {/* Meridian 2 - counter-phase */}
      <motion.ellipse
        cx="100"
        cy="95"
        rx="48"
        ry="65"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        opacity="0.18"
        animate={noMotion ? {} : { rx: [48, 15, 48, 60, 48] }}
        transition={
          noMotion
            ? { duration: 0 }
            : { repeat: Infinity, duration: 8, ease: "easeInOut" }
        }
      />

      {/* Parallels */}
      <line x1="40" y1="70" x2="160" y2="70" stroke="currentColor" strokeWidth="1.5" opacity="0.2" />
      <line x1="35" y1="95" x2="165" y2="95" stroke="currentColor" strokeWidth="2" opacity="0.25" />
      <line x1="40" y1="120" x2="160" y2="120" stroke="currentColor" strokeWidth="1.5" opacity="0.2" />

      {/* Continent shapes */}
      <path
        d="M75 65 L85 60 L95 63 L105 57 L115 60 L120 70 L115 80 L105 77 L95 83 L85 75 Z"
        fill="#2ECC40"
        opacity="0.3"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M65 90 L75 87 L80 95 L85 100 L80 110 L70 113 L60 105 L58 97 Z"
        fill="#2ECC40"
        opacity="0.3"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M110 95 L120 90 L130 93 L135 100 L130 110 L120 115 L110 110 Z"
        fill="#2ECC40"
        opacity="0.25"
        stroke="currentColor"
        strokeWidth="1.5"
      />

      {/* Plane path - dotted arc, draws on */}
      <motion.path
        d="M50 55 Q100 15 150 55"
        fill="none"
        stroke="#2ECC40"
        strokeWidth="2"
        strokeDasharray="6 4"
        opacity="0.7"
        initial={noMotion ? {} : { pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={
          noMotion
            ? { duration: 0 }
            : { duration: 1.8, ease: "easeOut", delay: 0.3 }
        }
      />

      {/* Plane icon - appears at end of path */}
      <motion.g
        transform="translate(145, 53) rotate(30)"
        initial={noMotion ? { opacity: 1 } : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={
          noMotion
            ? { duration: 0 }
            : { delay: 1.8, duration: 0.3 }
        }
      >
        <path
          d="M0 -3 L8 0 L0 3 L2 0 Z"
          fill="#2ECC40"
          stroke="currentColor"
          strokeWidth="1.5"
        />
        <line x1="-2" y1="0" x2="-6" y2="0" stroke="#2ECC40" strokeWidth="2" />
      </motion.g>

      {/* Globe stand */}
      <path
        d="M85 160 L100 165 L115 160"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="square"
      />
      <line x1="100" y1="160" x2="100" y2="167" stroke="currentColor" strokeWidth="3" />

      {/* Sparkle */}
      <motion.path
        d="M165 30 L167 36 L173 38 L167 40 L165 46 L163 40 L157 38 L163 36 Z"
        fill="#2ECC40"
        animate={
          noMotion
            ? { opacity: 0.5 }
            : { opacity: [0.3, 0.7, 0.3] }
        }
        transition={
          noMotion
            ? { duration: 0 }
            : { repeat: Infinity, duration: 2.5, ease: "easeInOut" }
        }
      />

      {/* Hard shadow */}
      <circle cx="104" cy="99" r="65" fill="currentColor" opacity="0.05" />
    </svg>
  );
}
