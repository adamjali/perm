/**
 * The SHAPE of a PERM case number, on the client side of the boundary.
 *
 * WHY THIS IS A SECOND COPY. The authority is `normaliseCaseNumber` in
 * src/lib/turso/caseLookup.ts, which is `server-only`: importing it from the
 * lookup form would put the Turso client in the browser bundle, which that
 * module's own guard exists to make a build error. So the rule is duplicated
 * here deliberately, exactly as the entity slug rules are duplicated between
 * the Python writer and the TypeScript reader, and pinned the same way: a
 * fixture test asserts this regex is character-identical to the server's, so
 * changing one without the other goes red rather than silently producing a
 * form that rejects numbers the server would have accepted.
 *
 * IT CHECKS SHAPE ONLY, and that is not an oversight. `parseCaseNumber` in
 * permCaseNumber.ts is stricter: it also rejects an impossible day-of-year, a
 * future date and a pre-2005 year, because it is decoding a date and a wrong
 * date is worse than a refusal. This one is deciding whether a string is
 * worth a database round trip, and a hint that says "not a case number" about
 * a number the server would happily look up is the worse failure here.
 */

/** `G-100-26125-868956` and friends, normalised for a primary-key lookup. */
export function normaliseCaseNumber(input: string): string | null {
  const raw = input.trim().toUpperCase().replace(/\s+/g, "");
  return /^[A-Z]-\d{3}-\d{5}-\d+$/.test(raw) ? raw : null;
}
