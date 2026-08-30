import { Fragment } from "react";
import Link from "next/link";

import {
  BROWSE_BUCKETS,
  bucketLabel,
  browseHref,
  type BrowseBucket,
} from "@/lib/entityBrowse";
import type { BrowseEntry } from "@/lib/turso/entityBrowse";
import { cn } from "@/lib/utils";

/**
 * The A-Z index modules, shared by all three entity kinds.
 *
 * These exist for crawlers first and readers second, which is unusual enough
 * to write down. `/perm-employers` renders 54 crawlable links over 16,309
 * employer pages; the other 16,255 are reachable only through a client-side
 * search box, so a sitemap is the ONLY thing that discovers them and nothing
 * links to them. Sitemaps get a URL crawled; internal links are how authority
 * reaches it, and several AI crawlers read no sitemap at all.
 *
 * WHAT KEEPS THIS FROM BEING A DOORWAY. Google's doorway policy names
 * "substantially similar pages that are closer to search results than a
 * clearly defined browseable hierarchy". A letter index IS that hierarchy, and
 * these pages earn it three ways: each carries a sentence measured from its
 * own bucket (share of the kind, the busiest member), each row shows the
 * filing count that decides whether a reader opens it, and every bucket links
 * to every other so the set is a navigable whole rather than 27 leaves.
 *
 * A bucket with nothing in it is rendered as plain text, not a link. Occupation
 * names never start with X, Y or Z, and linking three pages that say "nothing
 * here" is exactly the thin-page pattern the rest of this codebase spends so
 * much effort avoiding.
 */

function fmt(n: number): string {
  return n.toLocaleString("en-US");
}

/**
 * Every bucket, as links, with the current one marked.
 *
 * The cross-link that makes the set connected: from any letter a crawler (or
 * a reader) reaches all 26 others plus the index in one hop, so the whole
 * browse tier is two clicks deep from the hub whichever door you came in.
 */
export function BrowseStrip({
  base,
  counts,
  active,
  className,
}: {
  /** e.g. "/perm-employers". */
  base: string;
  /** Bucket -> how many entities have a page there. */
  counts: Record<BrowseBucket, number>;
  /** The bucket being viewed, or undefined on the index itself. */
  active?: BrowseBucket;
  className?: string;
}) {
  return (
    <nav aria-label="Browse by first letter" className={cn("", className)}>
      <ul className="flex list-none flex-wrap gap-1.5 p-0">
        {BROWSE_BUCKETS.map((b) => {
          const n = counts[b] ?? 0;
          const isActive = b === active;
          const chip =
            "inline-flex min-h-[44px] min-w-[44px] items-center justify-center border-2 px-2 font-heading text-sm font-black uppercase no-underline";
          return (
            // Keyed Fragment with a real space: React renders array items with
            // NOTHING between them, so 27 chips reach every extractor as
            // "ABCDEFG...". This is the third module in this codebase to ship
            // that defect, hence the pattern rather than the habit.
            <Fragment key={b}>{" "}
              <li>
                {n === 0 ? (
                  <span
                    className={cn(
                      chip,
                      "border-border/40 bg-card text-muted-foreground",
                    )}
                    title={`No ${bucketLabel(b)} entries`}
                  >
                    {bucketLabel(b)}
                  </span>
                ) : (
                  <Link
                    href={browseHref(base, b)}
                    aria-current={isActive ? "page" : undefined}
                    className={cn(
                      chip,
                      "border-border transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "bg-card hover:border-primary hover:text-primary",
                    )}
                  >
                    {bucketLabel(b)}
                  </Link>
                )}
              </li>
            </Fragment>
          );
        })}
      </ul>
    </nav>
  );
}

/**
 * The browse INDEX's content: every bucket as a card carrying its own count.
 *
 * Deliberately not the strip again. The index page's job is to answer "which
 * letter is worth opening", so the count is the content rather than a
 * decoration, and a 27-chip strip repeated above it would be the same 27 links
 * twice for no reader.
 */
export function BrowseIndexGrid({
  base,
  counts,
  plural,
  className,
}: {
  base: string;
  counts: Record<BrowseBucket, number>;
  /** "employers", "law firms", "occupations". */
  plural: string;
  className?: string;
}) {
  return (
    <ul
      className={cn(
        "grid list-none grid-cols-2 gap-3 p-0 [&>*]:min-w-0 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6",
        className,
      )}
    >
      {BROWSE_BUCKETS.map((b) => {
        const n = counts[b] ?? 0;
        const card =
          "flex min-h-[44px] flex-col justify-center border-2 p-4 no-underline";
        return (
          <Fragment key={b}>{" "}
            <li className="min-w-0">
              {n === 0 ? (
                <div className={cn(card, "border-border/40 bg-card")}>
                  <span className="font-heading text-2xl font-black uppercase text-muted-foreground">
                    {bucketLabel(b)}
                  </span>{" "}
                  <span className="mt-1 font-mono text-xs font-bold text-foreground/60">
                    none
                  </span>
                </div>
              ) : (
                <Link
                  href={browseHref(base, b)}
                  className={cn(
                    card,
                    "border-border bg-card shadow-hard-sm transition-colors hover:border-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
                  )}
                >
                  <span className="font-heading text-2xl font-black uppercase">
                    {bucketLabel(b)}
                  </span>{" "}
                  <span className="mt-1 font-mono text-xs font-bold tabular-nums text-foreground/70">
                    {fmt(n)} {plural}
                  </span>
                </Link>
              )}
            </li>
          </Fragment>
        );
      })}
    </ul>
  );
}

/**
 * One bucket's entities, as real anchors in the server-rendered HTML.
 *
 * Multi-column rather than a grid, deliberately: CSS columns fill top to
 * bottom before moving right, which is how an alphabetical index reads. A
 * grid fills row-major and would run A, B, C across the first line.
 *
 * The per-item styling hangs off the LIST, not off each element. At 1,605
 * rows in the largest bucket, a 200-character class attribute per row is
 * ~320 KB of markup expressing one rule; the arbitrary variants say it once.
 */
export function BrowseList({
  base,
  entries,
  unit,
  className,
}: {
  base: string;
  entries: BrowseEntry[];
  /** What the number beside a name counts: "filings". */
  unit: string;
  className?: string;
}) {
  return (
    <ul
      className={cn(
        "list-none columns-1 gap-x-8 p-0 sm:columns-2 lg:columns-3 xl:columns-4",
        "[&>li]:flex [&>li]:break-inside-avoid [&>li]:items-center [&>li]:justify-between [&>li]:gap-3 [&>li]:border-b [&>li]:border-border/40",
        "[&_a]:inline-flex [&_a]:min-h-[44px] [&_a]:min-w-0 [&_a]:items-center [&_a]:text-base [&_a]:font-bold [&_a]:leading-snug [&_a]:underline [&_a]:decoration-primary [&_a]:decoration-2 [&_a]:underline-offset-2 [&_a]:hover:text-primary",
        "[&_span]:shrink-0 [&_span]:font-mono [&_span]:text-xs [&_span]:font-bold [&_span]:tabular-nums [&_span]:text-foreground/70",
        className,
      )}
    >
      {entries.map((e) => (
        <Fragment key={e.slug}>{" "}
          <li>
            <Link href={`${base}/${e.slug}`}>{e.name}</Link>{" "}
            <span title={`${fmt(e.total)} ${unit}`}>{fmt(e.total)}</span>
          </li>
        </Fragment>
      ))}
    </ul>
  );
}
