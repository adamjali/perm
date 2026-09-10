import { render } from "@react-email/render";
import { describe, expect, it } from "vitest";

import { EmailPreferencesLink } from "../EmailPreferencesLink";
import { SITE_URL, actionUrl } from "../../../convex/lib/links";

/**
 * The preferences email shipped as PLAIN TEXT with a link to
 * `<deployment>.convex.site` — the only sending path in the codebase without a
 * template, and the one message whose whole job is to be trusted enough to
 * click. Unstyled text plus an unfamiliar domain plus a long opaque token is
 * the anatomy of a phishing email.
 *
 * These assert the two halves of that fix, not the wording.
 */
describe("the email preferences link", () => {
  const url = actionUrl("/prefs", "tok.en");

  it("addresses the reader's own site, not the Convex deployment", () => {
    expect(url.startsWith(`${SITE_URL}/prefs?token=`)).toBe(true);
    expect(url).not.toContain("convex.site");
    expect(url).not.toContain("convex.cloud");
  });

  it("renders real HTML with the link as a button", async () => {
    const html = await render(EmailPreferencesLink({ prefsUrl: url }));
    expect(html).toContain("<html");
    expect(html).toContain(encodeURIComponent("tok.en"));
    expect(html).toContain("Open my email preferences");
  });

  it("states the off-only rule ABOVE the button", async () => {
    // The asymmetry is what makes a replayable, never-expiring link safe, and
    // the reader carries the risk if it is not true. Someone who clicks
    // immediately never reads anything below the CTA.
    const html = await render(EmailPreferencesLink({ prefsUrl: url }));
    const rule = html.indexOf("only turn things off");
    const button = html.indexOf("Open my email preferences");
    expect(rule, "the off-only sentence is missing").toBeGreaterThan(-1);
    expect(button).toBeGreaterThan(-1);
    expect(rule).toBeLessThan(button);
  });

  it("carries no onward links but the one it exists for", async () => {
    // Same rule as the confirmation emails: one job, one destination.
    const html = await render(EmailPreferencesLink({ prefsUrl: url }));
    const hrefs = [...html.matchAll(/href="([^"]+)"/g)]
      .map((m) => m[1] ?? "")
      .filter((h) => h.startsWith("http") && !h.includes("/prefs"));
    // The layout's own footer brand link is allowed; nothing else is.
    const offsite = hrefs.filter((h) => !h.startsWith(SITE_URL));
    expect(offsite, `unexpected outbound links: ${offsite.join(", ")}`).toEqual([]);
  });
});
