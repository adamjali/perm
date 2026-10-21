import { describe, expect, it } from "vitest";
import { estimatePriorityDate, type BulletinMonth } from "@/lib/perm";
import { buildBulletinRun, captionOf, frameAt, keySteps, pickExample, poseOf, readingAt } from "../model";

// EB-2 India's final action cutoff as the archive holds it, November 2024 to October 2026.
const EB2_INDIA: [string, string][] = [
  ["2024-11", "15JUL12"], ["2024-12", "01AUG12"], ["2025-01", "01OCT12"], ["2025-02", "15OCT12"],
  ["2025-03", "01DEC12"], ["2025-04", "01JAN13"], ["2025-05", "01JAN13"], ["2025-06", "01JAN13"],
  ["2025-07", "01JAN13"], ["2025-08", "01JAN13"], ["2025-09", "01JAN13"], ["2025-10", "01APR13"],
  ["2025-11", "01APR13"], ["2025-12", "15MAY13"], ["2026-01", "15JUL13"], ["2026-02", "15JUL13"],
  ["2026-03", "15SEP13"], ["2026-04", "15JUL14"], ["2026-05", "15JUL14"], ["2026-06", "01SEP13"],
  ["2026-07", "U"], ["2026-08", "U"], ["2026-09", "U"], ["2026-10", "01NOV13"],
];
const bulletin = (month: string, cell: string): BulletinMonth => ({
  bulletinMonth: month,
  finalAction: { EB2: { india: cell, worldwide: "C" } },
  datesForFiling: {},
});
const archive = (rows: [string, string][]) => [bulletin("2024-10", "15JUL12"), ...rows.map(([m, c]) => bulletin(m, c))];

describe("the bulletin figure draws one line's real bulletins", () => {
  const run = buildBulletinRun({ bulletins: archive(EB2_INDIA) })!;
  const at = (month: string) => run.steps.findIndex((s) => s.month === month);

  it("shows the newest 24 months the line was printed, one step a month, on a rail of whole years", () => {
    expect(run.label).toBe("EB-2 India");
    expect(run.steps.map((s) => s.month)).toEqual(EB2_INDIA.map(([m]) => m));
    expect(run.steps[0]!.cutoff).toEqual({ kind: "date", iso: "2012-07-15" });
    expect(run.steps[at("2026-07")]!.cutoff).toEqual({ kind: "unavailable" });
    expect([run.railFrom, run.railTo]).toEqual(["2012-01-01", "2015-01-01"]);
  });

  it("picks the example from the window's biggest step back, never on a cutoff", () => {
    // June 2026 took the cutoff from Jul 15, 2014 back to Sep 1, 2013; the middle is early Feb 2014
    expect(run.example).toBe("2014-02-01");
    expect(run.steps.some((s) => s.cutoff?.kind === "date" && s.cutoff.iso === run.example)).toBe(false);
    // a first of the month that is itself a cutoff moves to the 15th
    expect(pickExample([{ kind: "date", iso: "2014-03-20" }, { kind: "date", iso: "2014-02-01" }])).toBe("2014-02-15");
    // with no step back, the middle of the movement
    expect(pickExample([{ kind: "date", iso: "2014-02-01" }, { kind: "date", iso: "2014-03-20" }])).toBe("2014-02-15");
    expect(pickExample([{ kind: "date", iso: "2014-01-10" }, { kind: "date", iso: "2014-05-20" }])).toBe("2014-03-01");
  });

  it("judges the example date with the central rule, month by month", () => {
    for (const step of run.steps) {
      const one = archive(EB2_INDIA).filter((b) => b.bulletinMonth === step.month);
      expect(step.exampleCurrent).toBe(estimatePriorityDate({ priorityDate: run.example, category: "EB2", country: "india", chart: "finalAction", bulletins: one }).isCurrent);
    }
    expect(run.steps.filter((s) => s.exampleCurrent).map((s) => s.month)).toEqual(["2026-04", "2026-05"]);
  });

  it("never draws Unavailable as a date: the door shuts and the gate lifts where it stood", () => {
    expect(poseOf(run, run.steps[at("2026-07")]!)).toEqual({ gate: null, strip: null, shut: 1 });
    const june = poseOf(run, run.steps[at("2026-06")]!);
    const half = frameAt(run, at("2026-06") + 0.5);
    expect(half.gate).toBeCloseTo(june.gate!, 9); // no slide toward the rail's end
    expect(half.gateShown).toBeCloseTo(0.5, 9);
    expect(half.stripShown).toBeCloseTo(0.5, 9);
    expect(half.shut).toBeCloseTo(0.5, 9);
    // reopening in October: the gate comes down at October's cutoff, not slid from June's
    const back = frameAt(run, at("2026-09") + 0.5);
    expect(back.gate).toBeCloseTo(poseOf(run, run.steps[at("2026-10")]!).gate!, 9);
  });

  it("opens the whole rail for Current and lifts the gate", () => {
    const current = buildBulletinRun({ bulletins: archive(EB2_INDIA.map(([m, c]) => [m, m === "2025-06" ? "C" : c])) })!;
    expect(poseOf(current, current.steps[at("2025-06")]!)).toEqual({ gate: null, strip: 1, shut: 0 });
    expect(readingAt(current, at("2025-06"))).toBe("June 2025 bulletin: Current. Every date is current.");
  });

  it("treats a month the archive doesn't hold as a break, never a point to draw through", () => {
    const gap = buildBulletinRun({ bulletins: archive(EB2_INDIA.filter(([m]) => m !== "2025-02")) })!;
    const i = gap.steps.findIndex((s) => s.month === "2025-02");
    expect(gap.steps[i]!.cutoff).toBeNull();
    expect(poseOf(gap, gap.steps[i]!)).toEqual({ gate: null, strip: null, shut: 0 });
    const into = frameAt(gap, i - 0.5);
    expect(into.gate).toBeCloseTo(poseOf(gap, gap.steps[i - 1]!).gate!, 9);
    expect(readingAt(gap, i)).toBe("The archive holds no EB-2 India cutoff for February 2025.");
    expect(captionOf(gap)).toContain("23 of the 24 bulletins");
    expect(captionOf(gap)).toContain("The archive holds no cutoff for February 2025, so the drawing shows none.");
  });

  it("reads each bulletin in words", () => {
    expect(readingAt(run, 0)).toBe("November 2024 bulletin: cutoff Jul 15, 2012. Feb 1, 2014 waits.");
    expect(readingAt(run, at("2026-04"))).toBe("April 2026 bulletin: cutoff Jul 15, 2014. Feb 1, 2014 is current.");
    expect(readingAt(run, at("2026-08"))).toBe("August 2026 bulletin: Unavailable. No date is current.");
  });

  it("tells what happened, in order, from the steps", () => {
    const caption = captionOf(run);
    expect(caption).toContain("EB-2 India's final action cutoff in the 24 bulletins from November 2024 to October 2026");
    const story = [
      "In April 2026 the cutoff passed it, so it was current.",
      "In June 2026 the cutoff went back to September 1, 2013, and the example date waited again.",
      "From July to September 2026 the line was Unavailable. The door shut, and no date was current however early. The October 2026 bulletin opened it again at November 1, 2013.",
    ];
    const places = story.map((s) => caption.indexOf(s));
    expect(places.every((p) => p >= 0)).toBe(true);
    expect([...places].sort((a, b) => a - b)).toEqual(places);
    expect(caption).toContain("Current, printed C, lifts the gate away, so every date is current. Unavailable, printed U, shuts the door, so none is.");
  });

  it("holds longer on the bulletins that changed something", () => {
    expect([...keySteps(run)].sort((a, b) => a - b)).toEqual([at("2026-04"), at("2026-06"), at("2026-07"), at("2026-10")]);
  });

  it("shows nothing it can't stand behind", () => {
    expect(buildBulletinRun({ bulletins: [] })).toBeNull();
    expect(buildBulletinRun({ bulletins: archive(EB2_INDIA), category: "EB9" })).toBeNull();
    expect(buildBulletinRun({ bulletins: archive(EB2_INDIA), country: "worldwide" })).toBeNull(); // only ever Current here
  });
});
