/**
 * "Likely cap-exempt", inferred from the industry an employer declares, and
 * labelled as an inference everywhere it shows.
 *
 * 8 U.S.C. 1184(g)(5)(A) takes H-1B workers employed at "an institution of
 * higher education (as defined in section 1001(a) of title 20), or a related
 * or affiliated nonprofit entity" outside the annual cap, so their employers
 * don't enter the lottery. NAICS 611310 is the Census Bureau's "Colleges,
 * Universities, and Professional Schools". An employer whose filings mostly
 * carry that code is LIKELY such an institution; whether it qualifies, and
 * whether an affiliate or a research organization under (g)(5)(B) does, is
 * USCIS's call, and nothing here says otherwise.
 */

export const HIGHER_ED_NAICS = "611310";
/** The share of an employer's coded filings that must carry the code. */
export const CAP_EXEMPT_SHARE = 0.5;

export interface IndustryRow {
  key: string | null;
  label: string;
  n: number;
}

/** The inference, or null when the filings don't mostly name a college or university. */
export function likelyCapExempt(rows: readonly IndustryRow[] | null | undefined): { n: number; share: number; label: string } | null {
  if (!rows || rows.length === 0) return null;
  const total = rows.reduce((s, r) => s + r.n, 0);
  const higherEd = rows.filter((r) => (r.key ?? "").startsWith(HIGHER_ED_NAICS));
  const n = higherEd.reduce((s, r) => s + r.n, 0);
  if (total <= 0 || n / total < CAP_EXEMPT_SHARE) return null;
  return { n, share: n / total, label: higherEd[0]!.label };
}
