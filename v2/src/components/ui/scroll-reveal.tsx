"use client";

/**
 * ScrollReveal Component
 *
 * Reveals content with animation when scrolled into view.
 * Uses Intersection Observer via motion/react's useInView hook.
 *
 * DESIGN RATIONALE:
 * - threshold: 0.1 (10%) triggers early, creating a "content rising to meet you" feel
 *   This prevents jarring pop-ins that happen when elements are fully visible
 * - once: true by default prevents re-animation on scroll back (reduces visual noise)
 * - Spring physics (stiffness 500, damping 30) create snappy, not floaty transitions
 * - Stagger delay of 0.1s creates rhythmic cascade without feeling slow
 *
 * Features:
 * - Multiple reveal directions (up, down, left, right)
 * - Stagger support for child elements
 * - Configurable viewport threshold
 * - Reduced motion support
 * - Once-only animation option (default: true)
 *
 */

import * as React from "react";
import { motion, useInView, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";
import {
  fadeInUp,
  fadeInDown,
  fadeInLeft,
  fadeInRight,
  fadeInUpMobile,
  staggerItem,
  noMotion,
  useIsMobile,
  STAGGER_DELAY,
  MOBILE_STAGGER_DELAY,
  type AnimationDirection,
} from "@/lib/animations";
import type { Variants } from "motion/react";

// ============================================================================
// PRE-CREATED MOTION COMPONENTS
// These must be defined outside the render function to avoid React errors
// ============================================================================

const MotionDiv = motion.div;
const MotionSection = motion.section;
const MotionArticle = motion.article;
const MotionAside = motion.aside;
const MotionMain = motion.main;
const MotionHeader = motion.header;
const MotionFooter = motion.footer;

type ElementType = "div" | "section" | "article" | "aside" | "main" | "header" | "footer";

const motionComponents: Record<ElementType, typeof MotionDiv> = {
  div: MotionDiv,
  section: MotionSection,
  article: MotionArticle,
  aside: MotionAside,
  main: MotionMain,
  header: MotionHeader,
  footer: MotionFooter,
};

// ============================================================================
// TYPES
// ============================================================================

export interface ScrollRevealProps {
  /** Reveal direction */
  direction?: AnimationDirection;
  /** Delay before animation starts (seconds) */
  delay?: number;
  /** Enable stagger animation for children (wraps children in motion.div) */
  stagger?: boolean;
  /**
   * Viewport threshold (0-1) - how much of element must be visible
   * Default: 0.1 (10%) - triggers early for smooth content reveal
   */
  threshold?: number;
  /**
   * Only animate once (default: true)
   * Enforced to prevent visual noise on scroll back
   */
  once?: boolean;
  /** Children to reveal */
  children: React.ReactNode;
  /** Additional className */
  className?: string;
  /** Wrapper element tag */
  as?: ElementType;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get the appropriate variant based on direction, motion preference, and device
 */
function getVariant(
  direction: AnimationDirection,
  prefersReducedMotion: boolean | null,
  isMobile: boolean
): Variants {
  // Reduced motion: instant opacity transition only
  if (prefersReducedMotion) {
    return noMotion;
  }

  // Mobile: use optimized variant with smaller transform distance
  if (isMobile && direction === "up") {
    return fadeInUpMobile;
  }

  // Desktop: full animation
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

/**
 * Add delay to variant if specified
 */
function getVariantWithDelay(variant: Variants, delay: number): Variants {
  if (delay === 0) return variant;

  return {
    ...variant,
    visible: {
      ...variant.visible,
      transition: {
        ...(typeof variant.visible === "object" && "transition" in variant.visible
          ? variant.visible.transition
          : {}),
        delay,
      },
    },
  };
}

/**
 * Get stagger container variants with optional delay and mobile optimization
 */
function getStaggerContainerVariants(
  delay: number,
  prefersReducedMotion: boolean | null,
  isMobile: boolean
): Variants {
  if (prefersReducedMotion) {
    return noMotion;
  }

  // Mobile: use faster stagger delay for snappier feel
  const staggerDelay = isMobile ? MOBILE_STAGGER_DELAY : STAGGER_DELAY;

  return {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: staggerDelay,
        delayChildren: delay,
      },
    },
  };
}

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * ScrollReveal Component
 *
 * Wraps content and reveals it with animation when scrolled into view.
 *
 * @example Basic usage
 * ```tsx
 * <ScrollReveal>
 *   <h2>This fades in from bottom</h2>
 * </ScrollReveal>
 * ```
 *
 * @example With direction
 * ```tsx
 * <ScrollReveal direction="left">
 *   <Card>Slides in from left</Card>
 * </ScrollReveal>
 * ```
 *
 * @example Stagger children
 * ```tsx
 * <ScrollReveal stagger>
 *   <div>Item 1</div>
 *   <div>Item 2</div>
 *   <div>Item 3</div>
 * </ScrollReveal>
 * ```
 *
 * @example Custom threshold
 * ```tsx
 * <ScrollReveal threshold={0.5}>
 *   <div>Reveals when 50% visible</div>
 * </ScrollReveal>
 * ```
 */
export function ScrollReveal({
  direction = "up",
  delay = 0,
  stagger = false,
  threshold = 0.1,
  once = true,
  children,
  className,
  as = "div",
}: ScrollRevealProps) {
  const ref = React.useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, {
    once,
    amount: threshold,
  });
  const prefersReducedMotion = useReducedMotion();
  const isMobile = useIsMobile();

  // Get the pre-created motion component
  const MotionComponent = motionComponents[as];

  // For stagger mode, wrap children in motion elements
  if (stagger) {
    const containerVariants = getStaggerContainerVariants(delay, prefersReducedMotion, isMobile);
    const itemVariants = prefersReducedMotion ? noMotion : staggerItem;

    return (
      <MotionComponent
        ref={ref}
        className={className}
        variants={containerVariants}
        initial="hidden"
        animate={isInView ? "visible" : "hidden"}
      >
        {React.Children.map(children, (child, index) => {
          if (!React.isValidElement(child)) return child;

          return (
            <motion.div key={index} variants={itemVariants}>
              {child}
            </motion.div>
          );
        })}
      </MotionComponent>
    );
  }

  // Standard single-element reveal (mobile-aware)
  const variant = getVariant(direction, prefersReducedMotion, isMobile);
  const variantWithDelay = getVariantWithDelay(variant, delay);

  return (
    <MotionComponent
      ref={ref}
      className={cn(className)}
      variants={variantWithDelay}
      initial="hidden"
      animate={isInView ? "visible" : "hidden"}
    >
      {children}
    </MotionComponent>
  );
}

// ============================================================================
// SCROLL REVEAL ITEM (for manual stagger control)
// ============================================================================

export interface ScrollRevealItemProps {
  /** Children to reveal */
  children: React.ReactNode;
  /** Additional className */
  className?: string;
  /** Custom variants (optional) */
  variants?: Variants;
}

/**
 * ScrollRevealItem - for use inside a parent with stagger control
 *
 * Use this when you need more control over staggered items.
 *
 * @example
 * ```tsx
 * <motion.div variants={staggerContainer} initial="hidden" animate="visible">
 *   <ScrollRevealItem>Item 1</ScrollRevealItem>
 *   <ScrollRevealItem>Item 2</ScrollRevealItem>
 * </motion.div>
 * ```
 */
export function ScrollRevealItem({
  children,
  className,
  variants,
}: ScrollRevealItemProps) {
  const prefersReducedMotion = useReducedMotion();
  const itemVariants = variants ?? (prefersReducedMotion ? noMotion : staggerItem);

  return (
    <motion.div className={className} variants={itemVariants}>
      {children}
    </motion.div>
  );
}

// ============================================================================
// EXPORTS
// ============================================================================

export default ScrollReveal;
