import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Every route group that renders must have an error boundary above it.
 *
 * This exists because the public tree had none. Authenticated routes each had
 * one; the public data pages - the ones that read an external database on
 * every regeneration and throw rather than degrade - fell through to
 * `global-error.tsx`, which replaces the entire document and takes the header
 * and nav with it. The harshest fallback was covering the likeliest failure.
 */

const APP = join(process.cwd(), "src", "app");

/** Route groups that own a section of the site and so need their own catch. */
const REQUIRED_BOUNDARIES = [
  join(APP, "(site)", "(public)", "error.tsx"),
  join(APP, "(site)", "(auth)", "error.tsx"),
  join(APP, "(authenticated)", "error.tsx"),
  join(APP, "global-error.tsx"),
  join(APP, "not-found.tsx"),
];

describe("route error boundaries", () => {
  it("scanned a plausible app tree", () => {
    // A test that cannot see its subject reports a clean pass, so prove the
    // directory is really there and really populated before asserting on it.
    expect(existsSync(APP)).toBe(true);
    expect(readdirSync(APP).length).toBeGreaterThan(5);
  });

  it.each(REQUIRED_BOUNDARIES)("%s exists", (path) => {
    expect(existsSync(path)).toBe(true);
  });

  it("every error boundary is a client component", () => {
    // An error.tsx without "use client" fails at build time in a way that
    // only shows up on a clean build, which is the worst time to find it.
    for (const path of REQUIRED_BOUNDARIES) {
      if (path.endsWith("not-found.tsx")) continue; // may be a server component
      const src = readFileSync(path, "utf8");
      expect(src.slice(0, 40)).toContain("use client");
    }
  });

  it("the public boundary points at the primary federal sources", () => {
    // The whole reason this boundary differs from the others: when our copy
    // of a public dataset is unreachable, the dataset itself is not. Sending
    // people to the agency is more useful than a retry button on a broken
    // query, and it is the honest posture for a convenience layer.
    const src = readFileSync(
      join(APP, "(site)", "(public)", "error.tsx"),
      "utf8",
    );
    expect(src).toContain("flag.dol.gov");
    expect(src).toContain("dol.gov/agencies/eta/foreign-labor");
    expect(src).toContain("travel.state.gov");
  });

  it("the public boundary reports to Sentry without a static import", () => {
    // Sentry is lazy-loaded and may be uninitialised on a public page, so a
    // static import inside an error handler can throw while handling an
    // error. Reporting a failure must not become a second failure.
    const src = readFileSync(
      join(APP, "(site)", "(public)", "error.tsx"),
      "utf8",
    );
    expect(src).toMatch(/import\(["']@sentry\/nextjs["']\)/);
    expect(src).not.toMatch(/^import .*@sentry\/nextjs/m);
  });

  it("boundaries are real files with content, not empty placeholders", () => {
    for (const path of REQUIRED_BOUNDARIES) {
      expect(statSync(path).size).toBeGreaterThan(200);
    }
  });
});
