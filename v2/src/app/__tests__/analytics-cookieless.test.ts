import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * PostHog is cookie-free for everyone not signed in (Sep 27 2026), and the
 * legal pages say what the code does. These pin both halves together: a
 * change to the init options that the policy doesn't describe, or policy
 * wording the code stopped matching, turns this red.
 */

const SRC = join(process.cwd(), "src");
const read = (p: string) => readFileSync(join(SRC, p), "utf8");
const flat = (s: string) => s.replace(/\s+/g, " ");

describe("cookie-free analytics", () => {
  const init = read("instrumentation-client.ts");

  it("starts PostHog cookie-free, with consent pending counted as a rejection", () => {
    expect(init).toMatch(/cookieless_mode:\s*"on_reject"/);
    expect(init).toMatch(/opt_out_capturing_by_default:\s*true/);
  });

  it("sends nothing at all for GPC and switched-off staff browsers", () => {
    // In "on_reject" mode an opt-out only falls back to cookie-free
    // counting, so the drop has to happen in before_send.
    expect(init).toMatch(/if \(gpcEnabled \|\| isAnalyticsOff\(\)\) return null;/);
  });

  it("opts a signed-in account in before identifying it", () => {
    const tracker = read("components/auth/LoginTracker.tsx");
    const consent = tracker.indexOf("analytics.consentForAccount()");
    const identify = tracker.indexOf("analytics.identify(");
    expect(consent).toBeGreaterThan(-1);
    expect(identify).toBeGreaterThan(consent);
  });
});

describe("the legal pages match the code", () => {
  const privacy = flat(read("app/(site)/(public)/privacy/page.tsx"));
  const terms = flat(read("app/(site)/(public)/terms/page.tsx"));

  it("the privacy policy describes cookie-free mode", () => {
    expect(privacy).toMatch(/cookie-free mode: it sets no cookies and stores nothing in your browser/);
    expect(privacy).not.toMatch(/identify your device across sessions/);
  });

  it("neither page describes features that were removed", () => {
    for (const page of [privacy, terms]) {
      // Sentry replay was removed Aug 29 2026, Speed Insights before it,
      // and BotID has guarded only the signed-in chat since Sep 23 2026.
      expect(page).not.toMatch(/session replay data/);
      expect(page).not.toMatch(/Sentry for error tracking with session replay/);
      expect(page).not.toMatch(/Speed Insights\)/);
      expect(page).not.toMatch(/BotID on our AI chat and authentication/);
    }
  });
});
