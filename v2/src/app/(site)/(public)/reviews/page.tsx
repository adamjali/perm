/**
 * Reviews: the form to leave one first (owner, Oct 23 2026), then what people said, as rows of cards that drift
 * slowly (ReviewCarousel: one row, up to three as reviews grow), and the whole list folded under them once the
 * reviews outgrow the rows.
 *
 * Read from the site's own reviews (convex/siteReviews.ts, through getSiteReviews), the same read as the
 * homepage's rating line, so the two never disagree. A review shows once the owner approves it, which is never by
 * its stars (16 CFR 465.7(b)); reviews by the people who run the site are kept and never shown (16 CFR 465.5).
 * Every review is in the HTML for crawlers and readers without scripts.
 *
 * The page dates itself by its newest review (OWN_DATE in lib/pageDates.ts), as the sitemap does, so its
 * "Updated" day moves when a review arrives, not only when this file changes.
 */

import type { Metadata } from "next";

import { ReviewStars } from "@/components/home/ReviewsLine";
import { ReviewCarousel, type CarouselReview } from "@/components/reviews/ReviewCarousel";
import { ReviewForm } from "@/components/reviews/ReviewForm";
import { SiteBreadcrumbs } from "@/components/layout/SiteBreadcrumbs";
import { ListPages } from "@/components/ui/list-pages";
import { openGraphBase } from "@/lib/openGraphBase";
import { pageDate } from "@/lib/pageDates";
import { getSiteReviews } from "@/lib/reviews/read";
import { IN_ROWS_MAX } from "@/lib/reviews/rows";
import { newestReviewDay, reviewDay } from "@/lib/reviews/senjaParse";
import { withSocialCard } from "@/lib/socialCard";
import { longDate } from "@convex/lib/months";

const TITLE = "PERM Tracker Reviews";
const DESCRIPTION =
  "What people who use PERM Tracker say about it, and a short form to leave your own. Every review from outside the team, with the average rating.";

// What a shared link says: an invitation first, since most people who see it haven't used the site yet.
const SHARE_TITLE = "Reviews of PERM Tracker";
const SHARE_DESCRIPTION =
  "Rate PERM Tracker in a tap, and read what the people who use it say. Every review from outside the team shows, whatever its stars.";

export const metadata: Metadata = withSocialCard(
  {
    // Absolute: the root template would make it "PERM Tracker Reviews | PERM Tracker".
    title: { absolute: TITLE },
    description: DESCRIPTION,
    alternates: { canonical: "/reviews" },
    openGraph: { ...openGraphBase, title: SHARE_TITLE, description: SHARE_DESCRIPTION, url: "/reviews" },
    twitter: { title: SHARE_TITLE, description: SHARE_DESCRIPTION },
  },
  "reviews",
);

// A daily window; approving or declining a review refreshes the page at once (/api/revalidate-reviews).
export const revalidate = 86400;

/** The full list's page size. */
const PER_PAGE = 12;
/** The rating breakdown shows from this many reviews; below it a breakdown says more about chance than the site. */
const BREAKDOWN_FROM = 5;

export default async function ReviewsPage() {
  const { rating, reviews, live } = await getSiteReviews();
  const count = reviews.length;
  const updated = pageDate("/reviews", { reviews: newestReviewDay(reviews) });
  const cards: CarouselReview[] = reviews.map((r) => ({
    id: r.id,
    rating: r.rating,
    text: r.text,
    name: r.name,
    day: longDate(reviewDay(r.date)),
  }));
  const byStars = [5, 4, 3, 2, 1].map((n) => ({ n, count: reviews.filter((r) => r.rating === n).length }));
  const most = Math.max(1, ...byStars.map((b) => b.count));

  return (
    <>
      <SiteBreadcrumbs date={updated} />
      <div className="mx-auto w-full max-w-6xl px-4 pb-24 pt-12 sm:px-6 sm:pt-16">
        <section id="write" aria-labelledby="reviews-heading" className="scroll-mt-24">
          <h1 id="reviews-heading" className="text-center font-heading text-4xl font-bold leading-[1.05] tracking-tight sm:text-5xl">
            Reviews of PERM Tracker
          </h1>{" "}
          {count > 0 ? (
            <p className="mt-4 flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
              <ReviewStars value={Number(rating.value)} className="size-6" />{" "}
              <span className="font-heading text-xl font-bold">{`${rating.value} out of 5`}</span>{" "}
              <a href="#said" className="link inline-flex min-h-11 items-center text-base">{`from ${count} ${count === 1 ? "review" : "reviews"}`}</a>
            </p>
          ) : null}{" "}
          <p className="mx-auto mt-4 max-w-xl text-center text-lg leading-relaxed text-soft">
            Tell people waiting on a case, or running them, what PERM Tracker did for you.
          </p>{" "}
          <div className="mt-12">
            <ReviewForm />
          </div>
        </section>{" "}
        <section id="said" aria-labelledby="said-heading" className="mt-24 scroll-mt-24">
          <h2 id="said-heading" className="text-center font-heading text-3xl font-bold sm:text-4xl">
            What people say
          </h2>{" "}
          <p className="mx-auto mt-3 max-w-2xl text-center text-base leading-relaxed text-muted-foreground">
            Every review by someone outside the team shows here, whatever its stars, unless it&apos;s spam or fake,
            abusive, shares someone&apos;s personal details, or isn&apos;t about PERM Tracker. Reviews by the people
            who run PERM Tracker are left out.
          </p>{" "}
          {count >= BREAKDOWN_FROM ? (
            <dl className="mx-auto mt-8 grid max-w-md grid-cols-[auto_1fr_auto] items-center gap-x-3 gap-y-2 [&>*]:min-w-0">
              {byStars.map((b) => (
                <div key={b.n} className="contents">
                  <dt className="text-sm font-bold">{`${b.n} ${b.n === 1 ? "star" : "stars"}`}</dt>{" "}
                  <dd className="h-3 border-2 border-border" aria-hidden="true">
                    <span className="block h-full bg-primary" style={{ width: `${(b.count / most) * 100}%` }} />
                  </dd>{" "}
                  <dd className="text-sm tabular-nums text-muted-foreground">{b.count}</dd>{" "}
                </div>
              ))}
            </dl>
          ) : null}{" "}
          <div className="mt-10">
            {count > 0 ? (
              <ReviewCarousel reviews={cards} />
            ) : (
              <p className="text-center text-lg text-muted-foreground">
                {live ? "No reviews yet. Yours could be the first." : "The reviews couldn't be loaded just now. Please try again later."}
              </p>
            )}
          </div>{" "}
          {count > IN_ROWS_MAX ? (
            <details className="mx-auto mt-10 max-w-3xl">
              <summary className="cursor-pointer text-center font-heading text-lg font-bold">{`All ${count} reviews`}</summary>{" "}
              <ul id="review-list" className="mt-6 scroll-mt-24 divide-y-2 divide-border border-y-2 border-border">
                {cards.map((r) => (
                  <li key={r.id} className="py-6">
                    <figure>
                      <p className="flex items-center gap-2">
                        <ReviewStars value={r.rating} className="size-4" />{" "}
                        <span className="text-sm text-muted-foreground">{`${r.rating} of 5`}</span>
                      </p>{" "}
                      {r.text ? (
                        <blockquote className="mt-3 whitespace-pre-line text-base leading-relaxed [overflow-wrap:anywhere]">
                          {`“${r.text}”`}
                        </blockquote>
                      ) : null}{" "}
                      <figcaption className="mt-3 text-sm text-muted-foreground">{r.day ? `${r.name}, ${r.day}` : r.name}</figcaption>
                    </figure>{" "}
                  </li>
                ))}
              </ul>{" "}
              <ListPages listId="review-list" total={count} perPage={PER_PAGE} noun="reviews" />
            </details>
          ) : null}
        </section>
      </div>
    </>
  );
}
