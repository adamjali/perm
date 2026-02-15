/**
 * HeroSection Component (Server Component)
 *
 * Server-rendered hero section for optimal LCP performance.
 * Static content (background, text, trust badges) renders immediately in HTML.
 * Interactive elements are composed as client islands:
 * - HeroCTAs: CTA buttons with navigation loading + MagneticButton
 * - DashboardShowcase: Scroll-linked parallax + Lightbox
 * - FloatingIcons: Decorative scroll-parallax icons
 *
 * CSS entrance animation replaces Framer Motion ScrollReveal for text stagger.
 */

import { Shield, Zap, Clock } from "lucide-react";
import { HeroCTAs } from "./HeroCTAs";
import { DashboardShowcase } from "./DashboardShowcase";
import { FloatingIcons } from "./DecorativeElements";

export function HeroSection() {
  return (
    <section id="hero" className="relative min-h-[calc(100vh-4rem)] overflow-hidden">
      {/* Background texture — CSS only for instant LCP (no image preload) */}
      <div className="absolute inset-0 z-0" aria-hidden="true">
        <div className="absolute inset-0 bg-background" />
        {/* Subtle warm texture via radial gradients (replaces photo through 92% overlay) */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            background:
              "radial-gradient(ellipse at 20% 50%, var(--primary), transparent 70%), " +
              "radial-gradient(ellipse at 80% 20%, hsl(var(--muted)), transparent 50%)",
          }}
        />
        {/* Green gradient accent at bottom */}
        <div
          className="absolute inset-x-0 bottom-0 h-64"
          style={{
            background: "linear-gradient(to top, var(--primary), transparent)",
            opacity: 0.04,
          }}
        />
      </div>

      {/* Floating decorative icons (client island — scroll parallax) */}
      <FloatingIcons className="absolute inset-0" />

      {/* Floating particles (pure CSS animation, server-rendered) */}
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        {Array.from({ length: 8 }, (_, i) => (
          <div
            key={i}
            className="absolute rounded-full bg-primary"
            style={{
              width: `${3 + (i % 3) * 2}px`,
              height: `${3 + (i % 3) * 2}px`,
              top: `${10 + i * 11}%`,
              left: `${5 + ((i * 13) % 90)}%`,
              opacity: 0.1 + (i % 3) * 0.05,
              animation: `parallax-float-slow ${6 + i * 2}s ease-in-out infinite`,
              animationDelay: `${i * 0.5}s`,
            }}
          />
        ))}
      </div>

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
            className="text-foreground/50 dark:text-foreground/40"
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
        <span className="text-[9px] font-bold uppercase tracking-[0.3em] text-foreground/40 dark:text-foreground/35">
          Scroll
        </span>
      </div>

      {/* Content container */}
      <div className="relative z-10 mx-auto flex min-h-[calc(100vh-4rem)] max-w-[1400px] items-center px-4 pb-24 pt-8 sm:px-8 sm:pb-28 sm:pt-12 lg:pb-32 lg:pt-16">
        <div className="grid w-full items-center gap-12 lg:grid-cols-2 lg:gap-16">
          {/* Left column - Text content (CSS entrance stagger) */}
          <div className="flex flex-col gap-6">
            {/* Eyebrow with animated dot */}
            <div className="hero-entrance-item inline-flex items-center gap-2 font-mono text-sm uppercase tracking-widest text-muted-foreground">
              <span className="pulse-dot h-2 w-2 bg-primary" />
              Free for Immigration Attorneys
            </div>

            {/* Headline with shimmer accent */}
            <h1 className="hero-entrance-item font-heading text-4xl font-black leading-[1.1] tracking-[-0.02em] sm:text-5xl lg:text-6xl xl:text-7xl">
              Never Miss a PERM{" "}
              <span className="hero-shimmer-text inline-block bg-primary px-[0.3em] py-[0.1em] text-black shadow-hard transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] hover:-translate-x-1 hover:-translate-y-1 hover:shadow-hard-lg">
                Deadline
              </span>{" "}
              Again
            </h1>

            {/* Subheadline */}
            <p className="hero-entrance-item max-w-xl text-lg leading-relaxed text-muted-foreground sm:text-xl">
              One missed filing window can kill a case. PERM Tracker auto-calculates every DOL deadline, sends reminders, and keeps your entire caseload organized — so you can focus on your clients, not spreadsheets.
            </p>

            {/* CTAs (client island) */}
            <HeroCTAs />

            {/* Trust badges - visual chips */}
            <div className="hero-entrance-item flex flex-wrap gap-3 pt-2">
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
          </div>

          {/* Right column - Dashboard showcase (client island — scroll parallax + lightbox) */}
          <DashboardShowcase />
        </div>
      </div>
    </section>
  );
}

export default HeroSection;
