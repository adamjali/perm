/**
 * The pages that render the policy feed or the rule pipeline, expired the run
 * any policy source writes.
 *
 * IN ITS OWN MODULE BECAUSE A `route.ts` MAY NOT EXPORT ANYTHING ELSE (see
 * `revalidate-dol/paths.ts` for the build error that rule prevents).
 *
 * Derived by following `lib/db/rulePipeline` and `lib/db/policyNotices` to their pages. `route.test.ts`
 * re-derives the list from the app tree, so a page that starts reading the
 * pipeline can't quietly show yesterday's stage for six hours.
 */
export const POLICY_PAGES = ["/policy-changes"] as const;
