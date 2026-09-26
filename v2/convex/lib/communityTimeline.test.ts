import { describe, expect, it } from "vitest";

import {
  BOARD_OPENS_AT,
  METRIC_MIN_N,
  computeMetrics,
  daysBetween,
  summarizeRfes,
  toBoardRow,
  validateTimeline,
  type TimelineRecord,
} from "./communityTimeline";

const TODAY = "2026-09-26";

describe("validateTimeline", () => {
  it("accepts a plain adjustment timeline and keeps public off unless ticked", () => {
    const r = validateTimeline(
      { category: "eb2", country: "india", route: "adjustment", i140FiledOn: "2026-01-10", i140ApprovedOn: "2026-01-20", premium: true },
      TODAY,
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.public).toBe(false);
    expect(r.value.premium).toBe(true);
    expect(r.value.i140ApprovedOn).toBe("2026-01-20");
  });

  it("refuses a timeline with no date after PERM", () => {
    const r = validateTimeline({ category: "eb3", public: true }, TODAY);
    expect(r).toEqual({ ok: false, message: expect.stringMatching(/at least one date/) });
  });

  it.each([
    ["a future date", { i140FiledOn: "2026-09-27" }],
    ["a malformed date", { i140FiledOn: "2026-9-1" }],
    ["an impossible date", { i140FiledOn: "2026-02-31x" }],
    ["a date before 2005", { i140FiledOn: "2004-12-31" }],
    ["an unknown category", { category: "eb1", i140FiledOn: "2026-01-01" }],
    ["an unknown RFE reason", { rfeForm: "i140", rfeReason: "vibes", i140FiledOn: "2026-01-01" }],
    ["a string too long to be a choice", { country: "x".repeat(40), i140FiledOn: "2026-01-01" }],
  ])("refuses %s", (_, input) => {
    expect(validateTimeline(input, TODAY).ok).toBe(false);
  });

  it("refuses an approval dated before its filing, and a response before the RFE", () => {
    expect(validateTimeline({ i140FiledOn: "2026-03-01", i140ApprovedOn: "2026-02-01" }, TODAY).ok).toBe(false);
    expect(
      validateTimeline({ i140FiledOn: "2026-03-01", rfeForm: "i140", rfeIssuedOn: "2026-04-01", rfeRespondedOn: "2026-03-20" }, TODAY).ok,
    ).toBe(false);
  });

  it("allows a concurrent I-485 filed the same day as, or before, the I-140 date", () => {
    expect(validateTimeline({ i140FiledOn: "2026-03-01", i485FiledOn: "2026-03-01" }, TODAY).ok).toBe(true);
    expect(validateTimeline({ i140FiledOn: "2026-03-05", i485FiledOn: "2026-03-01" }, TODAY).ok).toBe(true);
  });

  it("needs the form when any RFE field is given", () => {
    expect(validateTimeline({ i140FiledOn: "2026-03-01", rfeReason: "experience" }, TODAY).ok).toBe(false);
  });

  it("refuses an adjustment-only date on a consular timeline rather than printing a contradiction", () => {
    const r = validateTimeline({ route: "consular", i140FiledOn: "2026-01-01", eadOn: "2026-05-01" }, TODAY);
    expect(r.ok).toBe(false);
    expect(validateTimeline({ route: "consular", i140FiledOn: "2026-01-01", interviewOn: "2026-08-01" }, TODAY).ok).toBe(true);
  });
});

describe("daysBetween", () => {
  it("counts whole calendar days and returns null for a missing end", () => {
    expect(daysBetween("2026-01-01", "2026-03-01")).toBe(59);
    expect(daysBetween("2026-01-01", undefined)).toBeNull();
  });
});

const rec = (over: Partial<TimelineRecord>): TimelineRecord => ({ public: false, updatedAt: Date.UTC(2026, 8, 1), ...over });

describe("computeMetrics", () => {
  it("prints no median below the minimum count, and one at it", () => {
    const four = Array.from({ length: METRIC_MIN_N - 1 }, (_, i) =>
      rec({ i140FiledOn: "2026-01-01", i140ApprovedOn: `2026-01-${String(10 + i).padStart(2, "0")}`, premium: true }),
    );
    const m4 = computeMetrics(four).find((m) => m.id === "i140-premium")!;
    expect(m4.n).toBe(METRIC_MIN_N - 1);
    expect(m4.median).toBeNull();
    const five = [...four, rec({ i140FiledOn: "2026-01-01", i140ApprovedOn: "2026-01-20", premium: true })];
    const m5 = computeMetrics(five).find((m) => m.id === "i140-premium")!;
    expect(m5.n).toBe(METRIC_MIN_N);
    expect(m5.median).toBe(11);
  });

  it("keeps premium and regular I-140s apart, and skips an unknown premium", () => {
    const rows = [
      ...Array.from({ length: 5 }, () => rec({ i140FiledOn: "2026-01-01", i140ApprovedOn: "2026-01-11", premium: true })),
      ...Array.from({ length: 5 }, () => rec({ i140FiledOn: "2026-01-01", i140ApprovedOn: "2026-07-01", premium: false })),
      rec({ i140FiledOn: "2026-01-01", i140ApprovedOn: "2026-02-01" }),
    ];
    const ms = computeMetrics(rows);
    expect(ms.find((m) => m.id === "i140-premium")!.median).toBe(10);
    expect(ms.find((m) => m.id === "i140-regular")!.median).toBe(181);
    expect(ms.find((m) => m.id === "i140-regular")!.n).toBe(5);
  });

  it("drops a negative duration and a hidden row rather than averaging them in", () => {
    const rows = [
      ...Array.from({ length: 5 }, () => rec({ permFiledOn: "2025-01-01", permCertifiedOn: "2025-12-01" })),
      rec({ permFiledOn: "2025-12-01", permCertifiedOn: "2025-01-01" }),
      rec({ permFiledOn: "2025-01-01", permCertifiedOn: "2025-02-01", hiddenAt: 1 }),
    ];
    const perm = computeMetrics(rows).find((m) => m.id === "perm")!;
    expect(perm.n).toBe(5);
    expect(perm.median).toBe(334);
    expect(perm.verified).toBe(true);
  });
});

describe("summarizeRfes", () => {
  it("counts by form, reason and outcome, busiest first, and leaves out empty buckets", () => {
    const s = summarizeRfes([
      rec({ rfeForm: "i140", rfeReason: "experience", rfeOutcome: "approved" }),
      rec({ rfeForm: "i140", rfeReason: "experience", rfeOutcome: "pending" }),
      rec({ rfeForm: "i485", rfeReason: "medical" }),
      rec({ i140FiledOn: "2026-01-01" }),
    ]);
    expect(s.total).toBe(3);
    expect(s.byForm.map((f) => [f.id, f.count])).toEqual([["i140", 2], ["i485", 1]]);
    expect(s.byReason[0]).toMatchObject({ id: "experience", count: 2 });
    expect(s.byOutcome.find((o) => o.id === "denied")).toBeUndefined();
  });
});

describe("toBoardRow", () => {
  it("never carries a case number, an employer or an exact PERM date", () => {
    const row = toBoardRow(
      rec({ permFiledOn: "2025-06-17", permCertifiedOn: "2026-05-04", i140FiledOn: "2026-05-20", category: "eb3", public: true }),
    );
    const text = JSON.stringify(row);
    expect(text).not.toMatch(/G-\d{3}/);
    expect(text).not.toContain("2025-06-17");
    expect(text).not.toContain("2026-05-04");
    expect(row.filedMonth).toBe("2025-06");
    expect(row.permVerified).toBe(true);
    expect(row.stops.find((s) => s.id === "permCertifiedOn")!.day).toBe(321);
    expect(row.stops.find((s) => s.id === "i140FiledOn")!.day).toBe(337);
  });

  it("marks the PERM half unverified when DOL's record was not found", () => {
    expect(toBoardRow(rec({ i140FiledOn: "2026-05-20" })).permVerified).toBe(false);
  });
});

it("opens the board at a threshold that is more than one row", () => {
  expect(BOARD_OPENS_AT).toBeGreaterThan(METRIC_MIN_N);
});
