"use client";

/**
 * SocialProofSection (formerly TestimonialsSection)
 *
 * Trust badges, Senja reviews widget, and links to leave a review / G2.
 * Neobrutalist styling consistent with other homepage sections.
 */

import Script from "next/script";
import { Star, MessageSquarePlus, ExternalLink } from "lucide-react";
import { ScrollReveal } from "@/components/ui/scroll-reveal";

// ============================================================================
// TRUST BADGE DATA
// ============================================================================

interface TrustBadge {
  icon: React.ReactNode;
  label: string;
}

const trustBadges: TrustBadge[] = [
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <path d="M10 2 L17 6 L17 11 Q17 17 10 18 Q3 17 3 11 L3 6 Z" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <path d="M7 10 L9 12 L13 8" fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinecap="square" />
      </svg>
    ),
    label: "Encrypted Data",
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <rect x="3" y="4" width="14" height="12" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <path d="M3 4 L10 10 L17 4" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="15" cy="5" r="3" fill="var(--primary)" stroke="currentColor" strokeWidth="1" />
      </svg>
    ),
    label: "DOL Compliant",
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <circle cx="7" cy="7" r="4" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="13" cy="7" r="4" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="10" cy="13" r="4" fill="none" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    ),
    label: "Built for Attorneys",
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <line x1="2" y1="10" x2="18" y2="10" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="5" cy="10" r="2.5" fill="var(--stage-pwd)" stroke="currentColor" strokeWidth="1" />
        <circle cx="10" cy="10" r="2.5" fill="var(--stage-recruitment)" stroke="currentColor" strokeWidth="1" />
        <circle cx="15" cy="10" r="2.5" fill="var(--stage-eta9089)" stroke="currentColor" strokeWidth="1" />
      </svg>
    ),
    label: "5 PERM Stages",
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <circle cx="10" cy="10" r="7" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <line x1="10" y1="5" x2="10" y2="10" stroke="currentColor" strokeWidth="2" />
        <line x1="10" y1="10" x2="14" y2="12" stroke="var(--primary)" strokeWidth="1.5" />
      </svg>
    ),
    label: "Real-Time Updates",
  },
];

// ============================================================================
// COMPONENT
// ============================================================================

export function TestimonialsSection() {
  return (
    <section className="relative py-16 sm:py-20 overflow-hidden">
      <div className="mx-auto max-w-[1400px] px-4 sm:px-8">
        {/* Section header */}
        <ScrollReveal direction="up" className="mb-10 text-center">
          <div className="mb-4 inline-flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-muted-foreground">
            <Star className="h-3.5 w-3.5" />
            Trusted by Practitioners
          </div>
          <h2 className="font-heading text-3xl font-black tracking-tight sm:text-4xl lg:text-5xl">
            What Our Users Say
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-lg text-muted-foreground">
            Immigration attorneys trust PERM Tracker to manage their cases and never miss a deadline.
          </p>
        </ScrollReveal>

        {/* Trust badges row */}
        <ScrollReveal direction="up" delay={0.05}>
          <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-4 mb-12">
            {trustBadges.map((badge) => (
              <div
                key={badge.label}
                className="flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-muted-foreground"
              >
                <span className="flex-shrink-0">{badge.icon}</span>
                <span>{badge.label}</span>
              </div>
            ))}
          </div>
        </ScrollReveal>

        {/* Senja Reviews Widget */}
        <ScrollReveal direction="up" delay={0.1}>
          <div>
            <Script
              src="https://widget.senja.io/widget/3563db96-3a71-4d2a-b7e8-70550d4dd814/platform.js"
              strategy="lazyOnload"
            />
            <div
              className="senja-embed"
              data-id="3563db96-3a71-4d2a-b7e8-70550d4dd814"
              data-mode="shadow"
              data-lazyload="false"
              style={{ display: "block", width: "100%" }}
            />
          </div>
        </ScrollReveal>

        {/* Review links */}
        <ScrollReveal direction="up" delay={0.2}>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <a
              href="https://senja.io/p/perm-tracker/r/FXAjpr"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 border-3 border-border bg-primary px-5 py-2.5 font-heading text-sm font-bold uppercase tracking-wide text-black shadow-hard transition-all duration-150 hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-hard-lg active:translate-x-0.5 active:translate-y-0.5 active:shadow-none"
            >
              <MessageSquarePlus className="h-4 w-4" />
              Leave a Review
            </a>
            <a
              href="https://www.g2.com/products/perm-tracker/reviews"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 border-3 border-border bg-background px-5 py-2.5 font-heading text-sm font-bold uppercase tracking-wide text-foreground shadow-hard transition-all duration-150 hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-hard-lg active:translate-x-0.5 active:translate-y-0.5 active:shadow-none"
            >
              <ExternalLink className="h-4 w-4" />
              Review us on G2
            </a>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}

export default TestimonialsSection;
