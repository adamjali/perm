/**
 * The record this site is built on, as dated counts.
 *
 * Pure: takes the JSON documents the ingests already write into `perm_docs`
 * (plus the bulletin count) and returns figures with the date each one is
 * true for. Nothing here counts a table; every number is read from a doc the
 * ingest reconciled before writing, so a homepage render costs a handful of
 * point reads. The Turso half is `src/lib/turso/recordCounts.ts`.
 *
 * A figure whose doc is missing or malformed is null and the strip leaves it
 * out, rather than printing a dash beside a date.
 */

export interface RecordDocs {
  /** perm_docs['cases_meta']: the published PERM files. */
  casesMeta: string | null;
  /** perm_docs['live_remainder']: the live PERM cases not in those files. */
  liveRemainder: string | null;
  /** perm_docs['sweep_coverage']: when the pending sweep last finished. */
  sweepCoverage: string | null;
  /** perm_docs['flag_disclosure_summary_pw'] and ['..._lca']. */
  pwSummary: string | null;
  lcaSummary: string | null;
  /** Bulletin archive: how many months, and the newest. */
  bulletinCount: number | null;
  bulletinLatest: string | null;
}

export interface RecordFigure {
  /** Route the figure links to. */
  href: string;
  value: number;
  label: string;
  /** The date the value is true for, YYYY-MM-DD or YYYY-MM. */
  asOf: string;
  /** What the date means: "through" for a file's last decision, "checked" for a sweep. */
  asOfKind: "through" | "checked" | "newest";
}

function parse(json: string | null): Record<string, unknown> | null {
  if (!json) return null;
  try {
    const d = JSON.parse(json) as unknown;
    return d && typeof d === "object" ? (d as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

// YYYY-MM or longer; the strip slices what it prints, so a full timestamp is fine.
const isDate = (v: unknown): v is string => typeof v === "string" && v.length >= 7 && /^\d{4}-\d{2}/.test(v);
const isCount = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && v > 0;

/** The figures in the order the strip prints them; each only when its doc supports it. */
export function deriveRecordCounts(docs: RecordDocs): RecordFigure[] {
  const out: RecordFigure[] = [];

  const meta = parse(docs.casesMeta);
  if (meta && isCount(meta.totalCases) && isDate(meta.lastDecisionDate)) {
    out.push({
      href: "/case-search",
      value: meta.totalCases,
      label: "PERM decisions in DOL's published files",
      asOf: meta.lastDecisionDate.slice(0, 10),
      asOfKind: "through",
    });
  }

  const live = parse(docs.liveRemainder);
  const sweep = parse(docs.sweepCoverage);
  const checked = sweep && isDate(sweep.finishedOn) ? sweep.finishedOn.slice(0, 10) : null;
  if (live && isCount(live.pending) && checked) {
    out.push({
      href: "/perm-case-status",
      value: live.pending,
      label: "PERM cases pending at DOL, in the live record",
      asOf: checked,
      asOfKind: "checked",
    });
  }

  const pw = parse(docs.pwSummary);
  if (pw && isCount(pw.rows) && isDate(pw.latestDecision)) {
    out.push({
      href: "/pwd-cases",
      value: pw.rows,
      label: "prevailing wage determinations, with the wage",
      asOf: pw.latestDecision.slice(0, 10),
      asOfKind: "through",
    });
  }

  const lca = parse(docs.lcaSummary);
  if (lca && isCount(lca.rows) && isDate(lca.latestDecision)) {
    out.push({
      href: "/lca-cases",
      value: lca.rows,
      label: "H-1B labor condition applications, with the wage",
      asOf: lca.latestDecision.slice(0, 10),
      asOfKind: "through",
    });
  }

  if (isCount(docs.bulletinCount) && isDate(docs.bulletinLatest)) {
    out.push({
      href: "/visa-bulletin",
      value: docs.bulletinCount,
      label: "monthly visa bulletins, every category and country",
      asOf: docs.bulletinLatest.slice(0, 7),
      asOfKind: "newest",
    });
  }

  return out;
}
