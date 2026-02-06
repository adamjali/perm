"use client";

/**
 * AnimatedFolder - Manila folder that opens on hover/trigger.
 * Front flap rotates open, papers peek out with stagger.
 * Style: Neobrutalist - bold strokes, manila colors (#F5E6C8, #E8D4A8).
 */

import { motion, useReducedMotion } from "motion/react";
import { useState } from "react";

interface AnimatedFolderProps {
  className?: string;
  size?: number;
  animate?: boolean;
}

export function AnimatedFolder({
  className = "",
  size = 200,
  animate: triggerAnimate = false,
}: AnimatedFolderProps) {
  const prefersReducedMotion = useReducedMotion();
  const [hovered, setHovered] = useState(false);

  const isOpen = triggerAnimate || hovered;
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
      {/* Hard shadow */}
      <path
        d="M29 64 L29 174 L179 174 L179 64 Z"
        fill="currentColor"
        opacity="0.06"
      />

      {/* Folder back panel */}
      <path
        d="M25 60 L25 170 L175 170 L175 60 Z"
        fill="#E8D4A8"
        stroke="currentColor"
        strokeWidth="3"
      />

      {/* Folder tab */}
      <path
        d="M25 60 L60 60 L75 45 L120 45 L120 60"
        fill="#F5E6C8"
        stroke="currentColor"
        strokeWidth="3"
      />

      {/* Paper 1 - peeks out on open */}
      <motion.g
        animate={
          noMotion
            ? {}
            : { y: isOpen ? -20 : 0, rotate: isOpen ? -3 : 0 }
        }
        transition={
          noMotion
            ? { duration: 0 }
            : { type: "spring", stiffness: 200, damping: 18, delay: 0.1 }
        }
        style={{ originX: "100px", originY: "90px" }}
      >
        <rect
          x="55"
          y="70"
          width="90"
          height="30"
          fill="white"
          stroke="currentColor"
          strokeWidth="2"
        />
        <line x1="65" y1="78" x2="135" y2="78" stroke="currentColor" strokeWidth="1.5" opacity="0.3" />
        <line x1="65" y1="86" x2="130" y2="86" stroke="currentColor" strokeWidth="1.5" opacity="0.3" />
      </motion.g>

      {/* Paper 2 - peeks out on open, staggered */}
      <motion.g
        animate={
          noMotion
            ? {}
            : { y: isOpen ? -12 : 0, rotate: isOpen ? 2 : 0 }
        }
        transition={
          noMotion
            ? { duration: 0 }
            : { type: "spring", stiffness: 200, damping: 18, delay: 0.2 }
        }
        style={{ originX: "92px", originY: "90px" }}
      >
        <rect
          x="50"
          y="78"
          width="85"
          height="25"
          fill="#FAFAFA"
          stroke="currentColor"
          strokeWidth="2"
        />
        <line x1="60" y1="86" x2="125" y2="86" stroke="currentColor" strokeWidth="1.5" opacity="0.3" />
        <line x1="60" y1="93" x2="120" y2="93" stroke="currentColor" strokeWidth="1.5" opacity="0.3" />
      </motion.g>

      {/* Front flap - rotates open from bottom hinge */}
      <motion.path
        d="M20 90 L35 170 L175 170 L185 90 Z"
        fill="#F5E6C8"
        stroke="currentColor"
        strokeWidth="3"
        animate={
          noMotion
            ? {}
            : { rotateX: isOpen ? -25 : 0 }
        }
        transition={
          noMotion
            ? { duration: 0 }
            : { type: "spring", stiffness: 180, damping: 20 }
        }
        style={{ originY: "170px" }}
      />

      {/* Folder label */}
      <motion.g
        animate={
          noMotion
            ? {}
            : { opacity: isOpen ? 0.3 : 1 }
        }
        transition={{ duration: 0.2 }}
      >
        <rect x="75" y="125" width="50" height="20" fill="white" stroke="currentColor" strokeWidth="2" />
        <text
          x="100"
          y="139"
          textAnchor="middle"
          fill="currentColor"
          fontSize="8"
          fontWeight="700"
          fontFamily="var(--font-heading), system-ui"
          opacity="0.5"
        >
          CASES
        </text>
      </motion.g>

      {/* Sparkles - appear on open */}
      <motion.path
        d="M160 35 L162 41 L168 43 L162 45 L160 51 L158 45 L152 43 L158 41 Z"
        fill="#2ECC40"
        animate={
          noMotion
            ? { opacity: 0.6 }
            : { opacity: isOpen ? 0.8 : 0.4, scale: isOpen ? 1.2 : 1 }
        }
        transition={noMotion ? { duration: 0 } : { delay: 0.3 }}
        style={{ originX: "160px", originY: "43px" }}
      />
      <motion.path
        d="M40 28 L41.5 32 L46 33 L41.5 34 L40 38 L38.5 34 L34 33 L38.5 32 Z"
        fill="#2ECC40"
        animate={
          noMotion
            ? { opacity: 0.5 }
            : { opacity: isOpen ? 0.7 : 0.3, scale: isOpen ? 1.2 : 1 }
        }
        transition={noMotion ? { duration: 0 } : { delay: 0.35 }}
        style={{ originX: "40px", originY: "33px" }}
      />

      {/* Plus sign */}
      <motion.g
        opacity="0.4"
        animate={
          noMotion
            ? {}
            : { rotate: isOpen ? 90 : 0 }
        }
        transition={noMotion ? { duration: 0 } : { delay: 0.25 }}
        style={{ originX: "175px", originY: "55px" }}
      >
        <line x1="175" y1="50" x2="175" y2="60" stroke="#2ECC40" strokeWidth="2" />
        <line x1="170" y1="55" x2="180" y2="55" stroke="#2ECC40" strokeWidth="2" />
      </motion.g>
    </svg>
  );
}
