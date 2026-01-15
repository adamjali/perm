"use client";

/**
 * StatsSection Component
 *
 * Statistics section with count-up animation on scroll.
 * Dark background with primary-colored numbers.
 *
 */

import * as React from "react";
import { useInView } from "motion/react";

// ============================================================================
// STAT DATA
// ============================================================================

interface Stat {
  value: number;
  suffix?: string;
  label: string;
}

const stats: Stat[] = [
  { value: 180, label: "Day Filing Window" },
  { value: 100, suffix: "%", label: "Free Forever" },
  { value: 24, label: "Hour Support" },
  { value: 5, label: "PERM Stages Tracked" },
];

// ============================================================================
// COUNT-UP HOOK
// ============================================================================

function useCountUp(target: number, isInView: boolean, duration: number = 2000) {
  const [count, setCount] = React.useState(0);
  const hasAnimated = React.useRef(false);

  React.useEffect(() => {
    if (!isInView || hasAnimated.current) return;
    hasAnimated.current = true;

    const startTime = Date.now();
    const startValue = 0;

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Ease out quad
      const easeOut = 1 - (1 - progress) * (1 - progress);
      const currentValue = Math.round(startValue + (target - startValue) * easeOut);

      setCount(currentValue);

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }, [isInView, target, duration]);

  return count;
}

// ============================================================================
// STAT ITEM COMPONENT
// ============================================================================

interface StatItemProps {
  stat: Stat;
  isInView: boolean;
}

function StatItem({ stat, isInView }: StatItemProps) {
  const count = useCountUp(stat.value, isInView);

  return (
    <div className="border-3 border-transparent p-6 text-center transition-colors hover:border-primary">
      <div className="font-heading text-4xl font-bold text-primary sm:text-5xl lg:text-6xl count-up">
        {count}
        {stat.suffix}
      </div>
      {/* Using opacity-70 on inherited text-background color for light/dark mode compatibility */}
      <div className="mt-2 font-mono text-xs uppercase tracking-widest opacity-70">
        {stat.label}
      </div>
    </div>
  );
}

// ============================================================================
// COMPONENT
// ============================================================================

export function StatsSection() {
  const ref = React.useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section ref={ref} className="bg-foreground py-16 text-background sm:py-20">
      <div className="mx-auto grid max-w-[1400px] grid-cols-2 gap-8 px-4 sm:px-8 lg:grid-cols-4">
        {stats.map((stat) => (
          <StatItem key={stat.label} stat={stat} isInView={isInView} />
        ))}
      </div>
    </section>
  );
}

export default StatsSection;
