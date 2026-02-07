/**
 * DemoCTA Component
 *
 * Neobrutalist call-to-action section for the demo page.
 * Bold headline, feature highlights, and dual buttons.
 */

"use client";

import { ArrowRight, Sparkles, Loader2, Check } from "lucide-react";
import { ScrollReveal } from "@/components/ui/scroll-reveal";
import { useNavigationLoading } from "@/hooks/useNavigationLoading";

export function DemoCTA() {
  const { isNavigating, navigateTo, targetPath } = useNavigationLoading();

  return (
    <section
      className="relative border-t-3 border-border bg-muted"
      aria-labelledby="cta-heading"
    >
      <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        <ScrollReveal direction="up">
          <div className="border-3 border-border bg-background p-8 shadow-hard-lg sm:p-12 lg:p-16">
            {/* Headline */}
            <h2
              id="cta-heading"
              className="text-center font-heading text-2xl font-black tracking-tight sm:text-3xl lg:text-4xl"
            >
              Ready to track your{" "}
              <span className="inline-block bg-primary px-2 py-0.5 text-black shadow-hard-sm">
                real
              </span>{" "}
              cases?
            </h2>

            <p className="mx-auto mt-4 max-w-2xl text-center text-muted-foreground">
              Everything you just tried in this demo — auto-calculated deadlines,
              calendar view, case progress — works the same way with your real caseload.
            </p>

            {/* Feature highlights */}
            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              {[
                { title: "Free to Use", desc: "No credit card required" },
                { title: "2 Min Setup", desc: "Sign in with Google" },
                { title: "AI Assistant", desc: "Ask questions in plain English" },
              ].map((item) => (
                <div
                  key={item.title}
                  className="border-2 border-border bg-muted p-4 text-center"
                >
                  <div className="flex items-center justify-center gap-1.5">
                    <Check className="h-3.5 w-3.5 text-primary" />
                    <h3 className="font-heading text-sm font-bold uppercase tracking-wide">
                      {item.title}
                    </h3>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{item.desc}</p>
                </div>
              ))}
            </div>

            {/* AI teaser */}
            <div className="mt-8 flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Sparkles className="h-4 w-4 text-primary" />
              <span>AI-powered case management included</span>
            </div>

            {/* CTA buttons */}
            <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <button
                type="button"
                className="inline-flex h-14 w-full items-center justify-center gap-2 border-3 border-border bg-primary px-8 font-heading text-base font-bold uppercase tracking-[0.05em] text-black shadow-hard transition-all duration-150 hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-hard-lg active:translate-x-0.5 active:translate-y-0.5 active:shadow-none sm:w-auto"
                onClick={() => navigateTo("/signup")}
                disabled={isNavigating}
              >
                {isNavigating && targetPath === "/signup" ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <ArrowRight className="h-5 w-5" />
                )}
                Start Tracking Cases Free
              </button>
              <button
                type="button"
                className="inline-flex h-14 w-full items-center justify-center gap-2 border-3 border-border bg-background px-8 font-heading text-base font-bold uppercase tracking-[0.05em] shadow-hard transition-all duration-150 hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-hard-lg sm:w-auto"
                onClick={() => navigateTo("/")}
                disabled={isNavigating}
              >
                {isNavigating && targetPath === "/" ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : null}
                Learn More
              </button>
            </div>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
