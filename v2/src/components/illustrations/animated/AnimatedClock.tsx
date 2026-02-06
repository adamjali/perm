"use client";

/**
 * AnimatedClock - Clock with ticking hands and urgent pulse.
 * Second hand rotates continuously. Warning flash when `urgent` is true.
 * Style: Neobrutalist - bold strokes, red urgency zone, yellow warning.
 */

import { motion, useReducedMotion } from "motion/react";

interface AnimatedClockProps {
  className?: string;
  size?: number;
  urgent?: boolean;
}

const HOUR_MARKERS = [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330];

export function AnimatedClock({
  className = "",
  size = 200,
  urgent = false,
}: AnimatedClockProps) {
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
      {/* Urgent pulse rings */}
      {urgent && (
        <>
          <motion.circle
            cx="100"
            cy="100"
            r="80"
            fill="none"
            stroke="#DC2626"
            strokeWidth="2"
            animate={
              noMotion
                ? { opacity: 0.2 }
                : { opacity: [0.3, 0.05, 0.3], scale: [1, 1.05, 1] }
            }
            transition={
              noMotion
                ? { duration: 0 }
                : { repeat: Infinity, duration: 1.5, ease: "easeInOut" }
            }
          />
          <motion.circle
            cx="100"
            cy="100"
            r="88"
            fill="none"
            stroke="#DC2626"
            strokeWidth="1.5"
            animate={
              noMotion
                ? { opacity: 0.1 }
                : { opacity: [0.15, 0, 0.15], scale: [1, 1.08, 1] }
            }
            transition={
              noMotion
                ? { duration: 0 }
                : { repeat: Infinity, duration: 1.5, ease: "easeInOut", delay: 0.2 }
            }
          />
        </>
      )}

      {/* Hard shadow */}
      <circle cx="104" cy="104" r="70" fill="currentColor" opacity="0.06" />

      {/* Clock face */}
      <circle cx="100" cy="100" r="70" fill="white" stroke="currentColor" strokeWidth="3" />

      {/* Inner ring */}
      <circle cx="100" cy="100" r="62" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.1" />

      {/* Hour markers */}
      {HOUR_MARKERS.map((angle) => {
        const rad = (angle - 90) * (Math.PI / 180);
        const x1 = 100 + 55 * Math.cos(rad);
        const y1 = 100 + 55 * Math.sin(rad);
        const x2 = 100 + 62 * Math.cos(rad);
        const y2 = 100 + 62 * Math.sin(rad);
        const isMajor = angle % 90 === 0;
        return (
          <line
            key={angle}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke="currentColor"
            strokeWidth={isMajor ? 3 : 2}
          />
        );
      })}

      {/* Red urgency zone */}
      <motion.path
        d="M100 38 A62 62 0 0 1 145 52"
        fill="none"
        stroke="#DC2626"
        strokeWidth="6"
        strokeLinecap="square"
        animate={
          noMotion || !urgent
            ? { opacity: 0.7 }
            : { opacity: [0.9, 0.3, 0.9] }
        }
        transition={
          noMotion
            ? { duration: 0 }
            : { repeat: Infinity, duration: 0.8, ease: "easeInOut" }
        }
      />

      {/* Hour hand */}
      <line
        x1="100"
        y1="100"
        x2="80"
        y2="60"
        stroke="currentColor"
        strokeWidth="5"
        strokeLinecap="square"
      />

      {/* Minute hand */}
      <line
        x1="100"
        y1="100"
        x2="98"
        y2="42"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="square"
      />

      {/* Second hand - continuous rotation */}
      <motion.line
        x1="100"
        y1="100"
        x2="100"
        y2="45"
        stroke="#DC2626"
        strokeWidth="1.5"
        strokeLinecap="square"
        animate={noMotion ? {} : { rotate: 360 }}
        transition={
          noMotion
            ? { duration: 0 }
            : { repeat: Infinity, duration: 10, ease: "linear" }
        }
        style={{ originX: "100px", originY: "100px" }}
      />

      {/* Center dot */}
      <circle cx="100" cy="100" r="5" fill="currentColor" />
      <circle cx="100" cy="100" r="2" fill="#DC2626" />

      {/* Warning triangle - pulses when urgent */}
      <motion.g
        transform="translate(155, 30)"
        animate={
          noMotion || !urgent
            ? { scale: 1 }
            : { scale: [1, 1.15, 1] }
        }
        transition={
          noMotion
            ? { duration: 0 }
            : { repeat: Infinity, duration: 1, ease: "easeInOut" }
        }
        style={{ originX: "155px", originY: "30px" }}
      >
        <path
          d="M0 -18 L16 12 L-16 12 Z"
          fill="#FBBF24"
          stroke="currentColor"
          strokeWidth="3"
        />
        <text
          x="0"
          y="8"
          textAnchor="middle"
          fill="black"
          fontSize="18"
          fontWeight="900"
          fontFamily="var(--font-heading), system-ui"
        >
          !
        </text>
      </motion.g>

      {/* Lightning bolt */}
      <g transform="translate(40, 35)">
        <path
          d="M10 0 L0 12 L7 12 L3 24 L15 10 L8 10 Z"
          fill="#FBBF24"
          stroke="currentColor"
          strokeWidth="2"
        />
      </g>
    </svg>
  );
}
