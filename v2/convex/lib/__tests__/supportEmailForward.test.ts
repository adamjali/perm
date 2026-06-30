import { describe, it, expect } from "vitest";
import { shouldForwardInbound } from "../supportEmailForward";

const FWD = "owner@gmail.com"; // prod SUPPORT_FORWARD_EMAIL (external inbox)

describe("shouldForwardInbound", () => {
  it("forwards normal human inbound mail", () => {
    expect(shouldForwardInbound("perm@permtracker.app", FWD)).toBe(true);
    expect(shouldForwardInbound("hello@permtracker.app", FWD)).toBe(true);
    // support@ forwards in prod because the target is the Gmail, not support@.
    expect(shouldForwardInbound("support@permtracker.app", FWD)).toBe(true);
  });

  it("does NOT forward DMARC machine reports (case-insensitive)", () => {
    expect(shouldForwardInbound("dmarc@permtracker.app", FWD)).toBe(false);
    expect(shouldForwardInbound("DMARC@permtracker.app", FWD)).toBe(false);
    // but a dashed variant is not the blocked exact dmarc@ and forwards
    expect(shouldForwardInbound("dmarc-reports@permtracker.app", FWD)).toBe(true);
  });

  it("does NOT forward to the target itself (loop guard, case-insensitive)", () => {
    expect(shouldForwardInbound(FWD, FWD)).toBe(false);
    expect(shouldForwardInbound(FWD.toUpperCase(), FWD)).toBe(false);
  });

  it("with the legacy default target (support@), support@ is the loop-excluded one", () => {
    const legacy = "support@permtracker.app";
    expect(shouldForwardInbound("support@permtracker.app", legacy)).toBe(false);
    expect(shouldForwardInbound("perm@permtracker.app", legacy)).toBe(true);
  });
});
