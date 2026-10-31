import { pathToRegexp } from "next/dist/compiled/path-to-regexp";
import { prepareDestination } from "next/dist/shared/lib/router/utils/prepare-destination";
import { getPathMatch } from "next/dist/shared/lib/router/utils/path-match";
import { describe, expect, it, vi } from "vitest";

/**
 * The site is English only since Oct 31 2026, and every page it published in another language is in
 * Google's index or in a link someone saved. Each must answer a permanent redirect to the English page it was
 * a version of, never a 404, with its query string intact (a translated case lookup is the same case).
 *
 * The real config is loaded and each redirect is applied the way Next applies one (its own matcher and
 * `prepareDestination`, as resolve-routes calls it for a redirect), so this checks what a visitor gets.
 */

vi.mock("@sentry/nextjs", () => ({ withSentryConfig: (c: unknown) => c }));
vi.mock("@serwist/next", () => ({ default: () => (c: unknown) => c }));
vi.mock("@next/bundle-analyzer", () => ({ default: () => (c: unknown) => c }));

type Redirect = { source: string; destination: string; permanent?: boolean };

async function follow(url: string): Promise<{ to: string; permanent: boolean } | null> {
  const config = (await import("../../../next.config")).default as { redirects: () => Promise<Redirect[]> };
  const parsed = new URL(url, "https://permtracker.app");
  const query = Object.fromEntries(parsed.searchParams);
  for (const rule of await config.redirects()) {
    const params = getPathMatch(rule.source, { strict: true, removeUnnamedParams: true })(parsed.pathname);
    if (!params) continue;
    const { parsedDestination } = prepareDestination({
      appendParamsToQuery: false,
      destination: rule.destination,
      params,
      query,
    });
    const search = new URLSearchParams(parsedDestination.query as Record<string, string>).toString();
    return { to: `${parsedDestination.pathname}${search ? `?${search}` : ""}`, permanent: rule.permanent === true };
  }
  return null;
}

const LANGUAGES = ["es", "zh", "pt-br", "ko", "vi"];

describe("the retired language pages", () => {
  it.each(LANGUAGES)("/%s goes to the English guide it was a version of", async (lang) => {
    expect(await follow(`/${lang}`)).toEqual({ to: "/guides/waiting-on-your-green-card", permanent: true });
  });

  it.each(LANGUAGES.flatMap((lang) => ["/perm-case-status", "/perm-case-alerts", "/email-preferences"].map((page) => [lang, page])))(
    "/%s%s goes to the English page",
    async (lang, page) => {
      expect(await follow(`/${lang}${page}`)).toEqual({ to: page, permanent: true });
    },
  );

  it("keeps the query string, so a translated case lookup opens the same case", async () => {
    expect(await follow("/es/perm-case-status?case=G-100-26125-868956")).toEqual({
      to: "/perm-case-status?case=G-100-26125-868956",
      permanent: true,
    });
    expect(await follow("/zh/email-preferences?token=abc&focus=case%3Ax")).toEqual({
      to: "/email-preferences?token=abc&focus=case%3Ax",
      permanent: true,
    });
  });

  it("leaves English pages and look-alike paths alone", async () => {
    for (const path of ["/perm-case-status", "/guides/waiting-on-your-green-card", "/esta", "/vietnam", "/en/perm-case-status"]) {
      expect(await follow(path)).toBeNull();
    }
    // The matcher is anchored: a language code inside a longer segment is not a language page.
    expect(pathToRegexp("/:lang(es|zh|pt-br|ko|vi)/perm-case-status").test("/est/perm-case-status")).toBe(false);
  });
});
