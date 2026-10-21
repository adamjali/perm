import { describe, expect, it } from "vitest";
import { estimateRfiCase, RFI_DUE_DAYS, type RfiClock } from "@/lib/perm";
import { parseRfiPath } from "@/lib/stageMoves";
import { buildRfiRun, LEAD_DAYS, rfiReading } from "../model";
import { crossAt } from "../geometry";

// The clock and the path as production held them on Oct 21 2026.
const clock: RfiClock = {
  leaveDays: { p25: 31, p50: 31, p75: 31 },
  afterLeaveDays: { p25: 1, p50: 3, p75: 9, p90: null },
  slowEndDays: 14,
  slowEndFrom: "an immigration attorney's estimate",
  watched: 1246,
  afterLeaveWatched: 610,
  watchedFrom: "2026-08-27",
  test: null,
};
const path = parseRfiPath({
  since: "2026-08-28",
  entered: 1244,
  inRfi: 623,
  repliedWaiting: 93,
  decided: { certified: 487, denied: 11, withdrawn: 30, other: 0 },
  afterReply: { certified: 479, denied: 11, withdrawn: 4, other: 0 },
});
const today = "2026-10-21";

describe("the RFI figure runs the case page's own estimate", () => {
  const run = buildRfiRun({ clock, path, today })!;

  it("dates an RFI issued today exactly as estimateRfiCase does", () => {
    const est = estimateRfiCase({ enteredOn: today, today, clock });
    expect(est.kind).toBe("estimate");
    if (est.kind !== "estimate") return;
    expect(run.decideDate).toBe(est.date);
    expect(run.earliestDate).toBe(est.earliest);
    expect(run.latestDate).toBe(est.latest);
    expect([run.decideDate, run.earliestDate, run.latestDate]).toEqual(["2026-11-24", "2026-11-22", "2026-12-05"]);
    expect([run.decideDay, run.earliestDay, run.latestDay]).toEqual([34, 32, 45]);
  });

  it("takes the window from the central constant and the stay from the measured clock", () => {
    expect(run.dueDays).toBe(RFI_DUE_DAYS);
    expect(run.dueDate).toBe("2026-11-20");
    expect(run.leaveDay).toBe(clock.leaveDays.p50);
    expect(run.leaveDate).toBe("2026-11-21");
    expect([run.afterHalf, run.afterThreeQuarters, run.afterWatched]).toEqual([3, 9, 610]);
    expect(run.slowEndDays).toBe(clock.slowEndDays);
    expect(run.afterReply).toEqual({ decided: 494, certified: 479 });
  });

  it("says where the case is, day by day", () => {
    expect(rfiReading(run, -LEAD_DAYS)).toBe("October 15, 2026: the case is in analyst review, in filing order.");
    expect(rfiReading(run, 0)).toBe("October 21, 2026: DOL issues the RFI. The case leaves the line.");
    expect(rfiReading(run, 10)).toBe("October 31, 2026: day 10 of the RFI. The employer has 20 days left to answer.");
    expect(rfiReading(run, 29)).toBe("November 19, 2026: day 29 of the RFI. The employer has 1 day left to answer.");
    expect(rfiReading(run, 30)).toBe("November 20, 2026: day 30. DOL's 30 days are up.");
    expect(rfiReading(run, 31)).toBe("November 21, 2026: back in analyst review, out of filing order.");
    expect(rfiReading(run, run.decideDay)).toBe(
      "Around November 24, 2026: the date the case page gives, between November 22, 2026 and December 5, 2026.",
    );
  });

  it("keeps the cart on the main line outside the RFI and on the siding inside it", () => {
    expect(crossAt(run, -3)).toBe(0);
    expect(crossAt(run, 0)).toBe(0);
    expect(crossAt(run, 15)).toBeLessThan(0);
    expect(crossAt(run, 5)).toBe(crossAt(run, 20));
    expect(crossAt(run, run.leaveDay)).toBe(0);
    expect(crossAt(run, run.decideDay)).toBe(0);
  });

  it("shows nothing it can't stand behind", () => {
    expect(buildRfiRun({ clock: null, path, today })).toBeNull();
    // an RFI on the record's first day has no known start, so the case page gives no date
    expect(buildRfiRun({ clock, path, today: clock.watchedFrom })).toBeNull();
    // no decided-after-reply count leaves that sentence out, not the drawing
    expect(buildRfiRun({ clock, path: null, today })?.afterReply).toBeNull();
  });
});
