/**
 * Names withheld from the site, each at that person's or firm's own request
 * and by the owner's decision for that request alone: the site's instance of
 * the one rule in convex/lib/withheldNames.ts (read that header first; Convex
 * applies the same rule to its own reads in convex/lib/publicMirror.ts).
 *
 * The lists are never in this repository, which is public. They live in
 * WITHHELD_EMPLOYERS and WITHHELD_FIRMS, set on the server
 * (/srv/permtracker/app/env/production.env) and as GitHub Actions secrets for
 * the build, which prerenders pages from the same database. Unset, nothing is
 * withheld and every function below is a no-op.
 *
 * Applied in one place for the database (`rows()` in ../db/client.ts, which
 * every read goes through) and one for DOL's live service (`askDol` in
 * ../db/caseDiscovery.ts, which every live lookup goes through). A name is
 * masked, never its row: counts, ranks and charts stay as they were, the name
 * reads "Law firm 3" and links to that label's neutral page.
 */

import {
  makeMasker,
  neutralPath,
  parseWithheld,
  parseWithheldEnv,
  shownLabel,
  withheldKindOf,
  type MaskOptions,
  type PreparedStatement,
  type StatementContext,
  type WithheldEntry,
  type WithheldKind,
} from "@convex/lib/withheldNames";

export type { MaskOptions, PreparedStatement, StatementContext, WithheldEntry, WithheldKind };
export { makeMasker, neutralPath, parseWithheld, parseWithheldEnv, shownLabel, withheldKindOf };

const shipped = makeMasker(parseWithheldEnv(process.env));

/** Whether anything is withheld on this deployment. */
export const withholdingActive = shipped.active;

/** A statement with its neutral slugs rewritten to the real ones, and what it was asked by. */
export const prepareStatement = shipped.prepare;

/** Rows as the public may see them (see the rule's header). */
export const maskRows = shipped.mask;

/** The same, with each kept row's index among the rows read. */
export const maskRowsIndexed = shipped.maskIndexed;

/** The employer's name on DOL's live answer: the label for a withheld name or case. */
export const shownName = shipped.shownName;

/** Text with every withheld name replaced: for prose that isn't a database row. */
export const scrubWithheldText = shipped.scrubText;

/**
 * True when a search's or a filter's words are a withheld entity's real name
 * or slug. The search then answers "no match", never the next-closest name.
 * `kind` takes the site's entity kinds ("attorney" is a firm).
 */
export function isWithheldQuery(kind: string, text: string | null | undefined): boolean {
  const k = kind === "any" ? "any" : withheldKindOf(kind);
  return k ? shipped.isWithheldQuery(k, text) : false;
}

/** The withheld entry a neutral slug stands for on this kind's pages, or null. */
export function neutralPageEntry(kind: string, slug: string | null | undefined): WithheldEntry | null {
  const k = withheldKindOf(kind);
  return k ? shipped.neutralEntry(k, slug) : null;
}

/** True for a neutral page's path ("/perm-attorneys/law-firm-3"): it asks not to be indexed. */
export function isNeutralPath(path: string): boolean {
  return shipped.neutralForPath(path) !== null;
}

/** The entry a real or a neutral slug names, for a refusal (a firm can't claim a withheld page). */
export function withheldBySlug(kind: string, slug: string | null | undefined): WithheldEntry | null {
  const k = withheldKindOf(kind);
  return k ? shipped.withheldBySlug(k, slug) : null;
}

/** Every entry, for the deploy's checks and the live check. */
export const withheldEntries = shipped.entries;
