"use client";

import { useRef, useState } from "react";
import {
  motion,
  AnimatePresence,
  useScroll,
  useMotionValueEvent,
  useReducedMotion,
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

  // ONE progress indicator, drawn ON the border (2026-09-26). The button used
  // to carry two: a lime fill rising behind the arrow AND a line traced inside
  // the frame. The line was drawn in a 46-unit box inside the padding of an
  // `overflow-hidden` button with a 3px border, so it ran just inside the
  // black frame and was clipped at its corners - on a phone it read as a
  // second, broken border. Now the SVG covers the border box exactly
  // (`-inset-[3px]` from the padding box) and its stroke sits on the centre
  // line of the 3px border, so the frame itself fills with lime as you
  // scroll. Motion's `pathLength` handles the dash arithmetic.
  const reduceMotion = useReducedMotion();

  return (
    <AnimatePresence>
      {visible && (
        <motion.button
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          transition={{ duration: 0.2 }}
          onClick={() =>
            window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" })
          }
          className="fixed bottom-6 right-6 z-[60] flex h-11 w-11 cursor-pointer items-center justify-center border-3 border-border bg-background shadow-hard transition-[transform,box-shadow] duration-150 hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-hard-lg active:translate-x-0.5 active:translate-y-0.5 active:shadow-none"
          aria-label="Back to top"
        >
          <svg
            className="pointer-events-none absolute -inset-[3px] h-11 w-11"
            viewBox="0 0 44 44"
            fill="none"
            aria-hidden="true"
          >
            {/* Top centre, clockwise, back to top centre: 164 units. */}
            <motion.path
              d="M22 1.5 L42.5 1.5 L42.5 42.5 L1.5 42.5 L1.5 1.5 L22 1.5"
              stroke="var(--primary)"
              strokeWidth="3"
              strokeLinecap="butt"
              style={{ pathLength: scrollYProgress }}
            />
          </svg>
          <ArrowUpIcon className="relative h-4 w-4 text-foreground" />
        </motion.button>
      )}
    </AnimatePresence>
  );
}
