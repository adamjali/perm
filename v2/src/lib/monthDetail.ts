/**
 * One filing month's recent decisions, as the nightly sweep records them
 * (`write_month_detail` in scripts/ingest_case_status_direct.py): decisions
 * per day, where DOL is inside the month, and how far each employer initial
 * has got. Days are when our sweep first saw a decision, not DOL's own date.
 *
 * Plain module: the parser and the summaries are pure, so the unit project
 * holds them; the server read lives in turso/monthDetail.ts.
 */

export interface DayDecisions {
  date: string;
  certified: number;
  denied: number;
  withdrawn: number;
}

export interface MonthDetail {
  /** Newest day the series stands behind, `YYYY-MM-DD`. */
  asOf: string;
  /** How many recent days the front day is read from. */
  frontDays: number;
  days: DayDecisions[];
  /** Median filing day of the month's certifications and denials in those days, or null with too few. */
  frontDay: number | null;
  frontFrom: number;
  /** Initial -> [cases, decided]; "#" holds names that don't start with a letter. */
  letters: Record<string, [number, number]>;
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const int = (x: unknown) => (Number.isFinite(Number(x)) ? Math.max(0, Math.trunc(Number(x))) : 0);

/** The month's entry from the stored document, or null when it's absent or malformed. */
export function parseMonthDetail(json: string, month: string): MonthDetail | null {
  let doc: Record<string, unknown>;
  try {
    doc = JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
  const asOf = typeof doc.asOf === "string" && ISO.test(doc.asOf) ? doc.asOf : null;
  const months = doc.months as Record<string, Record<string, unknown>> | undefined;
  const m = months?.[month];
  if (!asOf || !m) return null;
  const days = Array.isArray(m.days)
    ? (m.days as Record<string, unknown>[])
        .filter((d) => typeof d.date === "string" && ISO.test(d.date))
        .map((d) => ({ date: d.date as string, certified: int(d.certified), denied: int(d.denied), withdrawn: int(d.withdrawn) }))
    : [];
  const letters: Record<string, [number, number]> = {};
  for (const [k, v] of Object.entries((m.letters as Record<string, unknown>) ?? {})) {
    if (/^([A-Z]|#)$/.test(k) && Array.isArray(v)) letters[k] = [int(v[0]), int(v[1])];
  }
  const frontDay = Number.isInteger(m.frontDay) && (m.frontDay as number) >= 1 && (m.frontDay as number) <= 31 ? (m.frontDay as number) : null;
  return { asOf, frontDays: int(doc.frontDays) || 5, days, frontDay, frontFrom: int(m.frontFrom), letters };
}

const decided = (d: DayDecisions) => d.certified + d.denied + d.withdrawn;

/**
 * The last seven days against the seven before, counting only days the
 * series holds. Null until both weeks have at least one day.
 */
export function weekOnWeek(days: readonly DayDecisions[], asOf: string): { thisWeek: number; weekBefore: number } | null {
  const end = Date.parse(`${asOf}T00:00:00Z`);
  const ago = (d: string) => Math.round((end - Date.parse(`${d}T00:00:00Z`)) / 86_400_000);
  const a = days.filter((d) => ago(d.date) >= 0 && ago(d.date) < 7);
  const b = days.filter((d) => ago(d.date) >= 7 && ago(d.date) < 14);
  if (!a.length || !b.length) return null;
  return { thisWeek: a.reduce((s, d) => s + decided(d), 0), weekBefore: b.reduce((s, d) => s + decided(d), 0) };
}

/** DOL's own decisions (certified and denied) in the series: the page shows the chart only when there are enough. */
export function dolDecisions(days: readonly DayDecisions[]): number {
  return days.reduce((s, d) => s + d.certified + d.denied, 0);
}
