/**
 * ChangelogTimeline
 *
 * The changelog as one short dated list: the date, what kind of change it was,
 * the title (linking to the entry) and its one-line summary. Each entry's
 * picture and tags live on the entry's own page; on the list they made every
 * row a screen tall and the pictures meant little out of context (round 3,
 * Oct 15 2026). Plain server markup, nothing animates in.
 */

import Link from "next/link";
import type { PostSummary } from "@/lib/content/types";
import { cn } from "@/lib/utils";

// Shared formatting for the entry's published/updated <time> elements. Module
// scope so the Intl.DateTimeFormatOptions object isn’t reallocated each render.
const DATE_FMT: Intl.DateTimeFormatOptions = {
  month: "long",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
};
const fmtDate = (iso: string): string =>
  new Date(iso).toLocaleDateString("en-US", DATE_FMT);

/** One soft fill per kind of change, with the ink edge every chip carries. */
const KIND_FILL: Record<string, string> = {
  Release: "bg-primary text-black",
  Feature: "bg-soft-info",
  Correction: "bg-soft-warn",
};

interface ChangelogTimelineProps {
  posts: PostSummary[];
}

/**
 * One timeline row.
 *
 * Every row is an ordinary changelog post, corrections included: they are one
 * entry (`content/changelog/corrections.mdx`, category "Correction") that
 * names each page, quotes what it said, states what was true and says what
 * changed, and `corrections-entry.test.ts` holds it to that.
 */
type Entry = { date: string; key: string; post: PostSummary };

export default function ChangelogTimeline({ posts }: ChangelogTimelineProps) {
  if (posts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="font-heading text-lg font-bold text-muted-foreground">
          No updates yet
        </p>{" "}
        <p className="mt-1 text-sm text-muted-foreground">
          Check back soon for product updates.
        </p>
      </div>
    );
  }

  // Newest first, the order the release notes already used.
  const entries: Entry[] = posts
    .map((post): Entry => ({ date: post.meta.date, key: post.slug, post }))
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

  return (
    <ol className="relative max-w-3xl">
      {/* The rail, drawn, never animated in. */}
      <div className="absolute bottom-2 left-[7px] top-2 w-[2px] bg-border" aria-hidden="true" />

      {entries.map((entry) => {
        const { meta } = entry.post;
        const updated = meta.updated && meta.updated !== meta.date ? meta.updated : null;
        const kind = meta.category ?? "";
        return (
          <li
            key={entry.key}
            id={entry.post.slug}
            className="relative scroll-mt-24 pb-6 pl-8 last:pb-0"
          >
            <span
              className="absolute left-0 top-1.5 size-4 border-2 border-border bg-primary"
              aria-hidden="true"
            />
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
              <time dateTime={entry.date} className="font-heading font-semibold">
                {fmtDate(entry.date)}
              </time>{" "}
              {kind ? (
                <span
                  className={cn(
                    "border-2 border-border px-2 py-0.5 font-heading text-sm font-semibold",
                    KIND_FILL[kind] ?? "bg-card",
                  )}
                >
                  {kind}
                </span>
              ) : null}{" "}
              {updated ? (
                <span className="text-muted-foreground">
                  <span className="font-semibold text-foreground">Updated</span>{" "}
                  <time dateTime={updated}>{fmtDate(updated)}</time>
                </span>
              ) : null}
            </div>{" "}
            <h2 className="mt-1.5 font-heading text-lg font-bold leading-snug">
              <Link href={`/changelog/${entry.post.slug}`} className="hover-underline">
                {meta.title}
              </Link>
            </h2>{" "}
            <p className="mt-1 leading-relaxed text-soft">{meta.description}</p>
          </li>
        );
      })}
    </ol>
  );
}
