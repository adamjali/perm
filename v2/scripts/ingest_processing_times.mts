/**
 * Fetch DOL's processing-times page and store it in Turso.
 *
 * This used to run as a Convex cron + action. It moved for the same reason
 * the case corpus did: Convex's free tier was exceeded and the whole
 * deployment was disabled, so the cron stopped and the page went stale with
 * no signal. Turso holds the public data now.
 *
 * IT REUSES THE EXISTING PARSER RATHER THAN PORTING IT. convex/lib/
 * dolProcessingTimes.ts is 561 lines with its own test suite, and it has
 * already had at least one subtle defect fixed in it (an unanchored regex
 * that read "As of May 2025 ... September 2025" as 2025-05 - a plausible
 * WRONG date, which is worse than a null because null is visible downstream).
 * Rewriting it in Python would re-derive those traps from scratch. The module
 * has ZERO imports, so it runs unmodified under Node.
 *
 *   node --experimental-strip-types scripts/ingest_processing_times.mts
 */
import { createClient } from "@libsql/client";
import { readFileSync } from "node:fs";

import { parseProcessingTimes } from "../convex/lib/dolProcessingTimes.ts";

const SOURCE = "https://flag.dol.gov/processingtimes";

function env(name: string): string {
  const raw = readFileSync(".env.local", "utf8");
  for (const line of raw.split("\n")) {
    if (line.startsWith(name + "=")) return line.slice(name.length + 1).trim();
  }
  throw new Error(`${name} missing from .env.local`);
}

async function main() {
  console.log(`  fetching ${SOURCE}`);
  // RETRY, BECAUSE THIS RUNS UNATTENDED ONCE A DAY. Before this there was a
  // single fetch with no retry, and the workflow step is `continue-on-error`,
  // so one blip against flag.dol.gov lost the whole day AND said nothing.
  // DOL publishes evening maintenance windows, which is exactly the shape of
  // failure a short backoff rides out.
  let res: Response | undefined;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      // ASSIGN, do not redeclare. A `const res` here shadows the outer one,
      // leaves it undefined forever, and makes the guard below throw on every
      // run. TypeScript does not flag it - shadowing is legal - so
      // `pnpm typecheck` passed cleanly over exactly this bug.
      res = await fetch(SOURCE, {
        headers: {
          // flag.dol.gov serves scripts without ceremony; www.dol.gov does not.
          // Verified 2026-08-25 with cloudflare.com/discord.com as controls.
          "User-Agent": "permtracker.app ingest (+https://permtracker.app)",
          Accept: "text/html,application/xhtml+xml",
        },
      });
      if (res.ok) break;
      // 403/429/503 are worth another go. A 404 means the page moved, and
      // retrying only delays the real error.
      if (![403, 429, 503].includes(res.status) || attempt === 4) {
        throw new Error(`DOL returned ${res.status}`);
      }
      console.log(`  HTTP ${res.status} (attempt ${attempt}/4)`);
    } catch (err) {
      if (attempt === 4) throw err;
      console.log(`  ${String(err)} (attempt ${attempt}/4)`);
    }
    await new Promise((r) => setTimeout(r, 5000 * 3 ** (attempt - 1)));
  }
  if (!res?.ok) throw new Error("DOL unreachable after 4 attempts");

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

  const now = Date.now();
  // Keyed by DOL's own as-of date, so re-running on a day DOL has not
  // republished is idempotent and does not fabricate a history point.
  await db.execute({
    sql: "INSERT OR REPLACE INTO processing_times (perm_as_of, json, fetched_at) VALUES (?, ?, ?)",
    args: [snap.permAsOf, JSON.stringify(snap), now],
  });

  const n = await db.execute("SELECT count(*) AS n FROM processing_times");
  const rows = await db.execute(
    "SELECT perm_as_of FROM processing_times ORDER BY perm_as_of DESC LIMIT 5");
  console.log(`  stored. ${n.rows[0]!.n} snapshot(s) in history:`);
  for (const r of rows.rows) console.log(`    ${r.perm_as_of}`);
}

main().catch((e) => { console.error("FAILED:", e.message); process.exit(1); });
