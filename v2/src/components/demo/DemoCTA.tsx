/**
 * DemoCTA Component
 *
 * Call-to-action section for the demo page encouraging users to sign up.
 * Features a bold headline, value proposition, and dual buttons.
 *
 */

"use client";

import { ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollReveal } from "@/components/ui/scroll-reveal";
import { useNavigationLoading } from "@/hooks/useNavigationLoading";
import { Loader2 } from "lucide-react";

// ============================================================================
// Component
// ============================================================================

/**
 * DemoCTA - Conversion call-to-action section.
 *
 * Features:
 * - Prominent headline with accent styling
 * - Value proposition bullet points
 * - Primary "Start Free" and secondary "Learn More" buttons
 * - AI assistant mention as subtle value-add
 * - Neobrutalist styling (borders, hard shadows)
 * - Responsive layout
 */
export function DemoCTA() {
  const { isNavigating, navigateTo, targetPath } = useNavigationLoading();

  return (
    <section
      className="relative border-t-2 border-border bg-accent/30"
      aria-labelledby="cta-heading"
    >
      <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        <ScrollReveal direction="up">
          {/* Main CTA container with shadow */}
          <div className="border-2 border-border bg-background p-8 shadow-hard-lg sm:p-12 lg:p-16">
            {/* Headline */}
            <h2
              id="cta-heading"
              className="text-center font-heading text-2xl font-black tracking-tight sm:text-3xl lg:text-4xl"
            >
              Ready to track your{" "}
              <span className="inline-block bg-primary px-2 py-0.5 text-black">
                real
              </span>{" "}
              cases?
            </h2>

            {/* Value proposition */}
            <p className="mx-auto mt-4 max-w-2xl text-center text-muted-foreground">
              Join immigration attorneys who trust PERM Tracker to manage their
              cases, never miss a deadline, and stay organized through every
              stage of the process.
            </p>

            {/* Feature highlights */}
            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              <FeatureItem
                title="Free Forever"
                description="No credit card, no trial period"
              />
              <FeatureItem
                title="All Stages Tracked"
                description="PWD to I-140 and beyond"
              />
              <FeatureItem
                title="Smart Reminders"
                description="Never miss a critical deadline"
              />
            </div>

            {/* AI assistant teaser - subtle */}
            <div className="mt-8 flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Sparkles className="size-4 text-primary" />
              <span>AI-powered assistance included</span>
            </div>

            {/* CTA buttons */}
            <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Button
                size="lg"
                className="h-14 w-full px-8 font-heading text-base font-bold uppercase tracking-wide shadow-hard hover:-translate-y-0.5 hover:shadow-hard-lg sm:w-auto"
                onClick={() => navigateTo("/signup")}
                disabled={isNavigating}
              >
                {isNavigating && targetPath === "/signup" ? (
                  <Loader2 className="mr-2 size-5 animate-spin" />
                ) : (
                  <ArrowRight className="mr-2 size-5" />
                )}
                Start Free
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="h-14 w-full px-8 font-heading text-base font-bold uppercase tracking-wide sm:w-auto"
                onClick={() => navigateTo("/")}
                disabled={isNavigating}
              >
                {isNavigating && targetPath === "/" ? (
                  <Loader2 className="mr-2 size-5 animate-spin" />
                ) : null}
                Learn More
              </Button>
            </div>

            {/* AI commands teaser - very subtle */}
            <div className="mt-10 border-t border-border/50 pt-6">
              <p className="text-center text-xs text-muted-foreground/70">
                Try asking:{" "}
                <span className="font-mono text-muted-foreground">
                  &quot;Add a new case for Acme Corp&quot;
                </span>{" "}
                or{" "}
                <span className="font-mono text-muted-foreground">
                  &quot;What deadlines are coming up?&quot;
                </span>
              </p>
            </div>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}

// ============================================================================
// Sub-components
// ============================================================================

interface FeatureItemProps {
  title: string;
  description: string;
}

function FeatureItem({ title, description }: FeatureItemProps) {
  return (
    <div className="border-2 border-border bg-card p-4 text-center">
      <h3 className="font-heading text-sm font-bold uppercase tracking-wide">
        {title}
      </h3>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
    </div>
  );
}
