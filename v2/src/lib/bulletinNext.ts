/**
 * The next visa bulletin, from the ones already held.
 *
 * Pure arithmetic over the archived series. Nothing here forecasts: a
 * "same-month move" is what that calendar month's bulletin did in each earlier
 * year, measured from the month before it, and a "months to reach" is the gap
 * divided by a pace that was itself measured over a closed window. Both are
 * printed with their basis so a reader can see how thin it is. Transitions
 * that are not date-to-date (opening from unavailable, going current, shutting)
 * are named, never turned into a number.
 */
import { parseCutoff, type BulletinMonth, type ChartKind, type CountryKey, type Cutoff } from "@/lib/perm";

const DAY_MS = 86_400_000;

export function nextBulletinMonth(lastMonth: string): string {
  const [y, m] = lastMonth.split("-").map(Number) as [number, number];
  const next = m === 12 ? [y + 1, 1] : [y, m + 1];
  return `${next[0]}-${String(next[1]).padStart(2, "0")}`;
}

export function monthBefore(ym: string): string {
  const [y, m] = ym.split("-").map(Number) as [number, number];
  const prev = m === 1 ? [y - 1, 12] : [y, m - 1];
  return `${prev[0]}-${String(prev[1]).padStart(2, "0")}`;
}

export type MoveKind =
  | "advanced"
  | "held"
  | "retrogressed"
  | "opened"
  | "shut"
  | "current"
  | "went-current"
  | "retrogressed-from-current"
  | "unavailable"
  | "unknown";

export interface SameMonthMove {
  bulletinMonth: string;
  from: Cutoff | null;
  to: Cutoff | null;
  /** Signed days, date-to-date only. */
  movedDays: number | null;
  kind: MoveKind;
}

function cutoffOf(b: BulletinMonth | undefined, chart: ChartKind, category: string, country: CountryKey): Cutoff | null {
  if (!b) return null;
  return parseCutoff(b[chart]?.[category]?.[country]);
}

function classify(from: Cutoff | null, to: Cutoff | null): { kind: MoveKind; movedDays: number | null } {
  if (!from || !to) return { kind: "unknown", movedDays: null };
  if (from.kind === "date" && to.kind === "date") {
    const days = Math.round((Date.parse(to.iso) - Date.parse(from.iso)) / DAY_MS);
    return { kind: days > 0 ? "advanced" : days < 0 ? "retrogressed" : "held", movedDays: days };
  }
  if (from.kind === "current" && to.kind === "current") return { kind: "current", movedDays: null };
  if (from.kind === "unavailable" && to.kind === "unavailable") return { kind: "unavailable", movedDays: null };
  if (from.kind === "unavailable") return { kind: "opened", movedDays: null };
  if (to.kind === "unavailable") return { kind: "shut", movedDays: null };
  if (to.kind === "current") return { kind: "went-current", movedDays: null };
  return { kind: "retrogressed-from-current", movedDays: null };
}

/**
 * Every bulletin for `targetMonth` (1..12) in the series, paired with the
 * bulletin for the month before it. A year whose prior month is missing is
 * skipped: pairing across a gap would measure two moves as one.
 */
export function sameMonthMoves(
  bulletins: readonly BulletinMonth[],
  chart: ChartKind,
  category: string,
  country: CountryKey,
  targetMonth: number,
): SameMonthMove[] {
  const byMonth = new Map(bulletins.map((b) => [b.bulletinMonth, b] as const));
  const out: SameMonthMove[] = [];
  for (const b of [...bulletins].sort((a, z) => a.bulletinMonth.localeCompare(z.bulletinMonth))) {
    if (Number(b.bulletinMonth.slice(5, 7)) !== targetMonth) continue;
    const prev = byMonth.get(monthBefore(b.bulletinMonth));
    if (!prev) continue;
    const from = cutoffOf(prev, chart, category, country);
    const to = cutoffOf(b, chart, category, country);
    out.push({ bulletinMonth: b.bulletinMonth, from, to, ...classify(from, to) });
  }
  return out;
}

export interface MoveSummary {
  count: number;
  advanced: number;
  held: number;
  retrogressed: number;
  /** Median of the date-to-date moves only; null when there were none. */
  medianDays: number | null;
  minDays: number | null;
  maxDays: number | null;
}

export function summariseMoves(moves: readonly SameMonthMove[]): MoveSummary {
  const days = moves.map((m) => m.movedDays).filter((d): d is number => d !== null).sort((a, b) => a - b);
  const median = days.length === 0 ? null : days.length % 2 ? days[(days.length - 1) / 2]! : Math.round((days[days.length / 2 - 1]! + days[days.length / 2]!) / 2);
  return {
    count: moves.length,
    advanced: moves.filter((m) => m.kind === "advanced").length,
    held: moves.filter((m) => m.kind === "held").length,
    retrogressed: moves.filter((m) => m.kind === "retrogressed").length,
    medianDays: median,
    minDays: days.length ? days[0]! : null,
    maxDays: days.length ? days[days.length - 1]! : null,
  };
}

/**
 * A floor on the publication day: the day of the PRIOR month on which the
 * Internet Archive first captured each bulletin. A capture taken after the
 * bulletin's own month began says nothing about when it was published and is
 * dropped. This is the only publication evidence the archive carries.
 */
export function archiveFloorDays(
  series: readonly { bulletinMonth: string; archivedAt: string | null }[],
): { bulletinMonth: string; day: number }[] {
  const out: { bulletinMonth: string; day: number }[] = [];
  for (const s of series) {
    if (!s.archivedAt) continue;
    const captured = s.archivedAt.slice(0, 10);
    if (captured.slice(0, 7) !== monthBefore(s.bulletinMonth)) continue;
    out.push({ bulletinMonth: s.bulletinMonth, day: Number(captured.slice(8, 10)) });
  }
  return out.sort((a, b) => a.bulletinMonth.localeCompare(b.bulletinMonth));
}

export interface PaceBasis {
  latest: Cutoff;
  movedDays: number | null;
  spanMonths: number | null;
  retrogressions: readonly string[];
}

/**
 * Months until a cutoff moving at the measured pace reaches `priorityDate`.
 * Withheld (null) when the category is current or shut, or when it did not
 * advance over the window: a pace of zero is not a wait of infinity, it is a
 * queue that is not moving, and the page says that in words instead.
 */
export function monthsToReach(
  cell: PaceBasis,
  priorityDate: string,
): { months: number; gapDays: number; basis: { movedDays: number; spanMonths: number; retrogressions: number } } | null {
  if (cell.latest.kind !== "date") return null;
  if (cell.movedDays === null || cell.spanMonths === null || cell.movedDays <= 0 || cell.spanMonths <= 0) return null;
  const gapDays = Math.round((Date.parse(priorityDate) - Date.parse(cell.latest.iso)) / DAY_MS);
  const perMonth = cell.movedDays / cell.spanMonths;
  const months = gapDays <= 0 ? 0 : Math.round((gapDays / perMonth) * 10) / 10;
  return { months, gapDays: Math.max(gapDays, 0), basis: { movedDays: cell.movedDays, spanMonths: cell.spanMonths, retrogressions: cell.retrogressions.length } };
}
