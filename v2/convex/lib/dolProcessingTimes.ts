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
 * caption is absent the header row is a reliable signature. Every TABLE lookup
 * below is anchored on caption text or header text, never on table index, so
 * DOL adding or reordering a section does not silently shift the data we read.
 *
 * Cells within a located table ARE read by column position. There is no
 * per-cell header matching, so a reordered column inside an otherwise intact
 * table would be read wrongly. That risk is bounded by two things: the tables
 * are narrow and fixed-shape, and every value now has to parse as the type its
 * column implies (see requireMonthCell), so a swapped column shows up as a
 * throw rather than as a plausible wrong answer. Said explicitly because an
 * earlier version of this paragraph claimed every lookup was anchored, which
 * over-promised on exactly the read that is not.
 *
 * Failure policy: this parser THROWS when an expected section is missing or
 * unreadable. It must never return a half-empty snapshot, because a snapshot
 * that parsed to zero rows is indistinguishable from a month where the queue
 * genuinely did not move, and that would quietly corrupt the series. That
 * policy applies at CELL granularity too, not just per table: a value that is
 * neither a recognised no-data placeholder nor parseable throws, because the
 * unit that actually matters here is one cell in one row.
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

/**
 * Month name to number, including the abbreviations DOL might switch to.
 *
 * The full names are what the page uses today. The short forms are here
 * because the alternative is a silent null: "Sept 2025" is a real month, and
 * without an entry for it the cell parsed to null, which the rest of the
 * pipeline reads as "DOL published nothing". Note "sept" as well as "sep" —
 * both are in common US usage and only one of them is the three-letter form.
 */
const MONTHS: Record<string, string> = {
  january: "01", february: "02", march: "03", april: "04",
  may: "05", june: "06", july: "07", august: "08",
  september: "09", october: "10", november: "11", december: "12",
  jan: "01", feb: "02", mar: "03", apr: "04",
  jun: "06", jul: "07", aug: "08",
  sep: "09", sept: "09", oct: "10", nov: "11", dec: "12",
};

/**
 * Cell contents that mean "DOL published nothing here".
 *
 * This set is the entire difference between a missing value and a value we
 * failed to read. Anything outside it that does not parse is treated as a page
 * change and throws, rather than being flattened into the same null.
 */
const NO_DATA_CELLS = new Set([
  "", "-", "--", "---", "n/a", "n/a.", "na", "none", "not available", "tbd", "pending",
]);

/** True when a cell is one of DOL's explicit no-data placeholders. */
function isNoDataCell(raw: string): boolean {
  return NO_DATA_CELLS.has(raw.trim().toLowerCase());
}

/**
 * The entities DOL actually emits on this page.
 *
 * Decoded in ONE pass rather than by chained `.replace` calls. Chaining them
 * lets each replacement re-consume the previous one's output: decoding `&amp;`
 * to `&` before handling `&lt;` turns the literal text `&amp;lt;` into `<`,
 * which is a value DOL never published. One pass over one alternation cannot
 * double-unescape, because each match is consumed exactly once.
 */
const HTML_ENTITIES: Record<string, string> = {
  "&nbsp;": " ",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&amp;": "&",
};

/**
 * Patterns for the two elements whose CONTENT must never reach parsed text.
 *
 * Written as literals rather than built from a tag name, both because the tag
 * set is fixed and because a RegExp built from a variable is a ReDoS footgun
 * the linter is right to flag. Two details a naive pattern gets wrong:
 *
 *   - `<\/script>` does not match `</script >`. HTML permits whitespace before
 *     the closing bracket, so the tail must be `<\/script\s*>`.
 *   - `<script` without `\b` also matches `<scripting>`, a different element.
 */
const SCRIPT_BLOCK = /<script\b[^>]*>[\s\S]*?<\/script\s*>/gi;
const STYLE_BLOCK = /<style\b[^>]*>[\s\S]*?<\/style\s*>/gi;

/**
 * Remove every match of `pattern`, repeating until the output stops changing.
 *
 * The loop matters because one lazy pass matches the first opener to the first
 * closer, so nested blocks leave the outer closing tag behind.
 */
function stripBlocks(input: string, pattern: RegExp): string {
  let out = input;
  let previous: string;
  do {
    previous = out;
    out = out.replace(pattern, " ");
  } while (out !== previous);
  return out;
}

/** Drop script and style blocks, content included. */
function stripScriptAndStyle(input: string): string {
  return stripBlocks(stripBlocks(input, SCRIPT_BLOCK), STYLE_BLOCK);
}

/** Strip tags, decode the handful of entities DOL emits, collapse whitespace. */
export function textOf(fragment: string): string {
  let out = stripScriptAndStyle(fragment);

  // Also loop here: deleting a tag can bring two fragments together that then
  // read as a tag themselves (`<sc<script>ript>`).
  let previous: string;
  do {
    previous = out;
    out = out.replace(/<[^>]*>/g, " ");
  } while (out !== previous);

  return out
    .replace(/&(?:nbsp|lt|gt|quot|amp|#39);/gi, (m) => HTML_ENTITIES[m.toLowerCase()] ?? m)
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
 * "September 2025" to "2025-09". Returns null for anything that is not a
 * month-year.
 *
 * ANCHORED, and that is the point. The previous pattern had no `^`/`$`, so it
 * matched the first month-year anywhere in the cell: a cell reading
 * "As of May 2025 the queue is at September 2025" returned 2025-05. A wrong
 * month is worse than a missing one, because null is at least visible
 * downstream while a plausible wrong date is not. Every sibling regex in
 * src/lib/dolFormat.ts was already anchored; this one was the outlier.
 *
 * Accepts "September 2025", "Sept. 2025", "September, 2025" and "09/2025".
 */
export function parseMonthYear(input: string): string | null {
  const trimmed = input.trim();

  const numeric = /^(\d{1,2})\s*\/\s*(\d{4})$/.exec(trimmed);
  if (numeric) {
    const mo = Number(numeric[1]);
    return mo >= 1 && mo <= 12 ? `${numeric[2]}-${String(mo).padStart(2, "0")}` : null;
  }

  const m = /^([A-Za-z]+)\.?,?\s+(\d{4})$/.exec(trimmed);
  if (!m) return null;
  const mm = MONTHS[m[1]!.toLowerCase()];
  return mm ? `${m[2]}-${mm}` : null;
}

/**
 * Parse a month cell, distinguishing "DOL published nothing" from "we could
 * not read this".
 *
 * The module's failure policy says a page change must throw rather than
 * produce a half-empty snapshot, but that was only ever enforced at TABLE
 * granularity: a missing section threw, while an unreadable CELL quietly
 * became null. The load-bearing unit here is a cell — one null in the analyst
 * row stops every queue alert and blanks the public page — so the same policy
 * has to reach this far down.
 */
function requireMonthCell(raw: string, what: string): string | null {
  if (isNoDataCell(raw)) return null;
  const parsed = parseMonthYear(raw);
  if (parsed === null) {
    throw new DolParseError(
      `unreadable month in ${what}: ${JSON.stringify(raw)}. ` +
        "Either DOL changed its date format or this is a new placeholder.",
    );
  }
  return parsed;
}

/** Count cell, same no-data-versus-unreadable distinction as requireMonthCell. */
function requireCountCell(raw: string, what: string): number | null {
  if (isNoDataCell(raw)) return null;
  const parsed = parseCount(raw);
  if (parsed === null) {
    throw new DolParseError(`unreadable count in ${what}: ${JSON.stringify(raw)}`);
  }
  return parsed;
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
  // Same whitespace-tolerant, loop-until-stable removal `textOf` uses. Table
  // markup itself is kept, since this function's whole job is to read it.
  const withoutScripts = stripScriptAndStyle(htmlDoc);

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

/**
 * Find a table by caption, or throw naming the caption we looked for.
 *
 * The throw lives here rather than at each call site so the error message is
 * generated from the same needle the matcher used. Previously they were
 * written separately and had already drifted: one site searched for
 * "Average Number of Days to Process PERM" while its error announced
 * "...Process PERM Applications", which would have sent anyone debugging a DOL
 * change looking for the wrong string.
 */
function requireByCaption(tables: ParsedTable[], needle: string): ParsedTable {
  const lower = needle.toLowerCase();
  const found = tables.find((t) => t.caption.toLowerCase().includes(lower));
  if (!found) throw new DolParseError(`no table captioned "${needle}"`);
  return found;
}

/** Find a table by its header signature, or throw naming that signature. */
function requireByHeaders(
  tables: ParsedTable[],
  needles: string[],
  what: string,
): ParsedTable {
  const found = tables.find((t) => {
    const joined = t.headers.join(" | ").toLowerCase();
    return needles.every((n) => joined.includes(n.toLowerCase()));
  });
  if (!found) {
    throw new DolParseError(`no ${what} table (headers: ${needles.join(" / ")})`);
  }
  return found;
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
  const permTable = requireByCaption(tables, "PERM Processing Times");

  const permAsOf = parseUsDate(permTable.caption);
  if (!permAsOf) {
    throw new DolParseError(`no as-of date in PERM caption: "${permTable.caption}"`);
  }

  const permQueues: PermQueueRow[] = permTable.rows
    .filter((cells) => cells.length >= 2 && cells[0]!.length > 0)
    .map((cells) => ({
      queue: cells[0]!,
      priorityDate: requireMonthCell(cells[1]!, `PERM queue row "${cells[0]!}"`),
      raw: cells[1]!,
    }));

  if (permQueues.length === 0) {
    throw new DolParseError("PERM queue table parsed to zero rows");
  }

  // The Analyst Review row specifically, because it is the only value in this
  // whole document the product depends on: it is the frontier every queue
  // alert is compared against and the headline figure on the public page.
  // Checking that the TABLE has rows does not check that THIS row is in it, so
  // a DOL relabel used to sail through as a successful parse and a successful
  // store, and simply stopped every alert with no error anywhere. Whatever
  // else changes about this page, losing this row has to be loud.
  if (!permQueues.some((q) => /analyst review/i.test(q.queue))) {
    throw new DolParseError(
      "no Analyst Review row in the PERM queue table (found: " +
        permQueues.map((q) => q.queue).join(", ") +
        ")",
    );
  }

  // --- Average calendar days to a determination. ---
  const avgTable = requireByCaption(tables, "Average Number of Days to Process PERM");

  const permAverageDays: PermDeterminationRow[] = avgTable.rows
    .filter((cells) => cells.length >= 3 && cells[0]!.length > 0)
    .map((cells) => ({
      determination: cells[0]!,
      month: requireMonthCell(cells[1]!, `average-days row "${cells[0]!}"`),
      calendarDays: requireCountCell(cells[2]!, `average-days row "${cells[0]!}"`),
      raw: cells[2]!,
    }));

  if (permAverageDays.length === 0) {
    throw new DolParseError("PERM average-days table parsed to zero rows");
  }

  // --- Prevailing wage queue. No caption, so anchor on the header signature. ---
  const pwdTable = requireByHeaders(
    tables,
    ["Processing Queue", "OEWS Receipt Date"],
    "prevailing-wage queue",
  );

  const pwdQueues: PwdQueueRow[] = pwdTable.rows
    .filter((cells) => cells.length >= 3 && cells[0]!.length > 0)
    .map((cells) => ({
      program: cells[0]!,
      oewsReceiptDate: requireMonthCell(cells[1]!, `prevailing-wage row "${cells[0]!}" (OEWS)`),
      nonOewsReceiptDate: requireMonthCell(
        cells[2]!,
        `prevailing-wage row "${cells[0]!}" (non-OEWS)`,
      ),
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
  const backlogTable = requireByHeaders(
    tables,
    ["PERM", "Remaining Requests"],
    "PERM prevailing-wage backlog",
  );

  // Unlike the tables above this one drops rows it cannot read rather than
  // throwing. Its shape is open-ended (DOL appends a month per publication and
  // has carried summary rows), so a strict read here would fail the whole
  // ingestion over a "Total" line. It is also display-only: nothing downstream
  // makes a decision from it. Both of those stop being true if it ever feeds
  // an alert, in which case it should move to requireMonthCell like the rest.
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
    // `raw` is included deliberately. The docstring on `contentHash` claims it
    // "catches a silent DOL correction that reuses the same as-of date", and
    // without the raw wording that was only half true: DOL rewording a cell
    // without changing the parsed value produced an identical hash, the row was
    // not stored, and the page kept rendering the PREVIOUS wording as "exactly
    // what DOL printed". DOL keeps no archive, so that correction would have
    // been unrecoverable. `textOf` has already collapsed whitespace by this
    // point, so this reacts to real wording changes, not reflowed markup.
    snapshot.permQueues.map((q) => [q.queue, q.priorityDate, q.raw]),
    snapshot.permAverageDays.map((d) => [d.determination, d.month, d.calendarDays, d.raw]),
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

// `monthsBetween` used to live here. Deleted: it had zero callers anywhere,
// including its own test file, and computed exactly what `monthsMoved` in
// src/lib/dolFormat.ts already computes for the one place that needs it.

/** The DOL row whose priority date answers "has the queue reached me yet". */
const ANALYST_REVIEW = /analyst review/i;

/**
 * The queue row the whole product cares about.
 *
 * Takes the ARRAY rather than a whole snapshot, and that is the difference
 * between this being used and being decoration. Typed against the parsed
 * snapshot it did not accept a stored Convex document (whose `pwdAsOf` is
 * `string | undefined` rather than `string | null`), so every production call
 * site hand-rolled the regex instead and this was reachable only from tests.
 * Four copies of the single most load-bearing string in the feature.
 */
export function analystReviewQueue(
  queues: readonly PermQueueRow[],
): PermQueueRow | undefined {
  return queues.find((q) => ANALYST_REVIEW.test(q.queue));
}

/** The matching average-days row, if DOL reported one. */
export function analystReviewAverage(
  rows: readonly PermDeterminationRow[],
): PermDeterminationRow | undefined {
  return rows.find((d) => ANALYST_REVIEW.test(d.determination));
}

export { SOURCE_URL as DOL_PROCESSING_TIMES_URL };
