import type { FacetRow } from "@/lib/db/entityDetail";

/**
 * Tidying the free-text facets DOL's filers type, before a page lists them.
 *
 * The newspaper on Form 9089 Section H and the worksite city are typed by
 * hand, so one employer's list can hold "Wisconsin State Journal" beside
 * "Wisconsin StateJournal" and "Wisconsin State Journalv", or a note where
 * the paper's name belongs ("Note: The mandatory recruitment ste"), or a
 * street address in the city field. Measured on Stoughton Trailers, LLC on
 * Nov 1 2026: four newspaper rows for one paper and a note, and one city row
 * that was an address. Counts are summed, never dropped, except a row that
 * names no paper or no city at all.
 */

/** A cross-reference the filer typed after the paper's name ("The San Bernardino Sun; See Box E.5"). */
const FORM_NOTE = /\s*[;,]\s*see\b.*$/i;

/** A row that names no paper: the filer's note, or a placeholder. */
const NOT_A_PAPER = /^\s*(note\b|n\/?a\b|none\b|not applicable|see\b|tbd\b)/i;

/** Letters and digits only, lower case, "the" and a bracketed publisher dropped. */
function letters(label: string): string {
  return label
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/^\s*the\s+/, "")
    .replace(/[^a-z0-9]/g, "");
}

/** True when a and b differ by one insertion, deletion, substitution or swap of neighbours. */
function oneEditApart(a: string, b: string): boolean {
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  if (a.length === b.length) {
    if (a.slice(i + 1) === b.slice(i + 1)) return true;
    return a[i] === b[i + 1] && a[i + 1] === b[i] && a.slice(i + 2) === b.slice(i + 2);
  }
  const [long, short] = a.length > b.length ? [a, b] : [b, a];
  return long.slice(i + 1) === short.slice(i);
}

/**
 * One row per newspaper: spellings that differ only in spacing, case or
 * punctuation join, a stray character on a long name joins the busier row,
 * and a row naming no paper goes. The busier spelling names the row.
 */
export function cleanPapers(rows: readonly FacetRow[]): FacetRow[] {
  const groups: { key: string; row: FacetRow; top: number }[] = [];
  for (const r of [...rows].sort((x, y) => y.n - x.n)) {
    if (NOT_A_PAPER.test(r.label)) continue;
    const label = r.label.replace(FORM_NOTE, "").trim();
    const key = letters(label);
    if (!key) continue;
    const into = groups.find((g) => g.key === key || (key.length >= 10 && g.key.length >= 10 && oneEditApart(g.key, key)));
    if (into) {
      into.row = { ...into.row, n: into.row.n + r.n, certified: into.row.certified + r.certified, denied: into.row.denied + r.denied };
    } else {
      groups.push({ key, row: { ...r, label }, top: r.n });
    }
  }
  return groups.map((g) => g.row).sort((x, y) => y.n - x.n);
}

/**
 * The worksite cities that are cities: a label that opens with a house number
 * ("1111 Veterans Dr., WI") is a street address typed into the city field.
 */
export function realCities(rows: readonly FacetRow[]): FacetRow[] {
  return rows.filter((r) => !/^\s*\d/.test(r.label));
}
