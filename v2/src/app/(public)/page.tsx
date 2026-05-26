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
import { getFAQPageSchema, getHomepageRatingPartialSchema } from "@/lib/structuredData";
import { openGraphBase } from "@/lib/openGraphBase";
import { JsonLdScript } from "@/components/seo/JsonLdScript";

export const dynamic = "force-static";

export const metadata: Metadata = {
  // `absolute` bypasses the root layout's `title.template: "%s | PERM Tracker"`
  // (Next.js docs § Template). Without this, Next.js appends " | PERM Tracker"
  // to a literal that already starts with the brand → "...| PERM Tracker | PERM
  // Tracker" doubled. Using `absolute` is the documented escape hatch.
  title: { absolute: "PERM Tracker - Deadline Management for Immigration Attorneys" },
  description:
    "PERM case tracking software for immigration attorneys. Auto-calculate 11 deadline types, get alerts before they hit, sync to Google Calendar.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    // Spread openGraphBase to preserve siteName / locale / type / images that
    // Next.js's shallow merge would otherwise drop from the parent layout.
    ...openGraphBase,
    title: "PERM Tracker - Never Lose a Case to a Missed Deadline",
    description:
      "Auto-calculate every PERM filing window, PWD expiration, and audit deadline. Email + push alerts before they hit.",
    url: "/",
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
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL || "https://permtracker.app";
  const faqSchema = getFAQPageSchema(homepageFAQs);
  // The aggregateRating ships ONLY here (homepage) — the Senja widget that
  // renders the visible review UI is mounted in TestimonialsSection on this
  // page. The partial below shares the root SoftwareApplication's @id so
  // Google's @id-graph merge attaches the rating to that entity on this
  // page only (not on /blog, /privacy, etc.).
  const ratingPartial = getHomepageRatingPartialSchema(baseUrl);

  return (
    <>
      {/* FAQPage + homepage aggregateRating partial. Server-built schemas only. */}
      <JsonLdScript schema={faqSchema} />
      <JsonLdScript schema={ratingPartial} />
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
