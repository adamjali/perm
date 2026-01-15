"use client";

/**
 * TrustStrip Component
 *
 * Animated marquee strip displaying trust badges.
 * Features continuous scrolling animation with duplicated content for seamless loop.
 *
 */

import {
  ShieldCheck,
  CheckCircle,
  Star,
  Zap,
  CalendarCheck,
  Bell,
} from "lucide-react";

// ============================================================================
// TRUST BADGE DATA
// ============================================================================

interface TrustBadge {
  icon: typeof ShieldCheck;
  text: string;
}

const trustBadges: TrustBadge[] = [
  { icon: ShieldCheck, text: "Bank-Level Security" },
  { icon: CheckCircle, text: "DOL Compliant" },
  { icon: Star, text: "5-Star Rated" },
  { icon: Zap, text: "Real-time Updates" },
  { icon: CalendarCheck, text: "Calendar Sync" },
  { icon: Bell, text: "Smart Notifications" },
];

// ============================================================================
// COMPONENT
// ============================================================================

export function TrustStrip() {
  // Duplicate badges for seamless infinite scroll
  const allBadges = [...trustBadges, ...trustBadges];

  return (
    <section className="bg-foreground text-background overflow-hidden py-6">
      <div className="marquee">
        {allBadges.map((badge, index) => (
          <div
            key={`${badge.text}-${index}`}
            className="flex items-center gap-3 font-heading text-sm font-semibold uppercase tracking-[0.1em]"
          >
            <badge.icon className="h-5 w-5 text-primary" />
            <span>{badge.text}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

export default TrustStrip;
