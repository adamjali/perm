/**
 * Home Page
 *
 * Public landing page for PERM Tracker.
 * Complete landing page matching mockup-home-v2.html design.
 *
 * Sections (in order):
 * 1. HeroSection - the measured wait, then the two doors
 * 2. LiveDataBand - DOL's live queue position + the tape
 * 3. StakesSection - Horizontal scroll PERM consequence cards (#stakes)
 * 4. HowItWorks - 3-step process with connectors + video showcase (#how)
 * 4b. ToolsSection - the four calculators, laid out as the process (#tools)
 * 4c. SectionDivider(comb) - graduations, where the page turns to instruments
 * 5. FeaturesGrid - 6 feature cards with tilt effect (#features)
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
import {
  getFAQPageSchema,
  getHomepageRatingPartialSchema,
} from "@/lib/structuredData";
import { openGraphBase } from "@/lib/openGraphBase";
import { JsonLdScript } from "@/components/seo/JsonLdScript";
import { HOME_FAQS } from "@/components/home/faqData";
import { fetchQuery } from "convex/nextjs";
import { api } from "../../../../convex/_generated/api";
import {
  analystReviewQueue,
  analystReviewAverage,
} from "../../../../convex/lib/dolProcessingTimes";
import { LiveDataBand } from "@/components/home/LiveDataBand";
import { SectionDivider } from "@/components/home/SectionDivider";
import { deriveFigures } from "@/components/home/dataPageFigures";
import { Preloader } from "@/components/home/Preloader";
import { getDisclosureStats } from "@/lib/turso/publicData";

// One live DOL figure on the page: hourly ISR, same as the data pages.
// The disclosure files are quarterly, so an hourly window bought
// nothing and cost a regeneration per page per hour across 21,178
// entity pages. A day bounds staleness far below the data's own
// cadence. The ingest should also revalidate on demand.
export const revalidate = 86400;

export const metadata: Metadata = {
  // `absolute` bypasses the root layout's `title.template: "%s | PERM Tracker"`
  // (Next.js docs § Template). Without this, Next.js appends " | PERM Tracker"
  // to a literal that already starts with the brand → "...| PERM Tracker | PERM
  // Tracker" doubled. Using `absolute` is the documented escape hatch.
  title: { absolute: "PERM Tracker - Live PERM Data and Deadlines" },
  description:
    "Where DOL's PERM queue stands today, and every case deadline computed automatically. For the person waiting and the person managing. Free.",
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
  // Two independent federal sources with two different as-of stamps, and they
  // must not be conflated: the processing-times snapshot is DOL's weekly queue
  // page, the disclosure stats are its quarterly determination files. Fetched
  // in parallel, server-side, once per revalidate window.
  const [snapshot, disclosure] = await Promise.all([
    fetchQuery(api.dolProcessingTimes.getLatest, {}).catch(() => null),
    getDisclosureStats(),
  ]);
  const analyst = snapshot
    ? analystReviewQueue(snapshot.permQueues)
    : undefined;
  const analystAvg = snapshot
    ? analystReviewAverage(snapshot.permAverageDays)
    : undefined;
  const pwdPending = snapshot?.pwdPermBacklog?.length
    ? snapshot.pwdPermBacklog.reduce((sum, r) => sum + r.remainingRequests, 0)
    : null;

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://permtracker.app";
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
      <Preloader />
      {/* FAQPage + homepage aggregateRating partial. Server-built schemas only. */}
      <JsonLdScript schema={faqSchema} />
      <JsonLdScript schema={ratingPartial} />
      <HeroSection waitRows={disclosure?.frontierHistory ?? []} />
      <LiveDataBand
        frontierMonth={analyst?.priorityDate ?? null}
        asOf={snapshot?.permAsOf ?? null}
        averageDays={analystAvg?.calendarDays ?? null}
        figures={deriveFigures(disclosure)}
      />
      <StakesSection />
      <SectionDivider kind="tape" fill="var(--muted)" />
      <HowItWorks />
      <SectionDivider kind="comb" fill="var(--background)" />
      <ToolsSection
        pwdPending={pwdPending}
        frontierMonth={analyst?.priorityDate ?? null}
        averageDays={analystAvg?.calendarDays ?? null}
      />
      <FeaturesGrid />
      <SectionDivider kind="ledger" fill="var(--muted)" />
      <SecuritySection />
      <TestimonialsSection />
      <FAQSection />
      <SectionDivider kind="step" fill="var(--primary)" />
      <CTASection />
    </>
  );
}
