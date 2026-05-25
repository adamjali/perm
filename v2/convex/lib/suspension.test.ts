import { describe, it, expect, vi, afterEach } from "vitest";
import {
  getUserSuspension,
  isUserSuspended,
  setSuspension,
  clearSuspension,
} from "./suspension";
import type { Doc } from "../_generated/dataModel";

// ---------------------------------------------------------------------------
// I12 — suspension.ts is the single source of truth that collapses the
// userProfiles (suspendedAt, suspendedReason, suspendedUntil) triplet into one
// nullable state, and the writers (setSuspension/clearSuspension) must always
// produce a VALID triplet (no orphaned partial state). Pure functions — no
// Convex harness needed.
// ---------------------------------------------------------------------------

/** Build a minimal userProfiles doc with just the suspension fields under test. */
function profile(
  fields: Partial<
    Pick<
      Doc<"userProfiles">,
      "suspendedAt" | "suspendedReason" | "suspendedUntil"
    >
  >,
): Doc<"userProfiles"> {
  return fields as Doc<"userProfiles">;
}

const NOW = 1_700_000_000_000;

describe("getUserSuspension", () => {
  afterEach(() => vi.useRealTimers());

  it("returns null when not suspended (no suspendedAt)", () => {
    expect(getUserSuspension(profile({}))).toBeNull();
    expect(getUserSuspension(null)).toBeNull();
    expect(getUserSuspension(undefined)).toBeNull();
  });

  it("returns the suspension object for an active suspension with a future until", () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    const result = getUserSuspension(
      profile({
        suspendedAt: NOW - 1000,
        suspendedReason: "auto: abuse",
        suspendedUntil: NOW + 60_000,
      }),
    );
    expect(result).toEqual({
      at: NOW - 1000,
      reason: "auto: abuse",
      until: NOW + 60_000,
    });
  });

  it("auto-lifts: returns null when suspendedUntil is in the past", () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    expect(
      getUserSuspension(
        profile({
          suspendedAt: NOW - 100_000,
          suspendedReason: "auto",
          suspendedUntil: NOW - 1, // expired
        }),
      ),
    ).toBeNull();
  });

  it("manual-lock (until undefined) → until: null and stays suspended", () => {
    const result = getUserSuspension(
      profile({ suspendedAt: NOW, suspendedReason: "manual hold" }),
    );
    expect(result).not.toBeNull();
    expect(result!.until).toBeNull();
    expect(result!.reason).toBe("manual hold");
  });

  it("missing reason → reason: null", () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    const result = getUserSuspension(
      profile({ suspendedAt: NOW, suspendedUntil: NOW + 1_000_000 }),
    );
    expect(result!.reason).toBeNull();
  });
});

describe("isUserSuspended (mirrors getUserSuspension)", () => {
  it("true iff getUserSuspension is non-null", () => {
    expect(isUserSuspended(profile({}))).toBe(false);
    expect(
      isUserSuspended(profile({ suspendedAt: NOW, suspendedReason: "x" })),
    ).toBe(true);
  });
});

describe("setSuspension (writer produces a valid triplet)", () => {
  afterEach(() => vi.useRealTimers());

  it("sets all three fields together (atMs + untilMs explicit)", () => {
    const patch = setSuspension({
      reason: "auto: 12 failures",
      atMs: NOW,
      untilMs: NOW + 86_400_000,
    });
    expect(patch).toEqual({
      suspendedAt: NOW,
      suspendedReason: "auto: 12 failures",
      suspendedUntil: NOW + 86_400_000,
    });
  });

  it("defaults atMs to now when omitted", () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    const patch = setSuspension({ reason: "r", untilMs: NOW + 1000 });
    expect(patch.suspendedAt).toBe(NOW);
  });

  it("manual-only lock: untilMs omitted → suspendedUntil undefined (but at + reason set)", () => {
    const patch = setSuspension({ reason: "manual", atMs: NOW });
    expect(patch.suspendedAt).toBe(NOW);
    expect(patch.suspendedReason).toBe("manual");
    expect(patch.suspendedUntil).toBeUndefined();
  });

  it("round-trips: a setSuspension patch reads back as a live suspension", () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    const patch = setSuspension({ reason: "auto", untilMs: NOW + 10_000 });
    const read = getUserSuspension(profile(patch));
    expect(read).toEqual({ at: NOW, reason: "auto", until: NOW + 10_000 });
  });
});

describe("clearSuspension (writer clears the whole triplet)", () => {
  it("unsets all three fields together — no orphaned partial state", () => {
    expect(clearSuspension()).toEqual({
      suspendedAt: undefined,
      suspendedReason: undefined,
      suspendedUntil: undefined,
    });
  });

  it("round-trips: a clearSuspension patch reads back as not-suspended", () => {
    const patch = clearSuspension();
    expect(getUserSuspension(profile(patch))).toBeNull();
    expect(isUserSuspended(profile(patch))).toBe(false);
  });
});
