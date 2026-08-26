/**
 * Queue position inside USCIS's employment-based I-485 pending inventory.
 *
 * The arithmetic behind /tools/i485-queue-position. It runs in the browser
 * over the whole published cell table rather than as a query per selection.
 * That is how every other calculator in this suite works: the server fetches
 * the dataset, the client computes. The table is 38 KB raw and 6 KB over the
 * wire, so four selects each driving a database round-trip would buy a
 * pending state on a figure that is otherwise instant.
 *
 * IT IS A SECOND IMPLEMENTATION of the rule `getI485Position` states in SQL,
 * which is a real risk and is guarded rather than argued away:
 * `__tests__/position.test.ts` pins every branch against values read out of
 * that query against the live table. If the two ever disagree, those fail.
 *
 * WHY A RANGE. USCIS replaces any cell holding 1 to 10 applications with the
 * letter D. An exact total is therefore not knowable from the release, and
 * `low` and `high` are the arithmetic bounds: every suppressed cell at its
 * floor of 1, and every one at its ceiling of 10. Both are true statements
 * about the published data. Resolving each D to 5 and printing one number,
 * as the rival does, invents a precision the source withheld.
 */

/**
 * One published cell: `[year, month, count, suppressed]`.
 *
 * `year` is 0 for USCIS's "Prior Years" column, which sorts ahead of every
 * real year for free. `count` is the published figure and `suppressed` is
 * how many cells in that slot USCIS replaced with a D, so exactly one of
 * the two is non-zero in the source rows, though nothing here depends on
 * that.
 */
export type I485Cell = [year: number, month: number, count: number, suppressed: number];

/** Cells keyed by `${country}|${category}`. */
export type I485CellTable = Record<string, I485Cell[]>;

export interface I485Position {
  /** Applications ahead with an earlier priority date, counted cells only. */
  counted: number;
  /** How many cells USCIS suppressed inside that set. Each holds 1 to 10. */
  suppressedCells: number;
  /** counted + suppressedCells: every suppressed cell at its floor of 1. */
  low: number;
  /** counted + suppressedCells * 10: every suppressed cell at its ceiling. */
  high: number;
  /** True when USCIS suppressed nothing here, so low and high agree. */
  exact: boolean;
  /** Published priority-date year span. 0 means the "Prior Years" column. */
  coverage: { earliest: number; latest: number };
  /**
   * True when the asked-for YEAR is later than anything USCIS publishes.
   *
   * This is the read layer's own `outsideCoverage`, kept verbatim so the
   * fixtures can pin the two implementations against each other. It is not
   * what the page asks, because it is a year-level test over a table that is
   * published by month: 33 of the 47 pairs stop before December, so India
   * EB2, whose last published cell is 2015-01, reports false for every month
   * of 2015 while returning the entire category total. Use `beyondPublished`.
   */
  outsideCoverage: boolean;
  /**
   * True when the asked-for MONTH is later than every published cell, so
   * every application in the release is ahead of it and there is no position
   * to report. The honest version of the question `outsideCoverage` asks.
   */
  beyondPublished: boolean;
  /** The latest priority date USCIS publishes here, as `[year, month]`. */
  latestPublished: [number, number];
  /** The same three figures for the whole country and category. */
  categoryCounted: number;
  categorySuppressedCells: number;
  categoryLow: number;
  categoryHigh: number;
}

/** The key `I485CellTable` is indexed by. */
export function pairKey(country: string, category: string): string {
  return `${country}|${category}`;
}

/**
 * How many applications sit ahead of a priority date.
 *
 * "Ahead" is STRICTLY earlier: the same month is not ahead of itself. And it
 * counts both pending statuses USCIS reports. An application whose visa
 * number is already available but which USCIS has not adjudicated is still in
 * front of you in the only queue the asker is in.
 *
 * Returns null when the country and category pair is not in the table, which
 * is the deploy-skew window rather than a bad selection: the page builds its
 * own options from the same release.
 */
export function computeI485Position(
  cells: I485CellTable,
  country: string,
  category: string,
  pdYear: number,
  pdMonth: number,
): I485Position | null {
  const rows = cells[pairKey(country, category)];
  if (!rows || rows.length === 0) return null;

  let counted = 0;
  let suppressedCells = 0;
  let categoryCounted = 0;
  let categorySuppressedCells = 0;
  let earliest = Number.POSITIVE_INFINITY;
  let latest = Number.NEGATIVE_INFINITY;
  let latestMonth = 0;

  for (const [year, month, count, suppressed] of rows) {
    categoryCounted += count;
    categorySuppressedCells += suppressed;
    if (year < earliest) earliest = year;
    if (year > latest || (year === latest && month > latestMonth)) {
      latest = year;
      latestMonth = month;
    }
    // USCIS's "Prior Years" column is encoded as year 0, so it falls out of
    // `year < pdYear` for free and needs no clause of its own. The SQL states
    // it separately only because it is comparing a TEXT column. An explicit
    // `year === 0 ||` here was unreachable for every year the form can offer,
    // which a probe caught: breaking it changed no test.
    const ahead = year < pdYear || (year === pdYear && month < pdMonth);
    if (!ahead) continue;
    counted += count;
    suppressedCells += suppressed;
  }

  return {
    counted,
    suppressedCells,
    low: counted + suppressedCells,
    high: counted + suppressedCells * 10,
    exact: suppressedCells === 0,
    coverage: { earliest, latest },
    outsideCoverage: pdYear > latest,
    beyondPublished: pdYear > latest || (pdYear === latest && pdMonth > latestMonth),
    latestPublished: [latest, latestMonth],
    categoryCounted,
    categorySuppressedCells,
    categoryLow: categoryCounted + categorySuppressedCells,
    categoryHigh: categoryCounted + categorySuppressedCells * 10,
  };
}

/**
 * How the certainty bar is split, as percentages of its own width.
 *
 * The bar is scaled to `high` and carries NO empty track, so it cannot read
 * as a progress meter: its whole width is the range, and the split says how
 * much of that range is settled. `solid` is the floor that certainly exists,
 * `hatched` is the width USCIS refuses to resolve.
 *
 * Solid can never fall below 10% (as counted approaches 0 the ratio tends to
 * suppressed / suppressed * 10) and hatched reaches 0 only when nothing was
 * suppressed, so neither segment ever renders as an invisible sliver by
 * accident. A hatched segment that is genuinely negligible, 0.5% on the
 * Rest-of-the-World EB2 span, SHOULD disappear: that is the finding.
 */
export function certaintySplit(p: I485Position): { solid: number; hatched: number } {
  if (p.high <= 0) return { solid: 0, hatched: 0 };
  const solid = (p.low / p.high) * 100;
  return { solid, hatched: 100 - solid };
}
