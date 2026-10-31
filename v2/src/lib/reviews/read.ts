import "server-only";

import { api } from "@convex/_generated/api";
import { queryStatic } from "@/lib/convexStatic";
import { APP_RATING } from "@/lib/structuredData";

import { ratingOf, type ReviewRating, type SiteReview } from "./senjaParse";

export interface SiteReviews {
  rating: ReviewRating;
  /** Approved reviews by people outside the team, newest first, at most the newest 500. Empty when unread. */
  reviews: SiteReview[];
  /** Every shown review counted by stars (index 0 is one star), from the kept tally: exact past the newest 500. */
  byStars: number[];
  /** False when the reviews couldn't be read and the rating is the last one recorded in the code. */
  live: boolean;
}

/** The average and count from a count by stars. */
export function ratingFromStars(byStars: number[]): ReviewRating {
  const count = byStars.reduce((a, n) => a + n, 0);
  const sum = byStars.reduce((a, n, i) => a + n * (i + 1), 0);
  const value = count ? (Math.round((sum / count) * 10) / 10).toFixed(1) : "0.0";
  return { value, count: String(count), best: "5", worst: "1" };
}

/**
 * The site's reviews (convex/siteReviews.ts): approved ones only, never an address, never an insider's. Read on
 * the page's own daily window; approving or declining a review refreshes /reviews and the homepage at once
 * (`/api/revalidate-reviews`). The words come from the newest 500; the average, the count and the breakdown come
 * from the kept tally, so they stay exact however many reviews there are. Never throws: when the read fails the
 * rating falls back to APP_RATING, the last count written into the code, and no review text is shown. When only
 * the tally can't be read, the rating is worked out from the reviews read, and the reason is logged.
 */
export async function getSiteReviews(): Promise<SiteReviews> {
  try {
    const [rows, tally] = await Promise.all([
      queryStatic(api.siteReviews.listPublished, {}, 86400),
      queryStatic(api.siteReviews.publicTally, {}, 86400).catch((error: unknown) => {
        console.warn("[reviews] couldn't read the tally, counting the reviews read instead:", String(error));
        return null;
      }),
    ]);
    const reviews: SiteReview[] = rows.map((r) => ({
      id: r.id,
      rating: r.rating,
      text: r.text,
      name: r.name,
      date: new Date(r.createdAt).toISOString(),
      ...(r.viaAlert ? { viaAlert: true } : {}),
    }));
    if (tally && !tally.exact) console.warn("[reviews] no kept tally yet; counted from the table");
    const byStars = tally && tally.stars.length === 5 ? tally.stars : countByStars(reviews);
    return { rating: byStars.some((n) => n > 0) ? ratingFromStars(byStars) : ratingOf(reviews), reviews, byStars, live: true };
  } catch (error) {
    console.warn("[reviews] couldn't read the reviews, using the last recorded rating:", String(error));
    return { rating: APP_RATING, reviews: [], byStars: [0, 0, 0, 0, 0], live: false };
  }
}

function countByStars(reviews: SiteReview[]): number[] {
  const stars = [0, 0, 0, 0, 0];
  for (const r of reviews) if (r.rating >= 1 && r.rating <= 5) stars[r.rating - 1]! += 1;
  return stars;
}
