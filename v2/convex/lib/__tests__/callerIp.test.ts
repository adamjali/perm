import { afterEach, describe, expect, it, vi } from "vitest";

import { callerIp } from "../callerIp";

/**
 * The site's forms post through its own address since Oct 31 2026 (`/c/<route>`, relayed by nginx), so Convex sees
 * the server connecting. The visitor's address rides in `x-pt-client-ip`, believed only from the relay itself.
 */

const RELAY = "198.51.100.7";
const req = (headers: Record<string, string>) => new Request("https://example.convex.site/case-alert/subscribe", { headers });

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("callerIp", () => {
  it("is the connecting address when nothing was relayed", () => {
    expect(callerIp(req({ "x-forwarded-for": "203.0.113.9" }))).toBe("203.0.113.9");
  });

  it("is the visitor's address when the relay passed it", () => {
    vi.stubEnv("RELAY_FROM_IPS", `192.0.2.1, ${RELAY}`);
    expect(callerIp(req({ "x-forwarded-for": RELAY, "x-pt-client-ip": "203.0.113.9" }))).toBe("203.0.113.9");
  });

  it("ignores the header from anyone but the relay, so nobody can spend another address's limit", () => {
    vi.stubEnv("RELAY_FROM_IPS", RELAY);
    expect(callerIp(req({ "x-forwarded-for": "203.0.113.50", "x-pt-client-ip": "203.0.113.9" }))).toBe("203.0.113.50");
  });

  it("ignores the header when no relay is set", () => {
    expect(callerIp(req({ "x-forwarded-for": RELAY, "x-pt-client-ip": "203.0.113.9" }))).toBe(RELAY);
  });

  it("ignores a relayed value that isn't an address", () => {
    vi.stubEnv("RELAY_FROM_IPS", RELAY);
    expect(callerIp(req({ "x-forwarded-for": RELAY, "x-pt-client-ip": "not an address" }))).toBe(RELAY);
  });

  it("reads an IPv6 visitor", () => {
    vi.stubEnv("RELAY_FROM_IPS", RELAY);
    expect(callerIp(req({ "x-forwarded-for": RELAY, "x-pt-client-ip": "2001:db8::1" }))).toBe("2001:db8::1");
  });

  it("is unknown with no address at all", () => {
    expect(callerIp(req({}))).toBe("unknown");
  });
});
