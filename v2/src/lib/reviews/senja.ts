import "server-only";

import { APP_RATING } from "@/lib/structuredData";

import { outsideReviews, parseSenjaWidget, ratingOf, type ReviewRating, type SiteReview } from "./senjaParse";

/** The Senja widget whose script carries the reviews (its id is in the widget's own URL, public). */
export const SENJA_WIDGET_URL = "https://widget.senja.io/widget/3563db96-3a71-4d2a-b7e8-70550d4dd814/platform.js";

export interface SiteReviews {
  rating: ReviewRating;
  /** Outside reviews, newest first. Empty when Senja couldn't be read. */
  reviews: SiteReview[];
  /** False when Senja couldn't be read and the rating is the last one recorded in the code. */
  live: boolean;
}

/**
 * The homepage's reviews, read from Senja once a day (the page's own window; a shorter fetch window would cap the
 * page's, which isr-window-caps.test.ts forbids). Never throws: when Senja can't be read the rating falls back to
 * APP_RATING, the last count written into the code, and no review text is shown.
 */
export async function getSiteReviews(): Promise<SiteReviews> {
  try {
    const res = await fetch(SENJA_WIDGET_URL, {
      next: { revalidate: 86400 },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) throw new Error(`Senja answered ${res.status}`);
    const all = parseSenjaWidget(await res.text());
    if (!all) throw new Error("no review array in the Senja widget script");
    const reviews = outsideReviews(all);
    return { rating: ratingOf(reviews), reviews, live: true };
  } catch (error) {
    console.warn("[reviews] Senja unreadable, using the last recorded rating:", String(error));
    return { rating: APP_RATING, reviews: [], live: false };
  }
}
