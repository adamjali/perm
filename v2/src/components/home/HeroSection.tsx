"use client";

/**
 * HeroSection Component
 *
 * Visually rich hero section with:
 * - Background photograph with dark overlay
 * - SVG illustrations
 * - Floating SVG icons with parallax
 * - Shimmer gradient on "Effortlessly" accent
 * - Dashboard screenshot with neobrutalist frame
 * - Trust badges with icons
 * - Animated particles
 * - Scroll-linked dashboard reveal (scale + opacity + y)
 *
 */

import { useRef } from "react";
import Image from "next/image";
import { Loader2, Rocket, Play, Shield, Zap, Clock } from "lucide-react";
import { motion, useScroll, useTransform } from "motion/react";
import { Button } from "@/components/ui/button";
import { MagneticButton } from "@/components/ui/magnetic-button";
import { ScrollReveal } from "@/components/ui/scroll-reveal";
import { useNavigationLoading } from "@/hooks/useNavigationLoading";
import { useReducedMotion } from "@/lib/animations";
import { FloatingIcons, FloatingParticles } from "./DecorativeElements";
import { Lightbox } from "@/components/ui/lightbox";

export function HeroSection() {
  const { isNavigating, navigateTo, targetPath } = useNavigationLoading();
  const heroRef = useRef<HTMLElement>(null);
  const reducedMotion = useReducedMotion();

  // Scroll-linked transforms for the dashboard reveal
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  });

  // Dashboard container transforms — starts full, fades as user scrolls away
  const dashboardScale = useTransform(scrollYProgress, [0, 0.8], [1, 0.92]);
  const dashboardOpacity = useTransform(scrollYProgress, [0, 0.6], [1, 0.7]);
  const dashboardY = useTransform(scrollYProgress, [0, 0.8], [0, 40]);

  // Browser chrome staggers slightly ahead
  const chromeScale = useTransform(scrollYProgress, [0, 0.75], [1, 0.92]);
  const chromeOpacity = useTransform(scrollYProgress, [0, 0.55], [1, 0.7]);
  const chromeY = useTransform(scrollYProgress, [0, 0.75], [0, 40]);


  return (
    <section ref={heroRef} id="hero" className="relative min-h-[calc(100vh-4rem)] overflow-hidden">
      {/* Background photo with dark overlay */}
      <div className="absolute inset-0 z-0">
        <Image
          src="/images/hero/legal-office-wide.jpg"
          alt=""
          fill
          priority
          fetchPriority="high"
          className="object-cover"
          sizes="100vw"
          aria-hidden="true"
        />
        {/* Dark overlay - light mode vs dark mode */}
        <div className="absolute inset-0 bg-background/92 dark:bg-background/95" />
        {/* Green gradient accent at bottom */}
        <div
          className="absolute inset-x-0 bottom-0 h-64"
          style={{
            background: "linear-gradient(to top, var(--primary), transparent)",
            opacity: 0.04,
          }}
          aria-hidden="true"
        />
      </div>

      {/* Floating decorative icons */}
      <FloatingIcons className="absolute inset-0" />
      <FloatingParticles className="absolute inset-0" />

      {/* Scroll indicator — mouse + line + text (CSS animations for reliability) */}
      <div
        className="pointer-events-none absolute bottom-10 left-1/2 z-20 hidden -translate-x-1/2 flex-col items-center gap-2 sm:flex"
        aria-hidden="true"
      >
        <svg width="18" height="28" viewBox="0 0 18 28" fill="none">
          <rect
            x="1.25"
            y="1.25"
            width="15.5"
            height="25.5"
            rx="7.75"
            stroke="currentColor"
            strokeWidth="2"
            className="text-foreground/60 dark:text-foreground/50"
          />
          <circle
            cx="9"
            cy="8"
            r="1.5"
            fill="currentColor"
            className="animate-scroll-wheel text-foreground/60 dark:text-foreground/50"
          />
        </svg>
        <div
          className="animate-scroll-line h-8 w-[1.5px] origin-top"
          style={{ background: "linear-gradient(to bottom, currentColor, transparent)" }}
        />
        <span className="text-[9px] font-bold uppercase tracking-[0.3em] text-foreground/60 dark:text-foreground/50">
          Scroll
        </span>
      </div>

      {/* Content container */}
      <div className="relative z-10 mx-auto flex min-h-[calc(100vh-4rem)] max-w-[1400px] items-center px-4 pb-16 pt-6 sm:px-8 sm:pb-20 sm:pt-10 lg:pb-24 lg:pt-12">
        <div className="grid w-full items-center gap-10 lg:grid-cols-2 lg:gap-12">
          {/* Left column - Text content (single stagger container) */}
          <ScrollReveal direction="up" stagger className="flex flex-col gap-6">
            {/* Eyebrow with animated dot */}
            <div className="inline-flex items-center gap-2 font-mono text-sm uppercase tracking-widest text-muted-foreground">
              <span className="pulse-dot h-2 w-2 bg-primary" />
              Free for Immigration Attorneys
            </div>

            {/* Headline with shimmer accent */}
            <h1 className="font-heading text-3xl font-black leading-[1.1] tracking-[-0.02em] sm:text-4xl lg:text-5xl xl:text-6xl">
              Never Miss a PERM{" "}
              <span className="hero-shimmer-text inline-block bg-primary px-[0.3em] py-[0.1em] text-black shadow-hard transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] hover:-translate-x-1 hover:-translate-y-1 hover:shadow-hard-lg">
                Deadline
              </span>{" "}
              Again
            </h1>

            {/* Subheadline */}
            <p className="max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
              One missed filing window can kill a case. PERM Tracker auto-calculates every DOL deadline, sends reminders, and keeps your entire caseload organized — so you can focus on your clients, not spreadsheets.
            </p>

            {/* CTAs */}
            <div className="flex flex-wrap gap-4 pt-4">
              <MagneticButton>
                <Button
                  size="lg"
                  className="h-12 border-3 border-border px-6 font-heading text-sm font-bold uppercase tracking-[0.05em] shadow-hard transition-all duration-150 hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-hard-lg active:translate-x-0.5 active:translate-y-0.5 active:shadow-none"
                  onClick={() => navigateTo("/signup")}
                  disabled={isNavigating}
                >
                  {isNavigating && targetPath === "/signup" ? (
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  ) : (
                    <Rocket className="mr-2 h-5 w-5" />
                  )}
                  Start Tracking Cases Free
                </Button>
              </MagneticButton>
              <MagneticButton>
                <Button
                  variant="outline"
                  size="lg"
                  className="h-12 border-3 border-border bg-transparent px-6 font-heading text-sm font-bold uppercase tracking-[0.05em] text-foreground shadow-hard transition-all duration-150 hover:bg-foreground hover:text-background hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-hard-lg active:translate-x-0.5 active:translate-y-0.5 active:shadow-none dark:bg-[#404040] dark:border-[rgba(255,255,255,0.3)] dark:hover:bg-primary dark:hover:text-black dark:hover:border-primary"
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
              </MagneticButton>
            </div>

            {/* Trust badges - visual chips */}
            <div className="flex flex-wrap gap-3 pt-2">
              <div className="inline-flex items-center gap-1.5 border-2 border-border/30 bg-muted/50 px-3 py-1.5 font-mono text-xs text-muted-foreground">
                <Shield className="h-3.5 w-3.5 text-primary" />
                20 CFR 656 Compliant
              </div>
              <div className="inline-flex items-center gap-1.5 border-2 border-border/30 bg-muted/50 px-3 py-1.5 font-mono text-xs text-muted-foreground">
                <Zap className="h-3.5 w-3.5 text-primary" />
                No Credit Card Required
              </div>
              <div className="inline-flex items-center gap-1.5 border-2 border-border/30 bg-muted/50 px-3 py-1.5 font-mono text-xs text-muted-foreground">
                <Clock className="h-3.5 w-3.5 text-primary" />
                Set Up in 2 Minutes
              </div>
            </div>
          </ScrollReveal>

          {/* Right column - Visual showcase */}
          <ScrollReveal direction="right" delay={0.15} className="relative lg:order-last">
            {/* Decorative corner elements */}
            <div
              className="absolute -right-6 -top-6 h-24 w-24 rotate-45 bg-primary opacity-15"
              aria-hidden="true"
            />
            <div
              className="absolute -bottom-8 -left-8 h-28 w-28 rotate-12 bg-primary opacity-10"
              aria-hidden="true"
            />

            {/* Dashboard screenshot with neobrutalist frame + scroll-linked reveal */}
            <motion.div
              className="relative"
              style={
                reducedMotion
                  ? undefined
                  : {
                      scale: dashboardScale,
                      opacity: dashboardOpacity,
                      y: dashboardY,
                    }
              }
            >
              {/* Browser chrome bar (staggers slightly ahead) */}
              <motion.div
                className="flex items-center gap-2 border-4 border-b-0 border-black bg-foreground px-4 py-2.5 dark:border-white/20"
                style={
                  reducedMotion
                    ? undefined
                    : {
                        scale: chromeScale,
                        opacity: chromeOpacity,
                        y: chromeY,
                      }
                }
              >
                <div className="flex gap-1.5">
                  <div className="h-3 w-3 bg-[#FF5F57]" />
                  <div className="h-3 w-3 bg-[#FFBD2E]" />
                  <div className="h-3 w-3 bg-[#28CA41]" />
                </div>
                <div className="ml-3 flex-1 bg-background/10 px-3 py-1 font-mono text-[10px] text-background/60">
                  permtracker.app/dashboard
                </div>
              </motion.div>

              {/* Screenshot */}
              <Lightbox src="/images/hero-showcase.png" alt="PERM Tracker dashboard showing case timeline, deadline tracking, and status updates">
                <div className="border-4 border-black shadow-hard-lg dark:border-white/20">
                  <Image
                    src="/images/hero-showcase.png"
                    alt="PERM Tracker dashboard showing case timeline, deadline tracking, and status updates"
                    width={800}
                    height={600}
                    priority
                    className="w-full"
                    sizes="(max-width: 768px) 90vw, (max-width: 1200px) 50vw, 600px"
                  />
                </div>
              </Lightbox>

              {/* Floating badge - bottom left overlapping the screenshot */}
              <div className="absolute -bottom-4 -left-4 z-10 flex items-center gap-2 border-3 border-border bg-background px-4 py-2.5 shadow-hard">
                <div className="flex h-8 w-8 items-center justify-center bg-primary">
                  <Shield className="h-4 w-4 text-black" />
                </div>
                <div>
                  <div className="font-heading text-xs font-bold">100% Free</div>
                  <div className="font-mono text-[10px] text-muted-foreground">No credit card</div>
                </div>
              </div>
            </motion.div>
          </ScrollReveal>
        </div>
      </div>
    </section>
  );
}

export default HeroSection;
