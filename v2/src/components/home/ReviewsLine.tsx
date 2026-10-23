import { ChatDotsIcon, StarHalfIcon, StarIcon } from "@phosphor-icons/react/ssr";

import { REVIEW_URL } from "@/lib/constants/externalLinks";
import { APP_RATING, shouldAdvertiseRating, type RatingFields } from "@/lib/structuredData";
import type { SiteReview } from "@/lib/reviews/senjaParse";
import { buttonVariants } from "@/components/ui/button";

/**
 * The site's review rating, the newest reviews, and the link to leave one.
 *
 * Server markup, no third-party script: the homepage reads its reviews from
 * Senja on the server (`getSiteReviews`) and passes the same rating here and to
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

/** How many reviews show under the rating; the count covers all of them. */
const SHOWN_REVIEWS = 3;

export function ReviewsLine({
  rating = APP_RATING,
  reviews = [],
}: {
  rating?: RatingFields;
  reviews?: SiteReview[];
} = {}) {
  const advertise = shouldAdvertiseRating(rating.count);
  return (
    // Beside the founder line on the homepage: the rating over its button, in
    // a framed box so it holds its place next to the prose.
    <div className="flex flex-wrap items-center justify-between gap-4 border-2 border-border bg-card p-5 shadow-hard-sm">
      {advertise ? (
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="flex" aria-hidden="true">
            {starFills(Number(rating.value)).map((fill, i) =>
              fill === "half" ? (
                <StarHalfIcon key={i} weight="fill" className="size-5 text-primary" />
              ) : (
                <StarIcon key={i} weight={fill === "full" ? "fill" : "regular"} className="size-5 text-primary" />
              ),
            )}
          </span>{" "}
          <span className="font-heading text-lg font-bold">{Number(rating.value).toFixed(1)}</span>{" "}
          <span className="text-sm text-muted-foreground">from {rating.count} reviews</span>
        </p>
      ) : null}{" "}
      <a
        href={REVIEW_URL}
        target="_blank"
        rel="noopener noreferrer"
        className={buttonVariants({ variant: "outline", size: "lg" })}
      >
        <ChatDotsIcon className="size-4" aria-hidden="true" />
        Leave a review
      </a>{" "}
      {advertise && reviews.length ? (
        <ul className="w-full space-y-4 border-t-2 border-border pt-4">
          {reviews.slice(0, SHOWN_REVIEWS).map((r) => (
            <li key={r.id}>
              <figure>
                <blockquote className="line-clamp-4 text-sm leading-relaxed">{`\u201C${r.text}\u201D`}</blockquote>{" "}
                <figcaption className="mt-1 text-sm text-muted-foreground">
                  {`${r.name}, ${r.rating} of 5 stars`}
                </figcaption>
              </figure>{" "}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
