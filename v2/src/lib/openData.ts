/**
 * The open datasets: two histories this site has kept, offered as files under
 * CC BY 4.0.
 *
 * WHY THESE TWO AND NOT THE REST. Both are histories the agencies themselves
 * don't keep in one place: the State Department posts each visa bulletin as
 * its own page, and DOL overwrites its processing-times page every time it
 * updates it, so the readings before today exist only where someone saved
 * them. Everything else on the site is either the agencies' own downloadable
 * files (better fetched from them) or our compilation, which the Terms keep
 * (§4 and §6). These two are the exception the Terms name.
 *
 * Plain module, no server imports: the routes and the page build the files
 * from rows the server read, and the tests build them from fixtures.
 */

import { parseCutoff } from "@/lib/perm";
import { csvCell } from "@/lib/caseSearchCsv";

export const OPEN_DATA_LICENSE = {
  name: "Creative Commons Attribution 4.0 International",
  short: "CC BY 4.0",
  url: "https://creativecommons.org/licenses/by/4.0/",
} as const;

/** The credit line CC BY asks for, ready to paste. */
export const OPEN_DATA_CREDIT = "PERM Tracker (permtracker.app)";

export const OPEN_DATA_PATHS = {
  bulletinCsv: "/open-data/visa-bulletins.csv",
  bulletinJson: "/open-data/visa-bulletins.json",
  dolCsv: "/open-data/dol-processing-times.csv",
  dolJson: "/open-data/dol-processing-times.json",
} as const;

type Chart = Record<string, Partial<Record<string, string>>> | null;

/** One stored bulletin, as `visa_bulletins` holds it. Cells are as printed. */
export interface BulletinRecord {
  bulletinMonth: string;
  sourceUrl: string | null;
  finalAction: Chart;
  datesForFiling: Chart;
  familyFinalAction: Chart;
  familyDatesForFiling: Chart;
}

export interface BulletinRow {
  bulletin_month: string;
  preference: "employment" | "family";
  chart: "final_action" | "dates_for_filing";
  category: string;
  country: string;
  as_printed: string;
  cutoff_date: string;
  status: "date" | "current" | "unavailable" | "unread";
}

const BULLETIN_COLUMNS = [
  "bulletin_month",
  "preference",
  "chart",
  "category",
  "country",
  "as_printed",
  "cutoff_date",
  "status",
] as const;

/** One row per printed cell, oldest bulletin first, charts in a fixed order. */
export function bulletinRows(bulletins: readonly BulletinRecord[]): BulletinRow[] {
  const out: BulletinRow[] = [];
  const sorted = [...bulletins].sort((a, b) => a.bulletinMonth.localeCompare(b.bulletinMonth));
  for (const b of sorted) {
    const charts: Array<[BulletinRow["preference"], BulletinRow["chart"], Chart]> = [
      ["employment", "final_action", b.finalAction],
      ["employment", "dates_for_filing", b.datesForFiling],
      ["family", "final_action", b.familyFinalAction],
      ["family", "dates_for_filing", b.familyDatesForFiling],
    ];
    for (const [preference, chart, cells] of charts) {
      if (!cells) continue;
      for (const [category, byCountry] of Object.entries(cells)) {
        for (const [country, printed] of Object.entries(byCountry ?? {})) {
          if (!printed) continue;
          const cut = parseCutoff(printed);
          out.push({
            bulletin_month: b.bulletinMonth,
            preference,
            chart,
            category,
            country,
            as_printed: printed,
            cutoff_date: cut?.kind === "date" ? cut.iso : "",
            // "unread" is a cell the parser could not read as a date, C or U.
            // It stays in the file, as printed, rather than vanishing.
            status: cut ? (cut.kind === "date" ? "date" : cut.kind) : "unread",
          });
        }
      }
    }
  }
  return out;
}

/** The DOL snapshot fields this file carries (the stored shape, minus nothing). */
export interface DolReading {
  permAsOf: string;
  permQueues: Array<{ queue: string; priorityDate: string | null; raw: string }>;
  permAverageDays: Array<{ determination: string; month: string | null; calendarDays: number | null; raw: string }>;
  pwdAsOf: string | null;
  pwdQueues: Array<{ program: string; oewsReceiptDate: string | null; nonOewsReceiptDate: string | null }>;
  pwdPermBacklog: Array<{ receiptMonth: string; remainingRequests: number }>;
  sourceUrl: string;
  fetchedAt: number;
}

export interface DolRow {
  as_of: string;
  table: "perm_queue" | "perm_average_days" | "pwd_queue_oews" | "pwd_queue_non_oews" | "pwd_perm_backlog";
  row: string;
  month: string;
  calendar_days: number | "";
  remaining_requests: number | "";
}

const DOL_COLUMNS = ["as_of", "table", "row", "month", "calendar_days", "remaining_requests"] as const;

/**
 * One row per published value, oldest date first. A blank month means DOL
 * printed "--" that day; the cell is kept so the row's absence isn't mistaken
 * for a gap in our record.
 *
 * Each half is written once per DOL date. A reading carries both halves, and
 * two readings can share a PERM date (DOL moved only its wage figures, Sep 30
 * 2026) or a wage date (only the PERM figures moved), which used to repeat
 * the shared half. Where two readings disagree about one date, the one we
 * recorded later wins.
 */
export function dolRows(readings: readonly DolReading[]): DolRow[] {
  const time = (r: DolReading) => (Number.isFinite(r.fetchedAt) ? r.fetchedAt : 0);
  const byTime = [...readings].sort((a, b) => time(a) - time(b));
  const perm = new Map<string, DolReading>();
  const pwd = new Map<string, DolReading>();
  for (const r of byTime) {
    perm.set(r.permAsOf, r);
    if (r.pwdAsOf) pwd.set(r.pwdAsOf, r);
  }
  const blocks: Array<{ asOf: string; order: number; rows: DolRow[] }> = [];
  for (const [asOf, r] of perm) {
    const rows: DolRow[] = [];
    for (const q of r.permQueues) {
      rows.push({ as_of: asOf, table: "perm_queue", row: q.queue, month: q.priorityDate ?? "", calendar_days: "", remaining_requests: "" });
    }
    for (const d of r.permAverageDays) {
      rows.push({
        as_of: asOf,
        table: "perm_average_days",
        row: d.determination,
        month: d.month ?? "",
        calendar_days: d.calendarDays ?? "",
        remaining_requests: "",
      });
    }
    blocks.push({ asOf, order: 0, rows });
  }
  for (const [asOf, r] of pwd) {
    const rows: DolRow[] = [];
    for (const p of r.pwdQueues) {
      rows.push({ as_of: asOf, table: "pwd_queue_oews", row: p.program, month: p.oewsReceiptDate ?? "", calendar_days: "", remaining_requests: "" });
      rows.push({ as_of: asOf, table: "pwd_queue_non_oews", row: p.program, month: p.nonOewsReceiptDate ?? "", calendar_days: "", remaining_requests: "" });
    }
    for (const b of r.pwdPermBacklog) {
      rows.push({ as_of: asOf, table: "pwd_perm_backlog", row: "PERM", month: b.receiptMonth, calendar_days: "", remaining_requests: b.remainingRequests });
    }
    blocks.push({ asOf, order: 1, rows });
  }
  blocks.sort((a, b) => a.asOf.localeCompare(b.asOf) || a.order - b.order);
  return blocks.flatMap((b) => b.rows);
}

function toCsv<T extends object>(columns: readonly (keyof T & string)[], rows: readonly T[]): string {
  const lines = [columns.join(",")];
  for (const r of rows) lines.push(columns.map((c) => csvCell(r[c])).join(","));
  return `${lines.join("\r\n")}\r\n`;
}

export function bulletinCsv(bulletins: readonly BulletinRecord[]): string {
  return toCsv<BulletinRow>(BULLETIN_COLUMNS, bulletinRows(bulletins));
}

export function dolCsv(readings: readonly DolReading[]): string {
  return toCsv<DolRow>(DOL_COLUMNS, dolRows(readings));
}

const LICENSE_BLOCK = {
  license: OPEN_DATA_LICENSE.url,
  credit: OPEN_DATA_CREDIT,
  homepage: "https://permtracker.app/open-data",
};

export function bulletinJson(bulletins: readonly BulletinRecord[]): string {
  const sorted = [...bulletins].sort((a, b) => a.bulletinMonth.localeCompare(b.bulletinMonth));
  return JSON.stringify({
    name: "Visa bulletin cutoff history",
    ...LICENSE_BLOCK,
    source: "U.S. Department of State, Visa Bulletin",
    cells: "As printed: a date like 15JAN13, C (current: open to every priority date) or U (unavailable: shut to all).",
    bulletins: sorted.map((b) => ({
      bulletinMonth: b.bulletinMonth,
      sourceUrl: b.sourceUrl,
      employment: { finalAction: b.finalAction, datesForFiling: b.datesForFiling },
      family: { finalAction: b.familyFinalAction, datesForFiling: b.familyDatesForFiling },
    })),
  });
}

export function dolJson(readings: readonly DolReading[]): string {
  const sorted = [...readings].sort(
    (a, b) => a.permAsOf.localeCompare(b.permAsOf) || (a.pwdAsOf ?? "").localeCompare(b.pwdAsOf ?? ""),
  );
  return JSON.stringify({
    name: "DOL processing times history",
    ...LICENSE_BLOCK,
    source: "U.S. Department of Labor, FLAG processing times (flag.dol.gov/processingtimes)",
    months: "YYYY-MM. Null where DOL printed --.",
    readings: sorted.map(({ fetchedAt, ...r }) => ({ ...r, recordedAt: isoOrNull(fetchedAt) })),
  });
}

/** When our ingest stored the reading; a stored value that isn't a time gives null, not a throw. */
function isoOrNull(ms: unknown): string | null {
  const n = Number(ms);
  return Number.isFinite(n) && n > 0 ? new Date(n).toISOString() : null;
}

/** Response headers for a download: its type, its name, its licence, and open to any site. */
export function downloadHeaders(kind: "csv" | "json", filename: string): HeadersInit {
  return {
    "Content-Type": kind === "csv" ? "text/csv; charset=utf-8" : "application/json; charset=utf-8",
    "Content-Disposition": `${kind === "csv" ? "attachment" : "inline"}; filename="${filename}"`,
    "Access-Control-Allow-Origin": "*",
    Link: `<${OPEN_DATA_LICENSE.url}>; rel="license"`,
  };
}
