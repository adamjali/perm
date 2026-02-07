/**
 * Shared animation variants for content components.
 *
 * Reused across ArticleLayout, ContentHero, ContentCTA, ScreenshotFigure,
 * and other content components to avoid duplicating the same Framer Motion
 * variant objects in every file.
 */

/** Stagger parent — delays children on show */
export const stagger = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.1, delayChildren: 0.05 },
  },
} as const;

/** Fade-up child — slides up with an ease-out curve */
export const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, ease: [0.4, 0, 0.2, 1] as const },
  },
} as const;
