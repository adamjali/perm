import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Every Convex HTTP route something points at exists.
 *
 * On Oct 23 2026 a commit adding two review routes wrote them over the
 * visa-bulletin alert block in `convex/http.ts`. Nothing failed: the form still
 * posted to `/bulletin-alert/subscribe`, every email still carried confirm and
 * unsubscribe links, and all of them answered 404 until the routes came back.
 * The typecheck can't see it (a path is a string) and no test called them.
 *
 * So this reads the router's registrations and checks four kinds of pointer
 * against them:
 *   - an emailed link (`actionUrl("/path", ...)` in convex/) needs a GET, and an
 *     unsubscribe link a POST too (mail clients post one-click unsubscribes);
 *   - a button inside a Convex-rendered page (`post: \`/path?token=...\``) needs a POST;
 *   - a form's endpoint (`convexSiteUrl("/path")` in src/) needs a route, and a
 *     POST there needs an OPTIONS, because a JSON post from the site preflights;
 *   - every Convex rewrite family in next.config.ts needs at least one route,
 *     and nginx's relay must carry every emailed link straight to Convex.
 *
 * A false red is safe here (it names the pointer); a vacuous green isn't, so it
 * counts what it read before judging.
 */
const ROOT = join(__dirname, "..", "..", "..");
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(join(ROOT, dir))) {
    const rel = join(dir, name);
    if (name === "node_modules" || name === "_generated" || name === "__tests__") continue;
    if (statSync(join(ROOT, rel)).isDirectory()) walk(rel, out);
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(rel);
  }
  return out;
}

/** String constants a route may name instead of a literal (`path: RATING_PATH`). */
function constants(): Map<string, string> {
  const found = new Map<string, string>();
  for (const file of walk("convex")) {
    for (const m of read(file).matchAll(/export const ([A-Z_]+) = "(\/[^"]*)"/g)) found.set(m[1]!, m[2]!);
  }
  return found;
}

/** Every `METHOD path` the router registers, literal, constant or from a `for (const path of [...])` list. */
function registeredRoutes(): Set<string> {
  const src = read("convex/http.ts");
  const named = constants();
  const routes = new Set<string>();
  const blocks = [...src.matchAll(/http\.route\(\{([\s\S]*?)handler:/g)];
  for (const block of blocks) {
    const body = block[1]!;
    const method = /method:\s*"([A-Z]+)"/.exec(body)?.[1];
    if (!method) continue;
    const literal = /path:\s*"(\/[^"]*)"/.exec(body)?.[1];
    const constant = /path:\s*([A-Z_]+)\s*,/.exec(body)?.[1];
    let paths: string[] = [];
    if (literal) paths = [literal];
    else if (constant && named.has(constant)) paths = [named.get(constant)!];
    else if (/\bpath,/.test(body)) {
      // Shorthand inside a loop: the nearest `for (const path of [...])` above this block.
      const before = src.slice(0, block.index);
      const loop = [...before.matchAll(/for \(const path of \[([^\]]*)\]\)/g)].pop();
      paths = loop ? [...loop[1]!.matchAll(/"(\/[^"]*)"/g)].map((m) => m[1]!) : [];
    }
    for (const p of paths) routes.add(`${method} ${p}`);
  }
  return routes;
}

const ROUTES = registeredRoutes();
const has = (method: string, path: string) => ROUTES.has(`${method} ${path}`);
const anyMethod = (path: string) => ["GET", "POST", "OPTIONS"].some((m) => has(m, path));

type Pointer = { path: string; file: string };

function pointers(dir: string, pattern: RegExp): Pointer[] {
  const out: Pointer[] = [];
  for (const file of walk(dir)) {
    for (const m of read(file).matchAll(pattern)) out.push({ path: m[1]!, file: relative(ROOT, join(ROOT, file)) });
  }
  return out;
}

/** Emailed links: `actionUrl("/path", token)`. */
const emailed = pointers("convex", /actionUrl\("(\/[^"?]+)"/g).filter((p) => !p.file.endsWith("lib/links.ts"));
/** Buttons on Convex-rendered pages: `post: \`/path?token=...\`` or a form's `action="/path?..."`. */
const buttons = [
  ...pointers("convex", /post:\s*`(\/[^?`$]+)/g),
  ...pointers("convex", /\baction="(\/[^"?$]+)/g),
];
/** Form endpoints: `convexSiteUrl("/path")` or a template up to its query string. */
const forms = pointers("src", /convexSiteUrl\(["`](\/[^"`?$]+)/g).filter((p) => !p.file.endsWith("lib/convexSite.ts"));

function rewriteFamilies(): string[] {
  const config = read("next.config.ts");
  const i = config.indexOf("emailLinkRewrites");
  const block = config.slice(i, config.indexOf("];", i));
  return [...block.matchAll(/\{ source: "([^"]+)", destination/g)].map((m) => m[1]!);
}

/** nginx's relay location for email links, as a JavaScript regex. */
function nginxRelay(): RegExp {
  const conf = read("scripts/oracle/nginx/permtracker.conf");
  const m = /location ~ (\^\/\(prefs[^ ]*\$) \{/.exec(conf);
  if (!m) throw new Error("nginx's email-link relay location wasn't found");
  return new RegExp(m[1]!);
}

const describeMissing = (list: Pointer[]) => list.map((p) => `${p.path} (${p.file})`);

describe("Convex HTTP routes that something points at", () => {
  it("reads enough of each kind to judge (control)", () => {
    expect(ROUTES.size).toBeGreaterThanOrEqual(30);
    expect(emailed.length).toBeGreaterThanOrEqual(10);
    expect(buttons.length).toBeGreaterThanOrEqual(5);
    expect(forms.length).toBeGreaterThanOrEqual(10);
    // The three shapes the router uses, each read at least once.
    expect(has("POST", "/bulletin-alert/subscribe") || has("POST", "/case-alert/subscribe")).toBe(true);
    expect(has("OPTIONS", "/timeline/save")).toBe(true); // registered in a loop
    expect(has("GET", "/case-alert/rate")).toBe(true); // registered by a constant
  });

  it("has a GET for every emailed link, and a POST for every unsubscribe link", () => {
    const missing = emailed.filter((p) => !has("GET", p.path) || (p.path.endsWith("/unsubscribe") && !has("POST", p.path)));
    expect(describeMissing(missing), "an emailed link with no route answers 404 in someone's inbox").toEqual([]);
  });

  it("has a POST for every button on a Convex-rendered page", () => {
    const missing = buttons.filter((p) => !has("POST", p.path));
    expect(describeMissing(missing)).toEqual([]);
  });

  it("has a route for every form endpoint, and an OPTIONS beside every POST", () => {
    const missing = forms.filter((p) => !anyMethod(p.path) || (has("POST", p.path) && !has("OPTIONS", p.path)));
    expect(describeMissing(missing), "a form posting to a missing route fails for every visitor").toEqual([]);
  });

  it("has at least one route under every Convex rewrite family", () => {
    const paths = [...ROUTES].map((r) => r.split(" ")[1]!);
    const families = rewriteFamilies();
    expect(families.length).toBeGreaterThan(3);
    const empty = families.filter((s) => {
      const base = s.endsWith("/:path*") ? s.slice(0, -7) : s;
      return !paths.some((p) => p === base || p.startsWith(`${base}/`));
    });
    expect(empty).toEqual([]);
  });

  it("relays every emailed link through nginx straight to Convex", () => {
    const relay = nginxRelay();
    const missed = emailed.filter((p) => !relay.test(p.path));
    expect(describeMissing(missed)).toEqual([]);
  });
});
