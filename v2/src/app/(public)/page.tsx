/**
 * Home Page
 *
 * Public landing page for PERM Tracker.
 * Complete landing page matching mockup-home-v2.html design.
 *
 * Sections (in order):
 * 1. HeroSection - Loss-frame headline + single CTA + dashboard reveal
 * 3. StakesSection - Horizontal scroll PERM consequence cards (#stakes)
 * 4. HowItWorks - 3-step process with connectors + video showcase (#how)
 * 4b. ToolsSection - the four calculators, laid out as the process (#tools)
 * 5. FeaturesGrid - 6 feature cards with tilt effect (#features)
 * 6. LiveDataBand - DOL's live queue position + the tape
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
  StakesSection,
  FeaturesGrid,
  HowItWorks,
  ToolsSection,
  SecuritySection,
  TestimonialsSection,
  FAQSection,
  CTASection,
} from "@/components/home";
import { getFAQPageSchema, getHomepageRatingPartialSchema } from "@/lib/structuredData";
import { openGraphBase } from "@/lib/openGraphBase";
import { JsonLdScript } from "@/components/seo/JsonLdScript";
import { HOME_FAQS } from "@/components/home/faqData";
import { fetchQuery } from "convex/nextjs";
import { api } from "../../../convex/_generated/api";
import {
  analystReviewQueue,
  analystReviewAverage,
} from "../../../convex/lib/dolProcessingTimes";
import { LiveDataBand } from "@/components/home/LiveDataBand";

// One live DOL figure on the page: hourly ISR, same as the data pages.
export const revalidate = 3600;

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



export default async function HomePage() {
  const snapshot = await fetchQuery(api.dolProcessingTimes.getLatest, {}).catch(
    () => null,
  );
  const analyst = snapshot ? analystReviewQueue(snapshot.permQueues) : undefined;
  const analystAvg = snapshot
    ? analystReviewAverage(snapshot.permAverageDays)
    : undefined;

  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL || "https://permtracker.app";
  const faqSchema = getFAQPageSchema(
    HOME_FAQS.map(({ question, answer }) => ({ question, answer })),
  );
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
      <StakesSection />
      <HowItWorks />
      <ToolsSection />
      <LiveDataBand
        frontierMonth={analyst?.priorityDate ?? null}
        asOf={snapshot?.permAsOf ?? null}
        averageDays={analystAvg?.calendarDays ?? null}
      />
      <FeaturesGrid />
      <SecuritySection />
      <TestimonialsSection />
      <FAQSection />
      <CTASection />
    </>
  );
}
