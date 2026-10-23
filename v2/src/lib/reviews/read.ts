import "server-only";

import { api } from "@convex/_generated/api";
import { queryStatic } from "@/lib/convexStatic";
import { APP_RATING } from "@/lib/structuredData";

import { ratingOf, type ReviewRating, type SiteReview } from "./senjaParse";

export interface SiteReviews {
  rating: ReviewRating;
  /** Approved reviews by people outside the team, newest first. Empty when they couldn't be read. */
  reviews: SiteReview[];
  /** False when the reviews couldn't be read and the rating is the last one recorded in the code. */
  live: boolean;
}

/**
 * The site's reviews (convex/siteReviews.ts): approved ones only, never an address, never an insider's. Read on
 * the page's own daily window; approving or declining a review refreshes /reviews and the homepage at once
 * (`/api/revalidate-reviews`). Never throws: when the read fails the rating falls back to APP_RATING, the last
 * count written into the code, and no review text is shown.
 */
export async function getSiteReviews(): Promise<SiteReviews> {
  try {
    const rows = await queryStatic(api.siteReviews.listPublished, {}, 86400);
    const reviews: SiteReview[] = rows.map((r) => ({
      id: r.id,
      rating: r.rating,
      text: r.text,
      name: r.name,
      date: new Date(r.createdAt).toISOString(),
    }));
    return { rating: ratingOf(reviews), reviews, live: true };
  } catch (error) {
    console.warn("[reviews] couldn't read the reviews, using the last recorded rating:", String(error));
    return { rating: APP_RATING, reviews: [], live: false };
  }
}
