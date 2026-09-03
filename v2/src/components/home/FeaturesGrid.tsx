"use client";

/**
 * FeaturesGrid Component
 *
 * Six-card grid showcasing PERM Tracker features.
 * Each card has a custom SVG illustration, background image tint,
 * animated hover states, and neobrutalist styling.
 *
 */

import Link from "next/link";
import { SparkleIcon } from "@phosphor-icons/react";
import { ScrollReveal } from "@/components/ui/scroll-reveal";
import {
  CalendarDeadlineSVG,
  NotificationBellSVG,
  CalendarSyncSVG,
  TimelineSVG,
  ShieldCheckSVG,
} from "@/components/illustrations";

interface Feature {
  title: string;
  description: string;
  illustration: React.ReactNode;
  accentColor: string;
  learnMoreHref?: string;
  learnMoreText?: string;
}

const features: Feature[] = [
  {
    title: "Auto Deadline Calculation",
    description:
      "Enter one date and 11 downstream deadlines update: PWD expiration, filing windows, I-140 cutoffs.",
    illustration: <CalendarDeadlineSVG size={64} className="text-foreground" />,
    accentColor: "var(--stage-pwd)",
    learnMoreHref: "/guides/tracking-perm-deadlines",
    learnMoreText: "See how deadlines work \u2192",
  },
  {
    title: "Smart Alerts",
    description:
      "Email, push and in-app reminders before each deadline, plus a Monday digest.",
    illustration: <NotificationBellSVG size={64} className="text-foreground" />,
    accentColor: "var(--primary)",
  },
  {
    title: "Google Calendar Sync",
    description:
      "Every PERM deadline goes onto your Google Calendar automatically.",
    illustration: <CalendarSyncSVG size={64} className="text-foreground" />,
    accentColor: "var(--stage-recruitment)",
  },
  {
    title: "Visual Case Timeline",
    description:
      "A color-coded timeline per case: what needs attention, what's on track.",
    illustration: (
      <div className="flex items-center justify-center w-[64px] h-[64px]">
        <TimelineSVG size={120} className="text-foreground" />
      </div>
    ),
    accentColor: "var(--stage-eta9089)",
  },
  {
    title: "DOL Compliance Checks",
    description:
      "Catches missing recruitment steps, expired PWDs and filing window violations.",
    illustration: <ShieldCheckSVG size={64} className="text-foreground" />,
    accentColor: "var(--stage-i140)",
    learnMoreHref: "/blog/common-perm-audit-triggers",
    learnMoreText: "Common audit triggers \u2192",
  },
  {
    title: "AI Case Assistant",
    description:
      "Ask about your cases, update them, check deadlines and search PERM regulations, in plain English.",
    illustration: (
      <svg width="64" height="64" viewBox="0 0 200 200" fill="none" className="text-foreground" aria-hidden="true">
        {/* Chat bubble */}
        <rect x="30" y="40" width="140" height="90" rx="8" fill="currentColor" opacity="0.08" stroke="currentColor" strokeWidth="3" />
        <polygon points="60,130 80,130 70,150" fill="currentColor" opacity="0.08" stroke="currentColor" strokeWidth="3" />
        {/* Sparkle */}
        <path d="M140 55 L143 48 L146 55 L153 58 L146 61 L143 68 L140 61 L133 58 Z" fill="var(--primary)" />
        <path d="M60 65 L61.5 61 L63 65 L67 66.5 L63 68 L61.5 72 L60 68 L56 66.5 Z" fill="var(--primary)" opacity="0.5" />
        {/* Text lines */}
        <line x1="55" y1="80" x2="125" y2="80" stroke="currentColor" strokeWidth="3" opacity="0.3" strokeLinecap="round" />
        <line x1="55" y1="95" x2="105" y2="95" stroke="currentColor" strokeWidth="3" opacity="0.2" strokeLinecap="round" />
        <line x1="55" y1="110" x2="115" y2="110" stroke="currentColor" strokeWidth="3" opacity="0.15" strokeLinecap="round" />
      </svg>
    ),
    accentColor: "var(--stage-closed)",
  },
];

/**
 * Individual feature card. The lift on hover is the hard shadow's press-and-
 * lift (see below), not a 3D tilt; the useTilt hook this once used was removed.
 */
function FeatureCard({ feature }: { feature: Feature }) {
  // No tilt and no photo underlay: the hard shadow's press-and-lift is this
  // design's whole hover vocabulary, and six ghosted photographs behind six
  // first-party illustrations were two visual languages on one card.
  return (
    <div className="feature-card group relative flex h-full flex-col border-2 border-border bg-background overflow-hidden shadow-hard transition-all duration-300 hover:-translate-x-1 hover:-translate-y-1 hover:shadow-hard-lg">
      {/* Top accent bar - appears on hover */}
      <div
        className="absolute left-0 right-0 top-0 h-1.5 origin-left scale-x-0 transition-transform duration-300 group-hover:scale-x-100"
        style={{ backgroundColor: feature.accentColor }}
        aria-hidden="true"
      />

      {/* Corner accent - grows on hover */}
      <div
        className="absolute -bottom-10 -right-10 h-24 w-24 rotate-45 opacity-5 transition-all duration-300 group-hover:opacity-10 group-hover:scale-125"
        style={{ backgroundColor: feature.accentColor }}
        aria-hidden="true"
      />

      {/* Content */}
      <div className="relative flex flex-1 flex-col p-5 sm:p-6">
        {/* Illustration */}
        <div className="mb-4 flex h-[64px] items-center">
          <div className="transition-transform duration-500 group-hover:scale-105">
            {feature.illustration}
          </div>
        </div>

        {/* Title */}
        <h3 className="relative font-heading text-lg font-bold mb-2">
          {feature.title}
        </h3>{" "}

        {/* Description */}
        <p className="relative flex-1 text-sm text-muted-foreground leading-relaxed">
          {feature.description}
        </p>

        {/* Learn more link */}
        {feature.learnMoreHref && (
          <Link
            href={feature.learnMoreHref}
            className="relative mt-3 inline-block text-sm font-semibold text-foreground underline decoration-primary decoration-2 underline-offset-2 transition-colors duration-150 hover:text-primary"
          >
            {feature.learnMoreText}
          </Link>
        )}
      </div>
    </div>
  );
}

export function FeaturesGrid() {
  return (
    <section id="features" className="relative">
      {/* Content container */}
      <div className="mx-auto max-w-[1400px] px-4 pt-12 pb-16 sm:px-8 sm:pt-14 sm:pb-20">
        {/* Section header */}
        <ScrollReveal direction="up" className="mb-8 text-center sm:mb-10">
          <div className="mb-4 inline-flex items-center gap-2 font-mono text-sm uppercase tracking-widest text-muted-foreground">
            <SparkleIcon className="h-3.5 w-3.5" />
            What You Get
          </div>{" "}
          <h2 className="font-heading text-2xl font-black tracking-tight sm:text-3xl lg:text-4xl">
            Built for PERM Practitioners
          </h2>
        </ScrollReveal>

        {/* Feature cards grid - single stagger container */}
        <ScrollReveal direction="up" stagger className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <FeatureCard key={feature.title} feature={feature} />
          ))}
        </ScrollReveal>
      </div>
    </section>
  );
}

export default FeaturesGrid;
