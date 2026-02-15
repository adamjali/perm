"use client";

import { useState, useRef, useEffect, type ReactNode } from "react";

interface LazySectionProps {
  children: ReactNode;
  /** Placeholder while not yet visible */
  fallback?: ReactNode;
  /** How far before viewport to start loading (default: 200px) */
  rootMargin?: string;
  /** Min height of placeholder to prevent layout shift */
  minHeight?: string;
  /** Optional className for the wrapper */
  className?: string;
}

/**
 * Defers rendering of children until the section approaches the viewport.
 * Uses IntersectionObserver with configurable rootMargin for early triggering.
 * Once visible, children render permanently (no unloading).
 */
export function LazySection({
  children,
  fallback,
  rootMargin = "200px",
  minHeight = "400px",
  className,
}: LazySectionProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [rootMargin]);

  if (!isVisible) {
    return (
      <div ref={ref} style={{ minHeight }} className={className}>
        {fallback}
      </div>
    );
  }

  return <>{children}</>;
}
