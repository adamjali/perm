"use client";

import * as React from "react";
import Link from "next/link";

import { useNameSuggestions } from "@/components/search/DidYouMean";
import { rankFuzzy } from "@/lib/fuzzy";
import { staticIndex } from "@/lib/search/siteIndex";
import type { NameSuggestion, SuggestKind } from "@/lib/search/suggestTypes";
import { formatInt } from "@/lib/format";

/**
 * The pages a name search can also mean, grouped beside the filings it found:
 * the employer, law firm and occupation pages with that name, and the site's
 * own pages. A search for "Microsoft" finds Microsoft's filings below, and
 * its employer page here, which holds its whole record.
 */

const GROUPS: { kind: SuggestKind; heading: string }[] = [
  { kind: "employer", heading: "Employers" },
  { kind: "attorney", heading: "Law firms" },
  { kind: "occupation", heading: "Jobs" },
];

const LINK = "inline-flex min-h-11 items-baseline gap-2 py-2 text-base font-semibold text-primary-text underline-offset-4 hover:underline";

function Count({ n }: { n: number }) {
  return (
    <span className="whitespace-nowrap text-sm font-normal text-muted-foreground">
      {formatInt(n)} {n === 1 ? "filing" : "filings"}
    </span>
  );
}

/** Employer, law firm and occupation pages close to a name, or nothing. */
export function NameGroups({ query, enabled }: { query: string; enabled: boolean }) {
  const { suggestions } = useNameSuggestions("all", query, enabled);
  const byKind = GROUPS.map((g) => ({ ...g, rows: suggestions.filter((s: NameSuggestion) => s.kind === g.kind) })).filter(
    (g) => g.rows.length > 0,
  );
  if (byKind.length === 0) return null;
  return (
    <section aria-labelledby="name-groups-heading" className="border-b border-border pb-6">
      <h2 id="name-groups-heading" className="font-heading text-xl font-bold">
        Pages with this name
      </h2>{" "}
      <div className="mt-3 grid gap-x-8 gap-y-4 sm:grid-cols-3 [&>*]:min-w-0">
        {byKind.map((g) => (
          <div key={g.kind}>
            <h3 className="text-sm font-semibold text-muted-foreground">{g.heading}</h3>{" "}
            <ul className="mt-1">
              {g.rows.map((s) => (
                <li key={s.href}>
                  <Link href={s.href} className={LINK}>
                    <span className="min-w-0 break-words">{s.name}</span> <Count n={s.cases} />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

/** Below this a page's name is only loosely like the query. */
const PAGE_MIN = 0.8;
const PAGES_SHOWN = 3;

/** The site's own pages a query names ("processing times", "visa bulletin"), or nothing. */
export function PageMatches({ query }: { query: string }) {
  const pages = React.useMemo(() => staticIndex(), []);
  const q = query.trim();
  const hits = q.length >= 3 ? rankFuzzy(q, pages, (p) => [p.label, p.keywords], { limit: PAGES_SHOWN, min: PAGE_MIN }) : [];
  if (hits.length === 0) return null;
  return (
    <section aria-labelledby="page-matches-heading">
      <h2 id="page-matches-heading" className="font-heading text-xl font-bold">
        Pages and guides
      </h2>{" "}
      <ul className="mt-2">
        {hits.map(({ item }) => (
          <li key={item.href}>
            <Link href={item.href} className={LINK}>
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
