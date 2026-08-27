import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import { PwdValidityWindow } from "../PwdValidityWindow";
import { calculatePWDExpiration } from "@/lib/perm";

/**
 * The figures are derived from `calculatePWDExpiration` at render time on
 * purpose, so these tests check the DERIVATION rather than restating the
 * numbers. Restating them would put a second copy of 20 CFR 656.40(c) in a
 * test file, which is the thing the central-logic rule exists to stop, and it
 * is exactly how a previous test in this repo asserted determination-plus-90
 * and was wrong.
 */
describe("PwdValidityWindow", () => {
  beforeEach(() => {
    // Pin the clock. The component anchors on the current wage year, and a
    // test that passes in August and fails in January is not a test.
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-27T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("states the 30 June cliff using the calculator's own answers", () => {
    render(<PwdValidityWindow />);

    // Derive what the copy must say from the same function the component uses.
    const june = "2026-06-30";
    const july = "2026-07-01";
    const days = (from: string) =>
      Math.round(
        (Date.parse(`${calculatePWDExpiration(from)}T00:00:00Z`) -
          Date.parse(`${from}T00:00:00Z`)) /
          86_400_000,
      );
    const short = days(june);
    const long = days(july);

    // The cliff is the whole point of the section. If the rule ever flattens,
    // this is the assertion that should fail rather than the copy quietly
    // making a claim the arithmetic no longer supports.
    expect(long).toBeGreaterThan(short * 2);
    expect(
      screen.getByText(
        new RegExp(`valid ${short}\\s+days\\.\\s+One issued .* is valid ${long}`),
      ),
    ).toBeInTheDocument();
  });

  it("prints a flat window as one figure and a sloping one as a range", () => {
    render(<PwdValidityWindow />);
    // 2 April to 30 June is 90 days throughout, so a range would be wrong.
    expect(screen.getByText("90 days")).toBeInTheDocument();
    // The other two both slope, because both are anchored to a fixed 30 June
    // and so shorten every day the determination is issued later.
    const ranges = screen.getAllByText(/^\d+ to \d+ days$/);
    expect(ranges).toHaveLength(2);
    for (const el of ranges) {
      const [lo, hi] = el.textContent!.match(/\d+/g)!.map(Number) as [number, number];
      expect(lo).toBeLessThan(hi);
    }
  });

  it("anchors on the current year rather than a hardcoded one", () => {
    const { unmount } = render(<PwdValidityWindow />);
    expect(screen.getByText(/computed for 2026/)).toBeInTheDocument();
    unmount();

    vi.setSystemTime(new Date("2027-02-01T12:00:00Z"));
    render(<PwdValidityWindow />);
    expect(screen.getByText(/computed for 2027/)).toBeInTheDocument();
  });
});
