/**
 * Home Page
 *
 * Public landing page for PERM Tracker.
 * Complete landing page matching mockup-home-v2.html design.
 *
 * Sections, in order:
 * 1. HeroSection - the measured wait, the case lookup, the doors, and the
 *    departures board (now deciding, decided, waiting, wage requests)
 * 2. LiveDataBand - the queue tape and the day-by-day charts (PermPulse)
 * 3. RoadSection - six stops to a green card, each with its real paperwork
 *    and its calculator
 * 4. DataShelf - an employer search and the five dataset doors
 * 5. AudienceBlocks - both audiences, equal headings, each with its film
 * 6. AboutSection - the portrait, the record ledger, the reviews
 * 7. FAQSection - Common questions (#faq)
 * 8. CTASection - two doors: check a case, start tracking cases
 * (Footer is rendered by PublicLayout)
 *
 * The practitioner sections (the product tour, Stakes, Security) live
 * WHOLE on /for-attorneys: on the homepage, H2s addressed to a caseload are
 * exactly what answer engines aggregate into "what this product is".
 */

import type { Metadata } from "next";
import { withSocialCard } from "@/lib/socialCard";
import {
  HeroSection,
  AudienceBlocks,
  AboutSection,
  FAQSection,
  CTASection,
} from "@/components/home";
import { RoadSection } from "@/components/home/RoadSection";
import {
  getFAQPageSchema,
  getHomepageRatingPartialSchema,
  shouldAdvertiseRating,
} from "@/lib/structuredData";
import { openGraphBase } from "@/lib/openGraphBase";
import { JsonLdScript } from "@/components/seo/JsonLdScript";
import { HOME_FAQS } from "@/components/home/faqData";
import { analystReviewQueue } from "@convex/lib/dolProcessingTimes";
import { DataShelf, LiveDataBand } from "@/components/home/LiveDataBand";
import { SectionDivider } from "@/components/home/SectionDivider";
import { pulseHeadline } from "@/lib/pulseStats";
import { deriveFigures } from "@/components/home/dataPageFigures";
import { getDisclosureStats } from "@/lib/turso/publicData";
import { getProcessingTimes } from "@/lib/turso/processingTimes";
import { getRecordCounts } from "@/lib/turso/recordCounts";
import { getObservedDays } from "@/lib/turso/pulse";
import { getSweepCoverage } from "@/lib/turso/sweepCoverage";
import { PermPulse } from "@/components/pulse/PermPulse";
import { SITE_URL } from "@/lib/constants/site";

// One live DOL figure on the page: hourly ISR, same as the data pages.
// The disclosure files are quarterly, so an hourly window bought
// nothing and cost a regeneration per page per hour across 21,178
// entity pages. A day bounds staleness far below the data's own
// cadence. The ingest should also revalidate on demand.
export const revalidate = 86400;

export const metadata: Metadata = withSocialCard({
  // `absolute` bypasses the root layout's `title.template: "%s | PERM Tracker"`
  // (Next.js docs § Template). Without this, Next.js appends " | PERM Tracker"
  // to a literal that already starts with the brand → "...| PERM Tracker | PERM
  // Tracker" doubled. Using `absolute` is the documented escape hatch.
  // LEADS WITH THE NAME, THEN THE PHRASES PEOPLE SEARCH: "perm tracker" is
  // the largest query in Search Console (58k appearances in the 3 months to
  // Oct 5 2026), and "case status" and "processing times" are the two largest
  // non-brand clusters. "Free" is what the page offers first. 56 characters.
  // The Nov 7 2026 freeze on this title was lifted by the owner on Oct 6 2026.
  title: { absolute: "PERM Tracker: Free PERM Case Status and Processing Times" },
  // LEADS WITH THE PHRASE THIS PAGE ACTUALLY RANKS FOR: "perm tracker" brings
  // close to half the site's clicks in Search Console. A description that
  // never contains the query is one Google ignores, assembling a snippet
  // from the page instead (trust-badge labels welded together with full
  // stops read like ad copy).
  //
  // Google rewrites descriptions when it judges page text a better answer, and
  // the text it chose opened with the query, bolded. This cannot be forced -
  // no description is guaranteed to be used - but one that answers the query
  // it is competing for has a far better chance than one that never says it.
  //
  // Says what a visitor can do here, with the name as its subject (the gate in
  // brand-signals.test.ts: without the name, Google printed scraped page text).
  // No figure, so it can't go stale between renders. 140 characters.
  description:
    "PERM Tracker looks up any PERM case by number, shows which month DOL is reviewing now, and estimates your decision. Free, no account needed.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    // Spread openGraphBase to preserve siteName / locale / type / images that
    // Next.js's shallow merge would otherwise drop from the parent layout.
    ...openGraphBase,
    title: "PERM Tracker: Free PERM Case Status and Processing Times",
    // THE SOCIAL DESCRIPTION DRIFTED FROM THE META ONE. The `description` above
    // was rewritten to lead with the free case lookup; this one still opened
    // with "Every PERM filing window, PWD expiration and audit deadline,
    // computed from your case dates" - the software pitch. So the SERP said one
    // thing and every shared link said another, and the shared link is the one
    // a person waiting on a case actually receives.
    description:
      "PERM Tracker looks up any PERM case by number, shows which month DOL is reviewing now, and estimates your decision. Free, no account needed.",
    url: "/",
  },
}, "home");

export default async function HomePage() {
  // Two independent federal sources with two different as-of stamps, and they
  // must not be conflated: the processing-times snapshot is DOL's weekly queue
  // page, the disclosure stats are its quarterly determination files. Fetched
  // in parallel, server-side, once per revalidate window.
  // The pulse reads our own sweep's record, a third clock: it moves when the
  // sweep finishes, and /api/revalidate-sweep expires this page then. Either
  // read failing drops the band, never the page.
  const [snapshot, disclosure, record, observed, coverage] = await Promise.all([
    getProcessingTimes(),
    getDisclosureStats(),
    getRecordCounts(),
    getObservedDays().catch(() => []),
    getSweepCoverage().catch(() => null),
  ]);
  const analyst = snapshot
    ? analystReviewQueue(snapshot.permQueues)
    : undefined;
  const lastDay = pulseHeadline(observed);
  const pwdPending = snapshot?.pwdPermBacklog?.length
    ? snapshot.pwdPermBacklog.reduce((sum, r) => sum + r.remainingRequests, 0)
    : null;

  const baseUrl = SITE_URL;
  const faqSchema = getFAQPageSchema(
    HOME_FAQS.map(({ question, answer }) => ({ question, answer })),
  );
  // The aggregateRating ships ONLY here (homepage), where ReviewsLine shows
  // the same rating. The partial below shares the root SoftwareApplication's @id so
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
      {/* The curtain panel is rendered by the root layout as the first
          child of <body>, so it paints before this page's header. */}
      {/* FAQPage + homepage aggregateRating partial. Server-built schemas only. */}
      <JsonLdScript schema={faqSchema} />
      {ratingPartial ? <JsonLdScript schema={ratingPartial} /> : null}
      {/* In reading order: the board (where DOL is, what it decided, what
          is still waiting), the line and its pace, the road with each
          stage's real paperwork, the search shelf, then the two halves with
          their films. */}
      <HeroSection
        waitRows={disclosure?.frontierHistory ?? []}
        board={{
          frontierMonth: analyst?.priorityDate ?? null,
          lastDay: lastDay ? { date: lastDay.day.date, total: lastDay.day.total } : null,
          pending: record.find((f) => f.href === "/perm-case-status")?.value ?? null,
          checkedAt: coverage?.checkedAt ?? null,
          pwdPending,
        }}
      />
      <LiveDataBand
        frontierMonth={analyst?.priorityDate ?? null}
        asOf={snapshot?.permAsOf ?? null}
      >
        <PermPulse variant="charts" days={observed} checkedAt={coverage?.checkedAt ?? null} />
      </LiveDataBand>
      <RoadSection pwdPending={pwdPending} frontierMonth={analyst?.priorityDate ?? null} />
      <DataShelf figures={deriveFigures(disclosure)} />
      <AudienceBlocks />
      <AboutSection record={record} />
      <FAQSection />
      <SectionDivider kind="step" above="var(--card)" fill="var(--primary)" />
      <CTASection />
    </>
  );
}
