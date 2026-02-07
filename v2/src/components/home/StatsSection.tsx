"use client";

/**
 * StatsSection Component
 *
 * Statistics section with count-up animation on scroll.
 * Features background photograph, decorative SVG elements,
 * animated stat counters with scramble effect, and SVG ring
 * animations on icons.
 *
 */

import * as React from "react";
import Image from "next/image";
import { useInView } from "motion/react";
import { useReducedMotion } from "@/lib/animations";

interface Stat {
  value: number;
  suffix?: string;
  label: string;
  icon: React.ReactNode;
}

const stats: Stat[] = [
  {
    value: 15,
    suffix: "+",
    label: "Deadlines Auto-Tracked",
    icon: (
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
        <rect x="3" y="6" width="22" height="18" fill="none" stroke="currentColor" strokeWidth="2" />
        <rect x="3" y="6" width="22" height="5" fill="var(--primary)" stroke="currentColor" strokeWidth="2" />
        <rect x="8" y="3" width="3" height="6" fill="currentColor" />
        <rect x="17" y="3" width="3" height="6" fill="currentColor" />
        <path d="M9 16 L12 19 L19 13" fill="none" stroke="var(--primary)" strokeWidth="2.5" strokeLinecap="square" />
      </svg>
    ),
  },
  {
    value: 5,
    label: "PERM Stages Covered",
    icon: (
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
        <line x1="4" y1="14" x2="24" y2="14" stroke="currentColor" strokeWidth="2" />
        <circle cx="6" cy="14" r="3" fill="var(--stage-pwd)" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="11" cy="14" r="3" fill="var(--stage-recruitment)" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="16" cy="14" r="3" fill="var(--stage-eta9089)" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="21" cy="14" r="3" fill="var(--stage-i140)" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    ),
  },
  {
    value: 100,
    suffix: "%",
    label: "Free to Use",
    icon: (
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
        <path d="M14 3 L24 8 L24 15 Q24 23 14 25 Q4 23 4 15 L4 8 Z" fill="none" stroke="currentColor" strokeWidth="2" />
        <path d="M10 14 L13 17 L19 11" fill="none" stroke="var(--primary)" strokeWidth="2.5" strokeLinecap="square" />
      </svg>
    ),
  },
  {
    value: 2,
    suffix: " min",
    label: "Setup Time",
    icon: (
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
        <circle cx="14" cy="14" r="10" fill="none" stroke="currentColor" strokeWidth="2" />
        <line x1="14" y1="8" x2="14" y2="14" stroke="currentColor" strokeWidth="2.5" />
        <line x1="14" y1="14" x2="19" y2="16" stroke="var(--primary)" strokeWidth="2" />
        <circle cx="14" cy="14" r="1.5" fill="var(--primary)" />
      </svg>
    ),
  },
];

/**
 * Count-up hook with digit scramble phase.
 *
 * Phase 1 (0–600ms): Rapidly cycle random digits matching the target's digit count.
 * Phase 2 (600–2000ms): Converge toward target with easeOutQuad.
 *
 * When reducedMotion is true, returns the target value immediately.
 */
function useCountUp(
  target: number,
  isInView: boolean,
  reducedMotion: boolean,
  duration: number = 2000,
  scrambleDuration: number = 600,
) {
  const [display, setDisplay] = React.useState(0);
  const hasAnimated = React.useRef(false);

  React.useEffect(() => {
    if (reducedMotion) {
      setDisplay(target);
      return;
    }

    if (!isInView || hasAnimated.current) return;
    hasAnimated.current = true;

    const digitCount = String(target).length;
    const scrambleMin = Math.pow(10, digitCount - 1); // e.g. 10 for 2-digit
    const scrambleMax = Math.pow(10, digitCount) - 1; // e.g. 99 for 2-digit
    // For single digit targets, scrambleMin would be 1
    const effectiveMin = digitCount === 1 ? 0 : scrambleMin;

    const startTime = performance.now();
    let lastScrambleTick = 0;
    const SCRAMBLE_INTERVAL = 50; // ms between random digit swaps

    const animate = (now: number) => {
      const elapsed = now - startTime;

      if (elapsed < scrambleDuration) {
        // Phase 1: Scramble — cycle random digits every 50ms
        if (elapsed - lastScrambleTick >= SCRAMBLE_INTERVAL) {
          lastScrambleTick = elapsed;
          const randomValue =
            effectiveMin + Math.floor(Math.random() * (scrambleMax - effectiveMin + 1));
          setDisplay(randomValue);
        }
        requestAnimationFrame(animate);
      } else {
        // Phase 2: Ease out from scramble toward target
        const convergeElapsed = elapsed - scrambleDuration;
        const convergeDuration = duration - scrambleDuration;
        const progress = Math.min(convergeElapsed / convergeDuration, 1);

        // easeOutQuad
        const easeOut = 1 - (1 - progress) * (1 - progress);
        const currentValue = Math.round(target * easeOut);

        setDisplay(currentValue);

        if (progress < 1) {
          requestAnimationFrame(animate);
        }
      }
    };

    requestAnimationFrame(animate);
  }, [isInView, target, duration, scrambleDuration, reducedMotion]);

  return display;
}

interface StatItemProps {
  stat: Stat;
  isInView: boolean;
  reducedMotion: boolean;
}

/**
 * SVG ring radius and dimensions for the icon ring animation.
 * Circle is sized to wrap the 40x40 (h-10 w-10) icon container.
 */
const RING_SIZE = 48;
const RING_RADIUS = 20;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

function StatItem({ stat, isInView, reducedMotion }: StatItemProps) {
  const count = useCountUp(stat.value, isInView, reducedMotion);

  return (
    <div className="group relative border-3 border-transparent p-6 text-center transition-all duration-300 hover:border-primary/30">
      {/* Icon with SVG ring */}
      <div className="relative mx-auto mb-3 flex h-12 w-12 items-center justify-center">
        {/* Animated ring */}
        <svg
          width={RING_SIZE}
          height={RING_SIZE}
          viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}
          className="absolute inset-0"
          aria-hidden="true"
        >
          <circle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={RING_RADIUS}
            fill="none"
            stroke="var(--primary)"
            strokeWidth="2"
            strokeDasharray={RING_CIRCUMFERENCE}
            strokeDashoffset={
              reducedMotion || isInView ? 0 : RING_CIRCUMFERENCE
            }
            className="origin-center -rotate-90"
            style={{
              transition: reducedMotion
                ? "none"
                : "stroke-dashoffset 1.5s ease-out",
            }}
          />
        </svg>
        {/* Icon centered inside ring */}
        <div className="relative flex h-10 w-10 items-center justify-center opacity-60 transition-opacity group-hover:opacity-100">
          {stat.icon}
        </div>
      </div>

      {/* Number */}
      <div className="font-heading text-4xl font-bold text-primary sm:text-5xl lg:text-6xl count-up">
        {count}
        {stat.suffix}
      </div>

      {/* Label */}
      <div className="mt-2 font-mono text-xs uppercase tracking-widest opacity-70">
        {stat.label}
      </div>
    </div>
  );
}

export function StatsSection() {
  const ref = React.useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });
  const reducedMotion = useReducedMotion();

  return (
    <section ref={ref} className="relative bg-foreground py-16 text-background sm:py-20 overflow-hidden">
      {/* Background image with heavy dark overlay */}
      <div className="absolute inset-0 opacity-[0.06]">
        <Image
          src="/images/backgrounds/dark-geometric.jpg"
          alt=""
          fill
          className="object-cover"
          sizes="100vw"
          aria-hidden="true"
        />
      </div>

      {/* Decorative elements */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        {/* Corner squares */}
        <div className="absolute top-4 left-4 h-16 w-16 border-2 border-primary/10 rotate-12" />
        <div className="absolute bottom-4 right-4 h-20 w-20 border-2 border-primary/10 -rotate-6" />

        {/* Floating plus signs */}
        <svg className="absolute top-8 right-[20%] opacity-10" width="16" height="16" viewBox="0 0 16 16" fill="none">
          <line x1="8" y1="1" x2="8" y2="15" stroke="var(--primary)" strokeWidth="2.5" />
          <line x1="1" y1="8" x2="15" y2="8" stroke="var(--primary)" strokeWidth="2.5" />
        </svg>
        <svg className="absolute bottom-12 left-[15%] opacity-8" width="12" height="12" viewBox="0 0 12 12" fill="none">
          <line x1="6" y1="0" x2="6" y2="12" stroke="var(--primary)" strokeWidth="2" />
          <line x1="0" y1="6" x2="12" y2="6" stroke="var(--primary)" strokeWidth="2" />
        </svg>
      </div>

      {/* Stats grid */}
      <div className="relative z-10 mx-auto grid max-w-[1400px] grid-cols-2 gap-8 px-4 sm:px-8 lg:grid-cols-4">
        {stats.map((stat) => (
          <StatItem key={stat.label} stat={stat} isInView={isInView} reducedMotion={reducedMotion} />
        ))}
      </div>
    </section>
  );
}

export default StatsSection;
