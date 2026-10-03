/**
 * Fetch DOL's processing-times page and store it in the database.
 *
 * It reuses the app's parser (convex/lib/dolProcessingTimes.ts, with its own
 * test suite) rather than porting it: that module has no imports, so it runs
 * unmodified under Node, and a second copy in Python would have to re-learn
 * every trap the first one already fixed.
 *
 *   node --experimental-strip-types scripts/ingest_processing_times.mts
 */
import { createClient } from "@libsql/client";
import { appendFileSync, existsSync, readFileSync } from "node:fs";

import { parseProcessingTimes } from "../convex/lib/dolProcessingTimes.ts";

const SOURCE = "https://flag.dol.gov/processingtimes";
const FETCH_ATTEMPTS = 4;
const RETRY_BASE_MS = 5000;
// Statuses worth another attempt. A 404 means the page moved, and retrying
// only delays the real error.
const RETRYABLE_STATUS = [403, 429, 503];
// DOL republishes roughly weekly with gaps of up to a week, so ten days is
// longer than any observed gap and still short enough to catch this job dying.
const FRESHNESS_MAX_AGE_DAYS = 10;

/** The environment first, then `.env.local`: the same rule as lib_turso.env(). */
function env(name: string): string {
  const value = process.env[name];
  if (value) return value;
  const raw = existsSync(".env.local") ? readFileSync(".env.local", "utf8") : "";
  for (const line of raw.split("\n")) {
    if (line.startsWith(name + "=")) return line.slice(name.length + 1).trim();
  }
  throw new Error(`${name} is not set in the environment or .env.local`);
}

async function main() {
  console.log(`  fetching ${SOURCE}`);
  // Retried with backoff: this runs unattended once a day, and DOL's evening
  // maintenance windows are exactly the kind of blip a short backoff rides out.
  let res: Response | undefined;
  for (let attempt = 1; attempt <= FETCH_ATTEMPTS; attempt++) {
    try {
      // Assign, don't redeclare: a `const res` here would shadow the outer
      // one, and TypeScript allows the shadow without a warning.
      res = await fetch(SOURCE, {
        headers: {
          // flag.dol.gov serves scripts without a browser header set.
          "User-Agent": "permtracker.app ingest (+https://permtracker.app)",
          Accept: "text/html,application/xhtml+xml",
        },
      });
      if (res.ok) break;
      if (!RETRYABLE_STATUS.includes(res.status) || attempt === FETCH_ATTEMPTS) {
        throw new Error(`DOL returned ${res.status}`);
      }
      console.log(`  HTTP ${res.status} (attempt ${attempt}/${FETCH_ATTEMPTS})`);
    } catch (err) {
      if (attempt === FETCH_ATTEMPTS) throw err;
      console.log(`  ${String(err)} (attempt ${attempt}/${FETCH_ATTEMPTS})`);
    }
    await new Promise((r) => setTimeout(r, RETRY_BASE_MS * 3 ** (attempt - 1)));
  }
  if (!res?.ok) throw new Error(`DOL unreachable after ${FETCH_ATTEMPTS} attempts`);

  const html = await res.text();
  console.log(`  ${html.length.toLocaleString()} bytes`);

  // Throws DolParseError on a shape it does not recognise. That is the point:
  // a silent fallback here would publish a stale or empty queue as current.
  const snap = parseProcessingTimes(html);
  console.log(`  permAsOf ${snap.permAsOf}  pwdAsOf ${snap.pwdAsOf ?? "-"}`);
  console.log(`  permQueues ${snap.permQueues.length}  ` +
    `permAverageDays ${snap.permAverageDays.length}  ` +
    `pwdQueues ${snap.pwdQueues.length}  pwdPermBacklog ${snap.pwdPermBacklog.length}`);

  const db = createClient({
    url: env("TURSO_DATABASE_URL"),
    authToken: env("TURSO_AUTH_TOKEN"),
  });

  await db.execute(`CREATE TABLE IF NOT EXISTS processing_times (
      perm_as_of TEXT PRIMARY KEY,
      json       TEXT NOT NULL,
      fetched_at INTEGER NOT NULL
    )`);

  // Did DOL actually republish? Asked BEFORE the write, because the write
  // destroys the answer: the table is keyed by DOL's own as-of, so after an
  // INSERT OR REPLACE a new publication and a re-read look the same.
  //
  // The workflow expires the public pages only when this is true. DOL moves
  // roughly weekly, so expiring on every run would re-render those pages on
  // the days nothing changed.
  //
  // DOL can move its prevailing wage figures without moving the PERM date (Sep
  // 30 2026), and the row is keyed by the PERM date, so "a new key" alone
  // missed those days and the pages waited up to two days. Any change to the
  // stored snapshot counts.
  const existing = await db.execute({
    sql: "SELECT json FROM processing_times WHERE perm_as_of = ? LIMIT 1",
    args: [snap.permAsOf],
  });
  const isNewAsOf = existing.rows.length === 0;
  const figuresMoved = !isNewAsOf && String(existing.rows[0]!.json) !== JSON.stringify(snap);
  const dolChanged = isNewAsOf || figuresMoved;

  const now = Date.now();
  // Keyed by DOL's own as-of date, so re-running on a day DOL has not
  // republished is idempotent and does not fabricate a history point.
  await db.execute({
    sql: "INSERT OR REPLACE INTO processing_times (perm_as_of, json, fetched_at) VALUES (?, ?, ?)",
    args: [snap.permAsOf, JSON.stringify(snap), now],
  });

  // Stamp the freshness row the health check reads, as every Python ingest
  // does, so a dataset this job keeps current never reads as stale.
  await db.execute(`CREATE TABLE IF NOT EXISTS data_freshness (
      dataset TEXT PRIMARY KEY, as_of TEXT, fetched_at INTEGER,
      source TEXT, cadence TEXT, note TEXT, max_age_days INTEGER)`);
  await db.execute({
    sql: "INSERT OR REPLACE INTO data_freshness VALUES (?,?,?,?,?,?,?)",
    args: [
      "processing-times",
      snap.permAsOf,
      now,
      "DOL FLAG (flag.dol.gov/processingtimes)",
      "Daily",
      "DOL's own as-of date",
      FRESHNESS_MAX_AGE_DAYS,
    ],
  });

  const n = await db.execute("SELECT count(*) AS n FROM processing_times");
  const rows = await db.execute(
    "SELECT perm_as_of FROM processing_times ORDER BY perm_as_of DESC LIMIT 5");
  console.log(`  stored. ${n.rows[0]!.n} snapshot(s) in history:`);
  for (const r of rows.rows) console.log(`    ${r.perm_as_of}`);
  console.log(`  freshness stamped: as_of ${snap.permAsOf}`);
  console.log(
    `  DOL as-of ${snap.permAsOf} is ${
      isNewAsOf
        ? "NEW (revalidation will fire)"
        : figuresMoved
          ? `unchanged, but other figures moved (wage as-of ${snap.pwdAsOf ?? "-"}; revalidation will fire)`
          : "unchanged, figures identical (no revalidation)"
    }`,
  );

  // Hand the decision to the workflow. Written only under GITHUB_OUTPUT so a
  // local run is unaffected, and appended rather than truncated because the
  // file is shared with every other step in the job.
  const ghOut = process.env.GITHUB_OUTPUT;
  if (ghOut) {
    appendFileSync(ghOut, `dol_changed=${dolChanged}\nperm_as_of=${snap.permAsOf}\n`);
  }
}

main().catch((e) => { console.error("FAILED:", e.message); process.exit(1); });
