/**
 * The deadline calculator's dates, ready to leave the page: as plain text to
 * paste into another system, and as a calendar file.
 *
 * Built for firms that keep their cases somewhere else (plain Salesforce, a
 * spreadsheet), where support staff work the PERM dates out by hand and type
 * them in (Oct 19 2026). The calculator does the arithmetic; these hand it
 * over without retyping. Pure, so the exact text and file are tested.
 */

import { formatAsOf } from "@/lib/dolFormat";

export interface DeadlineRow {
  label: string;
  /** ISO date, YYYY-MM-DD. */
  date: string;
  detail: string;
}

export interface DeadlineInputs {
  pwdDate: string;
  firstRecruitment?: string;
  lastRecruitment?: string;
}

const SOURCE = "https://permtracker.app/tools/perm-deadline-calculator";

/**
 * A plain list: the dates entered, then each deadline on its own line. Any
 * warning the page shows comes first, so a pasted copy carries the same doubt
 * the page does.
 */
export function deadlinesText(rows: DeadlineRow[], inputs: DeadlineInputs, warnings: string[], today: string): string {
  const lines: string[] = [];
  for (const w of warnings) lines.push(`Check first: ${w}`);
  if (warnings.length) lines.push("");
  lines.push("Dates entered");
  lines.push(`Prevailing wage determination: ${formatAsOf(inputs.pwdDate)}`);
  if (inputs.firstRecruitment) lines.push(`First recruitment step: ${formatAsOf(inputs.firstRecruitment)}`);
  if (inputs.lastRecruitment) lines.push(`Last recruitment step: ${formatAsOf(inputs.lastRecruitment)}`);
  lines.push("");
  lines.push("PERM deadlines");
  for (const r of rows) lines.push(`${r.label}: ${formatAsOf(r.date)}`);
  lines.push("");
  lines.push(`Worked out ${formatAsOf(today)} under 20 CFR 656 at ${SOURCE}. Not legal advice.`);
  return lines.join("\n");
}

/** RFC 5545 text: backslash, semicolon and comma escaped, newlines as \n. */
function icsText(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** Fold a content line at 75 octets, continuing with a space (RFC 5545 3.1). */
function fold(line: string): string {
  const bytes = new TextEncoder().encode(line);
  if (bytes.length <= 75) return line;
  const out: string[] = [];
  let cur = "";
  let curBytes = 0;
  for (const ch of line) {
    const n = new TextEncoder().encode(ch).length;
    const limit = out.length === 0 ? 75 : 74; // a continuation's leading space counts
    if (curBytes + n > limit) {
      out.push(cur);
      cur = "";
      curBytes = 0;
    }
    cur += ch;
    curBytes += n;
  }
  out.push(cur);
  return out.join("\r\n ");
}

const compact = (iso: string) => iso.replaceAll("-", "");

function nextDay(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/**
 * A calendar file: one all-day event per deadline, each with a reminder a week
 * before. The same dates entered give the same event ids, so importing again
 * updates rather than duplicates in calendars that honour UID.
 */
export function deadlinesIcs(rows: DeadlineRow[], inputs: DeadlineInputs, stampUtc: string): string {
  const key = [inputs.pwdDate, inputs.firstRecruitment, inputs.lastRecruitment].filter(Boolean).join("-");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//PERM Tracker//Deadline calculator//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:PERM deadlines",
  ];
  for (const r of rows) {
    lines.push(
      "BEGIN:VEVENT",
      `UID:${compact(key)}-${slug(r.label)}@permtracker.app`,
      `DTSTAMP:${stampUtc}`,
      `DTSTART;VALUE=DATE:${compact(r.date)}`,
      `DTEND;VALUE=DATE:${compact(nextDay(r.date))}`,
      `SUMMARY:${icsText(`PERM: ${r.label}`)}`,
      `DESCRIPTION:${icsText(`${r.detail}\n\nWorked out at ${SOURCE}. Not legal advice.`)}`,
      "TRANSP:TRANSPARENT",
      "BEGIN:VALARM",
      "ACTION:DISPLAY",
      `DESCRIPTION:${icsText(`In a week: ${r.label}`)}`,
      "TRIGGER:-P7D",
      "END:VALARM",
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}

/** The current time as an iCalendar UTC stamp, 20261019T235900Z. */
export function icsStamp(now: Date = new Date()): string {
  return now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}
