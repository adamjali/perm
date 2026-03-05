"use client";

/**
 * PageTransition Component
 *
 * Wraps page content with a quick fade + slide-up animation on route changes.
 * Uses key={pathname} to remount on navigation, triggering the enter animation.
 * Respects prefers-reduced-motion.
 *
 * Note: AnimatePresence mode="wait" was removed because it causes intermittent
 * blank pages during client-side navigation — the exit animation races with
 * Next.js App Router's Suspense streaming (loading.tsx → page swap).
 * Current behavior: enter-only animation (fade+slide-up). No exit animation
 * to avoid the Suspense race.
 */

import { motion } from "motion/react";
import { usePathname } from "next/navigation";
import { useReducedMotion } from "@/lib/animations";

export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const reducedMotion = useReducedMotion();

  if (reducedMotion) {
    return <>{children}</>;
  }

  return (
    <motion.div
      key={pathname}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.15, ease: [0.25, 0.1, 0.25, 1] }}
    >
      {children}
    </motion.div>
  );
}
