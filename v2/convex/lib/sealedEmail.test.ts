import { describe, expect, it } from "vitest";

import { openEmail, sealEmail } from "./sealedEmail";

const SECRET = "test-secret-value-long-enough";
const NOW = Date.parse("2026-10-23T20:00:00Z");

describe("sealed review-link tokens", () => {
  it("open to the address they were made for, tidied", async () => {
    const t = await sealEmail(" Pat@Example.com ", SECRET, NOW + 1000);
    expect(await openEmail(t, SECRET, NOW)).toBe("pat@example.com");
  });

  it("don't show the address in the token", async () => {
    const t = await sealEmail("pat@example.com", SECRET, NOW + 1000);
    expect(t).not.toContain("pat");
    expect(atob(t.replace(/-/g, "+").replace(/_/g, "/") + "==".slice(0, (4 - (t.length % 4)) % 4))).not.toContain("pat@");
  });

  it("refuse an expired token, another secret, an altered one and junk", async () => {
    const t = await sealEmail("pat@example.com", SECRET, NOW + 1000);
    expect(await openEmail(t, SECRET, NOW + 1000)).toBeNull();
    expect(await openEmail(t, "another-secret-value-entirely", NOW)).toBeNull();
    const flipped = t.slice(0, 20) + (t[20] === "A" ? "B" : "A") + t.slice(21);
    expect(await openEmail(flipped, SECRET, NOW)).toBeNull();
    for (const junk of [undefined, 42, "", "short", "!".repeat(80), "A".repeat(700)]) {
      expect(await openEmail(junk, SECRET, NOW)).toBeNull();
    }
  });
});
