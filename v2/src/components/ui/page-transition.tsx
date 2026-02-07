"use client";

/**
 * PageTransition Component
 *
 * Wraps page content with a quick fade + slide-up animation on route changes.
 * Uses motion/react AnimatePresence for enter/exit transitions.
 * Respects prefers-reduced-motion.
 */

import { AnimatePresence, motion } from "motion/react";
import { usePathname } from "next/navigation";
import { useReducedMotion } from "@/lib/animations";

export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const reducedMotion = useReducedMotion();

  if (reducedMotion) {
    return <>{children}</>;
  }

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={pathname}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
