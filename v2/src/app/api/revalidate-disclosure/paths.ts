/**
 * The aggregate pages built from DOL's quarterly disclosure files.
 *
 * IN ITS OWN MODULE BECAUSE A `route.ts` MAY NOT EXPORT ANYTHING ELSE. Next
 * generates a type for every route file constraining its exports to the known
 * handler names, and an extra export fails `next build` with a type-generation
 * error that appears in no other command. Same arrangement as
 * `api/revalidate-dol/paths.ts`.
 *
 * WHY THIS EXISTS. These pages read data that changes FOUR TIMES A YEAR, and
 * they sat on a one-day window: about 364 expiries a year each to express four
 * real changes. Every expiry a visitor walks into is a paid ISR render of an
 * identical page. With a trigger they can sit on a long window and still be
 * correct within minutes of a quarterly load.
 *
 * THE `[slug]` TEMPLATES ARE DELIBERATELY ABSENT. `/perm-employers/[slug]` is
 * ~21,000 generated pages and `/perm-attorneys/[slug]` and
 * `/perm-wages/[slug]` add thousands more. `revalidatePath` with the pattern
 * form expires every one of them in a single call, which is exactly the cost
 * mistake `/api/revalidate-live-employers` exists to avoid - it takes the few
 * hundred slugs the nightly diff says actually moved. Expiring 30,000 entity
 * pages to reflect a quarterly load would cost far more than serving them
 * slightly stale until their own window turns over.
 *
 * `/perm-cases` is included even though it also reads the live remainder: the
 * live half has its own nightly path, and one extra render four times a year
 * is not worth an exception that would later read as an oversight.
 *
 * `route.test.ts` re-derives this list from the app tree, so a page added later
 * that reads quarterly data cannot quietly keep serving a stale figure.
 */
export const DISCLOSURE_PAGES = [
  "/perm-cases",
  "/perm-wages",
  "/perm-wages/browse",
  "/perm-by-state",
  "/perm-denial-risk",
  "/perm-employers",
  "/perm-employers/browse",
  "/perm-attorneys",
  "/perm-attorneys/browse",
  "/methodology",
  "/tools/salary-explorer",
  "/tools/i140-trends",
] as const;
