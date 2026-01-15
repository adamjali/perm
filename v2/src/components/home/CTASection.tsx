"use client";

/**
 * CTASection Component
 *
 * Full-width call-to-action section with primary green background.
 * Features decorative corner elements and dual CTA buttons.
 *
 */

import { Rocket, Play, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollReveal } from "@/components/ui/scroll-reveal";
import { useNavigationLoading } from "@/hooks/useNavigationLoading";

// ============================================================================
// COMPONENT
// ============================================================================

export function CTASection() {
  const { isNavigating, navigateTo, targetPath } = useNavigationLoading();

  return (
    <section className="relative overflow-hidden bg-primary py-20 text-center sm:py-28">
      {/* Decorative corners */}
      <div
        className="absolute -left-24 -top-24 h-48 w-48 rotate-45 bg-black/10"
        aria-hidden="true"
      />
      <div
        className="absolute -bottom-24 -right-24 h-48 w-48 rotate-45 bg-black/10"
        aria-hidden="true"
      />

      {/* Content */}
      <div className="relative z-10 mx-auto max-w-3xl px-4 sm:px-8">
        <ScrollReveal direction="up">
          <h2 className="font-heading text-3xl font-black text-black sm:text-4xl lg:text-5xl">
            Ready to Track Smarter?
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-lg text-black/70">
            Join immigration attorneys who never miss a deadline. Get started
            free today.
          </p>
        </ScrollReveal>

        <ScrollReveal direction="up" delay={0.1}>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <Button
              size="lg"
              className="h-14 border-3 border-black bg-black px-8 font-heading text-base font-bold uppercase tracking-[0.05em] text-white transition-all duration-150 hover:bg-white hover:text-black hover:-translate-x-0.5 hover:-translate-y-0.5 active:translate-x-0.5 active:translate-y-0.5 dark:border-black dark:bg-black dark:text-white dark:hover:bg-white dark:hover:text-black"
              style={{ boxShadow: "4px 4px 0px #000" }}
              onClick={() => navigateTo("/signup")}
              disabled={isNavigating}
            >
              {isNavigating && targetPath === "/signup" ? (
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              ) : (
                <Rocket className="mr-2 h-5 w-5" />
              )}
              Get Started Free
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="h-14 border-3 border-black bg-transparent px-8 font-heading text-base font-bold uppercase tracking-[0.05em] text-black transition-all duration-150 hover:bg-black hover:text-white hover:-translate-x-0.5 hover:-translate-y-0.5 active:translate-x-0.5 active:translate-y-0.5 dark:border-black dark:bg-transparent dark:text-black dark:hover:bg-black dark:hover:text-white"
              style={{ boxShadow: "4px 4px 0px #000" }}
              onClick={() => navigateTo("/demo")}
              disabled={isNavigating}
            >
              {isNavigating && targetPath === "/demo" ? (
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              ) : (
                <Play className="mr-2 h-5 w-5" />
              )}
              View Demo
            </Button>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}

export default CTASection;
