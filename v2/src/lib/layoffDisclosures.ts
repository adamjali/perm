/**
 * What employers told DOL about layoffs on their PERM applications:
 * perm_docs['layoff_disclosures'], written by scripts/build_layoff_disclosures.py.
 *
 * Form 9089 asks whether the employer had a layoff in the job's occupation, or a
 * related one, in the area within the six months before filing (Section G,
 * Item 12). DOL's files print each answer as Y or N once a case is decided. A
 * yes doesn't bar a filing: the employer must have notified and considered the
 * laid-off workers (20 CFR 656.17(k)). Every figure here is DOL's own answer; a
 * blank one is counted as unanswered, never as no.
 */

export interface LayoffOutcomes {
  certified: number;
  denied: number;
  withdrawn: number;
}

export interface LayoffYear {
  fy: number;
  /** Decided cases in DOL's files for the fiscal year. */
  cases: number;
  /** Those carrying a Y or N. */
  answered: number;
  yes: number;
  /** The first and last decision days the year's cases hold. */
  from: string | null;
  through: string | null;
  yesOutcomes: LayoffOutcomes;
  noOutcomes: LayoffOutcomes;
}

export interface LayoffEmployer {
  /** The employer's page; null when no page carries its name. */
  slug: string | null;
  name: string;
  yes: number;
  answered: number;
  /** Of the yeses, certified. */
  certified: number;
}

export interface LayoffJob {
  /** The seven-character SOC group, "15-1252". */
  code: string;
  title: string;
  yes: number;
  answered: number;
  /** The busiest occupation page under the code, when there is one. */
  slug?: string | null;
}

export interface LayoffDoc {
  years: LayoffYear[];
  newestFy: number | null;
  newestThrough: string | null;
  employersAnswering: number;
  employersYes: number;
  employers: LayoffEmployer[];
  jobs: LayoffJob[];
  topByYear: Record<string, Omit<LayoffEmployer, "certified">[]>;
  builtOn: string;
}

/** The doc, or null when it's missing a part the page reads. */
export function parseLayoffDoc(raw: unknown): LayoffDoc | null {
  if (!raw || typeof raw !== "object") return null;
  const d = raw as Partial<LayoffDoc>;
  if (!Array.isArray(d.years) || !Array.isArray(d.employers) || !Array.isArray(d.jobs) || typeof d.newestFy !== "number") {
    return null;
  }
  if (!d.years.some((y) => y.fy === d.newestFy)) return null;
  return { ...d, topByYear: d.topByYear ?? {} } as LayoffDoc;
}

/** The newest decision day the page's figures cover. */
export function layoffAsOf(doc: LayoffDoc | null): string | null {
  return doc?.newestThrough ?? null;
}

export function newestYear(doc: LayoffDoc): LayoffYear {
  return doc.years.find((y) => y.fy === doc.newestFy)!;
}

/**
 * A fiscal year whose decisions reach its last week: DOL's quarterly files
 * end with a quarter, so a year still being published stops at June 30 or
 * March 31, and its count is a part of the year.
 */
export function yearComplete(y: LayoffYear): boolean {
  return !!y.through && y.through >= `${y.fy}-09-24`;
}

export function outcomeTotal(o: LayoffOutcomes): number {
  return o.certified + o.denied + o.withdrawn;
}

/**
 * The 100 squares of the share grid: how many of every 100 yeses the busiest
 * employer gave, by the largest remainder, so the two groups always add to 100
 * and a share under half a square still shows as one when it isn't zero.
 */
export function shareSquares(top: number, total: number): { top: number; rest: number } {
  if (total <= 0 || top <= 0) return { top: 0, rest: total > 0 ? 100 : 0 };
  if (top >= total) return { top: 100, rest: 0 };
  const exact = (top / total) * 100;
  const squares = Math.min(99, Math.max(1, Math.round(exact)));
  return { top: squares, rest: 100 - squares };
}

/** How much of an employer's answered cases said yes, as a word for the table's filter. */
export function yesBand(e: Pick<LayoffEmployer, "yes" | "answered">): "Every application" | "Most" | "Some" {
  if (e.yes >= e.answered) return "Every application";
  return e.yes * 2 > e.answered ? "Most" : "Some";
}

/** One employer's own answers on its newest decided fiscal year, for its page. */
export interface EmployerLayoffAnswer {
  fy: number;
  yes: number;
  answered: number;
  from: string | null;
  through: string | null;
}

/**
 * The newest fiscal year in which the employer answered at all, from its rows
 * by year and answer. Null when it never answered or never said yes there.
 */
export function newestAnswer(
  rows: readonly { fy: number; layoff: string | null; n: number; from: string | null; through: string | null }[],
): EmployerLayoffAnswer | null {
  const years = new Map<number, EmployerLayoffAnswer>();
  for (const r of rows) {
    if (r.layoff !== "Y" && r.layoff !== "N") continue;
    const y = years.get(r.fy) ?? { fy: r.fy, yes: 0, answered: 0, from: null, through: null };
    y.answered += r.n;
    if (r.layoff === "Y") y.yes += r.n;
    if (r.from && (!y.from || r.from < y.from)) y.from = r.from;
    if (r.through && (!y.through || r.through > y.through)) y.through = r.through;
    years.set(r.fy, y);
  }
  const newest = [...years.values()].sort((a, b) => b.fy - a.fy)[0];
  return newest && newest.yes > 0 ? newest : null;
}
