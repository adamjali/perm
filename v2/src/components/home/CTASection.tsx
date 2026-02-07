"use client";

/**
 * CTASection Component
 *
 * Full-width call-to-action section with primary green background.
 * Features background photograph with mesh gradient overlay,
 * RocketLaunchSVG illustration, floating mini-icons, and dual CTA buttons.
 *
 */

import Image from "next/image";
import { Rocket, Play, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MagneticButton } from "@/components/ui/magnetic-button";
import { ScrollReveal } from "@/components/ui/scroll-reveal";
import { useNavigationLoading } from "@/hooks/useNavigationLoading";
import { RocketLaunchSVG } from "@/components/illustrations";

export function CTASection() {
  const { isNavigating, navigateTo, targetPath } = useNavigationLoading();

  return (
    <section className="relative overflow-hidden bg-primary py-20 text-center sm:py-28">
      {/* Background photo with heavy green overlay */}
      <div className="absolute inset-0 opacity-[0.08] mix-blend-multiply">
        <Image
          src="/images/backgrounds/abstract-green.jpg"
          alt=""
          fill
          className="object-cover"
          sizes="100vw"
          aria-hidden="true"
        />
      </div>

      {/* Decorative corners - larger and more prominent */}
      <div
        className="absolute -left-24 -top-24 h-56 w-56 rotate-45 bg-black/10"
        aria-hidden="true"
      />
      <div
        className="absolute -bottom-24 -right-24 h-56 w-56 rotate-45 bg-black/10"
        aria-hidden="true"
      />
      <div
        className="absolute -bottom-16 -left-16 h-32 w-32 rotate-12 bg-black/5"
        aria-hidden="true"
      />
      <div
        className="absolute -top-16 -right-16 h-32 w-32 -rotate-12 bg-black/5"
        aria-hidden="true"
      />

      {/* Floating decorative SVG icons */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        {/* Mini document */}
        <svg className="absolute top-[15%] left-[8%] opacity-15 rotate-[-12deg]" width="36" height="36" viewBox="0 0 36 36" fill="none">
          <rect x="5" y="3" width="26" height="30" fill="none" stroke="black" strokeWidth="2" />
          <line x1="10" y1="12" x2="26" y2="12" stroke="black" strokeWidth="1.5" opacity="0.5" />
          <line x1="10" y1="18" x2="22" y2="18" stroke="black" strokeWidth="1.5" opacity="0.4" />
          <line x1="10" y1="24" x2="24" y2="24" stroke="black" strokeWidth="1.5" opacity="0.3" />
        </svg>

        {/* Mini checkmark */}
        <svg className="absolute top-[20%] right-[12%] opacity-12 rotate-[6deg]" width="30" height="30" viewBox="0 0 30 30" fill="none">
          <circle cx="15" cy="15" r="12" fill="none" stroke="black" strokeWidth="2" />
          <path d="M10 15 L14 19 L21 11" fill="none" stroke="black" strokeWidth="2.5" strokeLinecap="square" />
        </svg>

        {/* Mini calendar */}
        <svg className="absolute bottom-[18%] left-[15%] opacity-10 rotate-[8deg]" width="32" height="32" viewBox="0 0 32 32" fill="none">
          <rect x="4" y="7" width="24" height="20" fill="none" stroke="black" strokeWidth="2" />
          <rect x="4" y="7" width="24" height="6" fill="black" opacity="0.2" stroke="black" strokeWidth="2" />
          <rect x="9" y="4" width="3" height="6" fill="black" />
          <rect x="20" y="4" width="3" height="6" fill="black" />
        </svg>

        {/* Mini shield */}
        <svg className="absolute bottom-[25%] right-[8%] opacity-12 rotate-[-8deg]" width="28" height="28" viewBox="0 0 28 28" fill="none">
          <path d="M14 3 L24 8 L24 15 Q24 23 14 25 Q4 23 4 15 L4 8 Z" fill="none" stroke="black" strokeWidth="2" />
          <path d="M10 14 L13 17 L19 11" fill="none" stroke="black" strokeWidth="2" strokeLinecap="square" />
        </svg>

        {/* Plus signs */}
        <svg className="absolute top-[40%] left-[4%] opacity-8" width="16" height="16" viewBox="0 0 16 16" fill="none">
          <line x1="8" y1="1" x2="8" y2="15" stroke="black" strokeWidth="2.5" />
          <line x1="1" y1="8" x2="15" y2="8" stroke="black" strokeWidth="2.5" />
        </svg>
        <svg className="absolute bottom-[35%] right-[5%] opacity-8" width="14" height="14" viewBox="0 0 14 14" fill="none">
          <line x1="7" y1="1" x2="7" y2="13" stroke="black" strokeWidth="2" />
          <line x1="1" y1="7" x2="13" y2="7" stroke="black" strokeWidth="2" />
        </svg>
      </div>

      {/* Content */}
      <div className="relative z-10 mx-auto max-w-3xl px-4 sm:px-8">
        {/* Single stagger container (1 Intersection Observer) */}
        <ScrollReveal direction="up" stagger>
          {/* Rocket illustration */}
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center">
            <RocketLaunchSVG size={80} className="text-black" />
          </div>

          <div>
            <h2 className="font-heading text-3xl font-black text-black sm:text-4xl lg:text-5xl">
              Stop Tracking Deadlines Manually
            </h2>
            <p className="mx-auto mt-4 max-w-lg text-lg text-black/70">
              Set up in 2 minutes. Free forever. No credit card required.
            </p>
          </div>

          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <MagneticButton>
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
                Start Tracking Cases Free
              </Button>
            </MagneticButton>
            <MagneticButton>
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
            </MagneticButton>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}

export default CTASection;
