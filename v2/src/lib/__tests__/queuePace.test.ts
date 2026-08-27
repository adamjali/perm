import { describe, it, expect } from "vitest";
import { measureQueuePace, paceSentence } from "../queuePace";

const snap = (frontier: string | null, asOf: string | null) => ({ frontier, asOf });

describe("measureQueuePace", () => {
  it("measures the advance and the window from the ends of the list", () => {
    const pace = measureQueuePace([
      snap("2024-11", "2026-08-20"),
      snap("2024-09", "2026-05-15"),
      snap("2024-08", "2026-02-10"),
    ]);
    expect(pace).toEqual({ months: 3, overMonths: 6 });
  });

  it("returns null with fewer than two usable snapshots", () => {
    expect(measureQueuePace([])).toBeNull();
    expect(measureQueuePace([snap("2024-11", "2026-08-20")])).toBeNull();
  });

  it("ignores snapshots missing a frontier or an as-of date", () => {
    // One usable row survives the filter, so there is nothing to compare.
    expect(
      measureQueuePace([snap("2024-11", "2026-08-20"), snap(null, "2026-02-10")]),
    ).toBeNull();
  });

  it("refuses a window shorter than three months", () => {
    // DOL publishes monthly and the frontier steps in whole months, so a two
    // month window reports quantisation rather than a rate.
    expect(
      measureQueuePace([snap("2024-11", "2026-08-20"), snap("2024-10", "2026-06-20")]),
    ).toBeNull();
  });

  it("accepts exactly three months", () => {
    expect(
      measureQueuePace([snap("2024-11", "2026-08-20"), snap("2024-10", "2026-05-20")]),
    ).toEqual({ months: 1, overMonths: 3 });
  });

  it("returns an unparseable month as null rather than guessing", () => {
    expect(
      measureQueuePace([snap("Nov 2024", "2026-08-20"), snap("2024-08", "2026-02-10")]),
    ).toBeNull();
  });

  it("reports a stalled queue as measured", () => {
    expect(
      measureQueuePace([snap("2024-09", "2026-08-20"), snap("2024-09", "2026-02-10")]),
    ).toEqual({ months: 0, overMonths: 6 });
  });

  it("reports a backwards revision as measured, without suppressing it", () => {
    expect(
      measureQueuePace([snap("2024-07", "2026-08-20"), snap("2024-09", "2026-02-10")]),
    ).toEqual({ months: -2, overMonths: 6 });
  });
});

describe("paceSentence", () => {
  it("states a forward advance", () => {
    expect(paceSentence({ months: 3, overMonths: 6 })).toBe(
      "DOL’s queue has moved 3 months over the last 6 months.",
    );
  });

  it("singularises one month on both sides", () => {
    expect(paceSentence({ months: 1, overMonths: 1 })).toBe(
      "DOL’s queue has moved 1 month over the last 1 month.",
    );
  });

  it("says nothing for a stalled or reversed queue", () => {
    expect(paceSentence({ months: 0, overMonths: 6 })).toBeNull();
    expect(paceSentence({ months: -2, overMonths: 6 })).toBeNull();
  });

  it("says nothing when there is no measurement", () => {
    expect(paceSentence(null)).toBeNull();
  });

  it("never projects a date", () => {
    const s = paceSentence({ months: 3, overMonths: 6 }) ?? "";
    // The whole point of the module. A rate may be stated; a destination
    // derived from it may not.
    expect(s).not.toMatch(/will|expect|by |reach(ed|es)? you|your case/i);
  });
});
