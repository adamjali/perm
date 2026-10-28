import { describe, expect, it } from "vitest";

import { statusHistory, type StatusEvent } from "../statusHistory";

// An instant at a given Eastern hour (EDT, UTC-4, in the autumn days these use).
const at = (day: string, hourEt: number) => Date.parse(`${day}T${String(hourEt + 4).padStart(2, "0")}:00:00Z`);
const ev = (day: string, hour: number, from: string, to: string): StatusEvent => ({ at: at(day, hour), from, to });

describe("a case's status history", () => {
  it("lists the status it held when our record began, then each change on DOL's day, with how long each held", () => {
    const steps = statusHistory([
      ev("2026-09-30", 10, "ANALYST REVIEW", "RFI ISSUED"),
      ev("2026-11-03", 15, "RFI ISSUED", "ANALYST REVIEW"),
      ev("2026-11-10", 10, "ANALYST REVIEW", "CERTIFIED"),
    ]);
    expect(steps).toEqual([
      { status: "ANALYST REVIEW", since: null, days: null },
      { status: "RFI ISSUED", since: "2026-09-30", days: 34 },
      { status: "ANALYST REVIEW", since: "2026-11-03", days: 7 },
      { status: "CERTIFIED", since: "2026-11-10", days: null },
    ]);
  });

  it("a change seen during the record's catch-up (to Aug 29) says where the case stood, not when it moved", () => {
    const steps = statusHistory([
      ev("2026-08-28", 10, "DENIED", "RECONSIDERATION APPEALS"),
      ev("2026-09-23", 10, "RECONSIDERATION APPEALS", "NORD ISSUED"),
    ]);
    expect(steps).toEqual([
      { status: "RECONSIDERATION APPEALS", since: null, days: null },
      { status: "NORD ISSUED", since: "2026-09-23", days: null },
    ]);
  });

  it("dates a change seen before 7 AM Eastern to the day before, DOL's working day", () => {
    const steps = statusHistory([ev("2026-10-17", 4, "ANALYST REVIEW", "CERTIFIED")]);
    expect(steps[1]).toMatchObject({ status: "CERTIFIED", since: "2026-10-16" });
  });

  it("a case filed after the record began starts on its filing day, with its first status's length", () => {
    const steps = statusHistory([ev("2026-10-20", 10, "ANALYST REVIEW", "APPLICATION ON HOLD")], "2026-09-15");
    expect(steps[0]).toEqual({ status: "ANALYST REVIEW", since: "2026-09-15", days: 35, filed: true });
    // Filed during the catch-up: its start isn't dated either.
    expect(statusHistory([ev("2026-10-20", 10, "ANALYST REVIEW", "DENIED")], "2026-08-27")[0]!.since).toBeNull();
    // Filed before the record began: the start is unknown, so no length.
    expect(statusHistory([ev("2026-10-20", 10, "ANALYST REVIEW", "DENIED")], "2025-03-01")[0]).toEqual({
      status: "ANALYST REVIEW",
      since: null,
      days: null,
    });
  });

  it("keeps the later of two changes on one DOL day, and drops a change to the same status", () => {
    const steps = statusHistory([
      ev("2026-10-01", 10, "ANALYST REVIEW", "RFI ISSUED"),
      ev("2026-10-01", 15, "RFI ISSUED", "ANALYST REVIEW"),
      ev("2026-10-05", 10, "ANALYST REVIEW", "analyst review "),
    ]);
    expect(steps).toEqual([]);
  });

  it("shows nothing when nothing changed on our record", () => {
    expect(statusHistory([])).toEqual([]);
  });
});
