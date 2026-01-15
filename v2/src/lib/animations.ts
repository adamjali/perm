/**
 * Animation Utilities
 *
 * Reusable animation variants and utilities for Framer Motion.
 * Following existing patterns from TimelineMilestoneMarker and CollapsibleSection.
 *
 * DESIGN RATIONALE:
 * - All animations are "snappy, not floaty" (Linear.app style)
 * - Maximum duration: 0.5s for any animation
 * - Stagger delay: 0.1s standard for consistency
 * - Springs use high stiffness (500+) with moderate damping (25-30)
 * - These values create responsive, tactile feedback
 *
 */

import { useState, useEffect } from "react";
import type { Variants, Transition } from "motion/react";

// ============================================================================
// TIMING CONSTANTS
// ============================================================================

/**
 * Standard stagger delay between children (0.1s)
 * Consistent across all staggered animations for visual rhythm
 */
export const STAGGER_DELAY = 0.1;

/**
 * Maximum animation duration (0.5s)
 * Keeps all animations feeling responsive and snappy
 */
export const MAX_DURATION = 0.5;

// ============================================================================
// SPRING CONFIGURATIONS
// ============================================================================

/**
 * Factory for creating spring configs with consistent patterns
 * Reduces repetition across spring definitions
 */
function createSpringConfig(stiffness: number, damping: number): Transition {
  return {
    type: "spring",
    stiffness,
    damping,
  };
}

/**
 * Default spring config - snappy, not floaty
 * Used throughout the codebase (TimelineMilestoneMarker, etc.)
 *
 * stiffness 500 + damping 30 = ~0.3s settle time
 * High stiffness = fast initial response
 * Moderate damping = minimal overshoot
 */
export const springConfig = createSpringConfig(500, 30);

/**
 * Quick spring for subtle interactions
 * Higher stiffness for faster response on hover/press
 */
export const quickSpringConfig = createSpringConfig(600, 25);

/**
 * Visual duration spring - matches CollapsibleSection pattern
 * Uses visualDuration for predictable timing (0.15s)
 */
export const visualSpringConfig: Transition = {
  type: "spring",
  visualDuration: 0.15,
  bounce: 0.1,
};

// ============================================================================
// FADE IN VARIANTS
// ============================================================================

/**
 * Factory for creating fade-in variants with directional movement
 * Consolidates repetitive variant definitions
 *
 * @param axis - 'x' or 'y' axis
 * @param distance - Distance to move (positive/negative)
 * @param transition - Transition config (default: springConfig)
 */
function createFadeVariant(
  axis: "x" | "y",
  distance: number,
  transition: Transition = springConfig
): Variants {
  return {
    hidden: {
      opacity: 0,
      ...(axis === "x" ? { x: distance } : { y: distance }),
    },
    visible: {
      opacity: 1,
      ...(axis === "x" ? { x: 0 } : { y: 0 }),
      transition,
    },
  };
}

/**
 * Fade in from bottom (most common scroll reveal)
 */
export const fadeInUp = createFadeVariant("y", 24);

/**
 * Fade in from top
 */
export const fadeInDown = createFadeVariant("y", -24);

/**
 * Fade in from left
 */
export const fadeInLeft = createFadeVariant("x", -24);

/**
 * Fade in from right
 */
export const fadeInRight = createFadeVariant("x", 24);

/**
 * Simple fade (no movement)
 */
export const fadeIn: Variants = {
  hidden: {
    opacity: 0,
  },
  visible: {
    opacity: 1,
    transition: { duration: 0.2 },
  },
};

// ============================================================================
// STAGGER CONTAINER VARIANTS
// ============================================================================

/**
 * Factory for creating stagger container variants
 * Consolidates repeated stagger container patterns
 */
function createStaggerContainerVariants(
  staggerChildren: number,
  delayChildren: number = 0
): Variants {
  return {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren,
        delayChildren,
      },
    },
  };
}

/**
 * Container for staggered children animations
 * Pattern from next-up-section.components.tsx
 *
 * Uses STAGGER_DELAY (0.1s) for consistent rhythm across the app
 *
 * @example
 * ```tsx
 * <motion.div variants={staggerContainer} initial="hidden" animate="visible">
 *   <motion.div variants={fadeInUp}>Child 1</motion.div>
 *   <motion.div variants={fadeInUp}>Child 2</motion.div>
 * </motion.div>
 * ```
 */
export const staggerContainer = createStaggerContainerVariants(STAGGER_DELAY);

/**
 * Stagger container with custom delay
 * Defaults to STAGGER_DELAY (0.1s) for consistency
 */
export function createStaggerContainer(
  staggerDelay = STAGGER_DELAY,
  initialDelay = 0
): Variants {
  return createStaggerContainerVariants(staggerDelay, initialDelay);
}

/**
 * Stagger item variant (matches next-up-section pattern)
 * Duration 0.12s keeps items appearing snappy
 */
export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 6 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.12 },
  },
};

// ============================================================================
// PAGE ENTRANCE VARIANTS
// ============================================================================

/**
 * Page entrance container - for hero sections that animate on load
 * Triggers immediately without scroll, staggers children with STAGGER_DELAY
 *
 * @example
 * ```tsx
 * <motion.div variants={pageEntranceContainer} initial="hidden" animate="visible">
 *   <motion.h1 variants={pageEntranceItem}>Hero Title</motion.h1>
 *   <motion.p variants={pageEntranceItem}>Subtitle</motion.p>
 *   <motion.div variants={pageEntranceItem}>CTAs</motion.div>
 * </motion.div>
 * ```
 */
export const pageEntranceContainer = createStaggerContainerVariants(STAGGER_DELAY, 0.1);

/**
 * Page entrance item - for children within pageEntranceContainer
 * Slides up with spring physics for snappy feel
 */
export const pageEntranceItem = createFadeVariant("y", 20);

// ============================================================================
// SCALE VARIANTS
// ============================================================================

/**
 * Factory for creating scale variants
 * Consolidates scale animation patterns
 */
function createScaleVariant(initialScale: number, transition: Transition = springConfig): Variants {
  return {
    hidden: {
      opacity: 0,
      scale: initialScale,
    },
    visible: {
      opacity: 1,
      scale: 1,
      transition,
    },
  };
}

/**
 * Scale up animation for emphasis
 */
export const scaleUp = createScaleVariant(0.95);

/**
 * Pop in animation (scale from center)
 */
export const popIn = createScaleVariant(0, quickSpringConfig);

// ============================================================================
// PARALLAX HELPERS
// ============================================================================

/**
 * Calculate parallax Y offset range for useTransform.
 *
 * @deprecated Use createParallaxRange() instead for a clearer API.
 * The first parameter is unused and this function exists only for backward compatibility.
 *
 * @param _scrollProgress - Unused (kept for backward compatibility)
 * @param intensity - Movement range in pixels (default: 50)
 * @returns [start, end] tuple for useTransform output range
 *
 * @example
 * ```tsx
 * // DEPRECATED usage:
 * const y = useTransform(scrollYProgress, [0, 1], parallaxY(undefined, 100));
 *
 * // PREFERRED: use createParallaxRange for clearer API
 * const y = useTransform(scrollYProgress, [0, 1], createParallaxRange(100, 'up'));
 * ```
 */
export function parallaxY(
  _scrollProgress?: number,
  intensity = 50
): [number, number] {
  // Returns [start, end] values for useTransform
  return [intensity, -intensity];
}

/**
 * Create parallax transform values for useTransform
 *
 * @param intensity - Movement range in pixels
 * @param direction - 'up' | 'down' - direction of parallax movement
 */
export function createParallaxRange(
  intensity = 50,
  direction: "up" | "down" = "up"
): [number, number] {
  return direction === "up" ? [intensity, -intensity] : [-intensity, intensity];
}

// ============================================================================
// REDUCED MOTION VARIANTS
// ============================================================================

/**
 * No-motion variant for reduced motion preferences
 * Use with useReducedMotion hook
 */
export const noMotion: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.01 } },
};

/**
 * Get appropriate variants based on reduced motion preference
 */
export function getReducedMotionVariants(
  normalVariants: Variants,
  reducedMotion: boolean
): Variants {
  return reducedMotion ? noMotion : normalVariants;
}

// ============================================================================
// DIRECTION HELPER
// ============================================================================

export type AnimationDirection = "up" | "down" | "left" | "right";

/**
 * Get fade-in variant by direction
 */
export function getFadeInVariant(direction: AnimationDirection): Variants {
  switch (direction) {
    case "up":
      return fadeInUp;
    case "down":
      return fadeInDown;
    case "left":
      return fadeInLeft;
    case "right":
      return fadeInRight;
    default:
      return fadeInUp;
  }
}

// ============================================================================
// HOOKS
// ============================================================================

/**
 * Mobile breakpoint in pixels
 * Matches Tailwind's md breakpoint
 */
export const MOBILE_BREAKPOINT = 768;

/**
 * Hook to detect user's reduced motion preference
 *
 * Returns true if the user has enabled "reduce motion" in their OS settings.
 * Use this to provide instant/minimal animations for accessibility.
 *
 * @example
 * ```tsx
 * const prefersReducedMotion = useReducedMotion();
 * const variants = prefersReducedMotion ? noMotion : fadeInUp;
 * ```
 */
export function useReducedMotion(): boolean {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    // Check initial preference
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mediaQuery.matches);

    // Listen for changes
    const handleChange = (event: MediaQueryListEvent) => {
      setPrefersReducedMotion(event.matches);
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  return prefersReducedMotion;
}

/**
 * Hook to detect mobile viewport
 *
 * Returns true when viewport width is below MOBILE_BREAKPOINT (768px).
 * Use this to reduce animation complexity on mobile devices.
 *
 * @example
 * ```tsx
 * const isMobile = useIsMobile();
 * const staggerDelay = isMobile ? 0.05 : STAGGER_DELAY;
 * ```
 */
export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    // Check initial viewport
    const mediaQuery = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    setIsMobile(mediaQuery.matches);

    // Listen for changes
    const handleChange = (event: MediaQueryListEvent) => {
      setIsMobile(event.matches);
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  return isMobile;
}

// ============================================================================
// MOBILE-OPTIMIZED VARIANTS
// ============================================================================

/**
 * Mobile stagger delay - half of normal for faster perceived performance
 */
export const MOBILE_STAGGER_DELAY = 0.05;

/**
 * Mobile-optimized fade in from bottom
 * Reduced transform distance (12px vs 24px) for faster animations
 */
export const fadeInUpMobile = createFadeVariant("y", 12, quickSpringConfig);

/**
 * Mobile stagger container with faster timing
 */
export const mobileStaggerContainer = createStaggerContainerVariants(MOBILE_STAGGER_DELAY);

/**
 * Create stagger container with mobile optimization
 */
export function createMobileAwareStaggerContainer(
  isMobile: boolean,
  initialDelay = 0
): Variants {
  const staggerDelay = isMobile ? MOBILE_STAGGER_DELAY : STAGGER_DELAY;
  return createStaggerContainerVariants(staggerDelay, initialDelay);
}

/**
 * Get appropriate fade variant based on device
 */
export function getMobileAwareFadeVariant(
  direction: AnimationDirection,
  isMobile: boolean,
  reducedMotion: boolean
): Variants {
  if (reducedMotion) {
    return noMotion;
  }

  if (isMobile && direction === "up") {
    return fadeInUpMobile;
  }

  return getFadeInVariant(direction);
}

// ============================================================================
// TYPES
// ============================================================================

export type { Variants, Transition };
