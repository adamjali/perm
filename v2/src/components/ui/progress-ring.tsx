"use client";

/**
 * ProgressRing Component
 * Circular SVG progress indicator with scroll-triggered animation
 *
 * Visual Reference: design4 (Flash UI) - progress rings around stage icons
 *
 * Features:
 * - Circular SVG stroke progress (0-100%)
 * - Square stroke linecap (neobrutalist, not round)
 * - Animates on scroll into view using IntersectionObserver
 * - Eased animation (800ms cubic-bezier)
 * - Customizable size, stroke width, color
 * - Optional scroll animation toggle
 *
 * Usage:
 * <ProgressRing value={75} size={120} color="var(--stage-pwd)" />
 *
 * Phase: 20 (Dashboard + Deadline Hub)
 * Created: 2025-12-23
 */

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface ProgressRingProps {
  /** Progress value (0-100) */
  value: number;
  /** Ring diameter in pixels */
  size?: number;
  /** Stroke width in pixels */
  strokeWidth?: number;
  /** Stroke color (CSS color value) */
  color?: string;
  /** Enable scroll-triggered animation */
  animateOnScroll?: boolean;
  /** Additional CSS classes for the container */
  className?: string;
}

export default function ProgressRing({
  value,
  size = 120,
  strokeWidth = 8,
  color = "var(--primary)",
  animateOnScroll = true,
  className,
}: ProgressRingProps) {
  const [animatedValue, setAnimatedValue] = useState(animateOnScroll ? 0 : value);
  const containerRef = useRef<HTMLDivElement>(null);
  const hasAnimatedRef = useRef(false); // Track if animation has already played

  // Calculate SVG dimensions
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (animatedValue / 100) * circumference;

  useEffect(() => {
    if (!animateOnScroll) {
      setAnimatedValue(value);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          // Only animate once - skip if already animated
          if (entry.isIntersecting && !hasAnimatedRef.current) {
            hasAnimatedRef.current = true; // Mark as animated

            // Trigger animation when element enters viewport
            let startTime: number | null = null;
            const duration = 800; // 800ms animation

            const animate = (timestamp: number) => {
              if (!startTime) startTime = timestamp;
              const progress = Math.min((timestamp - startTime) / duration, 1);

              // Eased progress using cubic-bezier approximation
              const eased =
                progress < 0.5
                  ? 4 * progress * progress * progress
                  : 1 - Math.pow(-2 * progress + 2, 3) / 2;

              setAnimatedValue(eased * value);

              if (progress < 1) {
                requestAnimationFrame(animate);
              }
            };

            requestAnimationFrame(animate);
          }
        });
      },
      { threshold: 0.3 } // Trigger when 30% visible
    );

    const element = containerRef.current;
    if (element) {
      observer.observe(element);
    }

    return () => {
      if (element) {
        observer.unobserve(element);
      }
    };
  }, [value, animateOnScroll]);

  return (
    <div ref={containerRef} className={cn("inline-block", className)}>
      <svg width={size} height={size} className="rotate-[-90deg]">
        {/* Background circle - visible track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          className="stroke-muted-foreground/20 dark:stroke-white/15"
          strokeWidth={strokeWidth}
          strokeLinecap="butt"
        />

        {/* Progress circle with color */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="butt"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="drop-shadow-sm"
          style={{
            transition: animateOnScroll
              ? "none"
              : "stroke-dashoffset 0.3s ease",
          }}
        />
      </svg>
    </div>
  );
}
