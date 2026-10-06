/**
 * Titles for the industry pages (/perm-industries/<code>).
 */

/**
 * A Census industry title without its parenthetical: "(except Physicians)" and
 * our own "(group 518)" note stay on the page, and the NAICS code that sits
 * beside this name in a title already tells two such industries apart.
 */
export function industryName(label: string): string {
  return label.replace(/\s*\([^)]*\)/g, "").trim() || label;
}

/** "PERM in <industry>, NAICS <code>" when it fits Google's 60; the code first when it doesn't. */
export function industryTitle(label: string, code: string): string {
  const plain = `PERM in ${industryName(label)}, NAICS ${code}`;
  return plain.length <= 60 ? plain : `NAICS ${code} PERM Filings: ${industryName(label)}`;
}
