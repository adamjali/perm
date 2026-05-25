/**
 * Client-side name validation — re-export of the canonical server module.
 *
 * Previously this file hand-mirrored every regex + `checkUserName` from
 * `convex/lib/nameValidation.ts`, which had to stay in lockstep by hand and
 * was drift-prone. It now re-exports the single source directly (same pattern
 * as `src/lib/perm` → `convex/lib/perm`), so client UX can never diverge from
 * the authoritative server check. The canonical module is dependency-free
 * (pure regex/string logic), so it bundles safely on the client.
 *
 * @see convex/lib/nameValidation.ts — canonical source of truth
 * @module src/lib/nameValidation
 */

export {
  checkUserName,
  MAX_NAME_LENGTH,
} from "../../convex/lib/nameValidation";
export type {
  NameValidationFailure,
  NameCheckResult,
} from "../../convex/lib/nameValidation";
