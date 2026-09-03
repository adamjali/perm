/**
 * Which DOL foreign-labor program a FLAG case number belongs to.
 *
 * Every filing DOL's Foreign Labor Application Gateway handles gets a case
 * number from ONE serial counter, and the prefix is what says which program
 * it is: `G-100-` (and the older `A-`) for a PERM, `P-100-` for the
 * prevailing wage request that precedes it, `I-200-` / `I-203-` for a labor
 * condition application. DOL's batch status endpoint answers all three with
 * the same fields, and we store each in its own table on purpose - the PERM
 * tables feed the queue census, the review-stage pages and the RFI funnel,
 * all written against a PERM status vocabulary.
 *
 * This module is the one place that maps a case number to its program, and a
 * program to the things that differ: which table holds it, which freshness
 * row stamps it, what to call it in an email, and which status means it
 * landed well.
 *
 * ## Why it lives here and not in `src/lib/turso`
 *
 * `src/lib/turso/pwdCases.ts` and `lcaCases.ts` already carry the prefix
 * rules, but both import `server-only`, so Convex cannot read them. This
 * module has no such import and is safe from Convex, the browser and Node
 * alike, exactly as `caseStatusVocabulary.ts` is. The rules are therefore
 * duplicated, and `__tests__/flagCaseNumber.test.ts` reads the other copies
 * off disk and asserts they have not drifted - the same guard
 * `caseStatusVocabulary.ts` already uses against `caseLookup.ts`.
 *
 * @module
 */

import {
  canonicalStatus,
  isApproval,
  normaliseCaseNumber,
} from "./caseStatusVocabulary";

/** The three FLAG programs this product tracks per case. */
export type FlagProgram = "perm" | "pwd" | "lca";

/** Every program, in a stable order, for exhaustive iteration in tests. */
export const FLAG_PROGRAMS: readonly FlagProgram[] = ["perm", "pwd", "lca"];

/**
 * The prefix rules, byte-identical to the Turso read layer's own.
 *
 * PERM has no entry: its shape rule accepts any leading letter, so it is the
 * fallback rather than a pattern. See `programOf`.
 */
const PROGRAM_PATTERNS: readonly { program: FlagProgram; re: RegExp }[] = [
  { program: "pwd", re: /^P-\d{3}-\d{5}-\d+$/ },
  { program: "lca", re: /^I-\d{3}-\d{5}-\d+$/ },
];

/** Tidy a number the same way `normaliseCaseNumber` does, without judging it. */
function tidy(input: string): string {
  return input.trim().toUpperCase().replace(/\s+/g, "");
}

/**
 * The program a case number belongs to.
 *
 * THE ORDER IS LOAD-BEARING. The PERM shape rule is `^[A-Z]-\d{3}-\d{5}-\d+$`
 * and accepts ANY leading letter, so `P-100-26125-868956` satisfies it too.
 * Testing PERM first would file every prevailing wage request under
 * `perm_case_status`, where no row can ever match it, and the subscription
 * would sit there looking healthy and never fire. The specific prefixes go
 * first and PERM is the fallback, which is also how `/perm-case-status`
 * dispatches a lookup.
 *
 * Total by design: anything unrecognised comes back `perm`. Callers shape-gate
 * first with `normaliseFlagCaseNumber`; this answers "which of the three",
 * never "is this a case number".
 */
export function programOf(caseNumber: string): FlagProgram {
  const raw = tidy(caseNumber);
  for (const { program, re } of PROGRAM_PATTERNS) {
    if (re.test(raw)) return program;
  }
  return "perm";
}

/** A case number that passed the shape gate, with the program it belongs to. */
export interface FlagCaseRef {
  caseNumber: string;
  program: FlagProgram;
}

/**
 * Normalise and classify in one step, or null when it is not a case number.
 *
 * The shape gate is `normaliseCaseNumber`, unchanged and not re-implemented:
 * one copy of the rule that decides what may be stored as a key, so a number
 * normalised differently by the subscriber than by the reader cannot happen.
 */
export function normaliseFlagCaseNumber(input: string): FlagCaseRef | null {
  const caseNumber = normaliseCaseNumber(input);
  if (!caseNumber) return null;
  return { caseNumber, program: programOf(caseNumber) };
}

const STATUS_TABLE: Record<FlagProgram, string> = {
  perm: "perm_case_status",
  pwd: "pwd_case_status",
  lca: "lca_case_status",
};

/**
 * The live status table for a program.
 *
 * THE RESULT IS INTERPOLATED INTO SQL, by `convex/caseAlerts.ts`, so it must
 * never be able to carry caller input - and it cannot: the argument is one of
 * three literal keys, the map is exhaustive over them, so the return value is
 * one of three literal table names whatever anyone passes. Do not widen this
 * to take a `string`; a lookup that can miss puts `undefined` in a query.
 */
export function statusTableFor(program: FlagProgram): string {
  return STATUS_TABLE[program];
}

/**
 * The `data_freshness.dataset` key each program's ingest stamps.
 *
 * PERM's is written by `scripts/ingest_case_status_direct.py` (its pending
 * pass; the full pass owns `perm-case-status-full`), the other two by
 * `scripts/ingest_pwd_status_direct.py`. Reading the wrong one dates a
 * provenance line with another program's refresh, which is a small lie on
 * the one line whose entire job is saying where a number came from.
 */
const FRESHNESS_DATASET: Record<FlagProgram, string> = {
  perm: "perm-case-status",
  pwd: "pwd-status",
  lca: "lca-status",
};

export function freshnessDatasetFor(program: FlagProgram): string {
  return FRESHNESS_DATASET[program];
}

/**
 * What to call one filing, in prose.
 *
 * `withArticle` exists because "a LCA" is wrong and an email that gets the
 * article wrong on its first line reads as machine-written. Both forms are
 * user-visible copy, so they live together rather than being assembled by a
 * caller guessing at the vowel.
 */
const NOUNS: Record<FlagProgram, { noun: string; withArticle: string }> = {
  perm: { noun: "PERM case", withArticle: "a PERM case" },
  pwd: {
    noun: "prevailing wage request",
    withArticle: "a prevailing wage request",
  },
  lca: { noun: "LCA", withArticle: "an LCA" },
};

export function programNoun(program: FlagProgram): string {
  return NOUNS[program].noun;
}

export function programNounWithArticle(program: FlagProgram): string {
  return NOUNS[program].withArticle;
}

/**
 * The statuses that mean the filing landed WELL, for the two non-PERM
 * programs.
 *
 * A prevailing wage request ends with DOL issuing the wage: `DETERMINATION
 * ISSUED` is the ordinary good outcome, and a redetermination affirmed or
 * modified is still an issued wage. An LCA is certified.
 *
 * This matters because it drives one visual decision in the alert email.
 * `StatusRail` fills the new status lime when the case is still live or
 * ended well, and drops the fill for every other final status - denied,
 * withdrawn, expired. Judging a PWD by the PERM rule would print the
 * denial treatment on the day someone's wage came through.
 *
 * Deliberately NOT a substring test, for the same reason PERM's is not:
 * `CERTIFIED - WITHDRAWN` contains `CERTIFIED` and is a withdrawal.
 */
const LANDED_WELL: Record<Exclude<FlagProgram, "perm">, ReadonlySet<string>> = {
  pwd: new Set([
    "DETERMINATION ISSUED",
    "REDETERMINATION AFFIRMED",
    "REDETERMINATION MODIFIED",
  ]),
  lca: new Set(["CERTIFIED"]),
};

/**
 * Did this status end the filing well?
 *
 * PERM delegates to `isApproval`, so its rule stays in one place: the
 * narrowness there (exactly `CERTIFIED`, so `CERTIFIED - EXPIRED` is not an
 * approval) is the point of that function and must not be re-derived here.
 */
export function isProgramApproval(
  program: FlagProgram,
  status: string,
): boolean {
  if (program === "perm") return isApproval(status);
  return LANDED_WELL[program].has(canonicalStatus(status));
}
