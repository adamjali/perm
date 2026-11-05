/**
 * Which files each page renders from, shared by page_dates.mjs (the sitemap's
 * lastmod) and gsc_queue.mjs (what to ask Google to recrawl), so the two can't
 * disagree about what a change touches.
 *
 * "Renders from" is the page's own folder (files directly in it, tests left
 * out) plus what those files import from components, copy constants and the
 * page's own neighbours, two imports deep. Shared chrome (components/ui,
 * components/layout) is left out: a button restyle is not news about /faq.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

export const APP = "src/app";
const SOURCE = /\.(tsx?|mdx|json)$/;
const SKIP_FILE = /\.(test|spec|stories)\.|__tests__/;
const RESOLVE = ["", ".tsx", ".ts", ".mdx", ".json", "/index.tsx", "/index.ts"];
const DEPTH = 2;

/**
 * True when a page's source asks not to be indexed on every render: a plain
 * `robots: { index: false ... }`. One written inside a condition
 * (`...(FLAG ? {} : { robots: { index: false } })`, `cond ? { robots: ... } : {}`)
 * is indexable some of the time, and /perm-queue and its month pages are indexable
 * while their switch is on, so a conditional one doesn't count.
 */
const NOINDEX_LINE = /robots\s*:\s*\{[^}]*\bindex\s*:\s*false/;
export function alwaysNoindex(src) {
  return src.split("\n").some((line) => {
    const at = line.search(NOINDEX_LINE);
    if (at < 0) return false;
    const before = line.slice(0, at);
    return !/\.\.\.\s*\(|\?/.test(before);
  });
}

/**
 * True when `route` is a page of `family`: the same segments, a [param] standing for any one segment.
 * /perm-queue/2026-01 is in /perm-queue/[month] and not in /perm-queue/[month]/[day].
 */
export function inFamily(route, family) {
  const a = route.split("/");
  const b = family.split("/");
  return a.length === b.length && b.every((seg, i) => (seg.startsWith("[") ? a[i] !== "" : seg === a[i]));
}

export function git(args) {
  return execFileSync("git", args, { encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });
}

export function pageFiles(dir = APP) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) out.push(...pageFiles(p));
    else if (/^page\.(tsx|mdx)$/.test(name)) out.push(p);
  }
  return out;
}

export function routeOf(file) {
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

export function inputsOf(pageFile) {
  const pageDir = path.dirname(pageFile);
  const seen = new Set();
  let frontier = readdirSync(pageDir)
    .map((n) => path.join(pageDir, n))
    .filter((p) => statSync(p).isFile() && SOURCE.test(p) && !SKIP_FILE.test(p));
  frontier.forEach((f) => seen.add(f));
  for (let depth = 0; depth < DEPTH; depth++) {
    const next = [];
    for (let i = 0; i < frontier.length; i++) {
      const f = frontier[i];
      for (const m of readFileSync(f, "utf8").matchAll(IMPORT)) {
        const dep = resolve(m[1] || m[2] || m[3], f);
        if (dep && !seen.has(dep) && counts(dep, pageDir)) {
          seen.add(dep);
          // An index file only passes its folder's parts along, so it costs no level: what it re-exports is
          // walked as if imported here. The homepage reaches its sections through components/home/index.ts,
          // and at two levels the rating line two files further in was never seen (Oct 22 2026).
          if (isBarrel(dep)) frontier.push(dep);
          else next.push(dep);
        }
      }
    }
    frontier = next;
  }
  return [...seen];
}

function isBarrel(file) {
  return /(^|\/)index\.tsx?$/.test(file);
}
