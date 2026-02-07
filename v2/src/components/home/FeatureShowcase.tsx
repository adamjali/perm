"use client";

/**
 * FeatureShowcase Component
 *
 * Six-item showcase highlighting PERM-specific features.
 * Uses simpler layout than FeaturesGrid - feature bullets not full cards.
 * Staggered scroll reveal animations for visual polish.
 *
 */

import {
  CalendarCheck,
  Users,
  Calculator,
  Bell,
  Calendar,
  BarChart3,
} from "lucide-react";
import { ScrollReveal } from "@/components/ui/scroll-reveal";

interface ShowcaseFeature {
  icon: typeof CalendarCheck;
  title: string;
  description: string;
}

const showcaseFeatures: ShowcaseFeature[] = [
  {
    icon: CalendarCheck,
    title: "PWD Expiration Tracking",
    description:
      "Auto-calculated per 20 CFR 656.40. April-June determinations get 90-day windows, others expire June 30 of the following year. Never miss a renewal.",
  },
  {
    icon: Users,
    title: "Recruitment Period Management",
    description:
      "Track all 7 required recruitment methods including Sunday ads, job orders, and the 3 additional professional steps. One dashboard, complete visibility.",
  },
  {
    icon: Calculator,
    title: "Filing Window Calculator",
    description:
      "The 30-180 day ETA 9089 filing window is calculated automatically from your last recruitment date. Color-coded status shows when you're clear to file.",
  },
  {
    icon: Bell,
    title: "RFI/RFE Alerts",
    description:
      "Response deadlines are strict—30 days for RFIs with no extensions. Get alerts at 14, 7, and 3 days out so you never miss a deadline.",
  },
  {
    icon: Calendar,
    title: "Calendar Integration",
    description:
      "Two-way Google Calendar sync. Deadlines, filing windows, and milestones appear in your calendar automatically. Updates flow both directions.",
  },
  {
    icon: BarChart3,
    title: "Case Timeline View",
    description:
      "Visual progress from PWD through I-140. See exactly where each case stands, what's completed, and what's coming next—all at a glance.",
  },
];

export function FeatureShowcase() {
  return (
    <section className="relative">
      {/* Content container */}
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-8 sm:py-28">
        {/* Section header */}
        <ScrollReveal direction="up" className="mb-16 text-center">
          <h2 className="font-heading text-3xl font-black tracking-tight sm:text-4xl lg:text-5xl">
            Powerful Features
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
            Everything you need to manage PERM cases efficiently
          </p>
        </ScrollReveal>

        {/* Feature grid - 3 columns on desktop, 2 on tablet, 1 on mobile */}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {showcaseFeatures.map((feature, index) => (
            <ScrollReveal
              key={feature.title}
              direction="up"
              delay={index * 0.08}
              className="h-full"
            >
              <div className="group flex h-full flex-col gap-4 border-2 border-black bg-card p-6 shadow-hard transition-all hover:-translate-y-1 hover:shadow-hard-lg dark:border-white/20">
                {/* Icon container */}
                <div className="flex h-12 w-12 shrink-0 items-center justify-center border-2 border-black bg-primary shadow-hard-sm dark:border-black">
                  <feature.icon className="h-6 w-6 text-black" strokeWidth={2} />
                </div>

                {/* Text content */}
                <div className="flex-1">
                  <h3 className="font-heading text-lg font-bold">
                    {feature.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
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

export default FeatureShowcase;
