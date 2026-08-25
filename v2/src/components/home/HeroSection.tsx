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
import { Loader2, Shield, Zap, Clock } from "lucide-react";
import { motion, useScroll, useTransform } from "motion/react";
import { ScrollReveal } from "@/components/ui/scroll-reveal";
import { useNavigationLoading } from "@/hooks/useNavigationLoading";
import { useReducedMotion } from "@/lib/animations";
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
    <section ref={heroRef} id="hero" className="relative overflow-hidden lg:min-h-[calc(100vh-4rem)]">

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
        </svg>{" "}
        <div
          className="animate-scroll-line h-8 w-[1.5px] origin-top"
          style={{ background: "linear-gradient(to bottom, currentColor, transparent)" }}
        />
        <span className="text-[9px] font-bold uppercase tracking-[0.3em] text-foreground/60 dark:text-foreground/50">
          Scroll
        </span>
      </div>

      {/* Content container */}
      <div className="relative z-10 mx-auto flex max-w-[1400px] items-center px-4 pb-10 pt-6 sm:px-8 sm:pb-14 sm:pt-10 lg:min-h-[calc(100vh-4rem)] lg:pb-24 lg:pt-12">
        <div className="grid w-full items-center gap-10 lg:grid-cols-2 lg:gap-12">
          {/* Left column - Text content (single stagger container) */}
          <ScrollReveal direction="up" stagger className="flex flex-col gap-6">
            {/* Eyebrow with animated dot */}
            <div className="inline-flex items-center gap-2 font-mono text-sm uppercase tracking-widest text-muted-foreground">
              <span className="h-2 w-2 bg-primary" aria-hidden="true" />
              Live DOL data · Automatic deadlines
            </div>

            {/* Headline with shimmer accent */}
            <h1 className="font-heading text-3xl font-black leading-[1.1] tracking-[-0.02em] sm:text-4xl lg:text-5xl xl:text-6xl">
              The whole PERM process,{" "}
              <span className="inline-block bg-primary px-[0.3em] py-[0.1em] text-black shadow-hard transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] hover:-translate-x-1 hover:-translate-y-1 hover:shadow-hard-lg">
                tracked
              </span>
            </h1>{" "}

            {/* Subheadline: the problem, then the two halves of the answer. */}
            <p className="max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
              A PERM case takes a year and one missed date can end it. We show
              where DOL&apos;s queue stands from its own published data, and we
              compute every deadline in your case automatically. Free.
            </p>

            {/* Two doors: the site's whole demarcation, made at the top.
                One product, two readers — the person waiting and the person
                managing — each named in their own words, each linking into
                the other's half further down the page. */}
            <div className="grid gap-4 pt-4 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => navigateTo("/tools")}
                disabled={isNavigating}
                className="group flex flex-col border-3 border-border bg-tint-primary p-5 text-left shadow-hard transition-all duration-150 hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-hard-lg active:translate-x-0.5 active:translate-y-0.5 active:shadow-none"
              >
                <span className="font-mono text-xs font-bold uppercase tracking-wider text-foreground/60">
                  Waiting on a case
                </span>{" "}
                <span className="mt-2 font-heading text-lg font-black leading-tight">
                  See where the queue stands
                </span>{" "}
                <span className="mt-2 text-sm leading-relaxed text-foreground/70">
                  Live DOL figures, decision estimates, and one email when
                  your month comes up.
                </span>{" "}
                <span className="mt-3 inline-flex items-center gap-2 font-bold">
                  {isNavigating && targetPath === "/tools" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : null}
                  Open the data →
                </span>
              </button>
              <button
                type="button"
                onClick={() => navigateTo("/signup")}
                disabled={isNavigating}
                className="group flex flex-col border-3 border-border bg-foreground p-5 text-left text-background shadow-hard transition-all duration-150 hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-hard-lg active:translate-x-0.5 active:translate-y-0.5 active:shadow-none"
              >
                <span className="font-mono text-xs font-bold uppercase tracking-wider text-background/60">
                  Managing cases
                </span>{" "}
                <span className="mt-2 font-heading text-lg font-black leading-tight">
                  Track every deadline
                </span>{" "}
                <span className="mt-2 text-sm leading-relaxed text-background/70">
                  Filing windows, PWD expirations and audit responses computed
                  per case, with alerts and calendar sync.
                </span>{" "}
                <span className="mt-3 inline-flex items-center gap-2 font-bold text-background underline decoration-primary decoration-2 underline-offset-4">
                  {isNavigating && targetPath === "/signup" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : null}
                  Start tracking free →
                </span>
              </button>
            </div>

            {/* Trust badges - visual chips */}
            <div className="flex flex-wrap gap-3 pt-2">
              <div className="inline-flex items-center gap-1.5 border-2 border-border/30 bg-muted/50 px-3 py-1.5 font-mono text-xs text-muted-foreground">
                <Shield className="h-3.5 w-3.5 text-primary" />
                256-bit Encrypted
              </div>{" "}
              <div className="inline-flex items-center gap-1.5 border-2 border-border/30 bg-muted/50 px-3 py-1.5 font-mono text-xs text-muted-foreground">
                <Zap className="h-3.5 w-3.5 text-primary" />
                No Credit Card Required
              </div>{" "}
              <div className="inline-flex items-center gap-1.5 border-2 border-border/30 bg-muted/50 px-3 py-1.5 font-mono text-xs text-muted-foreground">
                <Clock className="h-3.5 w-3.5 text-primary" />
                11 Deadline Types Tracked
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
                className="flex items-center gap-2 border-4 border-b-0 border-black bg-foreground px-4 py-2.5"
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
                </div>{" "}
                <div className="ml-3 flex-1 bg-background/10 px-3 py-1 font-mono text-[10px] text-background/60">
                  permtracker.app/dashboard
                </div>
              </motion.div>

              {/* Screenshot */}
              <Lightbox src="/images/hero-showcase.png" alt="PERM Tracker dashboard showing case timeline, deadline tracking, and status updates">
                <div className="border-4 border-black shadow-hard-lg">
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
                </div>{" "}
                <div>
                  <div className="font-heading text-xs font-bold">No Credit Card</div>{" "}
                  <div className="font-mono text-[10px] text-muted-foreground">Get started free</div>
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
