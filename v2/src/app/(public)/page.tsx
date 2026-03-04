/**
 * Home Page
 *
 * Public landing page for PERM Tracker.
 * Complete landing page matching mockup-home-v2.html design.
 *
 * Sections (in order):
 * 1. HeroSection - Loss-frame headline + single CTA + dashboard reveal
 * 2. TrustStrip - Animated marquee with real feature badges
 * 3. StakesSection - Horizontal scroll PERM consequence cards (#stakes)
 * 4. HowItWorks - 3-step process with connectors + video showcase (#how)
 * 5. FeaturesGrid - 6 feature cards with tilt effect (#features)
 * 6. StatsSection - Count-up statistics
 * 7. SecuritySection - Neobrutalist security table (#security)
 * 8. TestimonialsSection - Value props + trust badges
 * 9. FAQSection - Common questions (#faq)
 * 10. CTASection - Single CTA with loss-frame
 * (Footer is rendered by PublicLayout)
 *
 */

import type { Metadata } from "next";
import {
  HeroSection,
  TrustStrip,
  StakesSection,
  FeaturesGrid,
  HowItWorks,
  StatsSection,
  SecuritySection,
  TestimonialsSection,
  FAQSection,
  CTASection,
} from "@/components/home";
import { getFAQPageSchema } from "@/lib/structuredData";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "PERM Tracker - Deadline Management for Immigration Attorneys",
  description:
    "PERM case tracking software for immigration attorneys. Auto-calculate 11 deadline types, get alerts before they hit, sync to Google Calendar.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "PERM Tracker - Never Lose a Case to a Missed Deadline",
    description:
      "Auto-calculate every PERM filing window, PWD expiration, and audit deadline. Email + push alerts before they hit.",
    url: "/",
    type: "website",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "PERM Tracker - Deadline Management for Immigration Attorneys",
      },
    ],
  },
};

// Plain-text FAQ data for FAQPage structured data (matches FAQSection component)
const homepageFAQs = [
  {
    question: "What exactly does PERM Tracker do?",
    answer:
      "PERM Tracker automates deadline management for PERM labor certification cases. Enter your case dates, and it auto-calculates every critical deadline \u2014 PWD expiration, the 30\u2013180 day ETA 9089 filing window, I-140 filing cutoffs, and more. You get email and push notifications before deadlines hit, plus Google Calendar sync so your whole team stays aligned.",
  },
  {
    question: "How is this different from using a spreadsheet?",
    answer:
      "Spreadsheets require manual deadline math, don't send reminders, and break when regulations change. PERM Tracker auto-calculates 11 deadline types per case based on DOL regulations (20 CFR 656), sends proactive alerts, validates compliance, and updates all downstream dates when one date changes.",
  },
  {
    question: "Is PERM Tracker really free?",
    answer:
      "Yes, currently free. No credit card, no trial period, no case limits. We may introduce paid plans in the future, but the core deadline tracking will remain accessible.",
  },
  {
    question: "Is my client data secure?",
    answer:
      "Sensitive fields like employer FEIN are encrypted with AES-256-GCM. The database runs on Convex\u2019s SOC 2 Type II certified infrastructure on AWS. Your cases are row-level isolated \u2014 no other user can see them. Sessions auto-expire after 15 minutes of inactivity.",
  },
  {
    question: "Can I import my existing cases?",
    answer:
      "Yes. PERM Tracker supports CSV import for bulk uploads. The import wizard auto-maps your fields and validates data before import. You can also export your data anytime \u2014 your data is always yours.",
  },
  {
    question: "What happens if DOL changes regulations?",
    answer:
      "We monitor DOL regulatory changes and update our deadline calculation engine accordingly. When regulations change, your existing cases are recalculated automatically. You don't need to manually update formulas or check for rule changes.",
  },
  {
    question: "What notifications can I configure?",
    answer:
      "Email and push notifications for each deadline type (PWD, recruitment, ETA 9089, I-140, RFI, RFE). Set reminders at 1, 3, 7, 14, or 30 days before. Configure quiet hours. A weekly Monday digest summarizes everything upcoming.",
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
      <StakesSection />
      <HowItWorks />
      <FeaturesGrid />
      <StatsSection />
      <SecuritySection />
      <TestimonialsSection />
      <FAQSection />
      <CTASection />
    </>
  );
}
