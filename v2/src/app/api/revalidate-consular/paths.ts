/**
 * The pages that read State's consular tables, expired when one is stored: the IV Scheduling
 * Status Tool (`lib/db/consularPosts`, `permtracker-uscis iv-tool`, scripts/ingest_iv_scheduling.py),
 * the monthly nonimmigrant issuances by post (`lib/db/nivIssuances`, scripts/ingest_niv_issuances.py)
 * and the yearly refusals by ground (`lib/db/visaRefusals`, scripts/ingest_visa_refusals.py).
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
  // State's refusals by ground, every year.
  "/visa-refusals",
];

/** Whole families, by FILE path (route groups included), expired with the (route, "page") form. */
export const CONSULAR_PAGE_FAMILIES = ["/(site)/(public)/consular-posts/[post]"];
