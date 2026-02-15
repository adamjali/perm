"use client";

import dynamic from "next/dynamic";
import { LazySection } from "@/components/ui/lazy-section";

// Code-split each section into its own chunk, defer hydration until near-viewport.
// ssr: false prevents hydration cost — HTML placeholder is shown until JS loads.
const JourneySection = dynamic(
  () => import("./JourneySection").then((m) => ({ default: m.JourneySection })),
  { ssr: false },
);
const FeaturesGrid = dynamic(
  () => import("./FeaturesGrid").then((m) => ({ default: m.FeaturesGrid })),
  { ssr: false },
);
const HowItWorks = dynamic(
  () => import("./HowItWorks").then((m) => ({ default: m.HowItWorks })),
  { ssr: false },
);
const StatsSection = dynamic(
  () => import("./StatsSection").then((m) => ({ default: m.StatsSection })),
  { ssr: false },
);
const FAQSection = dynamic(
  () => import("./FAQSection").then((m) => ({ default: m.FAQSection })),
  { ssr: false },
);
const ContentShowcase = dynamic(
  () =>
    import("./ContentShowcase").then((m) => ({ default: m.ContentShowcase })),
  { ssr: false },
);
const CTASection = dynamic(
  () => import("./CTASection").then((m) => ({ default: m.CTASection })),
  { ssr: false },
);
const TestimonialsSection = dynamic(
  () =>
    import("./TestimonialsSection").then((m) => ({
      default: m.TestimonialsSection,
    })),
  { ssr: false },
);

/**
 * Below-fold home page sections with lazy loading.
 * Each section is code-split and only loads when approaching the viewport.
 * Above-fold (HeroSection, TrustStrip) are imported eagerly in page.tsx.
 */
export function LazyHomeSections() {
  return (
    <>
      <LazySection minHeight="600px">
        <JourneySection />
      </LazySection>
      <LazySection minHeight="500px">
        <FeaturesGrid />
      </LazySection>
      <LazySection minHeight="600px">
        <HowItWorks />
      </LazySection>
      <LazySection minHeight="400px">
        <StatsSection />
      </LazySection>
      <LazySection minHeight="300px">
        <FAQSection />
      </LazySection>
      <LazySection minHeight="300px">
        <ContentShowcase />
      </LazySection>
      <LazySection minHeight="300px">
        <TestimonialsSection />
      </LazySection>
      <LazySection minHeight="300px">
        <CTASection />
      </LazySection>
    </>
  );
}
