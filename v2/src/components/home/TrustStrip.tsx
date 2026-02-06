"use client";

/**
 * TrustStrip Component
 *
 * Animated marquee strip displaying trust badges with mini SVG illustrations.
 * Features continuous scrolling animation with duplicated content for seamless loop.
 *
 */

// ============================================================================
// TRUST BADGE DATA
// ============================================================================

interface TrustBadge {
  icon: React.ReactNode;
  text: string;
}

const trustBadges: TrustBadge[] = [
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
        <path d="M11 2 L19 6 L19 12 Q19 18 11 20 Q3 18 3 12 L3 6 Z" fill="none" stroke="currentColor" strokeWidth="2" />
        <path d="M7.5 11.5 L10 14 L15 8.5" fill="none" stroke="var(--primary)" strokeWidth="2.5" strokeLinecap="square" />
      </svg>
    ),
    text: "Bank-Level Security",
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
        <circle cx="11" cy="11" r="8" fill="none" stroke="currentColor" strokeWidth="2" />
        <path d="M7 11 L10 14 L15 8" fill="none" stroke="var(--primary)" strokeWidth="2.5" strokeLinecap="square" />
      </svg>
    ),
    text: "DOL Compliant",
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
        <path d="M11 2 L13.5 7.5 L19.5 8 L15 12.5 L16 18.5 L11 15.5 L6 18.5 L7 12.5 L2.5 8 L8.5 7.5 Z" fill="var(--primary)" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    ),
    text: "5-Star Rated",
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
        <path d="M13 2 L9 12 L14 12 L10 20" fill="none" stroke="var(--primary)" strokeWidth="2.5" strokeLinecap="square" />
      </svg>
    ),
    text: "Real-time Updates",
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
    text: "Calendar Sync",
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
    text: "Smart Notifications",
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
        <rect x="4" y="3" width="14" height="16" fill="none" stroke="currentColor" strokeWidth="2" />
        <rect x="4" y="3" width="14" height="4" fill="var(--primary)" stroke="currentColor" strokeWidth="2" />
        <line x1="7" y1="11" x2="15" y2="11" stroke="currentColor" strokeWidth="1.5" opacity="0.5" />
        <line x1="7" y1="14" x2="13" y2="14" stroke="currentColor" strokeWidth="1.5" opacity="0.4" />
      </svg>
    ),
    text: "Case Tracking",
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
        <circle cx="11" cy="11" r="8" fill="none" stroke="currentColor" strokeWidth="2" />
        <line x1="11" y1="6" x2="11" y2="11" stroke="currentColor" strokeWidth="2.5" />
        <line x1="11" y1="11" x2="15" y2="13" stroke="var(--primary)" strokeWidth="2" />
      </svg>
    ),
    text: "Auto Deadlines",
  },
];

// ============================================================================
// COMPONENT
// ============================================================================

export function TrustStrip() {
  // Duplicate badges for seamless infinite scroll
  const allBadges = [...trustBadges, ...trustBadges];

  return (
    <section className="bg-foreground text-background overflow-hidden py-5 relative">
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
