import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

// The Privacy Policy says request contents never reach Sentry from the website's server. That is true only while
// the server config replaces the SDK's HTTP integration with one that attaches no body (its default is 10 KB).
const config = readFileSync(join(process.cwd(), "sentry.server.config.ts"), "utf8").replace(/\/\/.*$/gm, "");

describe("the server's Sentry setup", () => {
  it("attaches no request body to an event", () => {
    expect(config).toMatch(/httpIntegration\(\{[^}]*maxIncomingRequestBodySize:\s*"none"/);
  });

  it("keeps the Next.js SDK's own setting for the integration it replaces", () => {
    expect(config).toMatch(/httpIntegration\(\{[^}]*disableIncomingRequestSpans:\s*true/);
  });
});
