/**
 * When a printed employer name is close enough to one of our employers to
 * offer it as a POSSIBLE match.
 *
 * A job site prints "Meta" or "Amazon"; DOL prints "META PLATFORMS, INC." and
 * "AMAZON.COM SERVICES LLC". The exact step (equal program keys) misses those,
 * so the lookup falls back to a candidate whose key BEGINS with every word of
 * the query's key, in order. Whole words only: "Meta" is not Metamorphosis
 * Labs and "Intel" is not Intellectt (the text prefix that once counted
 * 8,219 of their LCAs on Intel's page). A query made only of words that name
 * nobody ("Global", "Technology Solutions") gets no possible match at all. The
 * same letters with the gaps elsewhere also count, ending on a word boundary
 * ("Walmart" may be "WAL-MART ASSOCIATES"; Rule D in scripts/entity_identity.py).
 *
 * Pure, so the browser extension's server answer can be tested without a
 * database. The answer always says "possible" and shows the matched name.
 */

import { programKey } from "@/lib/entitySlug";

/** Longest name a lookup accepts, checked before anything walks the string. */
export const MAX_QUERY_LENGTH = 120;
/** Shortest query key a possible match may start from. */
const MIN_KEY_LENGTH = 3;

/** Words that on their own name no particular employer. */
const GENERIC = new Set([
  "global", "international", "national", "america", "american", "us", "usa",
  "solution", "solutions", "technology", "technologies", "tech", "services", "service",
  "systems", "system", "group", "consulting", "consultants", "holdings", "enterprises",
  "enterprise", "management", "associates", "partners", "health", "healthcare",
  "medical", "university", "college", "school", "hospital", "software", "it", "data",
  "digital", "labs", "lab", "inc", "llc", "corp", "of", "and", "the",
]);

/** The query as a person typed it, tidied; null when it can't be a name. */
export function cleanEmployerQuery(raw: string): string | null {
  if (typeof raw !== "string" || raw.length > MAX_QUERY_LENGTH * 4) return null;
  const tidy = raw.replace(/\s+/g, " ").trim();
  if (tidy.length < 2 || tidy.length > MAX_QUERY_LENGTH) return null;
  return tidy;
}

/** Whether `candidateKey` may be the employer `queryKey` names. Both are program keys. */
export function isPossibleMatch(queryKey: string, candidateKey: string): boolean {
  const q = queryKey.split(" ").filter(Boolean);
  const c = candidateKey.split(" ").filter(Boolean);
  if (q.length === 0 || queryKey.replace(/ /g, "").length < MIN_KEY_LENGTH) return false;
  if (q.every((w) => GENERIC.has(w))) return false;
  if (q.length <= c.length && q.every((w, i) => c[i] === w)) return true;
  // Rule D (scripts/entity_identity.py): the same letters with the gaps elsewhere,
  // still ending where one of the candidate's words ends. "walmart" may be "wal
  // mart associates"; "meta" is still not "metamorphosis labs".
  const letters = q.join("");
  let lead = "";
  for (const w of c) {
    lead += w;
    if (lead === letters) return true;
    if (lead.length >= letters.length) break;
  }
  return false;
}

/** The first candidate, in the order given (busiest first), that may be the query's employer. */
export function pickPossibleMatch<T extends { name: string }>(query: string, candidates: T[]): T | null {
  const qk = programKey(query);
  for (const cand of candidates) {
    if (isPossibleMatch(qk, programKey(cand.name))) return cand;
  }
  return null;
}
