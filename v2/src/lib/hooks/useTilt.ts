"use client";

/**
 * useTilt Hook
 *
 * Adds a subtle 3D tilt effect to any element based on mouse position.
 * Tracks mousemove relative to the element center and computes
 * rotateX/rotateY transforms (max 5 degrees).
 *
 * Features:
 * - Perspective-based 3D tilt (perspective 800px)
 * - Smooth reset on mouseleave (0.3s ease-out CSS transition)
 * - Disabled when user prefers reduced motion
 * - Disabled on mobile (no mousemove on touch devices)
 *
 * @example
 * ```tsx
 * const { ref, style } = useTilt();
 * return <div ref={ref} style={style}>Tilting card</div>;
 * ```
 */

import { useRef, useState, useCallback, useEffect } from "react";
import { useReducedMotion, useIsMobile } from "@/lib/animations";

// ============================================================================
// CONFIGURATION
// ============================================================================

/** Maximum tilt angle in degrees */
const MAX_TILT_DEG = 5;

/** Perspective distance for 3D effect */
const PERSPECTIVE_PX = 800;

/** CSS transition for smooth reset on mouseleave */
const RESET_TRANSITION = "transform 0.3s ease-out";

// ============================================================================
// TYPES
// ============================================================================

interface TiltStyle {
  transform: string;
  transition: string;
}

interface UseTiltReturn<T extends HTMLElement = HTMLDivElement> {
  /** Ref to attach to the tilt target element */
  ref: React.RefObject<T | null>;
  /** Style object to spread on the tilt target element */
  style: TiltStyle;
}

// ============================================================================
// IDENTITY (no-op) TRANSFORM
// ============================================================================

const IDENTITY_STYLE: TiltStyle = {
  transform: `perspective(${PERSPECTIVE_PX}px) rotateX(0deg) rotateY(0deg)`,
  transition: RESET_TRANSITION,
};

// ============================================================================
// HOOK
// ============================================================================

/**
 * Hook that returns a ref and style for applying a 3D tilt effect.
 *
 * Attach `ref` to the target element and spread `style` on it.
 * The element will tilt toward the mouse cursor on hover,
 * and smoothly reset when the mouse leaves.
 *
 * Returns an identity transform (no tilt) when:
 * - The user has enabled "prefers-reduced-motion"
 * - The viewport is mobile-sized (no reliable mousemove)
 */
export function useTilt<T extends HTMLElement = HTMLDivElement>(): UseTiltReturn<T> {
  const ref = useRef<T | null>(null);
  const [tiltStyle, setTiltStyle] = useState<TiltStyle>(IDENTITY_STYLE);
  const reducedMotion = useReducedMotion();
  const isMobile = useIsMobile();

  const isDisabled = reducedMotion || isMobile;

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      const el = ref.current;
      if (!el) return;

      const rect = el.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      // Normalize offset to [-1, 1]
      const normalizedX = (e.clientX - centerX) / (rect.width / 2);
      const normalizedY = (e.clientY - centerY) / (rect.height / 2);

      // Clamp to [-1, 1]
      const clampedX = Math.max(-1, Math.min(1, normalizedX));
      const clampedY = Math.max(-1, Math.min(1, normalizedY));

      // rotateY follows horizontal mouse position, rotateX follows inverted vertical
      const rotateY = clampedX * MAX_TILT_DEG;
      const rotateX = -clampedY * MAX_TILT_DEG;

      setTiltStyle({
        transform: `perspective(${PERSPECTIVE_PX}px) rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg)`,
        transition: "none",
      });
    },
    []
  );

  const handleMouseLeave = useCallback(() => {
    setTiltStyle(IDENTITY_STYLE);
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el || isDisabled) return;

    el.addEventListener("mousemove", handleMouseMove);
    el.addEventListener("mouseleave", handleMouseLeave);

    return () => {
      el.removeEventListener("mousemove", handleMouseMove);
      el.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, [isDisabled, handleMouseMove, handleMouseLeave]);

  // When disabled, always return identity transform
  if (isDisabled) {
    return { ref, style: IDENTITY_STYLE };
  }

  return { ref, style: tiltStyle };
}

export default useTilt;
