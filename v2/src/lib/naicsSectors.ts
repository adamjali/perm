/**
 * The Census Bureau's 2022 NAICS sectors (two-digit codes), for grouping an
 * industry by its sector. Generated from scripts/data/naics_titles.json, the
 * same table the ingest takes industry titles from; ranges such as 31-33
 * (Manufacturing) appear once per code.
 */

export const NAICS_SECTORS: Readonly<Record<string, string>> = {
  "11": "Agriculture, Forestry, Fishing and Hunting",
  "21": "Mining, Quarrying, and Oil and Gas Extraction",
  "22": "Utilities",
  "23": "Construction",
  "31": "Manufacturing",
  "32": "Manufacturing",
  "33": "Manufacturing",
  "42": "Wholesale Trade",
  "44": "Retail Trade",
  "45": "Retail Trade",
  "48": "Transportation and Warehousing",
  "49": "Transportation and Warehousing",
  "51": "Information",
  "52": "Finance and Insurance",
  "53": "Real Estate and Rental and Leasing",
  "54": "Professional, Scientific, and Technical Services",
  "55": "Management of Companies and Enterprises",
  "56": "Administrative and Support and Waste Management and Remediation Services",
  "61": "Educational Services",
  "62": "Health Care and Social Assistance",
  "71": "Arts, Entertainment, and Recreation",
  "72": "Accommodation and Food Services",
  "81": "Other Services (except Public Administration)",
  "92": "Public Administration",
};

/** The sector title for any NAICS code of two or more digits, or null. */
export function naicsSectorTitle(code: string): string | null {
  return NAICS_SECTORS[code.slice(0, 2)] ?? null;
}

/** One Census sector, as every sector choice on the site offers it. */
export interface SectorGroup {
  /** The first two-digit code in the sector, which a URL carries (`sector=31`). */
  value: string;
  label: string;
  /** Every two-digit code it spans: Manufacturing is 31, 32 and 33. */
  codes: string[];
}

/** One option per Census sector, in code order: Census gives some sectors several codes and one title. */
export const SECTOR_GROUPS: readonly SectorGroup[] = (() => {
  const byTitle = new Map<string, SectorGroup>();
  for (const [code, label] of Object.entries(NAICS_SECTORS).sort(([a], [b]) => a.localeCompare(b))) {
    const g = byTitle.get(label);
    if (g) g.codes.push(code);
    else byTitle.set(label, { value: code, label, codes: [code] });
  }
  return [...byTitle.values()];
})();

/** The sector a value names (`31`), or null for one Census doesn't have. */
export function sectorGroup(value: string | null | undefined): SectorGroup | null {
  return SECTOR_GROUPS.find((g) => g.value === value) ?? null;
}

/** `31-33` for a sector spanning several codes, `54` for one: how the case search writes a sector. */
export function sectorRange(g: SectorGroup): string {
  return g.codes.length > 1 ? `${g.codes[0]}-${g.codes[g.codes.length - 1]}` : g.value;
}
