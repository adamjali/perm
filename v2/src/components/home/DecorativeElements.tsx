"use client";

/**
 * DecorativeElements Component
 *
 * Provides decorative UI elements for the home page:
 * - ScrollProgress: Fixed progress bar at top of page
 * - FloatingIcons: Scroll-based parallax with actual SVG icons (not just squares)
 * - GrainOverlay: Subtle noise texture
 * - FloatingParticles: Small floating dots/sparkles
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
// FLOATING ICONS - Scroll-based parallax with real SVG mini-illustrations
// ============================================================================

interface FloatingIconsProps {
  className?: string;
}

export function FloatingIcons({ className = "" }: FloatingIconsProps) {
  const [scrollY, setScrollY] = React.useState(0);
  const rafRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    const handleScroll = () => {
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
      {/* Mini document icon - top left */}
      <svg
        className="absolute opacity-15"
        style={{
          width: "60px",
          height: "60px",
          top: "15%",
          left: "8%",
          transform: `rotate(-12deg) translateY(${scrollY * 0.08}px)`,
          transition: "transform 0.1s ease-out",
        }}
        viewBox="0 0 60 60"
        fill="none"
      >
        <rect x="8" y="5" width="44" height="50" fill="none" stroke="currentColor" strokeWidth="2.5" />
        <rect x="8" y="5" width="44" height="12" fill="var(--primary)" stroke="currentColor" strokeWidth="2.5" />
        <line x1="16" y1="28" x2="44" y2="28" stroke="currentColor" strokeWidth="2" opacity="0.5" />
        <line x1="16" y1="36" x2="38" y2="36" stroke="currentColor" strokeWidth="2" opacity="0.4" />
        <line x1="16" y1="44" x2="42" y2="44" stroke="currentColor" strokeWidth="2" opacity="0.3" />
      </svg>

      {/* Mini calendar icon - top right area */}
      <svg
        className="absolute opacity-12"
        style={{
          width: "70px",
          height: "70px",
          top: "22%",
          right: "6%",
          transform: `rotate(8deg) translateY(${scrollY * 0.12}px)`,
          transition: "transform 0.1s ease-out",
        }}
        viewBox="0 0 70 70"
        fill="none"
      >
        <rect x="5" y="12" width="60" height="52" fill="none" stroke="currentColor" strokeWidth="2.5" />
        <rect x="5" y="12" width="60" height="14" fill="var(--primary)" stroke="currentColor" strokeWidth="2.5" />
        <rect x="15" y="5" width="6" height="14" fill="currentColor" />
        <rect x="35" y="5" width="6" height="14" fill="currentColor" />
        <rect x="49" y="5" width="6" height="14" fill="currentColor" />
        {/* Grid dots */}
        <circle cx="20" cy="40" r="3" fill="currentColor" opacity="0.3" />
        <circle cx="35" cy="40" r="3" fill="var(--primary)" opacity="0.5" />
        <circle cx="50" cy="40" r="3" fill="currentColor" opacity="0.3" />
        <circle cx="20" cy="52" r="3" fill="currentColor" opacity="0.2" />
        <circle cx="35" cy="52" r="3" fill="currentColor" opacity="0.2" />
      </svg>

      {/* Mini shield icon - mid left */}
      <svg
        className="absolute opacity-10"
        style={{
          width: "55px",
          height: "55px",
          top: "55%",
          left: "4%",
          transform: `rotate(5deg) translateY(${scrollY * 0.15}px)`,
          transition: "transform 0.1s ease-out",
        }}
        viewBox="0 0 55 55"
        fill="none"
      >
        <path
          d="M27.5 5 L48 15 L48 30 Q48 45 27.5 50 Q7 45 7 30 L7 15 Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
        />
        <path d="M20 28 L25 34 L37 22" fill="none" stroke="var(--primary)" strokeWidth="3" strokeLinecap="square" />
      </svg>

      {/* Mini stamp icon - bottom right */}
      <svg
        className="absolute opacity-12"
        style={{
          width: "50px",
          height: "50px",
          bottom: "25%",
          right: "10%",
          transform: `rotate(-6deg) translateY(${scrollY * 0.1}px)`,
          transition: "transform 0.1s ease-out",
        }}
        viewBox="0 0 50 50"
        fill="none"
      >
        <rect x="5" y="28" width="40" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" />
        <rect x="15" y="8" width="20" height="20" fill="var(--primary)" opacity="0.3" stroke="currentColor" strokeWidth="2" />
        <text x="25" y="42" textAnchor="middle" fill="currentColor" fontSize="8" fontWeight="900" fontFamily="var(--font-heading)">OK</text>
      </svg>

      {/* Decorative plus signs */}
      <div className="absolute opacity-10" style={{ top: "35%", right: "15%", transform: `translateY(${scrollY * 0.06}px)` }}>
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <line x1="10" y1="2" x2="10" y2="18" stroke="var(--primary)" strokeWidth="3" />
          <line x1="2" y1="10" x2="18" y2="10" stroke="var(--primary)" strokeWidth="3" />
        </svg>
      </div>

      {/* Decorative dot cluster */}
      <div className="absolute opacity-8" style={{ bottom: "40%", left: "12%", transform: `translateY(${scrollY * 0.09}px)` }}>
        <svg width="30" height="30" viewBox="0 0 30 30" fill="none">
          <circle cx="5" cy="5" r="3" fill="var(--primary)" />
          <circle cx="15" cy="5" r="2" fill="currentColor" />
          <circle cx="25" cy="5" r="3" fill="var(--primary)" opacity="0.5" />
          <circle cx="5" cy="15" r="2" fill="currentColor" opacity="0.5" />
          <circle cx="15" cy="15" r="3" fill="var(--primary)" opacity="0.3" />
        </svg>
      </div>

      {/* Large outline shapes (keeping some for background depth) */}
      <div
        className="absolute border-3 border-primary opacity-8 pointer-events-none"
        style={{
          width: "180px",
          height: "180px",
          top: "10%",
          right: "2%",
          transform: `rotate(12deg) translateY(${scrollY * 0.05}px)`,
          transition: "transform 0.1s ease-out",
        }}
      />

      <div
        className="absolute border-3 opacity-6 pointer-events-none"
        style={{
          width: "140px",
          height: "140px",
          bottom: "15%",
          left: "2%",
          borderColor: "var(--stage-pwd)",
          transform: `rotate(-8deg) translateY(${scrollY * 0.07}px)`,
          transition: "transform 0.1s ease-out",
        }}
      />
    </div>
  );
}

// Keep old name as alias for backwards compatibility
export const FloatingShapes = FloatingIcons;

// ============================================================================
// FLOATING PARTICLES - Tiny animated dots
// ============================================================================

export function FloatingParticles({ className = "" }: { className?: string }) {
  return (
    <div className={`pointer-events-none ${className}`} aria-hidden="true">
      {[...Array(8)].map((_, i) => (
        <div
          key={i}
          className="absolute rounded-full bg-primary"
          style={{
            width: `${3 + (i % 3) * 2}px`,
            height: `${3 + (i % 3) * 2}px`,
            top: `${10 + i * 11}%`,
            left: `${5 + ((i * 13) % 90)}%`,
            opacity: 0.1 + (i % 3) * 0.05,
            animation: `parallax-float-slow ${6 + i * 2}s ease-in-out infinite`,
            animationDelay: `${i * 0.5}s`,
          }}
        />
      ))}
    </div>
  );
}

const DecorativeElements = { ScrollProgress, FloatingIcons, FloatingShapes, FloatingParticles };
export default DecorativeElements;
