/**
 * The wage requests an employer filed for a pending PERM case's job, joined from DOL's two records.
 *
 * DOL's live record of a pending PERM case doesn't name its wage request; its published file does once the
 * case is decided (the decided timeline uses that). Until then the honest link is the employer's PERM wage
 * requests (P-100) for the same job title on which DOL issued a wage by the day the case was filed, filed
 * recently enough to still be in use: one of them is very likely this case's, and the page says so in those
 * words. A request still waiting, withdrawn, or decided after the case was filed can't be it: an ETA-9089 is
 * filed on a wage DOL has already issued (the first version listed requests decided weeks after the case).
 *
 * Plain module: the merge is tested here; the reads are lib/db/employerWageRequests.ts.
 */

/** Months before the PERM's filing a wage request can have been filed and still be in use. */
export const WAGE_REQUEST_LOOKBACK_MONTHS = 30;
/** At most this many are listed. */
export const WAGE_REQUESTS_SHOWN = 5;

/** DOL issued a wage on the request: a determination, or one a redetermination or the Center Director's review
 *  affirmed or changed. "PENDING REDETERMINATION" doesn't match: it starts with PENDING. */
export const WAGE_ISSUED_RE = /^(DETERMINATION ISSUED|REDETERMINATION|CENTER DIRECTOR REVIEW)/;

export function wageIssued(status: string | null | undefined): boolean {
  return WAGE_ISSUED_RE.test((status ?? "").trim().toUpperCase());
}

export interface EmployerWageRequest {
  caseNumber: string;
  /** DOL's status word: the live record's when it holds the request, else the published file's. */
  status: string;
  /** When DOL received it. */
  filed: string | null;
  /** When DOL decided it, from the published file. */
  decided: string | null;
  jobTitle: string | null;
  /** The determined wage and its unit, from the published file. */
  wage: number | null;
  wageUnit: string | null;
}

export interface LiveWageRow {
  caseNumber: string;
  status: string | null;
  filed: string | null;
  jobTitle: string | null;
  /** The DOL day our sweep saw it decided, for a request the published file doesn't hold yet. */
  decided?: string | null;
}

export interface FileWageRow {
  caseNumber: string;
  status: string | null;
  received: string | null;
  decided: string | null;
  jobTitle: string | null;
  wage: number | null;
  wageUnit: string | null;
}

/** The first day of the window, `YYYY-MM-DD`: the filing date less the lookback. */
export function lookbackStart(filingDate: string, months = WAGE_REQUEST_LOOKBACK_MONTHS): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(filingDate);
  if (!m) return null;
  const total = Number(m[1]) * 12 + (Number(m[2]) - 1) - months;
  const y = Math.floor(total / 12);
  const mo = (total % 12) + 1;
  return `${y}-${String(mo).padStart(2, "0")}-01`;
}

export interface EmployerWageRequests {
  /** The newest, at most WAGE_REQUESTS_SHOWN. */
  rows: EmployerWageRequest[];
  /** More than that were found: the list is the newest, not all of them. */
  more: boolean;
}

/**
 * One row per wage request, newest filed first, capped: the live record's status wins (it's today's), the
 * published file adds the decision day and the wage. Only requests that could be the case's are kept: a wage
 * issued, and decided on or before `permFiled` when the day is known.
 */
export function mergeWageRequests(
  live: readonly LiveWageRow[],
  file: readonly FileWageRow[],
  permFiled: string | null = null,
): EmployerWageRequests {
  const byCase = new Map<string, EmployerWageRequest>();
  for (const f of file) {
    byCase.set(f.caseNumber, {
      caseNumber: f.caseNumber,
      status: (f.status ?? "").trim() || "UNKNOWN",
      filed: f.received,
      decided: f.decided,
      jobTitle: f.jobTitle,
      wage: f.wage,
      wageUnit: f.wageUnit,
    });
  }
  for (const l of live) {
    const held = byCase.get(l.caseNumber);
    byCase.set(l.caseNumber, {
      caseNumber: l.caseNumber,
      status: (l.status ?? "").trim() || held?.status || "UNKNOWN",
      filed: l.filed ?? held?.filed ?? null,
      decided: held?.decided ?? l.decided ?? null,
      jobTitle: l.jobTitle ?? held?.jobTitle ?? null,
      wage: held?.wage ?? null,
      wageUnit: held?.wageUnit ?? null,
    });
  }
  const filedOn = permFiled ? permFiled.slice(0, 10) : null;
  const all = [...byCase.values()]
    .filter((r) => wageIssued(r.status) && !(filedOn && r.decided && r.decided.slice(0, 10) > filedOn))
    .sort(
    (a, b) => (b.filed ?? "").localeCompare(a.filed ?? "") || b.caseNumber.localeCompare(a.caseNumber),
  );
  return { rows: all.slice(0, WAGE_REQUESTS_SHOWN), more: all.length > WAGE_REQUESTS_SHOWN };
}

/** A PERM case an employer filed for a wage request's job, from DOL's live record or its published file. */
export interface EmployerPermCase {
  caseNumber: string;
  status: string;
  filed: string | null;
  decided: string | null;
}

export interface EmployerPermCases {
  rows: EmployerPermCase[];
  more: boolean;
}

/** Months after a wage request a PERM case using it can be filed (its validity, then the recruitment window). */
export const PERM_AFTER_WAGE_MONTHS = 30;

/** The last day of the window, `YYYY-MM-DD`: the wage request's filing date plus the months. */
export function lookaheadEnd(filed: string, months = PERM_AFTER_WAGE_MONTHS): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(filed);
  if (!m) return null;
  const total = Number(m[1]) * 12 + (Number(m[2]) - 1) + months + 1;
  const y = Math.floor(total / 12);
  const mo = (total % 12) + 1;
  return `${y}-${String(mo).padStart(2, "0")}-01`;
}

/**
 * The day a PERM case resting on this wage request could first be filed: the day DOL issued the wage, or the
 * request's own filing day when the decision day isn't held. Null while no wage is issued, since no PERM case
 * can rest on it yet.
 */
export function permWindowStart(req: { status: string | null; decided: string | null; filed: string | null }): string | null {
  if (!wageIssued(req.status)) return null;
  return (req.decided ?? req.filed)?.slice(0, 10) ?? null;
}

/** One row per PERM case, newest filed first, capped; the live record's status wins over the file's. */
export function mergePermCases(
  live: readonly { caseNumber: string; status: string | null; filed: string | null }[],
  file: readonly { caseNumber: string; status: string | null; filed: string | null; decided: string | null }[],
): EmployerPermCases {
  const byCase = new Map<string, EmployerPermCase>();
  for (const f of file) {
    byCase.set(f.caseNumber, { caseNumber: f.caseNumber, status: (f.status ?? "").trim() || "UNKNOWN", filed: f.filed, decided: f.decided });
  }
  for (const l of live) {
    const held = byCase.get(l.caseNumber);
    byCase.set(l.caseNumber, {
      caseNumber: l.caseNumber,
      status: (l.status ?? "").trim() || held?.status || "UNKNOWN",
      filed: l.filed ?? held?.filed ?? null,
      decided: held?.decided ?? null,
    });
  }
  const all = [...byCase.values()].sort(
    (a, b) => (b.filed ?? "").localeCompare(a.filed ?? "") || b.caseNumber.localeCompare(a.caseNumber),
  );
  return { rows: all.slice(0, WAGE_REQUESTS_SHOWN), more: all.length > WAGE_REQUESTS_SHOWN };
}
