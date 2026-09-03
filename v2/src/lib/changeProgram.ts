/**
 * The three FLAG programs the change feed covers, and what to call them.
 *
 * A PLAIN MODULE, NOT AN EXPORT FROM `turso/changes`. That module is
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
export const CHANGE_PROGRAMS = ["perm", "pwd", "lca"] as const;

export type ChangeProgram = (typeof CHANGE_PROGRAMS)[number];

export const PROGRAM_LABEL: Record<ChangeProgram, string> = {
  perm: "PERM",
  pwd: "Prevailing wage",
  lca: "H-1B LCA",
};

/** The case-number prefixes DOL issues for each, for the reader's orientation. */
export const PROGRAM_PREFIX: Record<ChangeProgram, string> = {
  perm: "G-100, G-200, G-300, G-400",
  pwd: "P-100",
  lca: "I-200, I-203",
};
