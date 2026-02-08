"use client";

/**
 * SocialProofSection (formerly TestimonialsSection)
 *
 * Trust badges and social proof.
 * Neobrutalist styling consistent with other homepage sections.
 */

import { Star } from "lucide-react";
import { ScrollReveal } from "@/components/ui/scroll-reveal";

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

export function TestimonialsSection() {
  return (
    <section className="relative py-16 sm:py-20 overflow-hidden">
      <div className="mx-auto max-w-[1400px] px-4 sm:px-8">
        {/* All content in single stagger container (1 Intersection Observer) */}
        <ScrollReveal direction="up" stagger>
          {/* Section header */}
          <div className="mb-10 text-center">
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
          </div>

          {/* Trust badges row */}
          <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-4">
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
      </div>
    </section>
  );
}

export default TestimonialsSection;
