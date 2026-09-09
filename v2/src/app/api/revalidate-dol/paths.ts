/**
 * The pages that render DOL's processing-times snapshot.
 *
 * IN ITS OWN MODULE BECAUSE A `route.ts` MAY NOT EXPORT ANYTHING ELSE. Next
 * generates a type for every route file that constrains its exports to the
 * known handler names, so `export const DOL_PAGES` from `route.ts` fails the
 * build with `Property 'DOL_PAGES' is incompatible with index signature ...
 * not assignable to type 'never'`. That is a TYPE-GENERATION error, so it does
 * not appear in `pnpm typecheck` or in `next dev`; it only surfaces in
 * `next build`, after a full compile. Colocated here, next to `route.ts`, the
 * same way `api/chat/create-tools.ts` sits beside its route.
 *
 * Derived by following `getProcessingTimes()` and `lib/turso/estimate` to their
 * consumers. Two deliberate omissions:
 *
 *   - `/perm-queue/[month]` is ~39 generated pages. They read the snapshot, but
 *     they carry `revalidate = 3600` and self-heal within the hour, and
 *     expiring a whole generated tail in one call is precisely the cost mistake
 *     the employer endpoint exists to avoid. Left to its own window.
 *   - `/perm-case-status` is fully dynamic (no `revalidate`), so there is no
 *     cached copy to expire.
 *
 * `/perm-queue` and `/perm-processing-times` already have short windows and
 * gain the least here, but they do render the number, and one extra render on
 * the ~4 days a month DOL moves is not worth an exception that would later read
 * as an oversight.
 *
 * `route.test.ts` re-derives this list from the app tree, so a page added later
 * cannot quietly start serving a stale figure.
 */
export const DOL_PAGES = [
  "/",
  "/tools",
  "/signup",
  "/llms.txt",
  "/perm-queue",
  "/perm-rfi-audit",
  "/perm-processing-times",
  "/tools/pwd-calculator",
  "/tools/green-card-timeline",
  "/tools/perm-timeline-calculator",
  // The catalogue page reads the snapshot ITSELF now (2026-09-09). It used to
  // render `<img src="/badge/x.svg">` and hold no figure of its own, so it was
  // correctly absent; it now prints DOL's as-of date and renders every badge
  // inline from one read. `route.test.ts` caught the omission the same day the
  // page changed, which is exactly what that test is for.
  "/badges",
  // Every badge carries DOL's queue month or average days, and a hot-linked
  // badge showing last week's month for a day is the staleness this endpoint
  // exists to end. Literal paths, because a dynamic segment cannot be handed
  // to revalidatePath. Keep in step with BADGE_KINDS.
  "/badge/perm-queue.svg",
  "/badge/perm-audits.svg",
  "/badge/perm-recon.svg",
  "/badge/perm-days.svg",
  "/badge/pwd-queue.svg",
  "/badge/pwd-perm-survey.svg",
  "/badge/pwd-h1b.svg",
  "/badge/pwd-h2b.svg",
  "/badge/pwd-cw1.svg",
] as const;
