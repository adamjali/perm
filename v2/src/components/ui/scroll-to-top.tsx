"use client";

import { useRef, useState } from "react";
import {
  motion,
  AnimatePresence,
  useScroll,
  useTransform,
  useMotionValueEvent,
} from "motion/react";
import { ArrowUpIcon } from "@phosphor-icons/react";

/**
 * ScrollToTop, neobrutalist square button, fixed bottom-right.
 *
 * All scroll-linked values use motion values (zero re-renders).
 * State only changes on visibility threshold crossing.
 *
 * IT SITS AT `z-[60]`, the house layer for bottom-fixed chrome, alongside
 * SelectionBar, ChatWidget and ReadingProgress. It does not collide with the
 * chat button, which sits at `bottom-20` (80px) while this one spans 24px to
 * 68px, and it stays below the search palette at `z-[100]`.
 *
 * It shipped at `z-50` against a footer that was ALSO `z-50`, and at an equal
 * z-index the later element in DOM order wins - the footer is rendered after
 * this button in `(site)/layout.tsx`. So the footer covered it at the bottom
 * of every long page, exactly where a back-to-top control is reached for.
 * The footer is `z-10` now (see Footer.tsx), which is the real fix; this
 * button keeps `z-[60]` on its own merits, not to escape the footer.
 */
export function ScrollToTop() {
  const [visible, setVisible] = useState(false);
  const visibleRef = useRef(false);
  const { scrollYProgress } = useScroll();

  // Only setState when threshold actually crosses
  useMotionValueEvent(scrollYProgress, "change", (v) => {
    const show = v > 0.05;
    if (show !== visibleRef.current) {
      visibleRef.current = show;
      setVisible(show);
    }
  });

  // Motion values — drive SVG + fill without re-renders
  const perimeter = 184; // 4 × 46px path
  const dashOffset = useTransform(scrollYProgress, [0, 1], [perimeter, 0]);
  const fillScaleY = useTransform(scrollYProgress, [0, 1], [0, 1]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.button
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          transition={{ duration: 0.2 }}
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="fixed bottom-6 right-6 z-[60] flex h-11 w-11 cursor-pointer items-center justify-center overflow-hidden border-3 border-border bg-background shadow-hard transition-[transform,box-shadow] duration-150 hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-hard-lg active:translate-x-0.5 active:translate-y-0.5 active:shadow-none"
          aria-label="Back to top"
        >
          {/* Background fill — rises from bottom with scroll (solid primary) */}
          <motion.div
            className="absolute inset-0 origin-bottom bg-primary will-change-transform"
            style={{ scaleY: fillScaleY }}
          />
          {/* Progress border — traces square from top-center */}
          <svg
            className="pointer-events-none absolute -inset-px"
            viewBox="0 0 46 46"
            fill="none"
          >
            <motion.path
              d="M23 1 L45 1 L45 45 L1 45 L1 1 Z"
              stroke="var(--primary)"
              strokeWidth="2.5"
              strokeLinecap="square"
              strokeDasharray={perimeter}
              style={{ strokeDashoffset: dashOffset }}
            />
          </svg>
          <ArrowUpIcon className="relative z-10 h-4 w-4 text-foreground" />
        </motion.button>
      )}
    </AnimatePresence>
  );
}
