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
import { BADGE_KINDS } from "@/lib/badge";

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
  // correctly absent; it now prints federal figures inline from one read.
  "/badges",
  // Every badge's canonical path, DERIVED rather than hand-listed. A hand list
  // fell behind the registry the same day six kinds were added, and the file
  // said "keep in step with BADGE_KINDS" in a comment, which is not a thing
  // that fails. Deriving makes the drift impossible instead of detectable.
  //
  // Only the canonical `<kind>.svg` form is expired here. The style and theme
  // variants are the same figure in another shape and self-heal within their
  // own 24-hour window; expiring ~200 of them on the four days a month DOL
  // moves is the cost mistake `/perm-queue/[month]` is already excluded for.
  ...BADGE_KINDS.map((k) => `/badge/${k}.svg`),
];
