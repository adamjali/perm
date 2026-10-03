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
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";

const OUT = "src/lib/sitemap/page-dates.json";
const APP = "src/app";
const SOURCE = /\.(tsx?|mdx|json)$/;
const SKIP_FILE = /\.(test|spec|stories)\.|__tests__/;
const RESOLVE = ["", ".tsx", ".ts", ".mdx", ".json", "/index.tsx", "/index.ts"];
const DEPTH = 2;

function git(args) {
  return execFileSync("git", args, { encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });
}

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

function pageFiles(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) out.push(...pageFiles(p));
    else if (/^page\.(tsx|mdx)$/.test(name)) out.push(p);
  }
  return out;
}

function routeOf(file) {
  const segs = path.dirname(path.relative(APP, file)).split(path.sep).filter((s) => s && s !== ".");
  const kept = segs.filter((s) => !s.startsWith("(") && !s.startsWith("@"));
  return "/" + kept.join("/");
}

function resolve(spec, from) {
  let base;
  if (spec.startsWith("@/")) base = path.join("src", spec.slice(2));
  else if (spec.startsWith(".")) base = path.join(path.dirname(from), spec);
  else return null;
  for (const ext of RESOLVE) {
    const p = base + ext;
    if (existsSync(p) && statSync(p).isFile()) return path.normalize(p);
  }
  return null;
}

const IMPORT = /(?:import|export)\s[^'";]*?from\s*["']([^"']+)["']|import\s*\(\s*["']([^"']+)["']\s*\)|import\s+["']([^"']+)["']/g;

function counts(file, pageDir) {
  if (SKIP_FILE.test(file)) return false;
  if (file.startsWith(pageDir + path.sep)) return true;
  if (file.startsWith("src/components/ui/") || file.startsWith("src/components/layout/")) return false;
  return file.startsWith("src/components/") || file.startsWith("src/lib/constants/") || file.startsWith(APP + "/");
}

function inputsOf(pageFile) {
  const pageDir = path.dirname(pageFile);
  const seen = new Set();
  let frontier = readdirSync(pageDir)
    .map((n) => path.join(pageDir, n))
    .filter((p) => statSync(p).isFile() && SOURCE.test(p) && !SKIP_FILE.test(p));
  frontier.forEach((f) => seen.add(f));
  for (let depth = 0; depth < DEPTH; depth++) {
    const next = [];
    for (const f of frontier) {
      for (const m of readFileSync(f, "utf8").matchAll(IMPORT)) {
        const dep = resolve(m[1] || m[2] || m[3], f);
        if (dep && !seen.has(dep) && counts(dep, pageDir)) {
          seen.add(dep);
          next.push(dep);
        }
      }
    }
    frontier = next;
  }
  return [...seen];
}

const dates = {};
for (const file of pageFiles(APP)) {
  const known = inputsOf(file).map((f) => lastChange.get(f)).filter(Boolean);
  if (known.length) dates[routeOf(file)] = known.sort().at(-1);
}
const sorted = Object.fromEntries(Object.entries(dates).sort(([a], [b]) => a.localeCompare(b)));
writeFileSync(OUT, JSON.stringify(sorted, null, 2) + "\n");
console.log(`${OUT}: ${Object.keys(sorted).length} pages dated`);
