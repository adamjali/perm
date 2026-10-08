#!/usr/bin/env node
/**
 * What to ask Google to recrawl after a change: the public pages a range of
 * commits touched, in the order the Search Console queue
 * (../.planning/gsc-index-priority.md) works them.
 *
 * Search Console takes about 11 indexing requests a day, so the queue spends
 * them where a stale copy costs most: a page that is new, then a page whose
 * own words changed, then one or two of the busiest pages of a changed family
 * (Google reaches the rest of a family through the sitemap, whose lastmod
 * moves on the same rule: scripts/lib_page_inputs.mjs decides for both what
 * a page renders from).
 *
 * The range starts, by default, at the last commit that touched the queue,
 * and ends at the working tree, so a run before or after the deploy's commit
 * gives the same list. Paste the output into the queue as a new
 * "Queue after the <date> deploy" section; the automatic round works the
 * newest section top down.
 *
 *   node scripts/gsc_queue.mjs                 # since the queue's last update
 *   node scripts/gsc_queue.mjs --since 043d1653
 *   node scripts/gsc_queue.mjs --since <before> --purge [--dry-run]   # drop Cloudflare's copies
 *   node scripts/gsc_queue.mjs --since <before> --warm-list           # what the deploy warms first
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { git, inputsOf, pageFiles, routeOf } from "./lib_page_inputs.mjs";

const LEDGER = "../.planning/gsc-index-priority.md";
const PUBLIC = `src${path.sep}app${path.sep}(site)${path.sep}(public)${path.sep}`;
const KNOWN = new Set(JSON.parse(readFileSync("scripts/known-routes.json", "utf8")));
// Article families render from content/<type>/<slug>.mdx, which no import reaches.
const CONTENT = /^content\/(blog|guides|changelog)\/([^/]+)\.mdx$/;

/** A real page of each family to request first; Google finds the rest through the sitemap. */
const SAMPLE = {
  "/perm-wages/[slug]": ["/perm-wages/software-developers"],
  "/perm-cities/[slug]": ["/perm-cities/new-york-ny"],
  "/perm-employers/[slug]": ["/perm-employers/google-llc"],
  "/perm-attorneys/[slug]": ["/perm-attorneys/fragomen-del-rey-bernsen-loewy-llp"],
  "/visa-bulletin/categories/[line]": ["/visa-bulletin/categories/eb2-india", "/visa-bulletin/categories/eb3-india"],
  "/perm-industries/[slug]": ["/perm-industries/541511"],
  "/perm-countries/[slug]": ["/perm-countries/india"],
};

function arg(name) {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : null;
}

const since = arg("--since") || git(["log", "-1", "--format=%h", "--", LEDGER]).trim();
if (!since) {
  console.error("no --since and no commit has touched the queue");
  process.exit(2);
}
const sinceDay = git(["log", "-1", "--format=%cs", since]).trim();
// A purge compares commits only: in CI the build step has already rewritten
// tracked files (page_dates.mjs writes src/lib/sitemap/page-dates.json), and
// those are not changes the push made.
const PURGE = process.argv.includes("--purge");
// --warm-list reads the same commit range as --purge, so the deploy warms
// first exactly the pages it then tells Cloudflare to forget.
const WARM = process.argv.includes("--warm-list");
const COMMITS_ONLY = PURGE || WARM;
const range = COMMITS_ONLY ? [since, "HEAD"] : [since];
const diff = (filter) =>
  git(["diff", "--name-only", "--relative", `--diff-filter=${filter}`, ...range, "--", "src", "content"])
    .split("\n")
    .filter(Boolean);
// Untracked files are new too: a run before the commit should list them.
const untracked = COMMITS_ONLY
  ? []
  : git(["ls-files", "--others", "--exclude-standard", "--", "src", "content"]).split("\n").filter(Boolean);
const changed = new Set([...diff("ACMR"), ...untracked]);
const added = new Set([...diff("A"), ...untracked]);

// A file that feeds many pages is site-wide polish (a source line that now
// wraps feeds about 60), not news about each page: the sitemap's lastmod
// carries it, and the queue's ~11 requests a day go to pages that changed
// their own words.
const SHARED_MIN = 15;
const pages = pageFiles().filter((f) => f.startsWith(PUBLIC)).map((f) => ({ file: f, route: routeOf(f), inputs: inputsOf(f) }));
const reach = new Map();
for (const pg of pages) for (const f of pg.inputs) reach.set(f, (reach.get(f) ?? 0) + 1);
const shared = [...changed].filter((f) => (reach.get(f) ?? 0) > SHARED_MIN);

const fresh = [];
const edited = [];
const families = [];
for (const { file, route, inputs } of pages) {
  const isNew = added.has(file);
  const touched = isNew || inputs.some((f) => changed.has(f) && (reach.get(f) ?? 0) <= SHARED_MIN);
  if (!touched) continue;
  if (route.includes("[")) families.push(route);
  else if (route !== "/" && !KNOWN.has(route)) console.error(`note: ${route} changed but isn't in scripts/known-routes.json (not public, or not registered)`);
  else (isNew ? fresh : edited).push(route);
}
for (const file of changed) {
  const m = CONTENT.exec(file);
  if (!m) continue;
  const route = `/${m[1]}/${m[2]}`;
  if (!KNOWN.has(route)) continue;
  (added.has(file) ? fresh : edited).push(route);
}

// --warm-list: one line per page the push changed ("page <path>") and per
// changed family ("prefix <path>/", every page under it). The deploy writes it
// into the release, and the server's warm-up renders these before the rest:
// Cloudflare drops its copies of exactly these pages after the switch, so
// their next visitors are the ones who reach the server (permtracker-deploy).
if (WARM) {
  const lines = [
    ...[...new Set([...fresh, ...edited])].map((r) => `page ${r}`),
    ...[...new Set(families)].map((f) => `prefix ${f.slice(0, f.indexOf("["))}`),
  ];
  if (lines.length) console.log(lines.join("\n"));
  process.exit(0);
}

// --purge: ask Cloudflare to drop its stored copies of the same pages, so the
// fix a deploy shipped is what visitors and Google's crawler read now, not in
// up to a day (pages carry s-maxage=86400 and Cloudflare serves the stored copy
// until then; measured Oct 5 2026, when a deployed fix stayed invisible). A
// family goes by prefix (one request covers every employer page), the homepage
// by its exact URL, since its prefix would be the whole site. Needs
// CF_PURGE_TOKEN (Zone > Cache Purge only) and CF_ZONE_ID; without them it says
// so and exits 0, so a deploy never fails on it.
if (PURGE) {
  const host = "permtracker.app";
  const statics = [...new Set([...fresh, ...edited])];
  const files = statics.includes("/") ? [`https://${host}/`] : [];
  const prefixes = [
    ...statics.filter((r) => r !== "/").map((r) => `${host}${r}`),
    ...[...new Set(families)].map((f) => `${host}${f.slice(0, f.indexOf("["))}`),
  ];
  const dry = process.argv.includes("--dry-run");
  const token = process.env.CF_PURGE_TOKEN;
  const zone = process.env.CF_ZONE_ID;
  console.log(`purge: ${files.length} URL(s), ${prefixes.length} prefix(es) since ${since}`);
  for (const x of [...files, ...prefixes]) console.log(`  ${x}`);
  if (dry || (!files.length && !prefixes.length)) process.exit(0);
  if (!token || !zone) {
    console.log("::notice::CF_PURGE_TOKEN or CF_ZONE_ID not set: Cloudflare keeps its copies until they expire (up to a day)");
    process.exit(0);
  }
  const send = async (body) => {
    const res = await fetch(`https://api.cloudflare.com/client/v4/zones/${zone}/purge_cache`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const j = await res.json().catch(() => ({}));
    if (!j.success) console.log(`::warning::purge refused (${res.status}): ${JSON.stringify(j.errors ?? []).slice(0, 200)}`);
    return j.success === true;
  };
  let ok = true;
  if (files.length) ok = (await send({ files })) && ok;
  // Free plan: 100 prefixes a request, 5 prefix requests a minute (Cloudflare's
  // purge limits page). Page click data (?_rsc=) is never stored at the edge
  // (cf-cache-status: BYPASS), so the HTML copies are all there is to drop.
  for (let i = 0; i < prefixes.length; i += 100) {
    if (i) await new Promise((r) => setTimeout(r, 13_000));
    ok = (await send({ prefixes: prefixes.slice(i, i + 100) })) && ok;
  }
  console.log(ok ? "purge: done" : "purge: not done in full (warned above)");
  process.exit(0);
}

// Shallow pages first: hubs and tools carry more searches than the pages under them.
const order = (a, b) => a.split("/").length - b.split("/").length || a.localeCompare(b);
const uniq = (xs) => [...new Set(xs)].sort(order);
let n = 0;
const out = [`Generated by \`node scripts/gsc_queue.mjs --since ${since}\` (changes since ${sinceDay}).`, ""];
if (fresh.length) {
  out.push("New pages (request):");
  for (const r of uniq(fresh)) out.push(`${++n}. \`${r}\``);
  out.push("");
}
if (edited.length) {
  out.push(`Changed pages (inspect; request any last crawled before ${sinceDay}):`);
  for (const r of uniq(edited)) out.push(`${++n}. \`${r}\``);
  out.push("");
}
if (families.length) {
  out.push("Changed page families (request the sample; the sitemap's lastmod carries the rest):");
  for (const f of uniq(families)) {
    const s = SAMPLE[f];
    out.push(s ? `${++n}. \`${f}\`: ${s.map((x) => `\`${x}\``).join(", ")}` : `- \`${f}\` (no sample set; the sitemap carries it)`);
  }
  out.push("");
}
if (shared.length) {
  out.push(`Site-wide changes, left to the sitemap's lastmod: ${shared.map((f) => `\`${path.basename(f)}\` (${reach.get(f)} pages)`).join(", ")}.`);
  out.push("");
}
if (!n) out.push("No public page changed its own content: nothing to request.");
console.log(out.join("\n"));
