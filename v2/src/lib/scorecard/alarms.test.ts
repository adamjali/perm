import { describe, expect, it } from "vitest";

import { scorecardAlarms } from "./alarms";
import type { PredictionRow } from "./score";

const row = (over: Partial<PredictionRow>): PredictionRow => ({
  source: "ours",
  program: "perm",
  model: "decision-pace",
  recordedOn: "2026-10-06",
  predicted: "2026-10-20",
  bandEarly: null,
  bandLate: null,
  decidedOn: null,
  outcome: null,
  ...over,
});

const TODAY = "2026-10-07";

describe("scorecardAlarms", () => {
  it("is quiet on a healthy record, however quiet the day", () => {
    const rows = [
      row({ recordedOn: "2026-10-07" }),
      ...Array.from({ length: 30 }, (_, i) =>
        row({ recordedOn: "2026-09-01", predicted: "2026-09-30", decidedOn: `2026-10-0${1 + (i % 6)}`, outcome: "CERTIFIED" }),
      ),
    ];
    expect(scorecardAlarms(rows, TODAY)).toEqual([]);
  });

  it("says when recording stopped", () => {
    const got = scorecardAlarms([row({ recordedOn: "2026-10-01" })], TODAY);
    expect(got).toEqual([
      "PERM decision dates: nothing recorded since 2026-10-01. The daily scorecard run may be failing.",
    ]);
  });

  it("says when grades stopped while dates were due", () => {
    const rows = [
      row({ recordedOn: "2026-10-07" }),
      ...Array.from({ length: 12 }, () => row({ program: "pwd", recordedOn: "2026-10-07", predicted: "2026-09-15" })),
    ];
    const got = scorecardAlarms(rows, TODAY);
    expect(got).toHaveLength(1);
    expect(got[0]).toMatch(/^Wage-request dates: no case graded yet, though 12 predicted dates passed/);
  });

  it("stays quiet when fewer dates are due than the floor", () => {
    const rows = Array.from({ length: 5 }, () => row({ recordedOn: "2026-10-07", predicted: "2026-09-15" }));
    expect(scorecardAlarms(rows, TODAY)).toEqual([]);
  });

  it("says when the recent miss is over twice the record's and a week worse", () => {
    const steady = Array.from({ length: 30 }, () =>
      row({ recordedOn: "2026-10-07", predicted: "2026-08-01", decidedOn: "2026-08-04", outcome: "CERTIFIED" }),
    );
    const bad = Array.from({ length: 12 }, () =>
      row({ recordedOn: "2026-10-07", predicted: "2026-09-10", decidedOn: "2026-10-01", outcome: "CERTIFIED" }),
    );
    const got = scorecardAlarms([...steady, ...bad], TODAY);
    expect(got).toEqual([
      "PERM decision dates: the last 14 days' typical miss is 21 days on 12 cases, against 3 over the whole record.",
    ]);
  });

  it("grades H-2A, H-2B and CW-1 on certifications only, so a rejection is not a grade", () => {
    const rows = Array.from({ length: 12 }, () =>
      row({ program: "seasonal", recordedOn: "2026-10-07", predicted: "2026-09-15", decidedOn: "2026-09-20", outcome: "NOR ISSUED" }),
    );
    expect(scorecardAlarms(rows, TODAY)[0]).toMatch(/^H-2A, H-2B and CW-1 dates: no case graded yet/);
  });

  it("says when a weekly backtest went stale, and not before", () => {
    const at = (iso: string) => Date.parse(`${iso}T12:00:00Z`);
    expect(
      scorecardAlarms([], TODAY, [
        { label: "The weekly PERM backtest", computedAt: at("2026-09-25") },
        { label: "The weekly H-2A, H-2B and CW-1 backtest", computedAt: at("2026-10-05") },
        { label: "The weekly wage-request backtest", computedAt: null },
      ]),
    ).toEqual(["The weekly PERM backtest last ran 12 days ago; it runs weekly."]);
  });

  it("holds a nightly test to its own clock", () => {
    const at = (d: string) => Date.parse(`${d}T12:00:00Z`);
    const nightly = (d: string) => [{ label: "The nightly PERM backtest", computedAt: at(d), everyDays: 1 }];
    expect(scorecardAlarms([], "2026-10-08", nightly("2026-10-05"))).toEqual([]);
    expect(scorecardAlarms([], "2026-10-08", nightly("2026-10-04"))).toEqual([
      "The nightly PERM backtest last ran 4 days ago; it runs every night.",
    ]);
  });
});
