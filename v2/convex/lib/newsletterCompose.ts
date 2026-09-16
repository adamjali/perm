/**
 * The weekly bulletin digest, composed from numbers the ingests already
 * hold. Pure: takes a data object, returns subject and plain text. The HTML
 * is rendered from the same object by `src/emails/BulletinWeekly.tsx`, so the
 * two parts cannot disagree.
 *
 * Every line is a fact with its date. Nothing here forecasts, and a section
 * with nothing to say is left out rather than padded.
 *
 * Every URL is built on `SITE_URL` from `./links`, never on a Convex host:
 * a link to an unfamiliar domain in a list email is the anatomy of phishing,
 * which is the whole argument in that module.
 */
import { SITE_URL } from "./links";

export interface DigestNotice {
  title: string;
  url: string;
  publicationDate: string;
  type: string;
}

/** The recipient's own confirmed, still-open case alert, when they have one. */
export interface WatchedCase {
  caseNumber: string;
  /** The status we last told them about, or null if none is recorded yet. */
  status: string | null;
  /** The live lookup for this case, on the public site. */
  url: string;
}

export interface DigestData {
  /** ISO date the issue is composed for (a Tuesday). */
  weekOf: string;
  /** DOL's stamp on the processing-times page, YYYY-MM-DD. */
  dolAsOf: string | null;
  /** The filing month DOL's analyst review has reached, YYYY-MM. */
  frontierMonth: string | null;
  /** DOL's published average days to a determination. */
  averageDays: number | null;
  /** Pending PERM cases in the live remainder. */
  pendingCases: number | null;
  /** Newest bulletin held, YYYY-MM, and how its final-action cells moved. */
  bulletinMonth: string | null;
  bulletinMoves: { advanced: number; held: number; retrogressed: number; total: number } | null;
  /** True when the previous issue carried this same bulletin month: the moves were already reported. */
  bulletinRepeat?: boolean;
  /** Federal Register documents published in the last 7 days. */
  notices: DigestNotice[];
  /** Absolute URL of the preference center for this address (per recipient). */
  prefsUrl?: string;
  /**
   * Per recipient: the case they are watching, so the issue opens with the
   * one fact that is theirs. The STORED issue never carries it; only the
   * per-recipient render inside `sendBatch` does.
   */
  watchedCase?: WatchedCase | null;
}

/** Gmail shows about 78 characters of a subject on a desktop; mobile shows fewer. */
export const SUBJECT_MAX = 78;

/** The two doors at the foot of every issue, the same pair the homepage CTA uses. */
export const CHECK_CASE_URL = `${SITE_URL}/perm-case-status`;
export const SIGNUP_URL = `${SITE_URL}/signup`;

/** The live lookup for one case number, on the public site. */
export function caseLookupUrl(caseNumber: string): string {
  return `${SITE_URL}/perm-case-status?case=${encodeURIComponent(caseNumber)}`;
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
] as const;

export function monthLabel(ym: string): string {
  const n = Number(ym.slice(5, 7));
  return `${MONTHS[n - 1] ?? ym} ${ym.slice(0, 4)}`;
}

export function dateLabel(iso: string): string {
  const m = Number(iso.slice(5, 7));
  return `${(MONTHS[m - 1] ?? "").slice(0, 3)} ${Number(iso.slice(8, 10))}, ${iso.slice(0, 4)}`;
}

const int = (n: number) => n.toLocaleString("en-US");

/** "2025-11" -> "Nov 2025", for the subject line, where every character is rationed. */
export function shortMonthLabel(ym: string): string {
  const n = Number(ym.slice(5, 7));
  return `${(MONTHS[n - 1] ?? ym).slice(0, 3)} ${ym.slice(0, 4)}`;
}

/**
 * Subject: the movement parts in priority order, then the week.
 *
 * Capped at SUBJECT_MAX. The wording is the short form (Nov, not November)
 * because Gmail's desktop list shows about 78 characters and a phone shows
 * fewer, and the full form spent them on month names. Over the cap, the LAST
 * parts go first (the notice count before the bulletin, the bulletin before
 * DOL's frontier); the week suffix is never cut, because a subject that loses
 * its date is one the reader cannot file. A single part that is still too
 * long on its own is hard-cut with an ellipsis rather than shipped over.
 */
export function composeSubject(d: DigestData): string {
  const parts: string[] = [];
  if (d.frontierMonth) parts.push(`DOL at ${shortMonthLabel(d.frontierMonth)}`);
  if (d.bulletinMonth && d.bulletinMoves) {
    const mon = shortMonthLabel(d.bulletinMonth).slice(0, 3);
    parts.push(
      d.bulletinRepeat
        ? `${mon} bulletin, same as last week`
        : d.bulletinMoves.advanced > 0
          ? `${d.bulletinMoves.advanced} cutoffs moved (${mon} bulletin)`
          : `${mon} bulletin unchanged`,
    );
  }
  if (d.notices.length > 0) parts.push(`${d.notices.length} new ${d.notices.length === 1 ? "notice" : "notices"}`);
  const suffix = ` · week of ${dateLabel(d.weekOf).replace(/,\s*\d{4}$/, "")}`;
  const fallback = "The week in PERM and the visa bulletin";
  while (parts.length > 1 && (parts.join(", ") + suffix).length > SUBJECT_MAX) parts.pop();
  let head = parts.length > 0 ? parts.join(", ") : fallback;
  if ((head + suffix).length > SUBJECT_MAX) {
    head = `${head.slice(0, Math.max(0, SUBJECT_MAX - suffix.length - 1)).trimEnd()}…`;
  }
  return `${head}${suffix}`;
}

/** The plain-text part. Same facts, same order as the HTML. */
export function composeText(d: DigestData): string {
  const lines: string[] = [];
  lines.push(`PERM Tracker, the week of ${dateLabel(d.weekOf)}`);
  lines.push("");
  if (d.watchedCase) {
    lines.push("YOUR CASE");
    lines.push(d.watchedCase.caseNumber);
    lines.push(
      d.watchedCase.status
        ? `Status when we last checked it for you: ${d.watchedCase.status}.`
        : "We haven't recorded a status for it yet.",
    );
    lines.push(`Check it live: ${d.watchedCase.url}`);
    lines.push("");
  }
  if (d.frontierMonth || d.averageDays !== null || d.pendingCases !== null) {
    lines.push("DOL'S QUEUE");
    if (d.frontierMonth) lines.push(`Analyst review is deciding cases filed in ${monthLabel(d.frontierMonth)}.`);
    if (d.averageDays !== null) lines.push(`Average to a determination: ${int(d.averageDays)} days.`);
    if (d.pendingCases !== null) lines.push(`Pending PERM cases in the live record: ${int(d.pendingCases)}.`);
    if (d.dolAsOf) lines.push(`DOL's own stamp: ${dateLabel(d.dolAsOf)}.`);
    lines.push(`${SITE_URL}/perm-processing-times`);
    lines.push("");
  }
  if (d.bulletinMonth && d.bulletinMoves) {
    const m = d.bulletinMoves;
    lines.push(`THE ${monthLabel(d.bulletinMonth).toUpperCase()} VISA BULLETIN`);
    lines.push(
      d.bulletinRepeat
        ? "Same bulletin as last week's issue; nothing has moved since. The next one is normally out mid-month."
        : `Final action dates: ${m.advanced} advanced, ${m.held} unchanged, ${m.retrogressed} went backwards, of ${m.total} cells.`,
    );
    lines.push(`${SITE_URL}/visa-bulletin/${d.bulletinMonth}`);
    lines.push("");
  }
  if (d.notices.length > 0) {
    lines.push("ON THE RECORD THIS WEEK");
    for (const n of d.notices) {
      lines.push(`${dateLabel(n.publicationDate)}, ${n.type}: ${n.title}`);
      lines.push(n.url);
    }
    lines.push(`${SITE_URL}/policy-changes`);
    lines.push("");
  }
  lines.push(`Check a case, any PERM, wage-request or LCA number, live from DOL: ${CHECK_CASE_URL}`);
  lines.push(`Start tracking cases, free, for attorneys, paralegals and HR teams: ${SIGNUP_URL}`);
  lines.push("");
  lines.push("Every figure above comes from DOL, the State Department or the Federal Register, dated as they published it. Nothing is predicted.");
  lines.push("");
  if (d.prefsUrl) {
    lines.push(`Manage or stop this email: ${d.prefsUrl}`);
  }
  lines.push(`PERM Tracker, ${SITE_URL}`);
  return lines.join("\n");
}
