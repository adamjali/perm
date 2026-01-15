"use client";

/**
 * HowItWorks Component
 *
 * Three-step process showing how PERM Tracker works.
 * Features muted background, step connectors, and bold step numbers.
 *
 */

import { ClipboardPlus, Calendar, Bell, Route } from "lucide-react";
import { ScrollReveal } from "@/components/ui/scroll-reveal";

// ============================================================================
// STEP DATA
// ============================================================================

interface Step {
  number: number;
  icon: typeof ClipboardPlus;
  title: string;
  description: string;
}

const steps: Step[] = [
  {
    number: 1,
    icon: ClipboardPlus,
    title: "Create Account",
    description: "Sign up for free in seconds. No credit card required.",
  },
  {
    number: 2,
    icon: Calendar,
    title: "Add Cases",
    description: "Enter your case details. We'll calculate all deadlines automatically.",
  },
  {
    number: 3,
    icon: Bell,
    title: "Stay On Track",
    description: "Receive notifications and never miss a deadline again.",
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
        </ScrollReveal>

        {/* Step cards with connectors */}
        <div className="relative grid gap-0 md:grid-cols-3">
          {steps.map((step, index) => (
            <ScrollReveal
              key={step.number}
              direction="up"
              delay={index * 0.15}
            >
              <div className="relative text-center px-8 py-8">
                {/* Connector line - positioned at vertical center of step number */}
                {index < steps.length - 1 && (
                  <div
                    className="absolute hidden md:block"
                    style={{
                      top: "32px", // Half of 64px step number
                      left: "calc(50% + 40px)",
                      width: "calc(100% - 80px)",
                      height: "3px",
                      backgroundColor: "var(--border)",
                      zIndex: 1,
                    }}
                    aria-hidden="true"
                  />
                )}

                {/* Step number - big and bold with spring hover */}
                <div className="relative z-10 mx-auto mb-6 inline-flex h-16 w-16 items-center justify-center border-3 border-border bg-primary text-2xl font-heading font-black text-black shadow-hard transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] hover:scale-110 hover:rotate-[-3deg]">
                  {step.number}
                </div>

                {/* Title */}
                <h3 className="font-heading text-xl font-bold mb-2">
                  {step.title}
                </h3>

                {/* Description */}
                <p className="text-[15px] text-muted-foreground leading-relaxed">
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
