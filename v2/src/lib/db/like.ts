/**
 * A "contains" search in SQL: LIKE, with its two wildcards escaped so a typed
 * `%` or `_` matches itself instead of widening the search, and the escape
 * character escaped first, or it would eat the escapes that follow. The
 * pattern and its ESCAPE clause are one rule, so they live together.
 */

export const LIKE_ESCAPE = "ESCAPE '\\'";

export function likeContains(text: string): string {
  return `%${text.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}
