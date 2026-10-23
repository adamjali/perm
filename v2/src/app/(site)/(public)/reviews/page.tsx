/**
 * Reviews: every approved review by someone outside the team, newest first, and the form to leave one.
 *
 * Read from the site's own reviews (convex/siteReviews.ts, through getSiteReviews), the same read as the
 * homepage's rating line, so the two never disagree. A review shows once the owner approves it, which is never by
 * its stars (16 CFR 465.7(b)); reviews by the people who run the site are kept and never shown (16 CFR 465.5).
 * Every review is in the HTML for crawlers and readers without scripts; ListPages shows twelve at a time, the
 * page in the address.
 *
 * The page dates itself by its newest review (OWN_DATE in lib/pageDates.ts), as the sitemap does, so its
 * "Updated" day moves when a review arrives, not only when this file changes.
 */

import type { Metadata } from "next";
import { PencilSimpleLineIcon } from "@phosphor-icons/react/ssr";

import { ReviewStars } from "@/components/home/ReviewsLine";
import { ReviewForm } from "@/components/reviews/ReviewForm";
import { SiteBreadcrumbs } from "@/components/layout/SiteBreadcrumbs";
import { buttonVariants } from "@/components/ui/button";
import { ListPages } from "@/components/ui/list-pages";
import { openGraphBase } from "@/lib/openGraphBase";
import { pageDate } from "@/lib/pageDates";
import { getSiteReviews } from "@/lib/reviews/read";
import { newestReviewDay, reviewDay } from "@/lib/reviews/senjaParse";
import { withSocialCard } from "@/lib/socialCard";
import { longDate } from "@convex/lib/months";

const TITLE = "PERM Tracker Reviews";
const DESCRIPTION =
  "What people who use PERM Tracker say about it. Every review left by someone outside the team, newest first, with the average rating.";

export const metadata: Metadata = withSocialCard(
  {
    // Absolute: the root template would make it "PERM Tracker Reviews | PERM Tracker".
    title: { absolute: TITLE },
    description: DESCRIPTION,
    alternates: { canonical: "/reviews" },
    openGraph: { ...openGraphBase, title: TITLE, description: DESCRIPTION, url: "/reviews" },
  },
  "reviews",
);

// A daily window; approving or declining a review refreshes the page at once (/api/revalidate-reviews).
export const revalidate = 86400;

/** Reviews a page shows before the page numbers take over. */
const PER_PAGE = 12;

export default async function ReviewsPage() {
  const { rating, reviews, live } = await getSiteReviews();
  const count = reviews.length;
  const updated = pageDate("/reviews", { reviews: newestReviewDay(reviews) });

  return (
    <>
      <SiteBreadcrumbs date={updated} />
      <div className="mx-auto w-full max-w-3xl px-4 pb-20 pt-10 sm:px-6 sm:pt-14">
        <h1 className="font-heading text-4xl font-bold leading-[1.05] tracking-tight sm:text-5xl">Reviews</h1>{" "}
        <p className="mt-5 max-w-2xl text-lg leading-relaxed text-soft">
          What people who use PERM Tracker say about it, newest first.
        </p>{" "}
        <section
          aria-label="The average rating"
          className="mt-8 flex flex-wrap items-center justify-between gap-4 border-2 border-border bg-card p-5 shadow-hard-sm"
        >
          {count > 0 ? (
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <ReviewStars value={Number(rating.value)} className="size-6" />{" "}
              <span className="font-heading text-2xl font-bold">{`${rating.value} out of 5`}</span>{" "}
              <span className="text-muted-foreground">{`from ${count} ${count === 1 ? "review" : "reviews"}`}</span>
            </p>
          ) : (
            <p className="text-muted-foreground">
              {live ? "No reviews yet. Yours could be the first." : "The reviews couldn't be loaded just now. Please try again later."}
            </p>
          )}{" "}
          <a href="#write" className={buttonVariants({ variant: "outline", size: "lg" })}>
            <PencilSimpleLineIcon className="size-4" aria-hidden="true" />
            Leave a review
          </a>
        </section>{" "}
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
          Every review by someone outside the team shows here once we&apos;ve checked it isn&apos;t spam, whatever its
          rating. Reviews by the people who run PERM Tracker are left out.
        </p>{" "}
        {count > 0 ? (
          <>
            <ul id="review-list" className="mt-10 scroll-mt-24 divide-y-2 divide-border border-y-2 border-border">
              {reviews.map((r) => {
                const day = longDate(reviewDay(r.date));
                return (
                  <li key={r.id} className="py-6">
                    <figure>
                      <p className="flex items-center gap-2">
                        <ReviewStars value={r.rating} className="size-4" />{" "}
                        <span className="text-sm text-muted-foreground">{`${r.rating} of 5`}</span>
                      </p>{" "}
                      <blockquote className="mt-3 whitespace-pre-line text-base leading-relaxed">
                        {`“${r.text}”`}
                      </blockquote>{" "}
                      <figcaption className="mt-3 text-sm text-muted-foreground">
                        {day ? `${r.name}, ${day}` : r.name}
                      </figcaption>
                    </figure>{" "}
                  </li>
                );
              })}
            </ul>{" "}
            <ListPages listId="review-list" total={count} perPage={PER_PAGE} noun="reviews" />
          </>
        ) : null}{" "}
        <section id="write" aria-labelledby="write-heading" className="mt-14 scroll-mt-24">
          <h2 id="write-heading" className="font-heading text-2xl font-bold sm:text-3xl">
            Leave a review
          </h2>{" "}
          <p className="mt-2 max-w-2xl text-base leading-relaxed text-soft">
            Tell people waiting on a case, or running them, what PERM Tracker did for you.
          </p>{" "}
          <div className="mt-5">
            <ReviewForm />
          </div>
        </section>
      </div>
    </>
  );
}
