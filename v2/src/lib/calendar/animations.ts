/**
 * Animation configurations for calendar components.
 * Centralized to maintain consistent motion across the app.
 */

/**
 * Spring config for snappy neobrutalist animations
 */
export const springTransition = {
  type: "spring" as const,
  stiffness: 500,
  damping: 30,
};

/**
 * Fade animation variants for view transitions
 */
export const fadeVariants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
};

/**
 * Fast fade transition duration
 */
export const fadeTransition = { duration: 0.15 };
