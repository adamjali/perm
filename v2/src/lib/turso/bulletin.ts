import "server-only";

/**
 * The whole visa bulletin board, not one cell of it.
 *
 * The priority-date page reads the archive one category, one country and one
 * chart at a time, which is the right shape for "where does MY date sit" and
 * the wrong shape for the question underneath it: which queues are actually
 * moving. There are three categories times five countries times two charts in
 * the archive, and until now nothing could see more than one of the thirty at
 * once.
 *
 * The measurement this makes possible is the pace ratio, and it is the one
 * number in the archive nobody else publishes: a cutoff that advances thirty
 * days per calendar month is holding station, and a queue is only shortening
 * above that. Measured across the archived run, EB-3 India advanced 610 days
 * while 35 months of calendar went past, so anyone waiting in it lost about
 * fifteen months of ground during a period when the line was moving forward
 * the whole time. EB-1 India advanced 2,113 days over the same window.
 *
 * It is arithmetic over a closed window, not a forecast. Nothing here says
 * when a date becomes current, and the ratio is withheld outright for a
 * category that is shut, because a pace computed up to the moment a queue
 * stopped reads as a promise it cannot keep.
 */

import { getVisaBulletins } from "./publicData";
import { parseCutoff, type BulletinMonth, type CountryKey, type ChartKind, type Cutoff } from "@/lib/perm";

/** Days in an average month, 365.25/12. The pace ratio is per calendar month. */
export const DAYS_PER_MONTH = 30.4375;

export const BOARD_COUNTRIES: readonly CountryKey[] = [
  "worldwide",
  "china",
  "india",
  "mexico",
  "philippines",
];

export interface BoardCell {
  category: string;
  country: CountryKey;
  /** The cell in the newest bulletin held here. */
  latest: Cutoff;
  /** The newest bulletin month that published this cell, `YYYY-MM`. */
  latestMonth: string;
  /** Days between the first and last real cutoff DATE in the window. */
  movedDays: number | null;
  /** Whole months between those two bulletins. */
  spanMonths: number | null;
  /**
   * Cutoff days gained per calendar month.
   *
   * 1.0 is holding station: the cutoff advances one month per month and the
   * wait ahead of a fixed priority date neither grows nor shrinks. Below 1.0
   * the queue is lengthening even though the number on the page goes up.
   *
   * Null when there are fewer than two dated bulletins, and null when the
   * category is currently unavailable: a pace measured up to the month a
   * queue shut is a fact about a queue that no longer exists.
   */
  pace: number | null;
  /** Bulletin months where the cutoff went backwards, or the category shut. */
  retrogressions: string[];
  /** Every state the cell took across the window, oldest first. */
  states: Array<{ month: string; cutoff: Cutoff }>;
}

export interface BulletinBoard {
  /** Oldest and newest bulletin months in the archive, `YYYY-MM`. */
  firstMonth: string;
  lastMonth: string;
  bulletinCount: number;
  /** Categories the archive actually publishes, in bulletin order. */
  categories: string[];
  finalAction: BoardCell[];
  datesForFiling: BoardCell[];
}

/**
 * The categories the archive holds, read from the data rather than declared.
 *
 * The visa bulletin publishes more employment-based rows than this ingest
 * captures (EB-4, EB-5 and the EB-3 other-workers line among them). Listing
 * them from memory in a selector offers a reader an answer the archive cannot
 * give, and the failure is silent: every panel simply stops rendering. Taking
 * the list from the bulletins themselves means the selector can only ever
 * offer what can be answered, and it picks up new rows the day an ingest
 * starts writing them.
 */
export function categoriesIn(bulletins: readonly BulletinMonth[]): string[] {
  const seen = new Set<string>();
  for (const b of bulletins) {
    for (const key of Object.keys(b.finalAction ?? {})) seen.add(key);
    for (const key of Object.keys(b.datesForFiling ?? {})) seen.add(key);
  }
  // Bulletin order, not alphabetical: EB-1 through EB-5 then the other-worker
  // lines, which is how the State Department prints them and how a reader
  // looking for their own row will scan.
  const ORDER = ["EB1", "EB2", "EB3", "EW3", "EB4", "EB5"];
  return [...seen].sort((a, z) => {
    const ia = ORDER.indexOf(a);
    const iz = ORDER.indexOf(z);
    if (ia === -1 && iz === -1) return a.localeCompare(z);
    if (ia === -1) return 1;
    if (iz === -1) return -1;
    return ia - iz;
  });
}

function monthsBetween(from: string, to: string): number {
  return (
    (Number(to.slice(0, 4)) - Number(from.slice(0, 4))) * 12 +
    (Number(to.slice(5, 7)) - Number(from.slice(5, 7)))
  );
}

function cellFor(
  bulletins: readonly BulletinMonth[],
  chart: ChartKind,
  category: string,
  country: CountryKey,
): BoardCell | null {
  const states: Array<{ month: string; cutoff: Cutoff }> = [];
  for (const b of bulletins) {
    const cutoff = parseCutoff(b[chart]?.[category]?.[country]);
    if (cutoff) states.push({ month: b.bulletinMonth, cutoff });
  }
  const newest = states[states.length - 1];
  if (!newest) return null;

  const dated = states.filter(
    (s): s is { month: string; cutoff: { kind: "date"; iso: string } } =>
      s.cutoff.kind === "date",
  );
  const first = dated[0];
  const last = dated[dated.length - 1];

  let movedDays: number | null = null;
  let spanMonths: number | null = null;
  if (first && last && first !== last) {
    movedDays = Math.round(
      (Date.parse(last.cutoff.iso) - Date.parse(first.cutoff.iso)) / 86_400_000,
    );
    spanMonths = monthsBetween(first.month, last.month);
  }

  const retrogressions: string[] = [];
  for (let i = 1; i < states.length; i += 1) {
    const prev = states[i - 1]!.cutoff;
    const curr = states[i]!.cutoff;
    if (curr.kind === "unavailable" && prev.kind !== "unavailable") {
      retrogressions.push(states[i]!.month);
    } else if (prev.kind === "date" && curr.kind === "date" && curr.iso < prev.iso) {
      retrogressions.push(states[i]!.month);
    }
  }

  // Withheld for a shut category on purpose. See the field note on `pace`.
  const pace =
    newest.cutoff.kind === "unavailable" ||
    movedDays === null ||
    spanMonths === null ||
    spanMonths <= 0
      ? null
      : movedDays / (spanMonths * DAYS_PER_MONTH);

  return {
    category,
    country,
    latest: newest.cutoff,
    latestMonth: newest.month,
    movedDays,
    spanMonths,
    pace,
    retrogressions,
    states,
  };
}

/**
 * Summarise every category and country in the archive, for both charts.
 *
 * Pure, so the arithmetic can be tested against fixtures without a database.
 */
export function summariseBulletins(bulletins: readonly BulletinMonth[]): BulletinBoard | null {
  const sorted = [...bulletins].sort((a, z) =>
    a.bulletinMonth.localeCompare(z.bulletinMonth),
  );
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  if (!first || !last) return null;

  const categories = categoriesIn(sorted);
  const build = (chart: ChartKind): BoardCell[] => {
    const out: BoardCell[] = [];
    for (const category of categories) {
      for (const country of BOARD_COUNTRIES) {
        const cell = cellFor(sorted, chart, category, country);
        if (cell) out.push(cell);
      }
    }
    return out;
  };

  return {
    firstMonth: first.bulletinMonth,
    lastMonth: last.bulletinMonth,
    bulletinCount: sorted.length,
    categories,
    finalAction: build("finalAction"),
    datesForFiling: build("datesForFiling"),
  };
}

/** The board, read from the archive. Null when the archive is empty. */
export async function getBulletinBoard(): Promise<BulletinBoard | null> {
  const raw = await getVisaBulletins();
  return summariseBulletins(
    raw.map((b) => ({
      bulletinMonth: b.bulletinMonth,
      finalAction: (b.finalAction ?? {}) as BulletinMonth["finalAction"],
      datesForFiling: (b.datesForFiling ?? {}) as BulletinMonth["datesForFiling"],
    })),
  );
}
