"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MagnifyingGlassIcon } from "@phosphor-icons/react";

import { DidYouMean, nameSuggestionChips, useNameSuggestions } from "@/components/search/DidYouMean";
import { suggestForPath, type ArticleRef, type PathSuggestions } from "@/lib/search/didYouMean";
import { staticIndex } from "@/lib/search/siteIndex";

/**
 * "Did you mean" on the 404 page, from the address that missed.
 *
 * The 404 page is rendered ahead of time, so the server never sees the
 * address; it is read here once the page has loaded. A mistyped page
 * address is matched against every page and article; a missing employer,
 * law firm or occupation page becomes a search of that family, with the
 * closest names from /api/suggest beside it.
 */
const noop = () => () => {};

export function NotFoundSuggestions({ articles }: { articles: ArticleRef[] }) {
  const pathname = usePathname();
  // False on the server and in the prerendered HTML, true once in a browser,
  // where the address is the one that missed.
  const mounted = React.useSyncExternalStore(noop, () => true, () => false);
  const found: PathSuggestions | null = React.useMemo(
    () => (mounted && pathname ? suggestForPath(pathname, staticIndex(), articles) : null),
    [mounted, pathname, articles],
  );

  const family = found?.family ?? null;
  const { suggestions } = useNameSuggestions(family?.kind ?? "all", family?.query ?? "", Boolean(family?.kind));

  if (!found) return null;
  const pages = found.pages.map((p) => ({ label: p.label, href: p.href }));
  if (!family && pages.length === 0) return null;

  return (
    <div className="mt-8 border-t border-border pt-6">
      {family ? (
        <>
          <Link
            href={family.searchHref}
            className="inline-flex min-h-[48px] items-center gap-2 border border-border bg-tint-primary px-4 font-bold transition-colors hover:bg-accent"
          >
            <MagnifyingGlassIcon aria-hidden="true" className="size-5" weight="bold" />
            {family.searchable ? `Search ${family.noun} for “${family.query}”` : `Every page of ${family.noun}`}
          </Link>{" "}
          <DidYouMean className="mt-5" suggestions={nameSuggestionChips(suggestions)} />
        </>
      ) : (
        <DidYouMean suggestions={pages} />
      )}
    </div>
  );
}
