import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Every RELATIVE url inside a Convex-rendered page has a rewrite behind it.
 *
 * Convex serves the preferences page as HTML, and its buttons are a relative
 * `<form method="POST" action="/prefs/update?token=...">`. A relative action
 * resolves against the host the page was served FROM. So the moment those
 * links were branded onto permtracker.app, the form's target moved with them -
 * and only `/prefs` had a rewrite, so the POST fell through to Next and
 * answered a 404.
 *
 * That is the whole failure: the user clicked "turn off", saw our DEAD END
 * page, and nothing was turned off, because the request never reached Convex.
 * The 404 was OUR page rather than Convex's "Invalid or expired preferences
 * link", which is how it was identified from the screenshot alone.
 *
 * Rewriting a server-rendered page's URL is therefore never a one-line change:
 * it moves the base for every relative URL on that page. This gate is that
 * rule, checked mechanically.
 *
 * Routes reached by a client `fetch` are deliberately NOT in scope - those
 * build an absolute `.convex.site` URL and never touch our domain - and
 * neither is `/resend-inbound`, which is Resend's webhook and must not depend
 * on our domain or pass our firewall.
 */
const ROOT = join(__dirname, "..", "..", "..");
const http = readFileSync(join(ROOT, "convex", "http.ts"), "utf8");
const config = readFileSync(join(ROOT, "next.config.ts"), "utf8");

/** Paths a Convex-rendered page links to relatively, so the browser resolves them against OUR host. */
function relativeTargets(): string[] {
  const found = [...http.matchAll(/(?:action|href)="(\/[^"?${]*)/g)].map((m) => m[1]!);
  return [...new Set(found)];
}

/** The rewrite sources in the emailLinkRewrites block. */
function rewriteSources(): string[] {
  const i = config.indexOf("emailLinkRewrites");
  const block = config.slice(i, config.indexOf("];", i));
  return [...block.matchAll(/\{ source: "([^"]+)", destination/g)].map((m) => m[1]!);
}

function isCovered(path: string, sources: string[]): boolean {
  return sources.some((s) =>
    s.endsWith("/:path*")
      ? path === s.slice(0, -7) || path.startsWith(`${s.slice(0, -7)}/`)
      : path === s,
  );
}

describe("Convex-rendered relative URLs", () => {
  it("finds the relative targets it is meant to check (control)", () => {
    const targets = relativeTargets();
    // If this ever reads zero, the regex broke and every assertion below is vacuous.
    expect(targets.length).toBeGreaterThan(0);
    expect(targets).toContain("/prefs/update");
  });

  it("has a rewrite for every one of them", () => {
    const sources = rewriteSources();
    expect(sources.length).toBeGreaterThan(3);
    const uncovered = relativeTargets().filter((p) => !isCovered(p, sources));
    expect(uncovered, "a relative link with no rewrite 404s on permtracker.app").toEqual([]);
  });

  it("keeps the page and its sub-paths together", () => {
    // The specific shape that broke: the page rewritten, its form target not.
    const sources = rewriteSources();
    expect(isCovered("/prefs", sources)).toBe(true);
    expect(isCovered("/prefs/update", sources)).toBe(true);
  });

  it("does not put Resend's inbound webhook on our domain", () => {
    // It is called by Resend, configured with the .convex.site URL. Routing it
    // through permtracker.app would make a third party's webhook depend on our
    // domain and our firewall rules.
    expect(isCovered("/resend-inbound", rewriteSources())).toBe(false);
  });
});
