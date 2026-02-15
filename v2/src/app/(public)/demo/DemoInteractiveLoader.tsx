"use client";

import dynamic from "next/dynamic";
import { LazySection } from "@/components/ui/lazy-section";

const DemoInteractive = dynamic(
  () =>
    import("./DemoInteractive").then((m) => ({
      default: m.DemoInteractive,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="mb-12 grid grid-cols-2 gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-24 animate-pulse border-3 border-border bg-muted"
            />
          ))}
        </div>
      </div>
    ),
  },
);

/**
 * Client wrapper that lazy-loads the interactive demo sections.
 * Uses IntersectionObserver to defer loading until user scrolls near.
 */
export function DemoInteractiveLoader() {
  return (
    <LazySection minHeight="800px" rootMargin="400px">
      <DemoInteractive />
    </LazySection>
  );
}
