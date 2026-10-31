/**
 * The pages that print USCIS's posted processing times (`lib/db/uscisPosted`), expired the run the posted-times
 * loader finishes, so a new USCIS posting shows the day it's copied instead of waiting out a page's weekly window.
 *
 * IN ITS OWN MODULE BECAUSE A `route.ts` MAY NOT EXPORT ANYTHING ELSE (see `revalidate-dol/paths.ts`).
 * `route.test.ts` re-derives the list from the app tree.
 */
export const USCIS_TIMES_PAGES = ["/uscis-processing-times"] as const;
