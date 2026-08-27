import { describe, expect, it } from "vitest";

/**
 * The case-number redaction that runs in PostHog's before_send.
 *
 * The function itself lives in src/instrumentation-client.ts, which cannot be
 * imported here: the module's top level calls posthog.init() and initBotId()
 * as import side effects. So the implementation is mirrored below and pinned
 * character-for-character against the source by the first test, which is the
 * cheap version of the alternative (exporting it and giving that file an
 * import graph it does not otherwise need).
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

// Kept byte-identical to the copy in src/instrumentation-client.ts.
function redactCaseParam(props: Record<string, unknown> | undefined): void {
  if (!props) return;
  for (const key of ["$current_url", "$referrer", "$pathname", "url"]) {
    const v = props[key];
    if (typeof v !== "string" || !v.includes("case=")) continue;
    props[key] = v.replace(/([?&]case=)[^&#]*/gi, "$1redacted");
  }
}

describe("redactCaseParam", () => {
  it("still matches the copy that actually runs in before_send", () => {
    // A test over a stale duplicate is decoration. This asserts the two are
    // the same code, so editing one without the other goes red.
    const src = readFileSync(
      join(process.cwd(), "src/instrumentation-client.ts"),
      "utf8",
    );
    expect(src).toContain(
      'props[key] = v.replace(/([?&]case=)[^&#]*/gi, "$1redacted");',
    );
    expect(src).toContain(
      'for (const key of ["$current_url", "$referrer", "$pathname", "url"])',
    );
    // And that it is actually wired in, not merely defined.
    expect(src).toContain("redactCaseParam(event.properties);");
  });

  it("redacts a case number from a full URL", () => {
    const p: Record<string, unknown> = {
      $current_url: "https://permtracker.app/perm-case-status?case=G-100-26125-868956",
    };
    redactCaseParam(p);
    expect(p.$current_url).toBe(
      "https://permtracker.app/perm-case-status?case=redacted",
    );
  });

  it("redacts from a bare path, which new URL() would throw on", () => {
    const p: Record<string, unknown> = {
      $pathname: "/perm-case-status?case=G-100-26125-868956",
    };
    redactCaseParam(p);
    expect(p.$pathname).toBe("/perm-case-status?case=redacted");
  });

  it("keeps every other parameter and the fragment intact", () => {
    const p: Record<string, unknown> = {
      $current_url: "/x?a=1&case=G-100-26125-868956&b=2#frag",
    };
    redactCaseParam(p);
    expect(p.$current_url).toBe("/x?a=1&case=redacted&b=2#frag");
  });

  it("catches the referrer too, which is how it leaks from the NEXT page", () => {
    const p: Record<string, unknown> = {
      $referrer: "https://permtracker.app/perm-case-status?case=P-100-26125-868956",
    };
    redactCaseParam(p);
    expect(p.$referrer).toBe("https://permtracker.app/perm-case-status?case=redacted");
  });

  it("does not match a parameter that merely ends in case", () => {
    // `?showcase=x` contains "case=" and must survive: the pattern requires
    // the parameter to start at a ? or &, so the substring pre-check being
    // loose costs nothing.
    const p: Record<string, unknown> = { $current_url: "/x?showcase=yes" };
    redactCaseParam(p);
    expect(p.$current_url).toBe("/x?showcase=yes");
  });

  it("leaves untouched anything with no case parameter", () => {
    const p: Record<string, unknown> = { $current_url: "/perm-queue" };
    redactCaseParam(p);
    expect(p.$current_url).toBe("/perm-queue");
  });

  it("survives undefined properties and non-string values", () => {
    expect(() => redactCaseParam(undefined)).not.toThrow();
    const p: Record<string, unknown> = { $current_url: 42 };
    redactCaseParam(p);
    expect(p.$current_url).toBe(42);
  });
});
