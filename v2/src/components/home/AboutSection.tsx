import Link from "next/link";

import { ABOUT_ONE_LINER, SABRINA } from "@/lib/constants/about";
import type { RecordFigure } from "@/lib/recordCounts";
import type { SiteReview } from "@/lib/reviews/senjaParse";
import type { RatingFields } from "@/lib/structuredData";

import { RecordStrip } from "./RecordStrip";
import { ReviewsLine } from "./ReviewsLine";

/**
 * "About PERM Tracker", on the homepage, in plain server-rendered prose.
 *
 * The brand query "perm tracker" goes to the page that says plainly what the
 * name is; without this heading on the homepage it drifts to /faq. Wired to
 * the same facts as /about and the Organization schema. No animation wrapper
 * on purpose: a Motion `initial`
 * serializes as an inline `opacity:0` in the prerendered HTML, and this is the
 * one passage on the page that most needs to be readable before hydration.
 */
export function AboutSection({
  record = [],
  rating,
  reviews = [],
}: {
  record?: RecordFigure[];
  rating?: RatingFields;
  reviews?: SiteReview[];
}) {
  return (
    <section id="about" className="py-12 sm:py-16 border-b-3 border-border">
      {/* The founder line on its own, then what people say across the full width, then the ledger (owner, Oct 23
          2026: the reviews box beside the prose left an empty space above it and read awkwardly). */}
      <div className="mx-auto max-w-[1200px] px-4 sm:px-8">
        <div className="max-w-3xl">
          <h2 className="font-heading text-2xl font-bold sm:text-3xl">About PERM Tracker</h2>{" "}
          {/* The definition is the hero's opening line; screen readers and
              crawlers get it here too, readers aren't shown it twice. */}
          <p className="sr-only">{ABOUT_ONE_LINER}</p>{" "}
          <p className="mt-4 text-base leading-relaxed text-soft sm:text-lg">
            PERM Tracker was founded by {SABRINA.name}, an immigration attorney. PERM Tracker is not affiliated
            with any law firms and nothing on the site constitutes legal advice.{" "}
            <Link href="/about" className="link">
              More about us
            </Link>
          </p>
        </div>{" "}
        <div className="mt-12">
          <ReviewsLine rating={rating} reviews={reviews} />
        </div>{" "}
        <RecordStrip record={record} className="mt-12" />
      </div>
    </section>
  );
}
