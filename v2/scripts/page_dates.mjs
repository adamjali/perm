#!/usr/bin/env node
/**
 * Writes src/lib/sitemap/page-dates.json: for every page in the app, the last
 * date (the commit's own day, YYYY-MM-DD) anything the page renders from
 * changed in git. The sitemap reads it for each page's lastmod.
 *
 * Why: those dates were typed by hand, 88 of them, and nobody retyped them.
 * /terms said June 15 after it changed on Oct 2. Google uses lastmod only when
 * it is "consistently and verifiably accurate", so a date that never moves
 * teaches it to ignore every date we send.
 *
 * "Renders from" is the page's own folder (files directly in it, tests left
 * out) plus what those files import from components, copy constants and the
 * page's own neighbours, two imports deep. Shared chrome (components/ui,
 * components/layout) is left out: a button restyle is not news about /faq.
 * Data is not here at all; pages that print live figures also take DOL's
 * as-of date in the sitemap, whichever is newer.
 *
 * Needs the history. The deploy checks out with fetch-depth 0; in a shallow
 * clone every page would look changed on the newest commit's day, so this
 * leaves the committed file alone and says so instead.
 *
 *   node scripts/page_dates.mjs           # run from v2/
 */
import { writeFileSync } from "node:fs";

import { APP, git, inputsOf, pageFiles, routeOf } from "./lib_page_inputs.mjs";

const OUT = "src/lib/sitemap/page-dates.json";

if (git(["rev-parse", "--is-shallow-repository"]).trim() === "true") {
  console.log(`::warning::shallow clone: ${OUT} left as committed (fetch with depth 0 to refresh it)`);
  process.exit(0);
}

// Newest change per file, from one pass over the history (newest first).
const lastChange = new Map();
let day = null;
for (const line of git(["log", "--format=%x00%cs", "--name-only", "--no-renames", "--relative", "--", "src"]).split("\n")) {
  if (line.startsWith("\0")) day = line.slice(1);
  else if (line && day && !lastChange.has(line)) lastChange.set(line, day);
}

const dates = {};
for (const file of pageFiles(APP)) {
  const known = inputsOf(file).map((f) => lastChange.get(f)).filter(Boolean);
  if (known.length) dates[routeOf(file)] = known.sort().at(-1);
}
const sorted = Object.fromEntries(Object.entries(dates).sort(([a], [b]) => a.localeCompare(b)));
writeFileSync(OUT, JSON.stringify(sorted, null, 2) + "\n");
console.log(`${OUT}: ${Object.keys(sorted).length} pages dated`);
