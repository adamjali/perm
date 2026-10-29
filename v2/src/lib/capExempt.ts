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

/**
 * The employers whose wage requests say ACWIA covers them: perm_docs['cap_exempt'],
 * written by scripts/build_cap_exempt.py. ACWIA's three kinds of employer
 * (20 CFR 656.40(e)) are the ones the H-1B cap leaves out
 * (8 CFR 214.2(h)(8)(iii)(F)); the answer is the employer's own, to DOL, so the
 * page says "likely".
 */
export type CapExemptKind = "higher-ed" | "affiliated" | "research";

export const CAP_EXEMPT_KINDS: readonly CapExemptKind[] = ["higher-ed", "affiliated", "research"];

/** Each kind in words, plural and singular. */
export const KIND_WORDS: Record<CapExemptKind, { many: string; one: string }> = {
  "higher-ed": { many: "Colleges and universities", one: "College or university" },
  affiliated: { many: "Nonprofits affiliated with one", one: "Affiliated nonprofit" },
  research: { many: "Research organizations", one: "Research organization" },
};

export interface CapExemptRow {
  slug: string;
  linked: boolean;
  name: string;
  kind: CapExemptKind | null;
  state: string | null;
  /** Wage requests saying ACWIA covers it. */
  requests: number;
  lcas: number;
  positions: number;
  uscisNew: number;
  uscisAppr: number;
}

export interface CapExemptDoc {
  employers: number;
  withLcas: number;
  kinds: Record<CapExemptKind, { employers: number; lcas: number }>;
  lcas: number;
  allLcas: number;
  months: { month: string; exempt: number; others: number }[];
  states: { state: string; employers: number; lcas: number }[];
  statesTotal: number;
  top: CapExemptRow[];
  asOf: { pwFrom: string | null; pwThrough: string | null; lcaFy: number | null; lcaThrough: string | null; uscisFy: number | null };
}

/** Each month's share of its group's year: the listed employers, and everyone else. */
export function monthShares(doc: Pick<CapExemptDoc, "months">): { month: string; exempt: number; others: number }[] {
  const ex = doc.months.reduce((s, m) => s + m.exempt, 0);
  const ot = doc.months.reduce((s, m) => s + m.others, 0);
  return doc.months.map((m) => ({ month: m.month, exempt: ex > 0 ? m.exempt / ex : 0, others: ot > 0 ? m.others / ot : 0 }));
}

/** The newest day the doc's figures cover: the page's date. */
export function capExemptAsOf(doc: Pick<CapExemptDoc, "asOf"> | null | undefined): string | null {
  if (!doc) return null;
  const days = [doc.asOf.lcaThrough, doc.asOf.pwThrough].filter((d): d is string => Boolean(d));
  return days.length ? days.sort().at(-1)! : null;
}

/** The share of a group's year in its three busiest months running, and which months. */
export function busiestQuarter(shares: readonly number[]): { start: number; share: number } {
  let best = { start: 0, share: -1 };
  for (let i = 0; i + 2 < shares.length; i++) {
    const s = shares[i]! + shares[i + 1]! + shares[i + 2]!;
    if (s > best.share) best = { start: i, share: s };
  }
  return best;
}
