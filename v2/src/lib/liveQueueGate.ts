/**
 * One switch for everything that depends on the live mirror being complete.
 *
 * WHY A CONSTANT AND NOT A BANNER. A warning somebody has to remember to
 * remove is a worse artefact than the thing it warns about - this repo has
 * already shipped a debug marker to production in its own site header,
 * surviving review because the change it arrived with was characterised by
 * diff statistics rather than read. Gating the sitemap entry, the navigation
 * link and the provisional notice on ONE boolean means confirming the load is
 * a one-line change, and nothing can half-ship: the page cannot appear in
 * search results while still calling itself provisional, and it cannot drop
 * the notice while still being unlisted.
 *
 * WHAT "COMPLETE" MEANS. `perm_case_status` is a per-case scan of 416,407
 * cases loading incrementally. Counts move between two queries a minute
 * apart, so any figure taken from it now is a moving target: a filing month
 * looks less decided than it is simply because its decided cases have not
 * arrived yet. The page is built and rendered against it regardless, because
 * the SHAPE is settled and only the row count changes.
 *
 * FLIPPED TRUE 2026-08-26 on confirmation: 412,865 cases (99.1% of upstream,
 * the shortfall being rows that changed status mid-load), two counts twenty
 * seconds apart identical, zero mixed-case rows, and `is_final` exact across
 * all 16 statuses. It is not a feature flag and it is not a preference.
 */
export const MIRROR_COMPLETE = true;

/** Shown wherever a figure from the mirror is displayed while it loads. */
export const PROVISIONAL_NOTICE =
  "These counts come from a per-case scan that is still loading, so they are provisional: a filing month can look less decided than it is simply because its decided cases have not arrived yet. Nothing here is a published DOL figure.";
