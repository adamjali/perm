"use client";

/**
 * FeaturesGrid Component
 *
 * Six-card grid showcasing PERM Tracker features.
 * Each card has a custom SVG illustration, background image tint,
 * animated hover states, and neobrutalist styling.
 *
 */

import Image from "next/image";
import { Sparkles } from "lucide-react";
import { ScrollReveal } from "@/components/ui/scroll-reveal";
import {
  CalendarDeadlineSVG,
  NotificationBellSVG,
  GlobePassportSVG,
  TimelineSVG,
  ShieldCheckSVG,
} from "@/components/illustrations";

// ============================================================================
// FEATURE DATA
// ============================================================================

interface Feature {
  title: string;
  description: string;
  illustration: React.ReactNode;
  bgImage: string;
  accentColor: string;
}

const features: Feature[] = [
  {
    title: "Smart Deadlines",
    description:
      "Automatic deadline calculation based on DOL regulations. Never miss a critical filing window.",
    illustration: <CalendarDeadlineSVG size={100} className="text-foreground" />,
    bgImage: "/images/features/calendar-planning.jpg",
    accentColor: "var(--stage-pwd)",
  },
  {
    title: "Smart Notifications",
    description:
      "Get notified about upcoming deadlines, document expirations, and case status changes.",
    illustration: <NotificationBellSVG size={100} className="text-foreground" />,
    bgImage: "/images/features/notification-phone.jpg",
    accentColor: "var(--primary)",
  },
  {
    title: "Calendar Sync",
    description:
      "Sync deadlines directly to Google Calendar. Access your schedule anywhere, anytime.",
    illustration: <GlobePassportSVG size={100} className="text-foreground" />,
    bgImage: "/images/features/team-meeting.jpg",
    accentColor: "var(--stage-recruitment)",
  },
  {
    title: "Case Timeline",
    description:
      "Visual timeline showing every milestone in your case with color-coded progress tracking.",
    illustration: (
      <div className="flex items-center justify-center w-[100px] h-[100px]">
        <TimelineSVG size={180} className="text-foreground" />
      </div>
    ),
    bgImage: "/images/journey/filing-forms.jpg",
    accentColor: "var(--stage-eta9089)",
  },
  {
    title: "Compliance Check",
    description:
      "Built-in validation ensures all recruitment activities meet DOL requirements.",
    illustration: <ShieldCheckSVG size={100} className="text-foreground" />,
    bgImage: "/images/journey/pwd-documents.jpg",
    accentColor: "var(--stage-i140)",
  },
  {
    title: "Dark Mode",
    description:
      "Easy on the eyes for those late-night filing sessions. Toggle anytime.",
    illustration: (
      <svg width="100" height="100" viewBox="0 0 200 200" fill="none" className="text-foreground" aria-hidden="true">
        {/* Moon */}
        <circle cx="100" cy="90" r="55" fill="currentColor" opacity="0.1" stroke="currentColor" strokeWidth="3" />
        <circle cx="125" cy="70" r="45" fill="var(--background)" />
        {/* Stars */}
        <g opacity="0.5">
          <path d="M50 50 L52 46 L54 50 L58 52 L54 54 L52 58 L50 54 L46 52 Z" fill="var(--primary)" />
          <path d="M140 40 L141.5 37 L143 40 L146 41.5 L143 43 L141.5 46 L140 43 L137 41.5 Z" fill="var(--primary)" />
          <path d="M60 130 L61 128 L62 130 L64 131 L62 132 L61 134 L60 132 L58 131 Z" fill="currentColor" />
          <path d="M155 120 L156.5 117 L158 120 L161 121.5 L158 123 L156.5 126 L155 123 L152 121.5 Z" fill="currentColor" />
        </g>
        {/* ZZZ */}
        <text x="70" y="120" fill="var(--primary)" fontSize="20" fontWeight="900" fontFamily="var(--font-heading)" opacity="0.4">Z</text>
        <text x="55" y="140" fill="var(--primary)" fontSize="16" fontWeight="900" fontFamily="var(--font-heading)" opacity="0.3">z</text>
      </svg>
    ),
    bgImage: "/images/backgrounds/dark-geometric.jpg",
    accentColor: "var(--stage-closed)",
  },
];

// ============================================================================
// COMPONENT
// ============================================================================

export function FeaturesGrid() {
  return (
    <section id="features" className="relative">
      {/* Content container */}
      <div className="mx-auto max-w-[1400px] px-4 py-20 sm:px-8 sm:py-28">
        {/* Section header */}
        <ScrollReveal direction="up" className="mb-12 text-center sm:mb-16">
          <div className="mb-4 inline-flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5" />
            Powerful Features
          </div>
          <h2 className="font-heading text-3xl font-black tracking-tight sm:text-4xl lg:text-5xl">
            Everything You Need
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-lg text-muted-foreground">
            Built specifically for immigration attorneys handling PERM labor certification cases.
          </p>
        </ScrollReveal>

        {/* Feature cards grid - 6 cards */}
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          {features.map((feature, index) => (
            <ScrollReveal
              key={feature.title}
              direction="up"
              delay={index * 0.08}
            >
              <div className="feature-card group relative border-3 border-border bg-background overflow-hidden shadow-hard transition-all duration-300 hover:-translate-x-1 hover:-translate-y-1 hover:shadow-hard-lg">
                {/* Background image - subtle, tinted */}
                <div className="absolute inset-0 opacity-[0.04] group-hover:opacity-[0.08] transition-opacity duration-500">
                  <Image
                    src={feature.bgImage}
                    alt=""
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 100vw, 33vw"
                    aria-hidden="true"
                  />
                </div>

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
                <div className="relative p-8 sm:p-10">
                  {/* Illustration */}
                  <div className="mb-6 flex h-[100px] items-center">
                    <div className="transition-transform duration-500 group-hover:scale-105">
                      {feature.illustration}
                    </div>
                  </div>

                  {/* Title */}
                  <h3 className="relative font-heading text-xl font-bold mb-3">
                    {feature.title}
                  </h3>

                  {/* Description */}
                  <p className="relative text-[15px] text-muted-foreground leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}

export default FeaturesGrid;
