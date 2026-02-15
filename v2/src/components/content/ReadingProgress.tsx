"use client";

/**
 * ReadingProgress
 *
 * Article reading progress bar.
 * Uses Framer Motion useScroll + useSpring for smooth scroll tracking.
 */

import { motion, useScroll, useSpring } from "framer-motion";

export default function ReadingProgress() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001,
  });

  return (
    <motion.div
      className="fixed left-0 right-0 top-0 z-[60] h-[3px] origin-left bg-primary"
      style={{ scaleX }}
      aria-hidden="true"
    />
  );
}
