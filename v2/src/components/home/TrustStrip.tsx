"use client";

/**
 * TrustStrip Component
 *
 * Animated marquee strip displaying trust badges with mini SVG illustrations.
 * Features continuous scrolling animation with duplicated content for seamless loop.
 *
 */

import { useRef, useCallback, useEffect } from "react";

interface TrustBadge {
  icon: React.ReactNode;
  text: string;
}

const trustBadges: TrustBadge[] = [
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
        <circle cx="11" cy="11" r="8" fill="none" stroke="currentColor" strokeWidth="2" />
        <line x1="11" y1="6" x2="11" y2="11" stroke="currentColor" strokeWidth="2.5" />
        <line x1="11" y1="11" x2="15" y2="13" stroke="var(--primary)" strokeWidth="2" />
      </svg>
    ),
    text: "11 Auto-Calculated Deadlines",
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
        <path d="M6 9 Q6 3 11 3 Q16 3 16 9 L16 10 L6 10 Z" fill="var(--primary)" opacity="0.3" stroke="currentColor" strokeWidth="2" />
        <path d="M4 10 L18 10" stroke="currentColor" strokeWidth="2.5" />
        <line x1="11" y1="10" x2="11" y2="16" stroke="currentColor" strokeWidth="2" />
        <circle cx="11" cy="17" r="1.5" fill="var(--primary)" />
      </svg>
    ),
    text: "Email + Push Alerts",
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
        <rect x="3" y="5" width="16" height="14" fill="none" stroke="currentColor" strokeWidth="2" />
        <rect x="3" y="5" width="16" height="4" fill="var(--primary)" stroke="currentColor" strokeWidth="2" />
        <rect x="6" y="3" width="2" height="4" fill="currentColor" />
        <rect x="14" y="3" width="2" height="4" fill="currentColor" />
        <circle cx="11" cy="14" r="2" fill="var(--primary)" />
      </svg>
    ),
    text: "Google Calendar Sync",
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
        <path d="M13 2 L9 12 L14 12 L10 20" fill="none" stroke="var(--primary)" strokeWidth="2.5" strokeLinecap="square" />
      </svg>
    ),
    text: "AI Case Assistant",
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
        <rect x="3" y="4" width="16" height="12" fill="none" stroke="currentColor" strokeWidth="2" />
        <path d="M3 4 L11 11 L19 4" fill="none" stroke="var(--primary)" strokeWidth="2" />
      </svg>
    ),
    text: "Weekly Deadline Digest",
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
        <line x1="4" y1="6" x2="18" y2="6" stroke="currentColor" strokeWidth="2" />
        <line x1="4" y1="11" x2="18" y2="11" stroke="currentColor" strokeWidth="2" />
        <line x1="4" y1="16" x2="18" y2="16" stroke="currentColor" strokeWidth="2" />
        <circle cx="7" cy="6" r="2" fill="var(--primary)" />
        <circle cx="13" cy="11" r="2" fill="var(--primary)" />
        <circle cx="10" cy="16" r="2" fill="var(--primary)" />
      </svg>
    ),
    text: "Visual Case Timeline",
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
        <path d="M11 2 L19 6 L19 12 Q19 18 11 20 Q3 18 3 12 L3 6 Z" fill="none" stroke="currentColor" strokeWidth="2" />
        <path d="M7.5 11.5 L10 14 L15 8.5" fill="none" stroke="var(--primary)" strokeWidth="2.5" strokeLinecap="square" />
      </svg>
    ),
    text: "256-bit Encryption",
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
        <rect x="4" y="3" width="14" height="16" fill="none" stroke="currentColor" strokeWidth="2" />
        <rect x="4" y="3" width="14" height="4" fill="var(--primary)" stroke="currentColor" strokeWidth="2" />
        <path d="M8 12 L14 12 M11 12 L11 16 L14 16" fill="none" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    ),
    text: "CSV + JSON Export",
  },
];

export function TrustStrip() {
  // Duplicate badges for seamless infinite scroll
  const allBadges = [...trustBadges, ...trustBadges];
  const containerRef = useRef<HTMLElement>(null);
  const dragState = useRef({ isDragging: false, startX: 0, scrollLeft: 0 });

  // Only capture intentional horizontal scroll (trackpad sideways swipe) — let vertical scroll pass through
  const handleWheel = useCallback((e: WheelEvent) => {
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY) && Math.abs(e.deltaX) > 2) {
      e.preventDefault();
      const container = containerRef.current;
      if (container) {
        container.scrollLeft += e.deltaX;
      }
    }
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    container.addEventListener("wheel", handleWheel, { passive: false });
    return () => container.removeEventListener("wheel", handleWheel);
  }, [handleWheel]);

  // Mouse drag to scroll horizontally
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    const container = containerRef.current;
    if (!container) return;
    dragState.current = { isDragging: true, startX: e.pageX - container.offsetLeft, scrollLeft: container.scrollLeft };
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragState.current.isDragging) return;
    e.preventDefault();
    const container = containerRef.current;
    if (!container) return;
    const x = e.pageX - container.offsetLeft;
    container.scrollLeft = dragState.current.scrollLeft - (x - dragState.current.startX);
  }, []);

  const handleMouseUp = useCallback(() => {
    dragState.current.isDragging = false;
  }, []);

  return (
    <section
      ref={containerRef}
      className="bg-foreground text-background overflow-hidden py-5 relative overscroll-x-none"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* Subtle top/bottom border accents */}
      <div className="absolute inset-x-0 top-0 h-[2px] bg-primary opacity-40" aria-hidden="true" />
      <div className="absolute inset-x-0 bottom-0 h-[2px] bg-primary opacity-20" aria-hidden="true" />

      <div className="marquee">
        {allBadges.map((badge, index) => (
          <div
            key={`${badge.text}-${index}`}
            className="flex items-center gap-2.5 font-heading text-sm font-semibold uppercase tracking-[0.1em]"
          >
            <span className="flex-shrink-0">{badge.icon}</span>
            <span>{badge.text}</span>
            {/* Separator dot */}
            <span className="ml-6 mr-2 h-1.5 w-1.5 bg-primary opacity-50" aria-hidden="true" />
          </div>
        ))}
      </div>
    </section>
  );
}

export default TrustStrip;
