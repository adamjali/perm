import "server-only";

import { cache } from "react";

import { rows } from "@/lib/db/client";

/**
 * OSHA inspections joined to a PERM sponsor's page (scripts/ingest_osha.py writes `osha_inspections`).
 *
 * Every figure is OSHA's, inspection by inspection, counted its way: a violation deleted by settlement or a court
 * doesn't count, grouped violations count once, and the penalty is the amount currently assessed (it can be less
 * than the initial one after a settlement). An open inspection can still change.
 */

export interface OshaInspection {
  activityNr: string;
  name: string;
  city: string | null;
  state: string | null;
  /** OSHA's inspection type code (A to N). */
  type: string | null;
  openDate: string;
  closeDate: string | null;
  violations: number;
  serious: number;
  willful: number;
  repeat: number;
  penalty: number;
}

export interface OshaSummary {
  inspections: number;
  /** Inspections that cited at least one violation. */
  withViolations: number;
  violations: number;
  serious: number;
  willful: number;
  repeat: number;
  /** Penalties as currently assessed, and as first assessed. */
  penalty: number;
  initialPenalty: number;
  /** Inspections with no close date yet. */
  open: number;
  /** Inspections after a death or catastrophe (type M) or an accident (type A). */
  afterHarm: number;
  firstOpen: string | null;
  lastOpen: string | null;
  /** The newest inspections, at most `limit`. */
  newest: OshaInspection[];
}

type Row = Record<string, string | number | null>;

const n = (v: unknown) => (v === null || v === undefined || v === "" ? 0 : Number(v));
const s = (v: unknown) => (v === null || v === undefined || v === "" ? null : String(v));

function hydrate(r: Row): OshaInspection {
  return {
    activityNr: String(r.activity_nr),
    name: String(r.estab_name ?? ""),
    city: s(r.city),
    state: s(r.state),
    type: s(r.insp_type),
    openDate: String(r.open_date),
    closeDate: s(r.close_date),
    violations: n(r.violations),
    serious: n(r.serious),
    willful: n(r.willful),
    repeat: n(r.repeat),
    penalty: n(r.current_penalty),
  };
}

/**
 * One sponsor page's inspections: totals over every inspection, and the newest few. Null before the table's first
 * load (no such table) and for a sponsor with none; any other failed read throws, so the page keeps its last good
 * render rather than storing a month of "no inspections".
 */
export const oshaForSlug = cache(async (slug: string, limit = 10): Promise<OshaSummary | null> => {
  try {
    const [totals, newest] = await Promise.all([
      rows<Row>(
        "SELECT COUNT(*) AS inspections, SUM(CASE WHEN violations > 0 THEN 1 ELSE 0 END) AS with_v, " +
          "SUM(violations) AS v, SUM(serious) AS serious, SUM(willful) AS willful, SUM(repeat) AS repeat, " +
          "SUM(current_penalty) AS pen, SUM(initial_penalty) AS init_pen, " +
          "SUM(CASE WHEN close_date IS NULL THEN 1 ELSE 0 END) AS open_n, " +
          "SUM(CASE WHEN insp_type IN ('A', 'M') THEN 1 ELSE 0 END) AS harm, " +
          "MIN(open_date) AS first_open, MAX(open_date) AS last_open FROM osha_inspections WHERE employer_slug = ?",
        [slug],
      ),
      rows<Row>(
        "SELECT activity_nr, estab_name, city, state, insp_type, open_date, close_date, violations, serious, willful, " +
          "repeat, current_penalty FROM osha_inspections WHERE employer_slug = ? ORDER BY open_date DESC, activity_nr DESC LIMIT ?",
        [slug, limit],
      ),
    ]);
    const t = totals[0];
    if (!t || n(t.inspections) === 0) return null;
    return {
      inspections: n(t.inspections),
      withViolations: n(t.with_v),
      violations: n(t.v),
      serious: n(t.serious),
      willful: n(t.willful),
      repeat: n(t.repeat),
      penalty: n(t.pen),
      initialPenalty: n(t.init_pen),
      open: n(t.open_n),
      afterHarm: n(t.harm),
      firstOpen: s(t.first_open),
      lastOpen: s(t.last_open),
      newest: newest.map(hydrate),
    };
  } catch (e) {
    if (/no such table/i.test(String(e))) return null;
    throw e;
  }
});
