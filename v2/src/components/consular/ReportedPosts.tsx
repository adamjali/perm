import Link from "next/link";
import { ChatsCircleIcon } from "@phosphor-icons/react/ssr";

import { BarRows, type BarRow } from "@/components/data/BarRows";
import { FigurePlate } from "@/components/tools/FigurePlate";
import { MIN_REPORTS, SELF_REPORTED } from "@/lib/consularReport";
import { formatInt, formatShareOf } from "@/lib/format";

/**
 * The index page's small panel: the consulates with the most reports from visitors in the last 30 days, and
 * the share of their interview results that were a 221(g). The overview query already leaves out a post
 * under three reports and a share under three results; this panel also drops a slug State's tables don't
 * list (the server can't check a slug against State's list, so a made-up one is never named here).
 */

export interface BusiestPost {
  post: string;
  reports30: number;
  results: number | null;
  g221: number | null;
}

const SHOWN = 8;

export function ReportedPosts({
  busiest,
  posts,
  className,
}: {
  busiest: readonly BusiestPost[];
  /** Every consulate State's tables list, slug to name. */
  posts: readonly { slug: string; name: string }[];
  className?: string;
}) {
  const names = new Map(posts.map((p) => [p.slug, p.name]));
  const rows: BarRow[] = busiest
    .filter((b) => names.has(b.post))
    .slice(0, SHOWN)
    .map((b) => {
      const name = names.get(b.post)!;
      const share = b.results !== null && b.g221 !== null ? formatShareOf(b.g221, b.results) : null;
      return {
        key: b.post,
        label: (
          <Link href={`/consular-posts/${b.post}#reports`} className="link">
            {name}
          </Link>
        ),
        sub: share ? `${share} of ${formatInt(b.results!)} results ended in 221(g)` : `Too few results yet for a 221(g) share`,
        value: b.reports30,
        text: `${formatInt(b.reports30)} report${b.reports30 === 1 ? "" : "s"}`,
        tone: "primary",
        tip: `${name}\n${formatInt(b.reports30)} reports in the last 30 days\n${share ? `${share} of results ended in 221(g)` : "Too few results yet"}\n${SELF_REPORTED}`,
      };
    });

  return (
    <FigurePlate
      title="What visitors report"
      subject="The last 30 days"
      caption={`The consulates with the most interview reports from visitors to this site, and the share of their results that were a 221(g). A consulate shows once ${MIN_REPORTS} people have reported there. Each one's page has the rest, and a form to add yours.`}
      source={`${SELF_REPORTED}.`}
      className={className}
    >
      {rows.length ? (
        <BarRows inline rows={rows} label="Consulates with the most visitor reports in the last 30 days" />
      ) : (
        <p className="flex items-start gap-2 text-base text-muted-foreground">
          <ChatsCircleIcon aria-hidden="true" weight="bold" className="mt-1 size-4 shrink-0" /> No consulate has{" "}
          {MIN_REPORTS} reports from the last 30 days yet. Each consulate&apos;s page has a form to share an interview.
        </p>
      )}
    </FigurePlate>
  );
}
