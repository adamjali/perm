import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { isLocalDevHost } from "../localHost";

describe("isLocalDevHost", () => {
  it("is true for this machine's own names", () => {
    for (const h of ["localhost", "127.0.0.1", "[::1]", "::1", "app.localhost", "LOCALHOST"]) {
      expect(isLocalDevHost(h), h).toBe(true);
    }
  });

  it("is false for the live site and look-alikes", () => {
    for (const h of ["permtracker.app", "www.permtracker.app", "localhost.permtracker.app", "notlocalhost", "127.0.0.2"]) {
      expect(isLocalDevHost(h), h).toBe(false);
    }
  });

  it("keeps analytics from starting on a local host unless asked", () => {
    const src = readFileSync(join(process.cwd(), "src/instrumentation-client.ts"), "utf8");
    const start = src.indexOf("void edgeCountry()");
    const guard = src.lastIndexOf("isLocalDevHost(", start);
    expect(start).toBeGreaterThan(0);
    expect(guard).toBeGreaterThan(0);
    expect(src.slice(guard, start)).toContain("NEXT_PUBLIC_POSTHOG_LOCAL");
  });
});
