import Link from "next/link";
import { ChatDotsIcon, StarHalfIcon, StarIcon } from "@phosphor-icons/react/ssr";

import { APP_RATING, shouldAdvertiseRating, type RatingFields } from "@/lib/structuredData";
import type { SiteReview } from "@/lib/reviews/senjaParse";
import { buttonVariants } from "@/components/ui/button";

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
          <ReviewStars value={Number(rating.value)} />{" "}
          <span className="font-heading text-lg font-bold">{Number(rating.value).toFixed(1)}</span>{" "}
          <Link href="/reviews" className="link inline-flex min-h-11 items-center text-sm">{`from ${rating.count} reviews`}</Link>
        </p>
      ) : null}{" "}
      <Link href="/reviews#write" className={buttonVariants({ variant: "outline", size: "lg" })}>
        <ChatDotsIcon className="size-4" aria-hidden="true" />
        Leave a review
      </Link>{" "}
      {advertise && reviews.length ? (
        <ul className="w-full space-y-4 border-t-2 border-border pt-4">
          {reviews.slice(0, SHOWN_REVIEWS).map((r) => (
            <li key={r.id}>
              <figure>
                {r.text ? (
                  <blockquote className="line-clamp-4 text-sm leading-relaxed [overflow-wrap:anywhere]">{`\u201C${r.text}\u201D`}</blockquote>
                ) : null}{" "}
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
