/**
 * Home Page
 *
 * Public landing page for PERM Tracker.
 * Complete landing page matching mockup-home-v2.html design.
 *
 * Sections (in order):
 * 1. HeroSection - the measured wait, the case-lookup form, then the doors
 * 2. LiveDataBand - DOL's live queue position + the tape
 * 3. StageStrip - PWD / PERM / I-140 / I-485, each with its timeline + data
 * 4. ToolsSection - the four calculators, laid out as the process (#tools)
 * 5. AttorneyPanel - the practitioner door, slimmed; full pitch on /for-attorneys
 * 6. TestimonialsSection - Value props + trust badges
 * 7. FAQSection - Common questions (#faq)
 * 8. CTASection - Single CTA with loss-frame
 * (Footer is rendered by PublicLayout)
 *
 * The practitioner lower half (Stakes, HowItWorks, FeaturesGrid, Security)
 * moved WHOLE to /for-attorneys: every H2 below the fold used to address a
 * caseload, which is exactly what answer engines aggregated into "what this
 * product is". Nothing was deleted in the move.
 */

import type { Metadata } from "next";
import {
  HeroSection,
  StageStrip,
  AttorneyPanel,
  ToolsSection,
  TestimonialsSection,
  FAQSection,
  CTASection,
} from "@/components/home";
import {
  getFAQPageSchema,
  getHomepageRatingPartialSchema,
  shouldAdvertiseRating,
} from "@/lib/structuredData";
import { openGraphBase } from "@/lib/openGraphBase";
import { JsonLdScript } from "@/components/seo/JsonLdScript";
import { HOME_FAQS } from "@/components/home/faqData";
import {
  analystReviewQueue,
  analystReviewAverage,
} from "../../../../convex/lib/dolProcessingTimes";
import { LiveDataBand } from "@/components/home/LiveDataBand";
import { SectionDivider } from "@/components/home/SectionDivider";
import { deriveFigures } from "@/components/home/dataPageFigures";
import { getDisclosureStats } from "@/lib/turso/publicData";
import { getProcessingTimes } from "@/lib/turso/processingTimes";

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
  // LEADS WITH THE PHRASE THIS PAGE ACTUALLY RANKS FOR, and that is the whole
  // edit. Measured in GSC 2026-08-30: "perm tracker" brought 1,088 of the
  // site's 2,300 clicks in the last three months, and the previous
  // description - accurate, 138 characters, well within every limit - did not
  // contain the phrase anywhere. Google was not using it. The live SERP
  // snippet was assembled from the page instead: one sentence out of the
  // reviews section plus four trust-badge labels welded together with full
  // stops ("Encrypted Data. DOL Compliant. Applicants and Attorneys. 5 PERM
  // Stages."), which reads like ad copy.
  //
  // Google rewrites descriptions when it judges page text a better answer, and
  // the text it chose opened with the query, bolded. This cannot be forced -
  // no description is guaranteed to be used - but one that answers the query
  // it is competing for has a far better chance than one that never says it.
  //
  // 138 characters, the same as what it replaces, so nothing is truncated.
  description:
    "PERM Tracker shows where DOL's queue stands today and computes every deadline on your case. Look up a case number free, no account needed.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    // Spread openGraphBase to preserve siteName / locale / type / images that
    // Next.js's shallow merge would otherwise drop from the parent layout.
    ...openGraphBase,
    title: "PERM Tracker - Live PERM Data and Case Deadlines",
    // THE SOCIAL DESCRIPTION DRIFTED FROM THE META ONE. The `description` above
    // was rewritten to lead with the free case lookup; this one still opened
    // with "Every PERM filing window, PWD expiration and audit deadline,
    // computed from your case dates" - the software pitch. So the SERP said one
    // thing and every shared link said another, and the shared link is the one
    // a person waiting on a case actually receives.
    description:
      "See where DOL's PERM queue stands today and look up any case number free, no account. Deadlines computed for the cases you track.",
    url: "/",
  },
};

export default async function HomePage() {
  // Two independent federal sources with two different as-of stamps, and they
  // must not be conflated: the processing-times snapshot is DOL's weekly queue
  // page, the disclosure stats are its quarterly determination files. Fetched
  // in parallel, server-side, once per revalidate window.
  const [snapshot, disclosure] = await Promise.all([
    getProcessingTimes(),
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
  // Gated on the review count: below the advertising floor the schema is
  // not emitted at all, which also keeps Google's visible-rating rule
  // trivially satisfied - no markup, nothing to render. One constant
  // (MIN_REVIEWS_TO_ADVERTISE) brings both back when the count grows.
  const ratingPartial = shouldAdvertiseRating()
    ? getHomepageRatingPartialSchema(baseUrl)
    : null;

  return (
    <>
      {/* The curtain panel is built by PRELOADER_BOOT in <head> - the
          server-rendered copy was removed because on a data-driven page
          its markup arrived after the cover, leaving a blank white cover
          with nothing on it. One owner now. */}
      {/* FAQPage + homepage aggregateRating partial. Server-built schemas only. */}
      <JsonLdScript schema={faqSchema} />
      {ratingPartial ? <JsonLdScript schema={ratingPartial} /> : null}
      <HeroSection waitRows={disclosure?.frontierHistory ?? []} />
      <LiveDataBand
        frontierMonth={analyst?.priorityDate ?? null}
        asOf={snapshot?.permAsOf ?? null}
        figures={deriveFigures(disclosure)}
      />
      <StageStrip />
      <SectionDivider kind="comb" fill="var(--background)" />
      <ToolsSection
        pwdPending={pwdPending}
        frontierMonth={analyst?.priorityDate ?? null}
        averageDays={analystAvg?.calendarDays ?? null}
      />
      <AttorneyPanel />
      <TestimonialsSection />
      <FAQSection />
      <SectionDivider kind="step" fill="var(--primary)" />
      <CTASection eyebrow="If you manage cases" />
    </>
  );
}
