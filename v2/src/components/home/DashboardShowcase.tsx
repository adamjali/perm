"use client";

import { useRef } from "react";
import Image from "next/image";
import { Shield } from "lucide-react";
import { motion, useScroll, useTransform } from "motion/react";
import { useReducedMotion } from "@/lib/animations";
import { Lightbox } from "@/components/ui/lightbox";

export function DashboardShowcase() {
  const containerRef = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotion();

  // Scroll-linked transforms — tracks this container relative to viewport
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start end", "end start"],
  });

  // Dashboard container transforms — starts full, fades as user scrolls away
  const dashboardScale = useTransform(scrollYProgress, [0.2, 0.8], [1, 0.92]);
  const dashboardOpacity = useTransform(scrollYProgress, [0.2, 0.7], [1, 0.7]);
  const dashboardY = useTransform(scrollYProgress, [0.2, 0.8], [0, 40]);

  // Browser chrome staggers slightly ahead
  const chromeScale = useTransform(scrollYProgress, [0.2, 0.75], [1, 0.92]);
  const chromeOpacity = useTransform(scrollYProgress, [0.2, 0.65], [1, 0.7]);
  const chromeY = useTransform(scrollYProgress, [0.2, 0.75], [0, 40]);

  return (
    <div ref={containerRef} className="relative lg:order-last">
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
              className="w-full"
              sizes="(max-width: 768px) calc(100vw - 40px), (max-width: 1200px) 50vw, 600px"
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
    </div>
  );
}
