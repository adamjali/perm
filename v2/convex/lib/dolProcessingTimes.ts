/**
 * Parser for the DOL Office of Foreign Labor Certification public
 * processing-times page.
 *
 * Source: https://flag.dol.gov/processingtimes
 *
 * Access note: FLAG is a plain Drupal site. Its robots.txt disallows only
 * /core/, /profiles/ and /README.txt, so /processingtimes is explicitly
 * crawlable. There is no auth, no captcha and no rate gate. This is the only
 * DOL surface we read. The OFLC disclosure archives sit behind Akamai and the
 * FLAG case-status search is bot-gated on purpose; neither is touched here.
 *
 * Why we store snapshots instead of reading live on every request:
 * DOL publishes a SNAPSHOT and overwrites it each month. The page has no
 * history and no archive. Keeping every snapshot is what turns a single
 * number into a measured series, so we can say how far the queue actually
 * moved between two dates rather than guessing where it will be next.
 *
 * Parsing approach: the page is a set of <table> elements, most carrying a
 * <caption> that names the section and stamps its own as-of date. Where a
 * caption is absent the header row is a reliable signature. Every lookup
 * below is therefore anchored on caption text or header text, never on table
 * index, so DOL adding or reordering a section does not silently shift the
 * data we read.
 *
 * Failure policy: this parser THROWS when an expected section is missing or
 * unreadable. It must never return a half-empty snapshot, because a snapshot
 * that parsed to zero rows is indistinguishable from a month where the queue
 * genuinely did not move, and that would quietly corrupt the series.
 *
 * @module
 */

/** One row of the PERM priority-date queue (what DOL is reviewing now). */
export interface PermQueueRow {
  /** e.g. "Analyst Review", "Audit Review", "Reconsideration Request to the CO" */
  queue: string;
  /** Month DOL is currently working, as "YYYY-MM". Null when DOL prints "--". */
  priorityDate: string | null;
  /** Exactly what DOL printed, kept so the UI can show the source wording. */
  raw: string;
}

/** One row of the average-days table. */
export interface PermDeterminationRow {
  /** e.g. "Analyst Review", "Audit Review" */
  determination: string;
  /** Month the average describes, as "YYYY-MM". Null when DOL prints "--". */
  month: string | null;
  /** Average calendar days. Null when DOL prints "--" (no determinations that month). */
  calendarDays: number | null;
  raw: string;
}

/** One row of the prevailing-wage queue. */
export interface PwdQueueRow {
  /** e.g. "PERM", "H-1B", "H-2B", "CW-1" */
  program: string;
  /** "YYYY-MM" or null when DOL prints "--". */
  oewsReceiptDate: string | null;
  /** "YYYY-MM" or null when DOL prints "--". */
  nonOewsReceiptDate: string | null;
}

/** One row of the PERM prevailing-wage backlog. */
export interface PwdBacklogRow {
  /** "YYYY-MM" */
  receiptMonth: string;
  /** Requests still pending from that receipt month. */
  remainingRequests: number;
}

export interface DolProcessingTimesSnapshot {
  /** DOL's own as-of date for the PERM section, "YYYY-MM-DD". */
  permAsOf: string;
  permQueues: PermQueueRow[];
  permAverageDays: PermDeterminationRow[];
  /** DOL's own as-of date for the prevailing-wage section, "YYYY-MM-DD". */
  pwdAsOf: string | null;
  pwdQueues: PwdQueueRow[];
  /** Prevailing-wage backlog for PERM cases, by month of receipt. */
  pwdPermBacklog: PwdBacklogRow[];
  /** Canonical source, recorded on every snapshot so a stored row is self-describing. */
  sourceUrl: string;
}

export class DolParseError extends Error {
  constructor(message: string) {
    super(`DOL processing-times parse failed: ${message}`);
    this.name = "DolParseError";
  }
}

const SOURCE_URL = "https://flag.dol.gov/processingtimes";

const MONTHS: Record<string, string> = {
  january: "01", february: "02", march: "03", april: "04",
  may: "05", june: "06", july: "07", august: "08",
  september: "09", october: "10", november: "11", december: "12",
};

/** Strip tags, decode the handful of entities DOL emits, collapse whitespace. */
export function textOf(fragment: string): string {
  return fragment
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * "8/20/2026" or "08/20/2026" to "2026-08-20".
 * DOL writes US month/day/year throughout this page.
 */
export function parseUsDate(input: string): string | null {
  const m = /(\d{1,2})\s*\/\s*(\d{1,2})\s*\/\s*(\d{4})/.exec(input);
  if (!m) return null;
  const [, mo, d, y] = m;
  return `${y}-${mo!.padStart(2, "0")}-${d!.padStart(2, "0")}`;
}

/**
 * "September 2025" to "2025-09". Returns null for "--", "N/A" and anything
 * that is not a month-year, which DOL uses to mean "nothing to report".
 */
export function parseMonthYear(input: string): string | null {
  const m = /([A-Za-z]+)\s+(\d{4})/.exec(input.trim());
  if (!m) return null;
  const mm = MONTHS[m[1]!.toLowerCase()];
  return mm ? `${m[2]}-${mm}` : null;
}

/** "14,386" to 14386. Returns null for "--" and other non-numerics. */
export function parseCount(input: string): number | null {
  const cleaned = input.replace(/,/g, "").trim();
  if (!/^\d+$/.test(cleaned)) return null;
  return Number.parseInt(cleaned, 10);
}

interface ParsedTable {
  caption: string;
  headers: string[];
  rows: string[][];
}

/** Split the document into tables, each with its caption, headers and body cells. */
export function extractTables(htmlDoc: string): ParsedTable[] {
  const withoutScripts = htmlDoc
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "");

  const tables = withoutScripts.match(/<table[\s\S]*?<\/table>/gi) ?? [];

  return tables.map((table) => {
    const captionMatch = /<caption[\s\S]*?<\/caption>/i.exec(table);
    const caption = captionMatch ? textOf(captionMatch[0]) : "";

    const headers = (table.match(/<th[\s\S]*?<\/th>/gi) ?? []).map(textOf);

    const rows = (table.match(/<tr[\s\S]*?<\/tr>/gi) ?? [])
      .map((tr) => (tr.match(/<td[\s\S]*?<\/td>/gi) ?? []).map(textOf))
      .filter((cells) => cells.length > 0);

    return { caption, headers, rows };
  });
}

function findByCaption(tables: ParsedTable[], needle: string): ParsedTable | undefined {
  const lower = needle.toLowerCase();
  return tables.find((t) => t.caption.toLowerCase().includes(lower));
}

function findByHeaders(tables: ParsedTable[], needles: string[]): ParsedTable | undefined {
  return tables.find((t) => {
    const joined = t.headers.join(" | ").toLowerCase();
    return needles.every((n) => joined.includes(n.toLowerCase()));
  });
}

/**
 * Parse the full page into one snapshot.
 *
 * @throws {DolParseError} when any required section is missing, so a shape
 *   change on DOL's side surfaces as a failed run rather than an empty series.
 */
export function parseProcessingTimes(htmlDoc: string): DolProcessingTimesSnapshot {
  if (!htmlDoc || htmlDoc.length < 1000) {
    throw new DolParseError(`document too short to be the real page (${htmlDoc?.length ?? 0} bytes)`);
  }

  const tables = extractTables(htmlDoc);
  if (tables.length === 0) {
    throw new DolParseError("no <table> elements found");
  }

  // --- PERM priority-date queue. Caption carries DOL's own as-of date. ---
  const permTable = findByCaption(tables, "PERM Processing Times");
  if (!permTable) {
    throw new DolParseError('no table captioned "PERM Processing Times"');
  }

  const permAsOf = parseUsDate(permTable.caption);
  if (!permAsOf) {
    throw new DolParseError(`no as-of date in PERM caption: "${permTable.caption}"`);
  }

  const permQueues: PermQueueRow[] = permTable.rows
    .filter((cells) => cells.length >= 2 && cells[0]!.length > 0)
    .map((cells) => ({
      queue: cells[0]!,
      priorityDate: parseMonthYear(cells[1]!),
      raw: cells[1]!,
    }));

  if (permQueues.length === 0) {
    throw new DolParseError("PERM queue table parsed to zero rows");
  }

  // --- Average calendar days to a determination. ---
  const avgTable = findByCaption(tables, "Average Number of Days to Process PERM");
  if (!avgTable) {
    throw new DolParseError('no table captioned "Average Number of Days to Process PERM Applications"');
  }

  const permAverageDays: PermDeterminationRow[] = avgTable.rows
    .filter((cells) => cells.length >= 3 && cells[0]!.length > 0)
    .map((cells) => ({
      determination: cells[0]!,
      month: parseMonthYear(cells[1]!),
      calendarDays: parseCount(cells[2]!),
      raw: cells[2]!,
    }));

  if (permAverageDays.length === 0) {
    throw new DolParseError("PERM average-days table parsed to zero rows");
  }

  // --- Prevailing wage queue. No caption, so anchor on the header signature. ---
  const pwdTable = findByHeaders(tables, ["Processing Queue", "OEWS Receipt Date"]);
  if (!pwdTable) {
    throw new DolParseError("no prevailing-wage queue table (headers: Processing Queue / OEWS Receipt Date)");
  }

  const pwdQueues: PwdQueueRow[] = pwdTable.rows
    .filter((cells) => cells.length >= 3 && cells[0]!.length > 0)
    .map((cells) => ({
      program: cells[0]!,
      oewsReceiptDate: parseMonthYear(cells[1]!),
      nonOewsReceiptDate: parseMonthYear(cells[2]!),
    }));

  if (pwdQueues.length === 0) {
    throw new DolParseError("prevailing-wage queue table parsed to zero rows");
  }

  // The prevailing-wage section stamps its as-of date in prose above the table
  // rather than in a caption, so read it from the surrounding document.
  const pwdAsOfMatch = /Prevailing Wage Determination Processing Times[\s\S]{0,120}?\(as of ([^)]+)\)/i.exec(
    textOf(htmlDoc),
  );
  const pwdAsOf = pwdAsOfMatch ? parseUsDate(pwdAsOfMatch[1]!) : null;

  // --- Prevailing-wage backlog for PERM, by receipt month. ---
  // Four sibling tables share this shape, one per program; the first header
  // cell names the program, so "PERM" identifies the one we want.
  const backlogTable = findByHeaders(tables, ["PERM", "Remaining Requests"]);
  if (!backlogTable) {
    throw new DolParseError("no PERM prevailing-wage backlog table (headers: PERM / Remaining Requests)");
  }

  const pwdPermBacklog: PwdBacklogRow[] = backlogTable.rows
    .filter((cells) => cells.length >= 2)
    .map((cells) => ({
      receiptMonth: parseMonthYear(cells[0]!),
      remainingRequests: parseCount(cells[1]!),
    }))
    .filter(
      (row): row is PwdBacklogRow =>
        row.receiptMonth !== null && row.remainingRequests !== null,
    );

  if (pwdPermBacklog.length === 0) {
    throw new DolParseError("PERM backlog table parsed to zero usable rows");
  }

  return {
    permAsOf,
    permQueues,
    permAverageDays,
    pwdAsOf,
    pwdQueues,
    pwdPermBacklog,
    sourceUrl: SOURCE_URL,
  };
}

/**
 * Stable hash of the DATA in a snapshot.
 *
 * Deliberately excludes `fetchedAt` and `sourceUrl`: two fetches of an
 * unchanged page must produce the same hash, or every scheduled run would
 * append a duplicate row and the series would stop meaning anything.
 *
 * Field order is fixed here rather than relying on `JSON.stringify` key order,
 * so a future reshuffle of the interface cannot silently invalidate every
 * previously stored hash and re-insert the whole history.
 *
 * Uses Web Crypto, which is available in Convex's default V8 runtime with no
 * import and no "use node" directive.
 */
export async function hashSnapshot(snapshot: DolProcessingTimesSnapshot): Promise<string> {
  const canonical = JSON.stringify([
    snapshot.permAsOf,
    snapshot.pwdAsOf ?? null,
    snapshot.permQueues.map((q) => [q.queue, q.priorityDate]),
    snapshot.permAverageDays.map((d) => [d.determination, d.month, d.calendarDays]),
    snapshot.pwdQueues.map((q) => [q.program, q.oewsReceiptDate, q.nonOewsReceiptDate]),
    snapshot.pwdPermBacklog.map((r) => [r.receiptMonth, r.remainingRequests]),
  ]);

  const digest = await globalThis.crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(canonical),
  );

  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Whole months between two "YYYY-MM" values, or null if either is missing.
 *
 * Used to state how far a queue moved between two stored snapshots. Both
 * inputs come from DOL, so this reports a measured change, never a forecast.
 */
export function monthsBetween(from: string | null, to: string | null): number | null {
  if (!from || !to) return null;
  const [fy, fm] = from.split("-").map(Number);
  const [ty, tm] = to.split("-").map(Number);
  if (!fy || !fm || !ty || !tm) return null;
  return (ty - fy) * 12 + (tm - fm);
}

/** Convenience accessor: the queue row the whole product cares about. */
export function analystReviewQueue(
  snapshot: DolProcessingTimesSnapshot,
): PermQueueRow | undefined {
  return snapshot.permQueues.find((q) => /analyst review/i.test(q.queue));
}

/** Convenience accessor: most recent published average, if DOL reported one. */
export function analystReviewAverageDays(
  snapshot: DolProcessingTimesSnapshot,
): number | null {
  const row = snapshot.permAverageDays.find((d) => /analyst review/i.test(d.determination));
  return row?.calendarDays ?? null;
}

export { SOURCE_URL as DOL_PROCESSING_TIMES_URL };
