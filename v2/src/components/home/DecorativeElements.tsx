"use client";

/**
 * DecorativeElements Component
 *
 * Provides decorative UI elements for the home page:
 * - ScrollProgress: Fixed progress bar at top of page
 * - FloatingShapes: Scroll-based parallax shapes for hero section
 *
 */

import * as React from "react";

// ============================================================================
// SCROLL PROGRESS
// ============================================================================

export function ScrollProgress() {
  const [progress, setProgress] = React.useState(0);
  const rafRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    const handleScroll = () => {
      // Throttle with requestAnimationFrame
      if (rafRef.current !== null) return;

      rafRef.current = requestAnimationFrame(() => {
        const scrollTop = document.documentElement.scrollTop;
        const scrollHeight =
          document.documentElement.scrollHeight - window.innerHeight;
        const progressValue = scrollHeight > 0 ? (scrollTop / scrollHeight) * 100 : 0;
        setProgress(progressValue);
        rafRef.current = null;
      });
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleScroll);
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  return (
    <div
      className="scroll-progress"
      style={{ width: `${progress}%` }}
      aria-hidden="true"
    />
  );
}

// ============================================================================
// FLOATING SHAPES - Scroll-based parallax (no bobbing)
// ============================================================================

interface FloatingShapesProps {
  className?: string;
}

export function FloatingShapes({ className = "" }: FloatingShapesProps) {
  const [scrollY, setScrollY] = React.useState(0);
  const rafRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    const handleScroll = () => {
      // Throttle with requestAnimationFrame
      if (rafRef.current !== null) return;

      rafRef.current = requestAnimationFrame(() => {
        setScrollY(window.scrollY);
        rafRef.current = null;
      });
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleScroll);
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  return (
    <div className={`pointer-events-none ${className}`} style={{ zIndex: 0 }} aria-hidden="true">
      {/* Shape 1 - Large green square outline - slow parallax */}
      <div
        className="absolute border-3 border-primary opacity-15 pointer-events-none"
        style={{
          width: "200px",
          height: "200px",
          top: "20%",
          right: "5%",
          transform: `rotate(12deg) translateY(${scrollY * 0.1}px)`,
          transition: "transform 0.1s ease-out",
        }}
      />

      {/* Shape 2 - Medium blue square outline - medium parallax */}
      <div
        className="absolute border-3 opacity-15 pointer-events-none"
        style={{
          width: "150px",
          height: "150px",
          bottom: "30%",
          left: "3%",
          borderColor: "var(--stage-pwd)",
          transform: `rotate(-8deg) translateY(${scrollY * 0.15}px)`,
          transition: "transform 0.1s ease-out",
        }}
      />
    </div>
  );
}

const DecorativeElements = { ScrollProgress, FloatingShapes };
export default DecorativeElements;
