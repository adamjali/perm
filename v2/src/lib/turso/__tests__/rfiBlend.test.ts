import { describe, expect, it, vi } from "vitest";

import type { RfiFunnel, RfiObserved } from "../rfi";

/**
 * The blend that decides the headline RFI percentage.
 *
 * Adam asked for one blended number over my recommendation to publish the two
 * halves separately. That is his call; what the code owes in return is a blend
 * that is provably decomposable and provably free of double counting, which is
 * what these tests pin.
 */

// rfi.ts is server-only and reaches libSQL. Only the pure arithmetic is under
// test, so the client is stubbed rather than the whole module.
vi.mock("server-only", () => ({}));
vi.mock("../client", () => ({ one: vi.fn(), rows: vi.fn() }));

const { blendRfiFunnel, wilsonInterval, DIRECT_EVENT_SOURCE } = await import("../rfi");

const BASE: RfiFunnel = {
  totalTracked: 211_719,
  everIssued: 3_213,
  resolved: 2_151,
  certified: 1_799,
  denied: 210,
  withdrawn: 142,
  stillOpen: 1_062,
  medianDaysToDecision: 33,
  observedAt: 1_787_800_000_000,
  source: "permtrack.app aggregate, frozen",
};

const NONE: RfiObserved = {
  newIssued: 0, resolved: 0, certified: 0, denied: 0, withdrawn: 0, from: null,
};

describe("blendRfiFunnel", () => {
  it("equals the frozen base when we have observed nothing", () => {
    const b = blendRfiFunnel(BASE, NONE);
    expect(b.everIssued).toBe(3_213);
    expect(b.resolved).toBe(2_151);
    expect(b.certified).toBe(1_799);
    expect(b.approvalRate).toBeCloseTo((1799 / 2151) * 100, 10);
    expect(b.observedShare).toBe(0);
  });

  it("adds our events to theirs rather than replacing them", () => {
    const b = blendRfiFunnel(BASE, {
      ...NONE, newIssued: 100, resolved: 80, certified: 60, denied: 15, withdrawn: 5,
    });
    expect(b.everIssued).toBe(3_313);
    expect(b.resolved).toBe(2_231);
    expect(b.certified).toBe(1_859);
    expect(b.denied).toBe(225);
    expect(b.withdrawn).toBe(147);
  });

  it("keeps both halves recoverable from the result", () => {
    const obs = { ...NONE, newIssued: 10, resolved: 8, certified: 6, denied: 2 };
    const b = blendRfiFunnel(BASE, obs);
    // The whole justification for blending is that it can be taken apart.
    expect(b.base).toEqual(BASE);
    expect(b.observed).toEqual(obs);
    expect(b.resolved - b.observed.resolved).toBe(BASE.resolved);
    expect(b.certified - b.observed.certified).toBe(BASE.certified);
  });

  it("reports our share of the denominator, which is the weight", () => {
    const b = blendRfiFunnel(BASE, { ...NONE, resolved: 2_151, certified: 2_151 });
    // Equal denominators means our half carries exactly half the weight.
    expect(b.observedShare).toBeCloseTo(50, 10);
    // And the blended rate sits between the two input rates, never outside.
    const theirs = (1799 / 2151) * 100;
    expect(b.approvalRate).toBeGreaterThan(theirs);
    expect(b.approvalRate).toBeLessThan(100);
  });

  it("moves the rate in proportion to weight, not by averaging percentages", () => {
    // 1 case at 100% must barely move an 83.6% rate. Averaging the two
    // PERCENTAGES would give ~91.8%, which is the classic blend bug and the
    // reason the counts are stored as counts.
    const b = blendRfiFunnel(BASE, { ...NONE, resolved: 1, certified: 1 });
    expect(b.approvalRate).toBeCloseTo((1800 / 2152) * 100, 10);
    expect(b.approvalRate).toBeLessThan(83.7);
    expect(b.approvalRate).toBeGreaterThan(83.6);
  });

  it("never reports a negative still-open count", () => {
    // A case can resolve inside our window whose RFI predates both counts.
    const b = blendRfiFunnel(
      { ...BASE, everIssued: 10, resolved: 10 },
      { ...NONE, resolved: 5, certified: 5 },
    );
    expect(b.stillOpen).toBe(0);
  });

  it("does not divide by zero on an empty base", () => {
    const b = blendRfiFunnel(
      { ...BASE, everIssued: 0, resolved: 0, certified: 0 }, NONE,
    );
    expect(b.approvalRate).toBe(0);
    expect(b.observedShare).toBe(0);
    expect(b.ci).toBeNull();
  });

  it("carries a Wilson interval computed on the BLENDED counts", () => {
    const b = blendRfiFunnel(BASE, { ...NONE, resolved: 100, certified: 90 });
    expect(b.ci).toEqual(wilsonInterval(1_889, 2_251));
    // A bigger denominator must tighten the interval, not widen it.
    const narrow = b.ci!;
    const wide = wilsonInterval(1_799, 2_151)!;
    expect(narrow.hi - narrow.lo).toBeLessThan(wide.hi - wide.lo);
  });
});

describe("DIRECT_EVENT_SOURCE", () => {
  it("is byte-identical to the Python ingest's own SOURCE string", async () => {
    // A CROSS-LANGUAGE CONTRACT WITH NO COMPILER BETWEEN ITS HALVES. The
    // writer is Python and the reader is TypeScript, and if the two strings
    // drift the blend does not error - it silently counts zero of our events
    // forever and the published figure freezes at the base. Same shape as the
    // entitySlug pair, and the same reason it is pinned by a test.
    const { readFileSync } = await import("node:fs");
    const py = readFileSync("scripts/ingest_case_status_direct.py", "utf8");
    const m = /^SOURCE = "(.+)"$/m.exec(py);
    expect(m, "SOURCE assignment not found in the ingest").not.toBeNull();
    expect(m![1]).toBe(DIRECT_EVENT_SOURCE);
  });

  it("does not match the retired mirror's source string", () => {
    // The whole point of the filter: mirror rows recorded a difference against
    // permtrack's copy, not an observation of DOL, and their age relative to
    // the frozen base is unknowable.
    expect(DIRECT_EVENT_SOURCE).not.toContain("permtrack");
    expect(DIRECT_EVENT_SOURCE).not.toContain("mirror");
  });
});
