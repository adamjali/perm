import { describe, it, expect } from "vitest";
import { makeUnsubscribeToken, verifyUnsubscribeToken } from "../unsubscribeToken";

const SECRET = "test-secret-abc123";

describe("unsubscribeToken", () => {
  it("round-trips a valid token back to the email", async () => {
    const token = await makeUnsubscribeToken("Jake@Firm.com", SECRET);
    expect(await verifyUnsubscribeToken(token, SECRET)).toBe("jake@firm.com");
  });

  it("normalizes case + whitespace before signing", async () => {
    const a = await makeUnsubscribeToken("  Jake@Firm.com ", SECRET);
    const b = await makeUnsubscribeToken("jake@firm.com", SECRET);
    expect(a).toBe(b);
  });

  it("rejects a token signed with a different secret", async () => {
    const token = await makeUnsubscribeToken("jake@firm.com", SECRET);
    expect(await verifyUnsubscribeToken(token, "wrong-secret")).toBeNull();
  });

  it("rejects a tampered email", async () => {
    const token = await makeUnsubscribeToken("jake@firm.com", SECRET);
    const [, sig] = token.split(".");
    // Re-encode a different email but keep the old signature.
    const forgedEmail = btoa("attacker@evil.com").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    expect(await verifyUnsubscribeToken(`${forgedEmail}.${sig}`, SECRET)).toBeNull();
  });

  it("rejects a tampered signature", async () => {
    const token = await makeUnsubscribeToken("jake@firm.com", SECRET);
    const [email] = token.split(".");
    expect(await verifyUnsubscribeToken(`${email}.deadbeef`, SECRET)).toBeNull();
  });

  it("rejects malformed tokens", async () => {
    expect(await verifyUnsubscribeToken("", SECRET)).toBeNull();
    expect(await verifyUnsubscribeToken("nodot", SECRET)).toBeNull();
    expect(await verifyUnsubscribeToken(".onlysig", SECRET)).toBeNull();
    expect(await verifyUnsubscribeToken("onlyemail.", SECRET)).toBeNull();
  });
});
