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
 * full window after the record moved: the owner's "updated, correct, synced"
 * (Oct 1 2026). Literal paths only, and the generated tails are left to their
 * own windows (see the test's EXCLUDED list for each reason).
 *
 * `__tests__/route.test.ts` re-derives this list from the app tree.
 */
export const SWEEP_PAGES = [
  "/",
  "/perm-decision-activity",
  "/perm-case-statuses",
  "/perm-rfi-audit",
  "/perm-employers/under-review",
  "/tools/perm-timeline-calculator",
  "/estimate-scorecard",
  // The wage-request and LCA summaries, written by pwd-status-direct.yml,
  // which calls this endpoint too.
  "/pwd-cases",
  "/lca-cases",
  "/case-search",
] as const;
