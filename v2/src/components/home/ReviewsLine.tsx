import { ChatDotsIcon, StarIcon } from "@phosphor-icons/react/ssr";

import { REVIEW_URL } from "@/lib/constants/externalLinks";
import { APP_RATING, shouldAdvertiseRating } from "@/lib/structuredData";
import { buttonVariants } from "@/components/ui/button";

/**
 * The site's review rating and the link to leave one.
 *
 * Server markup, no third-party script: the homepage's aggregateRating
 * structured data needs the rating visible on the page, and this line is it.
 * Both sit behind one threshold (`shouldAdvertiseRating`), so the rating
 * never shows where the markup doesn't, and the other way round. The link
 * shows at every count, since it's how the count grows.
 */
export function ReviewsLine() {
  return (
    <div className="mt-10 flex flex-wrap items-center justify-between gap-4 border-t-2 border-border pt-6">
      {shouldAdvertiseRating() ? (
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="flex" aria-hidden="true">
            {Array.from({ length: 5 }, (_, i) => (
              <StarIcon key={i} weight="fill" className="size-5 text-primary" />
            ))}
          </span>{" "}
          <span className="font-heading text-lg font-bold">{Number(APP_RATING.value).toFixed(1)}</span>{" "}
          <span className="text-sm text-muted-foreground">from {APP_RATING.count} reviews</span>
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
      </a>
    </div>
  );
}
