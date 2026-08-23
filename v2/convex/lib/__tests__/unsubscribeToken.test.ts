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

  // ---------------------------------------------------------------------
  // Purpose scoping
  //
  // Without it every token for one address was the SAME string, so the link
  // meaning "unsubscribe me" was byte-identical to the one meaning "confirm
  // me" and differed only in which path it was pasted into. Replaying an
  // unsubscribe link against the confirm route undid the opt-out.
  // ---------------------------------------------------------------------

  it("mints a different token per purpose for the same address", async () => {
    const confirm = await makeUnsubscribeToken("jake@firm.com", SECRET, "queue-confirm");
    const unsub = await makeUnsubscribeToken("jake@firm.com", SECRET, "queue-unsubscribe");
    expect(confirm).not.toBe(unsub);
  });

  it("does not verify a token against a different purpose", async () => {
    const confirm = await makeUnsubscribeToken("jake@firm.com", SECRET, "queue-confirm");
    expect(await verifyUnsubscribeToken(confirm, SECRET, "queue-confirm")).toBe("jake@firm.com");
    expect(await verifyUnsubscribeToken(confirm, SECRET, "queue-unsubscribe")).toBeNull();
  });

  it("does not accept a scoped token on the unscoped legacy route", async () => {
    const scoped = await makeUnsubscribeToken("jake@firm.com", SECRET, "queue-unsubscribe");
    expect(await verifyUnsubscribeToken(scoped, SECRET)).toBeNull();
  });

  it("still verifies legacy unscoped tokens", async () => {
    // Weekly-digest unsubscribe links are already in real inboxes signed this
    // way and have no expiry. Breaking them would strip a working opt-out from
    // every digest ever sent, which is worse than the risk scoping removes.
    const legacy = await makeUnsubscribeToken("jake@firm.com", SECRET);
    expect(await verifyUnsubscribeToken(legacy, SECRET)).toBe("jake@firm.com");
    expect(await verifyUnsubscribeToken(legacy, SECRET, "queue-confirm")).toBeNull();
  });
});
