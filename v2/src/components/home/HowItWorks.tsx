"use client";

/**
 * HowItWorks Component
 *
 * Three-step process showing how PERM Tracker works.
 * Each step has a custom SVG illustration, animated connector,
 * and bold step numbers with hover effects.
 *
 */

import Image from "next/image";
import { Route } from "lucide-react";
import { ScrollReveal } from "@/components/ui/scroll-reveal";
import {
  RocketLaunchSVG,
  CalendarDeadlineSVG,
  NotificationBellSVG,
} from "@/components/illustrations";

// ============================================================================
// STEP DATA
// ============================================================================

interface Step {
  number: number;
  illustration: React.ReactNode;
  title: string;
  description: string;
  bgImage: string;
  accentColor: string;
}

const steps: Step[] = [
  {
    number: 1,
    illustration: <RocketLaunchSVG size={80} className="text-foreground" />,
    title: "Create Account",
    description: "Sign up for free in seconds. No credit card required.",
    bgImage: "/images/hero/legal-office-wide.jpg",
    accentColor: "var(--primary)",
  },
  {
    number: 2,
    illustration: <CalendarDeadlineSVG size={80} className="text-foreground" />,
    title: "Add Cases",
    description: "Enter your case details. We'll calculate all deadlines automatically.",
    bgImage: "/images/features/calendar-planning.jpg",
    accentColor: "var(--stage-eta9089)",
  },
  {
    number: 3,
    illustration: <NotificationBellSVG size={80} className="text-foreground" />,
    title: "Stay On Track",
    description: "Receive notifications and never miss a deadline again.",
    bgImage: "/images/features/notification-phone.jpg",
    accentColor: "var(--stage-pwd)",
  },
];

// ============================================================================
// COMPONENT
// ============================================================================

export function HowItWorks() {
  return (
    <section id="how" className="relative bg-muted">
      {/* Content container */}
      <div className="mx-auto max-w-[1200px] px-4 py-20 sm:px-8 sm:py-28">
        {/* Section header */}
        <ScrollReveal direction="up" className="mb-16 text-center">
          <div className="mb-4 inline-flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-muted-foreground">
            <Route className="h-3.5 w-3.5" />
            Simple Process
          </div>
          <h2 className="font-heading text-3xl font-black tracking-tight sm:text-4xl lg:text-5xl">
            Get Started in 3 Steps
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-lg text-muted-foreground">
            From signup to case tracking in under a minute.
          </p>
        </ScrollReveal>

        {/* Step cards with connectors */}
        <div className="relative grid gap-0 md:grid-cols-3">
          {steps.map((step, index) => (
            <ScrollReveal
              key={step.number}
              direction="up"
              delay={index * 0.15}
            >
              <div className="group relative text-center px-6 py-8">
                {/* Connector line - positioned at vertical center of step number */}
                {index < steps.length - 1 && (
                  <div
                    className="absolute hidden md:block"
                    style={{
                      top: "52px",
                      left: "calc(50% + 48px)",
                      width: "calc(100% - 96px)",
                      height: "3px",
                      backgroundColor: "var(--border)",
                      zIndex: 1,
                    }}
                    aria-hidden="true"
                  >
                    {/* Arrow at end of connector */}
                    <div
                      className="absolute right-0 top-1/2 -translate-y-1/2 border-y-[5px] border-y-transparent border-l-[8px]"
                      style={{ borderLeftColor: "var(--border)" }}
                    />
                  </div>
                )}

                {/* Step number - big and bold with spring hover */}
                <div className="relative z-10 mx-auto mb-6 inline-flex h-16 w-16 items-center justify-center border-3 border-border bg-primary text-2xl font-heading font-black text-black shadow-hard transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] hover:scale-110 hover:rotate-[-3deg]">
                  {step.number}
                </div>

                {/* Illustration card */}
                <div className="relative mx-auto mb-6 h-24 w-24 overflow-hidden border-2 border-border/30 bg-background/50 p-2">
                  {/* Background image tint */}
                  <div className="absolute inset-0 opacity-[0.06]">
                    <Image
                      src={step.bgImage}
                      alt=""
                      fill
                      className="object-cover"
                      sizes="96px"
                      aria-hidden="true"
                    />
                  </div>
                  <div className="relative flex h-full w-full items-center justify-center transition-transform duration-500 group-hover:scale-110">
                    {step.illustration}
                  </div>
                </div>

                {/* Title */}
                <h3 className="font-heading text-xl font-bold mb-2">
                  {step.title}
                </h3>

                {/* Description */}
                <p className="text-[15px] text-muted-foreground leading-relaxed max-w-[250px] mx-auto">
                  {step.description}
                </p>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}

export default HowItWorks;
