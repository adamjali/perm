/**
 * The weekly bulletin digest, composed from numbers the ingests already
 * hold. Pure: takes a data object, returns subject and plain text. The HTML
 * is rendered from the same object by `src/emails/BulletinWeekly.tsx`, so the
 * two parts cannot disagree.
 *
 * Every line is a fact with its date. Nothing here forecasts, and a section
 * with nothing to say is left out rather than padded.
 */

export interface DigestNotice {
  title: string;
  url: string;
  publicationDate: string;
  type: string;
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
  /** Federal Register documents published in the last 7 days. */
  notices: DigestNotice[];
  /** Absolute URL of the preference center for this address (per recipient). */
  prefsUrl?: string;
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

export function composeSubject(d: DigestData): string {
  const parts: string[] = [];
  if (d.frontierMonth) parts.push(`DOL at ${monthLabel(d.frontierMonth)}`);
  if (d.bulletinMonth && d.bulletinMoves) {
    parts.push(
      d.bulletinMoves.advanced > 0
        ? `${d.bulletinMoves.advanced} cutoffs moved in the ${monthLabel(d.bulletinMonth)} bulletin`
        : `${monthLabel(d.bulletinMonth)} bulletin unchanged`,
    );
  }
  if (d.notices.length > 0) parts.push(`${d.notices.length} new ${d.notices.length === 1 ? "notice" : "notices"}`);
  const head = parts.length > 0 ? parts.join(", ") : "The week in PERM and the visa bulletin";
  return `${head} (week of ${dateLabel(d.weekOf)})`;
}

/** The plain-text part. Same facts, same order as the HTML. */
export function composeText(d: DigestData): string {
  const lines: string[] = [];
  lines.push(`PERM Tracker, the week of ${dateLabel(d.weekOf)}`);
  lines.push("");
  if (d.frontierMonth || d.averageDays !== null || d.pendingCases !== null) {
    lines.push("DOL'S QUEUE");
    if (d.frontierMonth) lines.push(`Analyst review is deciding cases filed in ${monthLabel(d.frontierMonth)}.`);
    if (d.averageDays !== null) lines.push(`Average to a determination: ${int(d.averageDays)} days.`);
    if (d.pendingCases !== null) lines.push(`Pending PERM cases in the live record: ${int(d.pendingCases)}.`);
    if (d.dolAsOf) lines.push(`DOL's own stamp: ${dateLabel(d.dolAsOf)}.`);
    lines.push("https://permtracker.app/perm-processing-times");
    lines.push("");
  }
  if (d.bulletinMonth && d.bulletinMoves) {
    const m = d.bulletinMoves;
    lines.push(`THE ${monthLabel(d.bulletinMonth).toUpperCase()} VISA BULLETIN`);
    lines.push(
      `Final action dates: ${m.advanced} advanced, ${m.held} unchanged, ${m.retrogressed} went backwards, of ${m.total} cells.`,
    );
    lines.push(`https://permtracker.app/visa-bulletin/${d.bulletinMonth}`);
    lines.push("");
  }
  if (d.notices.length > 0) {
    lines.push("ON THE RECORD THIS WEEK");
    for (const n of d.notices) {
      lines.push(`${dateLabel(n.publicationDate)}, ${n.type}: ${n.title}`);
      lines.push(n.url);
    }
    lines.push("https://permtracker.app/policy-changes");
    lines.push("");
  }
  lines.push("Every figure above comes from DOL, the State Department or the Federal Register, dated as they published it. Nothing is predicted.");
  lines.push("");
  if (d.prefsUrl) {
    lines.push(`Manage or stop this email: ${d.prefsUrl}`);
  }
  lines.push("PERM Tracker, https://permtracker.app");
  return lines.join("\n");
}
