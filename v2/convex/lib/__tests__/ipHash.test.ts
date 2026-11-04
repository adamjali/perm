import { describe, expect, it } from "vitest";

import { ipHash } from "../ipHash";

async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** A stored address hash can't be read back by hashing every IPv4 address (Nov 4 2026). */
describe("ipHash", () => {
  it("is keyed: without the secret, hashing the address again doesn't find it", async () => {
    const keyed = await ipHash("timeline", "203.0.113.7", "a-long-random-secret");
    expect(keyed).toMatch(/^[0-9a-f]{64}$/);
    expect(keyed).not.toBe(await sha256Hex("timeline:203.0.113.7"));
  });

  it("is stable for one address and scope, and differs by scope and by secret", async () => {
    const a = await ipHash("timeline", "203.0.113.7", "s1");
    expect(await ipHash("timeline", "203.0.113.7", "s1")).toBe(a);
    expect(await ipHash("push", "203.0.113.7", "s1")).not.toBe(a);
    expect(await ipHash("timeline", "203.0.113.7", "s2")).not.toBe(a);
  });

  it("falls back to the old hash when the secret isn't set, so nothing stops working", async () => {
    expect(await ipHash("milestone", "198.51.100.2", "")).toBe(await sha256Hex("milestone:198.51.100.2"));
  });
});
