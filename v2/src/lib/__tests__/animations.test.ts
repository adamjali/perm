/**
 * Animation Utilities Tests
 *
 * Tests for animation utilities, variants, and helper functions.
 */

import { describe, it, expect } from "vitest";
import {
  // Constants
  STAGGER_DELAY,
  MAX_DURATION,
  MOBILE_BREAKPOINT,
  MOBILE_STAGGER_DELAY,
  // Spring configs
  springConfig,
  quickSpringConfig,
  visualSpringConfig,
  // Variants
  fadeIn,
  fadeInUp,
  fadeInDown,
  fadeInLeft,
  fadeInRight,
  scaleUp,
  popIn,
  noMotion,
  fadeInUpMobile,
  // Stagger variants
  staggerContainer,
  staggerItem,
  pageEntranceContainer,
  pageEntranceItem,
  // Utility functions
  parallaxY,
  createParallaxRange,
  getFadeInVariant,
  getReducedMotionVariants,
  // Types
  type AnimationDirection,
} from "../animations";

// ============================================================================
// Constants Tests
// ============================================================================

describe("Animation Constants", () => {
  it("STAGGER_DELAY is 0.1 seconds", () => {
    expect(STAGGER_DELAY).toBe(0.1);
  });

  it("MAX_DURATION is 0.5 seconds", () => {
    expect(MAX_DURATION).toBe(0.5);
  });

  it("MOBILE_BREAKPOINT is 768 pixels", () => {
    expect(MOBILE_BREAKPOINT).toBe(768);
  });

  it("MOBILE_STAGGER_DELAY is half of standard", () => {
    expect(MOBILE_STAGGER_DELAY).toBe(0.05);
    expect(MOBILE_STAGGER_DELAY).toBe(STAGGER_DELAY / 2);
  });
});

// ============================================================================
// Spring Configuration Tests
// ============================================================================

describe("Spring Configurations", () => {
  it("springConfig uses spring type with stiffness 500 and damping 30", () => {
    expect(springConfig.type).toBe("spring");
    expect(springConfig.stiffness).toBe(500);
    expect(springConfig.damping).toBe(30);
  });

  it("quickSpringConfig is faster with higher stiffness", () => {
    expect(quickSpringConfig.type).toBe("spring");
    expect(quickSpringConfig.stiffness).toBe(600);
    expect(quickSpringConfig.damping).toBe(25);
  });

  it("visualSpringConfig uses visualDuration", () => {
    expect(visualSpringConfig.type).toBe("spring");
    expect(visualSpringConfig.visualDuration).toBe(0.15);
    expect(visualSpringConfig.bounce).toBe(0.1);
  });
});

// ============================================================================
// Variant Structure Tests
// ============================================================================

describe("Fade Variants", () => {
  it("fadeIn has hidden and visible states", () => {
    expect(fadeIn.hidden).toBeDefined();
    expect(fadeIn.visible).toBeDefined();
    expect(fadeIn.hidden?.opacity).toBe(0);
    expect((fadeIn.visible as { opacity: number }).opacity).toBe(1);
  });

  it("fadeInUp animates from below", () => {
    expect((fadeInUp.hidden as { y: number }).y).toBe(24);
    expect((fadeInUp.visible as { y: number }).y).toBe(0);
  });

  it("fadeInDown animates from above", () => {
    expect((fadeInDown.hidden as { y: number }).y).toBe(-24);
    expect((fadeInDown.visible as { y: number }).y).toBe(0);
  });

  it("fadeInLeft animates from left", () => {
    expect((fadeInLeft.hidden as { x: number }).x).toBe(-24);
    expect((fadeInLeft.visible as { x: number }).x).toBe(0);
  });

  it("fadeInRight animates from right", () => {
    expect((fadeInRight.hidden as { x: number }).x).toBe(24);
    expect((fadeInRight.visible as { x: number }).x).toBe(0);
  });

  it("fadeInUpMobile has reduced distance (12px)", () => {
    expect((fadeInUpMobile.hidden as { y: number }).y).toBe(12);
  });
});

describe("Scale Variants", () => {
  it("scaleUp scales from 0.95", () => {
    expect((scaleUp.hidden as { scale: number }).scale).toBe(0.95);
    expect((scaleUp.visible as { scale: number }).scale).toBe(1);
  });

  it("popIn scales from 0", () => {
    expect((popIn.hidden as { scale: number }).scale).toBe(0);
    expect((popIn.visible as { scale: number }).scale).toBe(1);
  });
});

describe("Stagger Variants", () => {
  it("staggerContainer has staggerChildren property", () => {
    const visible = staggerContainer.visible as { transition: { staggerChildren: number } };
    expect(visible.transition.staggerChildren).toBe(STAGGER_DELAY);
  });

  it("staggerItem has hidden and visible states", () => {
    expect(staggerItem.hidden).toBeDefined();
    expect(staggerItem.visible).toBeDefined();
  });

  it("pageEntranceContainer has delayChildren", () => {
    const visible = pageEntranceContainer.visible as { transition: { delayChildren: number } };
    expect(visible.transition.delayChildren).toBe(0.1);
  });

  it("pageEntranceItem animates from y: 20", () => {
    expect((pageEntranceItem.hidden as { y: number }).y).toBe(20);
  });
});

describe("noMotion Variant", () => {
  it("has minimal animation duration", () => {
    const visible = noMotion.visible as { transition: { duration: number } };
    expect(visible.transition.duration).toBeLessThanOrEqual(0.01);
  });
});

// ============================================================================
// Utility Function Tests
// ============================================================================

describe("parallaxY", () => {
  it("returns [intensity, -intensity] by default", () => {
    const result = parallaxY();
    expect(result).toEqual([50, -50]);
  });

  it("respects custom intensity", () => {
    const result = parallaxY(undefined, 100);
    expect(result).toEqual([100, -100]);
  });

  it("ignores first parameter (deprecated)", () => {
    // First param is unused but kept for API compatibility
    const result = parallaxY(0.5, 75);
    expect(result).toEqual([75, -75]);
  });
});

describe("createParallaxRange", () => {
  it("returns [intensity, -intensity] for up direction", () => {
    const result = createParallaxRange(50, "up");
    expect(result).toEqual([50, -50]);
  });

  it("returns [-intensity, intensity] for down direction", () => {
    const result = createParallaxRange(50, "down");
    expect(result).toEqual([-50, 50]);
  });

  it("defaults to 50 intensity and up direction", () => {
    const result = createParallaxRange();
    expect(result).toEqual([50, -50]);
  });
});

describe("getFadeInVariant", () => {
  it("returns fadeInUp for up direction", () => {
    const result = getFadeInVariant("up");
    expect(result).toBe(fadeInUp);
  });

  it("returns fadeInDown for down direction", () => {
    const result = getFadeInVariant("down");
    expect(result).toBe(fadeInDown);
  });

  it("returns fadeInLeft for left direction", () => {
    const result = getFadeInVariant("left");
    expect(result).toBe(fadeInLeft);
  });

  it("returns fadeInRight for right direction", () => {
    const result = getFadeInVariant("right");
    expect(result).toBe(fadeInRight);
  });

  it("returns fadeInUp as default fallback", () => {
    // Cast to avoid type error - testing fallback behavior
    const result = getFadeInVariant("invalid" as AnimationDirection);
    expect(result).toBe(fadeInUp);
  });
});

describe("getReducedMotionVariants", () => {
  it("returns normal variants when reducedMotion is false", () => {
    const result = getReducedMotionVariants(fadeInUp, false);
    expect(result).toBe(fadeInUp);
  });

  it("returns noMotion when reducedMotion is true", () => {
    const result = getReducedMotionVariants(fadeInUp, true);
    expect(result).toBe(noMotion);
  });

  it("works with any variant type", () => {
    const customVariant = { hidden: { opacity: 0 }, visible: { opacity: 1 } };
    const resultNormal = getReducedMotionVariants(customVariant, false);
    const resultReduced = getReducedMotionVariants(customVariant, true);

    expect(resultNormal).toBe(customVariant);
    expect(resultReduced).toBe(noMotion);
  });
});
