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
 * 5. HowItWorks - 3-step process with connectors + video showcase (#how)
 * 6. StatsSection - Count-up statistics
 * 7. TestimonialsSection - Value props + trust badges + review CTA
 * 8. FAQSection - Common questions (#faq)
 * 9. CTASection - Full-width CTA
 * (Footer is rendered by PublicLayout)
 *
 */

import type { Metadata } from "next";
import { HeroSection, TrustStrip } from "@/components/home";
import { LazyHomeSections } from "@/components/home/LazyHomeSections";
import { getFAQPageSchema } from "@/lib/structuredData";

export const metadata: Metadata = {
  title: "PERM Tracker - Free Case Tracking for Immigration Attorneys",
  description:
    "Free PERM case tracking software. Manage labor certification deadlines, track case status, and streamline your immigration practice.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "PERM Tracker - Free Case Tracking for Immigration Attorneys",
    description:
      "Free PERM case tracking software for immigration attorneys. Track deadlines, manage cases, never miss a filing date.",
    url: "/",
    type: "website",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "PERM Tracker - Case Management for Immigration Attorneys",
      },
    ],
  },
};

// Plain-text FAQ data for FAQPage structured data (matches FAQSection component)
const homepageFAQs = [
  {
    question: "What exactly does PERM Tracker do?",
    answer:
      "PERM Tracker automates deadline management for PERM labor certification cases. Enter your case dates, and it auto-calculates every critical deadline — PWD expiration, the 30-180 day ETA 9089 filing window, I-140 filing cutoffs, and more. You get email and push notifications before deadlines hit, plus Google Calendar sync so your whole team stays aligned.",
  },
  {
    question: "How is this different from using a spreadsheet?",
    answer:
      "Spreadsheets require manual deadline math, don't send reminders, and break when regulations change. PERM Tracker auto-calculates 15+ deadlines per case based on DOL regulations (20 CFR 656), sends proactive alerts, validates compliance, and updates all downstream dates when one date changes.",
  },
  {
    question: "Is PERM Tracker really free?",
    answer:
      "Yes, completely free. No credit card, no trial period, no case limits. Immigration attorneys deserve quality tools without typical SaaS pricing. We may introduce optional premium features in the future, but the core tracking and deadline management will always be free.",
  },
  {
    question: "Is my client data secure?",
    answer:
      "Yes. We use industry-standard encryption, secure Google OAuth authentication, and row-level database security. Your data is isolated — no other firm can see your cases. We also offer Privacy Mode to hide sensitive information during screen sharing or presentations.",
  },
  {
    question: "Can I import my existing cases?",
    answer:
      "Yes. PERM Tracker supports CSV import for bulk uploads. The import wizard auto-maps your fields and validates data before import. You can also export your data anytime — your data is always yours.",
  },
  {
    question: "What happens if DOL changes regulations?",
    answer:
      "We monitor DOL regulatory changes and update our deadline calculation engine accordingly. When regulations change, your existing cases are recalculated automatically. You don't need to manually update formulas or check for rule changes.",
  },
];

export default function HomePage() {
  const faqSchema = getFAQPageSchema(homepageFAQs);

  return (
    <>
      {/* FAQPage structured data for rich results and AI search visibility.
          Content is hardcoded server-side strings, not user input — safe for JSON-LD. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      <HeroSection />
      <TrustStrip />
      <LazyHomeSections />
    </>
  );
}
