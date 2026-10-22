"use client";

import { clampPage, Pagination, usePageParam } from "@/components/ui/pagination";

/**
 * Pages for a long server-rendered list (`<ul id>` of `<li>`), keeping every item in the HTML. Owner, Oct 21 2026:
 * "pagination not endless scroll". Used where the list is the page's crawlable index (the A to Z pages exist so
 * every entity page is one link from an index) or plain server markup (the policy feed): crawlers and the
 * no-script reader get every item. What pages is the view: a style rule shows one page's
 * names (`nth-child`) and hides the rest, drawn on the server for page 1 so nothing moves on load, then for the
 * page in the address (`?page=3`). The list itself never re-renders.
 */
export function ListPages({
  listId,
  total,
  perPage = 200,
  noun,
}: {
  /** The id of the list's <ul>. */
  listId: string;
  total: number;
  perPage?: number;
  /** Plural ("employers"). */
  noun: string;
}) {
  const [param, setPage] = usePageParam();
  const pageCount = Math.max(1, Math.ceil(total / perPage));
  const page = clampPage(param, pageCount);
  if (pageCount <= 1) return null;
  const first = (page - 1) * perPage + 1;
  const last = page * perPage;
  // Elements only: nth-child skips the text nodes between the items.
  const rule = `#${listId} > :nth-child(-n+${first - 1}), #${listId} > :nth-child(n+${last + 1}) { display: none; }`;
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: page === 1 ? `#${listId} > :nth-child(n+${last + 1}) { display: none; }` : rule }} />
      <Pagination
        page={page}
        pageCount={pageCount}
        onPage={(n) => {
          setPage(n);
          document.getElementById(listId)?.scrollIntoView({ block: "start" });
        }}
        total={total}
        perPage={perPage}
        noun={noun}
        label={`Pages of ${noun}`}
        className="mt-8"
      />
    </>
  );
}
