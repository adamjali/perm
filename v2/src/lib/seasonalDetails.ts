/**
 * The words for a seasonal case's details: the wage with its unit, the
 * published status, the worksite, and the H-2A decision date the rule sets.
 * Plain module, so the card and its tests share one copy.
 */

const UNIT_PHRASE: Record<string, string> = {
  HOUR: "an hour",
  HOURLY: "an hour",
  WEEK: "a week",
  "BI-WEEKLY": "every two weeks",
  MONTH: "a month",
  YEAR: "a year",
  ANNUAL: "a year",
  "PIECE RATE": "a piece",
};

/** "$15.51 an hour"; null without a usable wage. Cents shown only when there are any. */
export function wagePhrase(wage: number | null, unit: string | null): string | null {
  if (wage === null || !Number.isFinite(wage) || wage <= 0) return null;
  const whole = Math.abs(wage - Math.round(wage)) < 0.005;
  const amount = `$${wage.toLocaleString("en-US", {
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
  const per = unit ? UNIT_PHRASE[unit.trim().toUpperCase()] : undefined;
  return per ? `${amount} ${per}` : amount;
}

/**
 * DOL's published status in plain words. The files print
 * "Determination Issued - Certification (Expired)"; the prefix says only that
 * DOL decided, which the decision date already says.
 */
export function publishedStatusLabel(status: string): string {
  const s = status.trim().replace(/^DETERMINATION ISSUED\s*-\s*/i, "");
  if (!s) return status;
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

/**
 * The live statuses DOL's case service leaves on some applications it has
 * already decided. Must stay identical to
 * PROGRAMS["seasonal"]["settled_by_file"]["statuses"] in
 * scripts/ingest_pwd_status_direct.py, whose sweep marks such a case finished.
 * An appeal is not here: a decided case can really be appealed back into review.
 */
export const SETTLED_BY_FILE_STATUSES: ReadonlySet<string> = new Set(["IN PROCESS"]);

/**
 * DOL's published file records a decision on a case its live service still
 * calls in process (Oct 7 2026: 1,725 of the 1,726 H-2B applications filed
 * Oct 2024 to Mar 2026 that still read IN PROCESS). The page then reports the
 * decision and drops everything that assumes a wait.
 */
export function decidedInFileOnly(liveStatus: string, publishedDecisionDate: string | null): boolean {
  return SETTLED_BY_FILE_STATUSES.has(liveStatus.trim().toUpperCase()) && Boolean(publishedDecisionDate);
}

/** Whether a published status is DOL granting the application, partly or wholly. */
export function publishedGranted(status: string): boolean {
  return /CERTIFICATION/i.test(status) && !/WITHDRAWN/i.test(status);
}

/**
 * The word that already names a county-level division. DOL's files print the
 * whole name ("KNOX COUNTY", "ACADIA PARISH", "CAPITOL PLANNING REGION"), so
 * "County" is added only to a bare name.
 */
const DIVISION = /\b(county|parish|borough|census area|municipality|region|city|district|island)s?$/i;

/** "Austin, Travis County, TX", leaving out what the record lacks. */
export function worksitePhrase(city: string | null, county: string | null, state: string | null): string | null {
  const titled = (s: string) => s.trim().toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase());
  const parts = [
    city ? titled(city) : null,
    county ? (DIVISION.test(county.trim()) ? titled(county) : `${titled(county)} County`) : null,
    state ? state.toUpperCase() : null,
  ].filter((p): p is string => !!p);
  return parts.length ? parts.join(", ") : null;
}

/**
 * The day DOL must decide an H-2A application by: "not later than 30
 * calendar days before the first date of need" (20 CFR 655.160). An
 * application modified under 655.142 is not held to it, so the card says
 * "by rule" and names the exception rather than promising the date.
 */
export const H2A_DECISION_LEAD_DAYS = 30;

export function h2aDecideBy(firstDateOfNeed: string | null): string | null {
  if (!firstDateOfNeed || !/^\d{4}-\d{2}-\d{2}$/.test(firstDateOfNeed)) return null;
  const d = new Date(`${firstDateOfNeed}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  d.setUTCDate(d.getUTCDate() - H2A_DECISION_LEAD_DAYS);
  return d.toISOString().slice(0, 10);
}
