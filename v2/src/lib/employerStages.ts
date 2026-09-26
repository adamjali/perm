/**
 * Employers by their PERM cases outside DOL's normal queue: on hold, at RFI or
 * NORD, in supervised recruitment (all DOL's doing), or under appeal (the
 * employer's own filing after a denial). The pure half: parsing the document
 * the sweep writes, the two rankings the page prints, and the dated sentences.
 *
 * WHO ACTED IS PART OF EVERY SENTENCE. Until Sep 25 2026 the page said "DOL
 * has pulled aside" over all of these, and 2,848 of the 5,958 cases were
 * appeals the employers filed themselves. A status is DOL's word for where a
 * case is; the page never adds a reason DOL hasn't given.
 *
 * Why two rankings. Counts answer "who has the most cases held", which is
 * dominated by the biggest filers; share answers "whose queue is mostly
 * held", which is where a small employer with every case on hold shows.
 * Share is only ranked above a floor, because two of two is not a signal.
 * The Turso half is `src/lib/turso/employerStages.ts`.
 */

export const QUEUE_STATUS = "ANALYST REVIEW";
export const HOLD_STATUS = "APPLICATION ON HOLD";
/** An employer needs this many pending cases before its share is ranked. */
export const SHARE_FLOOR = 25;
export const EMPLOYER_STAGES_MAX_AGE_MS = 8 * 86_400_000;

export interface EmployerStageRow {
  name: string;
  slug: string | null;
  pending: number;
  /** Pending cases at any status other than analyst review. */
  review: number;
  share: number;
  byStatus: Record<string, number>;
  /**
   * When the current hold began, read from this site's daily record. Present
   * only on employers with a case on hold, and only in docs written since
   * Sep 25 2026. `holdSince` is the entry day most held cases share,
   * `holdSinceCases` how many share it; `holdUndated` were never seen
   * entering, of which `holdBeforeLog` were already held when the record
   * began (the rest were already held when first recorded).
   */
  holdSince?: string | null;
  holdSinceCases?: number;
  holdUndated?: number;
  holdBeforeLog?: number;
}

/** One day DOL moved five or more of one employer's cases into or out of hold. */
export interface HoldMove {
  date: string;
  name: string;
  slug: string | null;
  dir: "on" | "off";
  /** Where the cases went: the hold itself for "on", the next status for "off". */
  to: string;
  n: number;
}

/**
 * One day a batch of one employer's cases was decided, well above its own
 * pace (see `decision_moves` in the ingest for the three rules). Dated by the
 * day this site recorded it. DOL certifies and denies; the employer withdraws.
 */
export interface DecisionMove {
  date: string;
  name: string;
  slug: string | null;
  to: "CERTIFIED" | "DENIED" | "WITHDRAWN";
  n: number;
}

export interface EmployerStagesDoc {
  asOf: string;
  pendingTotal: number;
  nationwide: Record<string, number>;
  minPending: number;
  employers: EmployerStageRow[];
  /** First day of this site's record of status changes, or null on an older doc. */
  logFrom: string | null;
  holdMoves: HoldMove[];
  /** Empty on a doc written before Sep 26 2026. */
  decisionMoves: DecisionMove[];
}

const isInt = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v) && v >= 0;
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const isIso = (v: unknown): v is string => typeof v === "string" && ISO.test(v);
const optInt = (v: unknown) => v === undefined || isInt(v);

function isRow(v: unknown): v is EmployerStageRow {
  if (typeof v !== "object" || v === null) return false;
  const r = v as Record<string, unknown>;
  return (
    typeof r.name === "string" &&
    (r.slug === null || typeof r.slug === "string") &&
    isInt(r.pending) &&
    isInt(r.review) &&
    typeof r.share === "number" &&
    typeof r.byStatus === "object" &&
    r.byStatus !== null &&
    Object.values(r.byStatus as Record<string, unknown>).every(isInt) &&
    (r.holdSince === undefined || r.holdSince === null || isIso(r.holdSince)) &&
    optInt(r.holdSinceCases) &&
    optInt(r.holdUndated) &&
    optInt(r.holdBeforeLog)
  );
}

function isMove(v: unknown): v is HoldMove {
  if (typeof v !== "object" || v === null) return false;
  const m = v as Record<string, unknown>;
  return (
    isIso(m.date) &&
    typeof m.name === "string" &&
    m.name.length > 0 &&
    (m.slug === null || typeof m.slug === "string") &&
    (m.dir === "on" || m.dir === "off") &&
    typeof m.to === "string" &&
    isInt(m.n)
  );
}

const DECISIONS = new Set(["CERTIFIED", "DENIED", "WITHDRAWN"]);

function isDecision(v: unknown): v is DecisionMove {
  if (typeof v !== "object" || v === null) return false;
  const m = v as Record<string, unknown>;
  return (
    isIso(m.date) &&
    typeof m.name === "string" &&
    m.name.length > 0 &&
    (m.slug === null || typeof m.slug === "string") &&
    typeof m.to === "string" &&
    DECISIONS.has(m.to) &&
    isInt(m.n)
  );
}

/** Null for anything stale or malformed; a partial document must not render as a whole one. */
export function parseEmployerStagesDoc(json: string, computedAt: number, now: number): EmployerStagesDoc | null {
  if (now - computedAt > EMPLOYER_STAGES_MAX_AGE_MS) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) return null;
  const d = parsed as Record<string, unknown>;
  if (
    !isIso(d.asOf) ||
    !isInt(d.pendingTotal) ||
    typeof d.nationwide !== "object" ||
    d.nationwide === null ||
    !Object.values(d.nationwide as Record<string, unknown>).every(isInt) ||
    !isInt(d.minPending) ||
    !Array.isArray(d.employers) ||
    !d.employers.every(isRow)
  ) {
    return null;
  }
  const nationwide = d.nationwide as Record<string, number>;
  // The doc must reconcile with itself, the same rule the sweep applies before writing.
  const summed = Object.values(nationwide).reduce((a, b) => a + b, 0);
  if (summed !== d.pendingTotal) return null;
  // The dates are context on top of the counts: a doc from before they
  // existed, or one whose moves failed to parse, still renders its counts.
  const moves = Array.isArray(d.holdMoves) && d.holdMoves.every(isMove) ? (d.holdMoves as HoldMove[]) : [];
  const decisions =
    Array.isArray(d.decisionMoves) && d.decisionMoves.every(isDecision)
      ? (d.decisionMoves as DecisionMove[])
      : [];
  return {
    asOf: d.asOf,
    pendingTotal: d.pendingTotal,
    nationwide,
    minPending: d.minPending,
    employers: d.employers as EmployerStageRow[],
    logFrom: isIso(d.logFrom) ? d.logFrom : null,
    holdMoves: moves,
    decisionMoves: decisions,
  };
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"] as const;

/** "September 24, 2026" from an ISO date, with no time zone arithmetic. */
export function longDate(iso: string): string {
  return `${MONTHS[Number(iso.slice(5, 7)) - 1] ?? ""} ${Number(iso.slice(8, 10))}, ${iso.slice(0, 4)}`;
}

const int = (n: number) => n.toLocaleString("en-US");

/**
 * When an employer's current hold began, as a phrase, or null when it has no
 * case on hold or the doc carries no dates. Every clause is a count the record
 * supports; an undated case is never folded into a dated one.
 */
export function holdSincePhrase(row: EmployerStageRow, logFrom: string | null): string | null {
  const held = row.byStatus[HOLD_STATUS] ?? 0;
  if (held === 0 || row.holdUndated === undefined) return null;
  const dated = row.holdSince ? row.holdSinceCases ?? 0 : 0;
  const before = logFrom ? row.holdBeforeLog ?? 0 : 0;
  const firstSeen = (row.holdUndated ?? 0) - before;
  const otherDays = held - dated - (row.holdUndated ?? 0);
  const parts: string[] = [];
  if (dated > 0 && row.holdSince) {
    parts.push(dated === held ? `on hold since ${longDate(row.holdSince)}` : `${int(dated)} on hold since ${longDate(row.holdSince)}`);
  }
  if (before > 0 && logFrom) {
    parts.push(
      before === held
        ? `on hold since before ${longDate(logFrom)}, when this site's record begins`
        : `${int(before)} since before ${longDate(logFrom)}`,
    );
  }
  if (firstSeen > 0) parts.push(`${int(firstSeen)} already on hold when first recorded`);
  if (otherDays > 0) parts.push(`${int(otherDays)} put on hold on other days`);
  return parts.length ? parts.join("; ") : null;
}

const APPEAL_STATUSES = ["RECONSIDERATION APPEALS", "BALCA APPEALS", "REQUEST FOR REVIEW"] as const;

/**
 * "216 on hold, 3 at RFI, 26 under appeal": the cases outside the queue,
 * each named by who acted. Hold and RFI are DOL's; an appeal is the
 * employer's. Empty when the employer has none of the three.
 */
export function breakdownParts(row: EmployerStageRow): string[] {
  const at = (s: string) => row.byStatus[s] ?? 0;
  const appeals = APPEAL_STATUSES.reduce((a, s) => a + at(s), 0);
  return [
    at(HOLD_STATUS) > 0 ? `${int(at(HOLD_STATUS))} on hold` : "",
    at("RFI ISSUED") > 0 ? `${int(at("RFI ISSUED"))} at RFI` : "",
    appeals > 0 ? `${int(appeals)} under appeal` : "",
  ].filter(Boolean);
}

const STATUS_WORDS: Record<string, string> = {
  "ANALYST REVIEW": "back to analyst review",
  CERTIFIED: "certified",
  DENIED: "denied",
  WITHDRAWN: "withdrawn",
  "RFI ISSUED": "sent a request for information",
};

/** "215 cases put on hold" / "201 taken off hold, back to analyst review". */
export function moveSentence(m: HoldMove): string {
  const cases = `${int(m.n)} case${m.n === 1 ? "" : "s"}`;
  if (m.dir === "on") return `${cases} put on hold`;
  const where = STATUS_WORDS[m.to] ?? m.to.toLowerCase();
  return `${cases} taken off hold, ${where}`;
}

/**
 * "DOL certified 44 of its cases" / "12 of its cases were withdrawn by the
 * employer". Names who acted: DOL decides, the employer withdraws.
 */
export function decisionSentence(m: DecisionMove): string {
  const cases = `${int(m.n)} of its cases`;
  if (m.to === "WITHDRAWN") return `${cases} ${m.n === 1 ? "was" : "were"} withdrawn by the employer`;
  return `DOL ${m.to === "CERTIFIED" ? "certified" : "denied"} ${cases}`;
}

/** "DOL put 215 of its cases on hold" / "DOL took 201 of its cases off hold, back to analyst review". */
export function holdSentence(m: HoldMove): string {
  const cases = `${int(m.n)} of its cases`;
  if (m.dir === "on") return `DOL put ${cases} on hold`;
  const them = m.n === 1 ? "it" : "them";
  switch (m.to) {
    case "ANALYST REVIEW":
      return `DOL took ${cases} off hold, back to analyst review`;
    case "CERTIFIED":
      return `DOL took ${cases} off hold and certified ${them}`;
    case "DENIED":
      return `DOL took ${cases} off hold and denied ${them}`;
    case "RFI ISSUED":
      return `DOL took ${cases} off hold and sent a request for information`;
    case "WITHDRAWN":
      return `${cases} came off hold as withdrawals by the employer`;
    default:
      return `DOL moved ${cases} off hold, to ${m.to.toLowerCase()}`;
  }
}

/**
 * Every employer-wide move in one list, newest first, keyed for the follow
 * alerts' change detector: `<date>|hold-on|<to>`, `<date>|hold-off|<to>`,
 * `<date>|decided|<to>`. One key per group, so a follower hears of each once.
 */
export interface EmployerMove {
  key: string;
  date: string;
  slug: string | null;
  name: string;
  sentence: string;
  tone: "good" | "bad" | "neutral";
  n: number;
}

export function employerMoves(doc: Pick<EmployerStagesDoc, "holdMoves" | "decisionMoves">): EmployerMove[] {
  const out: EmployerMove[] = [
    ...doc.holdMoves.map((m) => ({
      key: `${m.date}|hold-${m.dir}|${m.to}`,
      date: m.date,
      slug: m.slug,
      name: m.name,
      sentence: holdSentence(m),
      tone: (m.dir === "on" ? "bad" : m.to === "CERTIFIED" ? "good" : "neutral") as EmployerMove["tone"],
      n: m.n,
    })),
    ...doc.decisionMoves.map((m) => ({
      key: `${m.date}|decided|${m.to}`,
      date: m.date,
      slug: m.slug,
      name: m.name,
      sentence: decisionSentence(m),
      tone: (m.to === "CERTIFIED" ? "good" : m.to === "DENIED" ? "bad" : "neutral") as EmployerMove["tone"],
      n: m.n,
    })),
  ];
  return out.sort((a, b) => b.date.localeCompare(a.date) || b.n - a.n);
}

/** Most cases outside the normal queue, then most pending, then name. */
export function rankByReview(rows: readonly EmployerStageRow[], take = 50): EmployerStageRow[] {
  return [...rows]
    .filter((r) => r.review > 0)
    .sort((a, b) => b.review - a.review || b.pending - a.pending || a.name.localeCompare(b.name))
    .slice(0, take);
}

/** Highest share of pending outside the normal queue, above the floor, then count. */
export function rankByShare(rows: readonly EmployerStageRow[], take = 50, floor = SHARE_FLOOR): EmployerStageRow[] {
  return [...rows]
    .filter((r) => r.pending >= floor && r.review > 0)
    .sort((a, b) => b.share - a.share || b.review - a.review || a.name.localeCompare(b.name))
    .slice(0, take);
}

/** The share of the nationwide cases at a status that one employer holds, 0 when the status is empty. */
export function nationalShare(row: EmployerStageRow, status: string, nationwide: Record<string, number>): number {
  const total = nationwide[status] ?? 0;
  const mine = row.byStatus[status] ?? 0;
  return total > 0 ? mine / total : 0;
}
