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
/** The page and the documents its search box loads (`policy-changes/search.json`). */
export const POLICY_PAGES = ["/policy-changes", "/policy-changes/search.json"] as const;

/**
 * The article parts that read the rule watch's record. Every article using one is expired too,
 * found by reading the articles (`postsUsing`), so a new article on a rule needs no entry here.
 */
export const RULE_PARTS = ["RuleStatus", "RuleCompare"] as const;
