/**
 * The pages that read State's IV Scheduling Status Tool (`lib/db/consularPosts`), expired when a
 * new monthly table is stored (`permtracker-uscis iv-tool`, scripts/ingest_iv_scheduling.py).
 *
 * IN ITS OWN MODULE BECAUSE A `route.ts` MAY NOT EXPORT ANYTHING ELSE (see `revalidate-dol/paths.ts`).
 * `route.test.ts` re-derives the readers from the app tree, so a page added later can't quietly keep
 * last month's table.
 */
export const CONSULAR_PAGES = [
  "/consular-posts",
  // The planner's consulate route names the reader's post and its scheduling month.
  "/tools/green-card-timeline",
  // The sitemap child that lists the consulate pages.
  "/sitemaps/pages.xml",
];

/** Whole families, by FILE path (route groups included), expired with the (route, "page") form. */
export const CONSULAR_PAGE_FAMILIES = ["/(site)/(public)/consular-posts/[post]"];
