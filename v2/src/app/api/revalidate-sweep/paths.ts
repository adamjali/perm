/**
 * The pages that render figures our DOL sweep writes: the daily decisions,
 * the live census, the review stages, the sweep's own check time.
 *
 * In its own module because a `route.ts` may export only handler names (see
 * api/revalidate-dol/paths.ts for the build error that rule produces).
 *
 * WHY THE SWEEP EXPIRES THEM. These pages sit on daily or six-hourly windows,
 * and the sweep finishes twice a day. Without this a page can print the
 * previous day's decisions, or "checked against DOL" a day late, for up to a
 * full window after the record moved. Literal paths only, and the generated
 * tails are left to their
 * own windows (see the test's EXCLUDED list for each reason).
 *
 * `__tests__/route.test.ts` re-derives this list from the app tree.
 */
export const SWEEP_PAGES = [
  "/",
  // The About page prints the homepage's record ledger, its "checked" date included.
  "/about",
  "/perm-decision-activity",
  "/perm-case-statuses",
  "/perm-rfi-audit",
  "/perm-employers/under-review",
  // The board of totals: the census, holds, decisions per day, RFIs, new filings.
  "/perm-by-the-numbers",
  // Where every step stands: the day's decisions, each status's moves, the census.
  "/today",
  "/tools/green-card-timeline",
  // Opens with today's holds, from the same document as the page above.
  "/press",
  "/tools/perm-timeline-calculator",
  "/estimate-scorecard",
  // The wage-request, LCA and H-2A/H-2B summaries, written by
  // pwd-status-direct.yml, which calls this endpoint too.
  "/pwd-cases",
  "/lca-cases",
  "/seasonal-cases",
  "/case-search",
  // Guides holding a drawing that reads the sweep (the line, the RFI record): figure-guides-refresh.test.ts
  // holds this list to the guides' own tags.
  "/guides/how-the-perm-queue-works",
  "/guides/perm-rfi-issued-what-to-do",
  "/guides/track-a-prevailing-wage-request",
] as const;
