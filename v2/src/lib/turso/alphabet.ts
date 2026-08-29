/**
 * How much a case's employer initial is worth, read from `perm_docs.alphabet`.
 *
 * Written by `scripts/build_alphabet.py`, which owns the measurement and states
 * why it exists. Nothing here computes: a GROUP BY over ~340k rows on an
 * unindexed expression is not a request-path query.
 */
import "server-only";

import { doc } from "./publicData";

export interface AlphabetLetter {
  letter: string;
  cases: number;
  meanDays: number;
  /** Days above (+) or below (-) the corpus mean. */
  deltaDays: number;
}

export interface AlphabetMonthGap {
  month: string;
  /** S-Z mean minus A-I mean. Negative means the back half was FASTER. */
  gapDays: number;
  cases: number;
}

export interface Alphabet {
  letters: AlphabetLetter[];
  meanDays: number;
  cases: number;
  /** Fastest letter to slowest, end to end. */
  spreadDays: number;
  monthlyGaps: AlphabetMonthGap[];
  medianGapDays: number;
  monthsMeasured: number;
  /** Months where the back half of the alphabet came out ahead. */
  monthsReversed: number;
  since: string;
  source: string;
}

export async function getAlphabet(): Promise<Alphabet | null> {
  const d = await doc<Alphabet>("alphabet");
  if (!d || !Array.isArray(d.letters) || d.letters.length === 0) return null;
  return d;
}
