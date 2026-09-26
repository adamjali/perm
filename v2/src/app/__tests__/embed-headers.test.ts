import { pathToRegexp } from "next/dist/compiled/path-to-regexp";
import { describe, expect, it, vi } from "vitest";

/**
 * Only /embed/* may be framed by another site.
 *
 * The real config is loaded (its plugin wrappers mocked to pass the object
 * through) and its header rules are applied the way Next applies them: every
 * rule whose source matches contributes, and a later rule's key overrides an
 * earlier one's. So this asserts what a browser actually receives per path,
 * not what the file happens to say.
 */

vi.mock("@sentry/nextjs", () => ({ withSentryConfig: (c: unknown) => c }));
vi.mock("@serwist/next", () => ({ default: () => (c: unknown) => c }));
vi.mock("@next/bundle-analyzer", () => ({ default: () => (c: unknown) => c }));
vi.mock("botid/next/config", () => ({ withBotId: (c: unknown) => c }));

type Rule = { source: string; headers: { key: string; value: string }[] };

async function effectiveHeaders(path: string): Promise<Map<string, string>> {
  const config = (await import("../../../next.config")).default as { headers: () => Promise<Rule[]> };
  const out = new Map<string, string>();
  for (const rule of await config.headers()) {
    const re = pathToRegexp(rule.source, [], { strict: true, sensitive: false, delimiter: "/" });
    if (!re.test(path)) continue;
    for (const h of rule.headers) out.set(h.key.toLowerCase(), h.value);
  }
  return out;
}

const ancestors = (csp: string | undefined) => csp?.match(/frame-ancestors ([^;]+)/)?.[1]?.trim();

describe("framing headers", () => {
  it.each(["/", "/tools/perm-timeline-calculator", "/perm-case-status", "/embedded", "/badges"])(
    "refuses framing on %s",
    async (path) => {
      const h = await effectiveHeaders(path);
      expect(h.get("x-frame-options")).toBe("DENY");
      expect(ancestors(h.get("content-security-policy"))).toBe("'none'");
      expect(h.get("x-robots-tag")).toBeUndefined();
    },
  );

  it.each(["/embed", "/embed/case-status", "/embed/perm-timeline"])("allows any site to frame %s", async (path) => {
    const h = await effectiveHeaders(path);
    expect(h.get("x-frame-options")).toBeUndefined();
    expect(ancestors(h.get("content-security-policy"))).toBe("*");
    expect(h.get("x-robots-tag")).toContain("noindex");
  });

  it("keeps every other security header on both kinds of page", async () => {
    const page = await effectiveHeaders("/tools/rfi-deadline");
    const embed = await effectiveHeaders("/embed/rfi-deadline");
    for (const key of ["strict-transport-security", "x-content-type-options", "referrer-policy", "permissions-policy"]) {
      expect(page.get(key)).toBeTruthy();
      expect(embed.get(key)).toBe(page.get(key));
    }
    // The two policies differ in frame-ancestors and nothing else.
    const strip = (csp: string | undefined) => csp?.replace(/frame-ancestors [^;]+/, "");
    expect(strip(embed.get("content-security-policy"))).toBe(strip(page.get("content-security-policy")));
  });
});
