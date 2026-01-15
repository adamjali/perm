"use client";

/**
 * FeaturesGrid Component
 *
 * Six-card grid showcasing PERM Tracker features.
 * Uses neobrutalist Card components with staggered scroll reveal
 * and corner accent decorations.
 *
 */

import {
  Calendar,
  BellRing,
  RefreshCw,
  GitBranch,
  ShieldCheck,
  Moon,
  Sparkles,
} from "lucide-react";
import { ScrollReveal } from "@/components/ui/scroll-reveal";

// ============================================================================
// FEATURE DATA
// ============================================================================

interface Feature {
  icon: typeof Calendar;
  title: string;
  description: string;
}

const features: Feature[] = [
  {
    icon: Calendar,
    title: "Smart Deadlines",
    description:
      "Automatic deadline calculation based on DOL regulations. Never miss a critical filing window.",
  },
  {
    icon: BellRing,
    title: "Smart Notifications",
    description:
      "Get notified about upcoming deadlines, document expirations, and case status changes.",
  },
  {
    icon: RefreshCw,
    title: "Calendar Sync",
    description:
      "Sync deadlines directly to Google Calendar. Access your schedule anywhere, anytime.",
  },
  {
    icon: GitBranch,
    title: "Case Timeline",
    description:
      "Visual timeline showing every milestone in your case with color-coded progress tracking.",
  },
  {
    icon: ShieldCheck,
    title: "Compliance Check",
    description:
      "Built-in validation ensures all recruitment activities meet DOL requirements.",
  },
  {
    icon: Moon,
    title: "Dark Mode",
    description:
      "Easy on the eyes for those late-night filing sessions. Toggle anytime.",
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
        </ScrollReveal>

        {/* Feature cards grid - 6 cards */}
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          {features.map((feature, index) => (
            <ScrollReveal
              key={feature.title}
              direction="up"
              delay={index * 0.08}
            >
              <div className="feature-card group relative border-3 border-border bg-background p-10 shadow-hard overflow-hidden transition-all duration-300 hover:-translate-x-1 hover:-translate-y-1 hover:shadow-hard-lg">
                {/* Corner accent - grows on hover */}
                <div
                  className="absolute -bottom-10 -right-10 h-20 w-20 rotate-45 bg-primary opacity-5 transition-all duration-300 group-hover:opacity-10 group-hover:scale-125"
                  aria-hidden="true"
                />

                {/* Top accent bar - appears on hover */}
                <div
                  className="absolute left-0 right-0 top-0 h-1 bg-primary origin-left scale-x-0 transition-transform duration-300 group-hover:scale-x-100"
                  aria-hidden="true"
                />

                {/* Icon - inverts on hover */}
                <div className="relative mb-6 inline-flex h-14 w-14 items-center justify-center border-2 border-border bg-muted text-primary transition-all duration-300 group-hover:bg-primary group-hover:text-primary-foreground">
                  <feature.icon className="h-7 w-7" strokeWidth={2} />
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
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}

export default FeaturesGrid;
