"use client";

/**
 * HeroSection Component
 *
 * Hero section for the home page with bold neobrutalist styling.
 * Features the signature "Effortlessly" accent text, floating shapes,
 * and an animated eyebrow badge.
 *
 */

import Image from "next/image";
import { Loader2, Rocket, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollReveal } from "@/components/ui/scroll-reveal";
import { useNavigationLoading } from "@/hooks/useNavigationLoading";
import { FloatingShapes } from "./DecorativeElements";

// ============================================================================
// COMPONENT
// ============================================================================

export function HeroSection() {
  const { isNavigating, navigateTo, targetPath } = useNavigationLoading();

  return (
    <section id="hero" className="relative min-h-[calc(100vh-4rem)] overflow-hidden">
      {/* Floating decorative shapes */}
      <FloatingShapes className="absolute inset-0" />

      {/* Content container - z-10 to be above floating shapes */}
      <div className="relative z-10 mx-auto flex min-h-[calc(100vh-4rem)] max-w-[1400px] items-center px-4 py-12 sm:px-8 sm:py-16 lg:py-20">
        <div className="grid w-full items-center gap-12 lg:grid-cols-2 lg:gap-20">
          {/* Left column - Text content */}
          <div className="flex flex-col gap-6">
            {/* Eyebrow with animated dot */}
            <ScrollReveal direction="up">
              <div className="inline-flex items-center gap-2 font-mono text-sm uppercase tracking-widest text-muted-foreground">
                <span className="pulse-dot h-2 w-2 bg-primary" />
                Case Management Reimagined
              </div>
            </ScrollReveal>

            {/* Headline - v1 style with accent box */}
            <ScrollReveal direction="up" delay={0.05}>
              <h1 className="font-heading text-4xl font-black leading-[1.1] tracking-[-0.02em] sm:text-5xl lg:text-6xl xl:text-7xl">
                Track Your PERM Cases{" "}
                <span className="inline-block bg-primary px-[0.3em] py-[0.1em] text-black shadow-hard transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] hover:-translate-x-1 hover:-translate-y-1 hover:shadow-hard-lg">
                  Effortlessly
                </span>
              </h1>
            </ScrollReveal>

            {/* Subheadline */}
            <ScrollReveal direction="up" delay={0.1}>
              <p className="max-w-xl text-lg leading-relaxed text-muted-foreground sm:text-xl">
                Free, modern case management for immigration attorneys.
                Never miss a deadline, stay organized, and manage your PERM cases with confidence.
              </p>
            </ScrollReveal>

            {/* CTAs */}
            <ScrollReveal direction="up" delay={0.15}>
              <div className="flex flex-wrap gap-4 pt-4">
                <Button
                  size="lg"
                  className="h-14 border-3 border-border px-8 font-heading text-base font-bold uppercase tracking-[0.05em] shadow-hard transition-all duration-150 hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-hard-lg active:translate-x-0.5 active:translate-y-0.5 active:shadow-none"
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
                  className="h-14 border-3 border-border bg-transparent px-8 font-heading text-base font-bold uppercase tracking-[0.05em] text-foreground shadow-hard transition-all duration-150 hover:bg-foreground hover:text-background hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-hard-lg active:translate-x-0.5 active:translate-y-0.5 active:shadow-none dark:bg-[#404040] dark:border-[rgba(255,255,255,0.3)] dark:hover:bg-primary dark:hover:text-black dark:hover:border-primary"
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

            {/* Trust signal */}
            <ScrollReveal direction="up" delay={0.2}>
              <p className="mono text-sm text-muted-foreground">
                No credit card required <span className="opacity-50">·</span> Free forever <span className="opacity-50">·</span> Built for attorneys
              </p>
            </ScrollReveal>
          </div>

          {/* Right column - Hero image */}
          <ScrollReveal direction="right" delay={0.15} className="relative lg:order-last">
            {/* Decorative corner elements */}
            <div
              className="absolute -right-10 -top-10 h-28 w-28 rotate-45 bg-primary opacity-10"
              aria-hidden="true"
            />
            <div
              className="absolute -bottom-16 -left-16 h-32 w-32 rotate-12 bg-primary opacity-10"
              aria-hidden="true"
            />

            {/* Image wrapper with shadow */}
            <div className="relative border-4 border-black shadow-hard-lg dark:border-white/20">
              <Image
                src="/images/hero-showcase.png"
                alt="PERM Tracker dashboard showing case timeline, deadline tracking, and status updates"
                width={800}
                height={600}
                priority
                className="w-full"
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 600px"
              />
            </div>
          </ScrollReveal>
        </div>
      </div>
    </section>
  );
}

export default HeroSection;
