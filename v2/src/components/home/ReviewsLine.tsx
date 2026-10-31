import Link from "next/link";
import { ChatDotsIcon, StarHalfIcon, StarIcon } from "@phosphor-icons/react/ssr";

import { APP_RATING, shouldAdvertiseRating, type RatingFields } from "@/lib/structuredData";
import type { SiteReview } from "@/lib/reviews/senjaParse";
import { buttonVariants } from "@/components/ui/button";
import { ReviewCard } from "@/components/reviews/ReviewCard";
import { cardDay } from "@/lib/reviews/cardDay";

/**
 * The site's review rating, the newest reviews, and the link to leave one.
 *
 * Server markup, no third-party script: the homepage reads the site's own
 * approved reviews on the server (`getSiteReviews`) and passes the same rating here and to
 * its aggregateRating structured data, which needs the rating visible on the
 * page. Both sit behind one threshold (`shouldAdvertiseRating`), so the rating
 * never shows where the markup doesn't, and the other way round. The link
 * shows at every count, since it's how the count grows.
 */
/** Five stars for a rating, to the nearest half: 4.7 is four full and a half. */
export function starFills(value: number): Array<"full" | "half" | "empty"> {
  const halves = Math.round(value * 2);
  return Array.from({ length: 5 }, (_, i) => (halves >= (i + 1) * 2 ? "full" : halves === i * 2 + 1 ? "half" : "empty"));
}

/** A rating's stars, drawn only: the number beside them says it in words. */
export function ReviewStars({ value, className = "size-5" }: { value: number; className?: string }) {
  return (
    <span className="flex" aria-hidden="true">
      {starFills(value).map((fill, i) =>
        fill === "half" ? (
          <StarHalfIcon key={i} weight="fill" className={`${className} text-primary`} />
        ) : (
          <StarIcon key={i} weight={fill === "full" ? "fill" : "regular"} className={`${className} text-primary`} />
        ),
      )}
    </span>
  );
}

/** How many reviews the homepage shows: the newest. The count and "See all" cover every one. */
const SHOWN_REVIEWS = 3;
/** The tiles' columns from a tablet up, by how many there are, so two never leave a third column empty. */
const COLUMNS: Record<number, string> = { 1: "md:max-w-md", 2: "md:grid-cols-2", 3: "md:grid-cols-3" };

/**
 * "What people say" on the homepage: the rating, the newest reviews as the same tiles /reviews shows, a button
 * to leave one and a link to all of them. Full width under the About line (owner, Oct 23 2026: the framed box
 * beside the prose read awkwardly).
 */
export function ReviewsLine({
  rating = APP_RATING,
  reviews = [],
}: {
  rating?: RatingFields;
  reviews?: SiteReview[];
} = {}) {
  const advertise = shouldAdvertiseRating(rating.count);
  const count = Number(rating.count) || 0;
  const newest = advertise ? reviews.slice(0, SHOWN_REVIEWS) : [];
  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
        <div>
          <h2 className="font-heading text-2xl font-bold sm:text-3xl">What people say</h2>{" "}
          {advertise ? (
            <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
              <ReviewStars value={Number(rating.value)} />{" "}
              <span className="font-heading text-lg font-bold">{`${Number(rating.value).toFixed(1)} out of 5`}</span>{" "}
              <span className="text-base text-muted-foreground">{`from ${rating.count} ${rating.count === "1" ? "rating" : "ratings"}`}</span>
            </p>
          ) : null}
        </div>{" "}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <Link href="/reviews#write" className={buttonVariants({ variant: "outline", size: "lg" })}>
            <ChatDotsIcon className="size-4" aria-hidden="true" />
            Leave a review
          </Link>{" "}
          {advertise && count > 0 ? (
            <Link href="/reviews#said" className="link inline-flex min-h-11 items-center text-base">
              {`See all ${count} ${count === 1 ? "review" : "reviews"}`}
            </Link>
          ) : null}
        </div>
      </div>{" "}
      {newest.length ? (
        <ul aria-label="The newest reviews" className={`mt-6 grid grid-cols-1 gap-5 [&>*]:min-w-0 ${COLUMNS[newest.length] ?? ""}`}>
          {newest.map((r) => (
            <li key={r.id} className="flex">
              <ReviewCard
                review={{ id: r.id, rating: r.rating, text: r.text, name: r.name, day: cardDay(r.date, r.viaAlert), viaAlert: r.viaAlert }}
                lines={5}
                compact
                className="w-full"
              />
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
