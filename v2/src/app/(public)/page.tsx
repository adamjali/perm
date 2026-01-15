/**
 * Home Page
 *
 * Public landing page for PERM Tracker.
 * Complete landing page matching mockup-home-v2.html design.
 *
 * Sections (in order):
 * 1. HeroSection - Value proposition + CTAs + floating shapes
 * 2. TrustStrip - Animated marquee with trust badges
 * 3. JourneySection - Horizontal scroll PERM stages (#journey)
 * 4. FeaturesGrid - 6 feature cards with corner accents (#features)
 * 5. HowItWorks - 3-step process with connectors (#how)
 * 6. StatsSection - Count-up statistics
 * 7. FAQSection - Common questions (#faq)
 * 8. CTASection - Full-width CTA
 * (Footer is rendered by PublicLayout)
 *
 */

import type { Metadata } from "next";
import {
  HeroSection,
  TrustStrip,
  JourneySection,
  FeaturesGrid,
  HowItWorks,
  StatsSection,
  FAQSection,
  CTASection,
} from "@/components/home";

export const metadata: Metadata = {
  title: "PERM Tracker - Free Case Tracking for Immigration Attorneys",
  description:
    "Free PERM case tracking software. Manage labor certification deadlines, track case status, and streamline your immigration practice.",
};

export default function HomePage() {
  return (
    <>
      <HeroSection />
      <TrustStrip />
      <JourneySection />
      <FeaturesGrid />
      <HowItWorks />
      <StatsSection />
      <FAQSection />
      <CTASection />
    </>
  );
}
