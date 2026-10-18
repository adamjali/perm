/**
 * The four FLAG program families the site reads (the change feed, the case
 * search, employer pages), and what to call them. The one list and the one set
 * of names: nothing else defines either.
 *
 * A PLAIN MODULE, NOT AN EXPORT FROM `db/changes`. That module is
 * `server-only`, so a value import of it from a client component is a build
 * error - the same reason `flagMerge.ts` is a plain module rather than an
 * export from the browser component that uses it. The labels are needed on
 * both sides (the table header and the reader's filter, in the browser; the
 * per-program roll-up, on the server), so they live where both can reach them.
 *
 * DOL exposes every program through one endpoint with one serial counter, and
 * we keep a separate pair of tables per program because the PERM tables feed
 * the census, the stage pages, the RFI funnel and the alert sweep, all written
 * against a PERM status vocabulary. This is the shared vocabulary that lets one
 * feed read all three.
 */

/** In the order they are offered, busiest first. */
export const CHANGE_PROGRAMS = ["perm", "pwd", "lca", "seasonal"] as const;

export type ChangeProgram = (typeof CHANGE_PROGRAMS)[number];

/**
 * Narrow an untrusted string to a program.
 *
 * Lives here rather than in a route because the same check is needed wherever
 * a program arrives from outside: a query string, a stored preference, a
 * link. A second copy is a second place for the list to drift.
 */
export function isChangeProgram(v: string): v is ChangeProgram {
  return (CHANGE_PROGRAMS as readonly string[]).includes(v);
}

/**
 * A wage request means a PERM one on every page that lists them. DOL's PW file
 * and its live record also hold H-1B, H-1B1, E-3, H-2B and CW-1 requests; each
 * of those is read where its own program is, and a reader looking at an
 * employer's wage requests is asking about its green card filings.
 */
export const PWD_VISA_CLASS = "PERM";

/** A program's name where a row or a tag names it. */
export const PROGRAM_LABEL: Record<ChangeProgram, string> = {
  perm: "PERM",
  pwd: "Wage request",
  lca: "H-1B LCA",
  seasonal: "H-2A, H-2B and CW-1",
};

/** A program's name where a heading or a list introduces it. */
export const PROGRAM_TITLE: Record<ChangeProgram, string> = {
  perm: "PERM (green card)",
  pwd: "Prevailing wage requests",
  lca: "H-1B labor condition applications",
  seasonal: "H-2A, H-2B and CW-1 (seasonal work)",
};

/** The case-number prefixes DOL issues for each, for the reader's orientation. */
export const PROGRAM_PREFIX: Record<ChangeProgram, string> = {
  perm: "G-100, G-200, G-300, G-400",
  pwd: "P-100",
  lca: "I-200 to I-203",
  seasonal: "H-300, H-400, C-500, P-400, P-500, JO-A-300",
};
