"use client";

/**
 * MagneticButton Component
 *
 * Wrapper that makes its children magnetically attracted to the cursor on hover.
 * When the mouse moves within a configurable radius of the button center,
 * the button shifts toward the cursor (4-6px default). On mouseleave,
 * it springs back to center with a spring-like CSS transition.
 *
 * Disabled when:
 * - User has "prefers-reduced-motion" enabled
 * - Viewport is mobile-sized (no reliable mousemove)
 *
 * @example
 * ```tsx
 * <MagneticButton>
 *   <Button>Click me</Button>
 * </MagneticButton>
 * ```
 */

import { useRef, useState, useCallback, useEffect } from "react";
import { useReducedMotion, useIsMobile } from "@/lib/animations";

// ============================================================================
// TYPES
// ============================================================================

interface MagneticButtonProps {
  /** Content to make magnetic (typically a Button component) */
  children: React.ReactNode;
  /** Additional CSS classes for the wrapper */
  className?: string;
  /** Maximum pixel shift toward cursor (default: 6) */
  strength?: number;
  /** Activation radius in pixels from button center (default: 100) */
  radius?: number;
}

// ============================================================================
// SPRING-LIKE CUBIC BEZIER
// ============================================================================

/**
 * Cubic bezier that approximates spring physics for the snap-back transition.
 * Overshoots slightly then settles, creating a natural "magnetic release" feel.
 */
const SPRING_BEZIER = "cubic-bezier(0.34, 1.56, 0.64, 1)";

/** Duration for the spring-back transition */
const SPRING_DURATION = "0.3s";

// ============================================================================
// COMPONENT
// ============================================================================

export function MagneticButton({
  children,
  className,
  strength = 6,
  radius = 100,
}: MagneticButtonProps) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isHovering, setIsHovering] = useState(false);
  const reducedMotion = useReducedMotion();
  const isMobile = useIsMobile();

  const isDisabled = reducedMotion || isMobile;

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      const el = wrapperRef.current;
      if (!el) return;

      const rect = el.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      const distX = e.clientX - centerX;
      const distY = e.clientY - centerY;
      const distance = Math.sqrt(distX * distX + distY * distY);

      if (distance < radius) {
        // Stronger pull the closer to center (inverse of distance ratio)
        const pull = 1 - distance / radius;
        const moveX = (distX / radius) * strength * pull;
        const moveY = (distY / radius) * strength * pull;

        setOffset({ x: moveX, y: moveY });
        setIsHovering(true);
      } else {
        setOffset({ x: 0, y: 0 });
        setIsHovering(false);
      }
    },
    [radius, strength]
  );

  const handleMouseLeave = useCallback(() => {
    setOffset({ x: 0, y: 0 });
    setIsHovering(false);
  }, []);

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el || isDisabled) return;

    el.addEventListener("mousemove", handleMouseMove);
    el.addEventListener("mouseleave", handleMouseLeave);

    return () => {
      el.removeEventListener("mousemove", handleMouseMove);
      el.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, [isDisabled, handleMouseMove, handleMouseLeave]);

  const wrapperStyle: React.CSSProperties = isDisabled
    ? {}
    : {
        transform: `translate(${offset.x.toFixed(2)}px, ${offset.y.toFixed(2)}px)`,
        transition: isHovering
          ? "transform 0.1s ease-out"
          : `transform ${SPRING_DURATION} ${SPRING_BEZIER}`,
        willChange: "transform",
      };

  return (
    <div
      ref={wrapperRef}
      className={className}
      style={{ display: "inline-block", ...wrapperStyle }}
    >
      {children}
    </div>
  );
}

export default MagneticButton;
