import { describe, expect, it } from "vitest";

import { MIN_CASE_REPORTERS } from "./communityTimeline";
import {
  MIN_REPORTS,
  OWNER_LIST_MAX,
  REPORT_CATEGORIES,
  activityDay,
  latestAllowedDay,
  linesFor,
  ownerDigest,
  postWords,
  summarizeReports,
  validateReport,
  waitDays,
  weekStarts,
  type ReportChange,
  type ReportInput,
  type ReportRecord,
} from "./consularReport";

/**
 * The consulate reports' rules: what a report may hold, and what the public figures may say. The figures
 * hold every cell to the three-report floor the timelines use, so a cell of one or two people's outcomes
 * never prints; a hidden report never counts.
 */

const TODAY = "2026-11-05"; // a Thursday
const NOW = Date.parse(`${TODAY}T12:00:00Z`);

const base: ReportInput = { post: "mumbai", category: "employment", outcome: "waiting", scheduledOn: "2026-10-01" };

function rec(over: Partial<ReportRecord> = {}): ReportRecord {
  return {
    post: "mumbai",
    category: "employment",
    outcome: "issued",
    interviewOn: "2026-11-02",
    createdAt: NOW,
    updatedAt: NOW,
    ...over,
  } as ReportRecord;
}

describe("validateReport", () => {
  it("accepts a plain report and returns only the fields it holds", () => {
    const r = validateReport({ ...base, nvcCompleteMonth: "2026-03" }, TODAY);
    expect(r).toEqual({
      ok: true,
      value: { post: "mumbai", category: "employment", outcome: "waiting", scheduledOn: "2026-10-01", nvcCompleteMonth: "2026-03" },
    });
  });

  it("takes every kind of visa, employment and the work visas listed first", () => {
    const ids = REPORT_CATEGORIES.map((c) => c.id);
    expect(ids).toEqual(["employment", "h1b", "h4", "l1", "l2", "family", "immediate", "k1", "f1", "b1b2", "other"]);
    for (const category of ids) {
      const r = validateReport({ post: "manila", category, outcome: "waiting", interviewOn: "2026-10-20" }, TODAY);
      expect(r.ok, category).toBe(true);
    }
    // A K-1 goes through NVC; an F-1 doesn't.
    expect(validateReport({ post: "manila", category: "k1", outcome: "waiting", nvcCompleteMonth: "2026-06" }, TODAY).ok).toBe(true);
    expect(validateReport({ post: "manila", category: "f1", outcome: "waiting", nvcCompleteMonth: "2026-06" }, TODAY).ok).toBe(false);
  });

  it("shares the timelines' floor of three", () => {
    expect(MIN_REPORTS).toBe(MIN_CASE_REPORTERS);
    expect(MIN_REPORTS).toBe(3);
  });

  it.each([
    ["a post slug with a capital", { post: "Mumbai" }, "post"],
    ["a post slug too short", { post: "m" }, "post"],
    ["a post slug with a slash", { post: "../admin" }, "post"],
    ["no category", { category: null }, "category"],
    ["a category off the list", { category: "eb5" }, "choice"],
    ["no outcome", { outcome: undefined }, "outcome"],
    ["an outcome off the list", { outcome: "stamped" }, "choice"],
    ["a date in the future", { scheduledOn: "2026-11-07" }, "date"],
    ["a date before 2020", { scheduledOn: "2019-12-31" }, "date"],
    ["a date that isn't one", { scheduledOn: "2026-02-30" }, "date"],
    ["a date in another shape", { scheduledOn: "10/01/2026" }, "date"],
    ["a month in the future", { nvcCompleteMonth: "2026-12" }, "date"],
    ["a month before 2020", { nvcCompleteMonth: "2019-11" }, "date"],
    ["a month that isn't one", { nvcCompleteMonth: "2026-13" }, "date"],
    ["no date at all", { scheduledOn: null }, "no-dates"],
    ["a refusal ground without a refusal", { refusalGround: "public-charge" }, "refusal-ground"],
    ["a refusal ground off the list", { outcome: "refused", interviewOn: "2026-10-20", refusalGround: "fraud" }, "choice"],
    ["a resolved day while waiting", { resolvedOn: "2026-10-10" }, "resolved"],
    ["an interview before its letter", { interviewOn: "2026-09-20" }, "order"],
    ["an interview before NVC said complete", { scheduledOn: null, interviewOn: "2026-02-10", nvcCompleteMonth: "2026-03" }, "order"],
    ["a visa issued before the interview", { outcome: "issued", interviewOn: "2026-10-20", resolvedOn: "2026-10-19" }, "order"],
    ["an approval after the visa", { outcome: "issued", interviewOn: "2026-10-20", approvedOn: "2026-10-25", resolvedOn: "2026-10-22" }, "order"],
    ["an approval before the interview", { outcome: "approved", interviewOn: "2026-10-20", approvedOn: "2026-10-19" }, "order"],
    ["an approval day with no approval", { outcome: "refused", interviewOn: "2026-10-20", approvedOn: "2026-10-20" }, "approved"],
    ["NVC's month on an H-1B", { category: "h1b", nvcCompleteMonth: "2026-03" }, "nvc"],
    ["a drop box on a green card", { mode: "dropbox" }, "nonimmigrant"],
    ["a slip colour on a green card", { outcome: "221g", interviewOn: "2026-10-20", slipColor: "white" }, "nonimmigrant"],
    ["a slip colour without a 221(g)", { category: "h1b", outcome: "issued", interviewOn: "2026-10-20", slipColor: "white" }, "221g-detail"],
    ["emailed documents without a 221(g)", { category: "h4", outcome: "waiting", interviewOn: "2026-10-20", askedToEmailDocs: "yes" }, "221g-detail"],
    ["a mode off the list", { category: "h1b", mode: "video" }, "choice"],
    ["a slip colour off the list", { category: "h1b", outcome: "221g", interviewOn: "2026-10-20", slipColor: "orange" }, "choice"],
  ])("refuses %s", (_, over, code) => {
    const r = validateReport({ ...base, ...over } as ReportInput, TODAY);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe(code);
  });

  it("allows a day ahead of UTC, for someone reporting from Manila or Auckland in the morning", () => {
    expect(latestAllowedDay(TODAY)).toBe("2026-11-06");
    expect(validateReport({ ...base, scheduledOn: "2026-11-06" }, TODAY).ok).toBe(true);
  });

  it("keeps a refusal ground only on a refusal, and a resolved day on an issue or a 221(g)", () => {
    const refused = validateReport({ ...base, outcome: "refused", interviewOn: "2026-10-20", refusalGround: "public-charge" }, TODAY);
    expect(refused.ok && refused.value.refusalGround).toBe("public-charge");
    const cleared = validateReport({ ...base, outcome: "221g", interviewOn: "2026-10-20", resolvedOn: "2026-11-01" }, TODAY);
    expect(cleared.ok && cleared.value.resolvedOn).toBe("2026-11-01");
  });

  it("takes a nonimmigrant stamping report with every detail it can carry", () => {
    const r = validateReport(
      {
        post: "mumbai",
        category: "h1b",
        mode: "interview",
        scheduledOn: "2026-10-01",
        interviewOn: "2026-10-20",
        outcome: "221g",
        slipColor: "white",
        askedToEmailDocs: "yes",
        resolvedOn: "2026-11-01",
      },
      TODAY,
    );
    expect(r).toMatchObject({ ok: true, value: { category: "h1b", mode: "interview", slipColor: "white", askedToEmailDocs: "yes" } });
    const visitor = validateReport({ post: "mumbai", category: "h4", mode: "dropbox", interviewOn: "2026-10-02", outcome: "passport-returned", approvedOn: "2026-10-09", resolvedOn: "2026-10-14" }, TODAY);
    expect(visitor.ok).toBe(true);
    const refused = validateReport({ post: "mumbai", category: "l1", interviewOn: "2026-10-02", outcome: "refused", refusalGround: "214b" }, TODAY);
    expect(refused.ok && refused.value.refusalGround).toBe("214b");
    // "Another visa" can carry either kind of question.
    expect(validateReport({ post: "mumbai", category: "other", nvcCompleteMonth: "2026-01", mode: "interview", interviewOn: "2026-10-02", outcome: "waiting" }, TODAY).ok).toBe(true);
  });

  it("takes an empty string as no answer, the way a cleared form field arrives", () => {
    const r = validateReport({ ...base, nvcCompleteMonth: "", interviewOn: "", resolvedOn: "" }, TODAY);
    expect(r.ok).toBe(true);
    if (r.ok) expect(Object.keys(r.value).sort()).toEqual(["category", "outcome", "post", "scheduledOn"]);
  });
});

describe("the exact category, why the 221(g), who cancelled", () => {
  const ok = (over: ReportInput) => validateReport({ ...base, ...over }, TODAY);

  it("takes an exact category only from the kind of visa's own list", () => {
    expect(ok({ line: "eb2" })).toMatchObject({ ok: true, value: { line: "eb2" } });
    expect(ok({ category: "family", line: "f2a" })).toMatchObject({ ok: true, value: { line: "f2a" } });
    expect(ok({ category: "immediate", line: "ir1" })).toMatchObject({ ok: true, value: { line: "ir1" } });
    // F2A isn't an employment category, and an H-1B has none.
    expect(ok({ line: "f2a" })).toMatchObject({ ok: false, code: "line" });
    expect(ok({ category: "h1b", line: "eb2" })).toMatchObject({ ok: false, code: "line" });
    expect(ok({ line: "eb9" })).toMatchObject({ ok: false, code: "choice" });
    expect(linesFor("h1b")).toEqual([]);
    expect(linesFor("family").map((l) => l.id)).toEqual(["f1", "f2a", "f2b", "f3", "f4"]);
  });

  it("keeps why the 221(g) only on a 221(g), for any kind of visa", () => {
    expect(ok({ category: "immediate", outcome: "221g", holdReason: "public-charge" })).toMatchObject({
      ok: true,
      value: { holdReason: "public-charge" },
    });
    expect(ok({ category: "h1b", outcome: "221g", holdReason: "admin" })).toMatchObject({ ok: true });
    expect(ok({ outcome: "refused", holdReason: "documents" })).toMatchObject({ ok: false, code: "hold-reason" });
  });

  it("keeps who cancelled only on a cancelled or moved interview", () => {
    expect(ok({ outcome: "cancelled", cancelledBy: "consulate" })).toMatchObject({ ok: true, value: { cancelledBy: "consulate" } });
    expect(ok({ outcome: "rescheduled", cancelledBy: "me" })).toMatchObject({ ok: true, value: { cancelledBy: "me" } });
    expect(ok({ outcome: "issued", cancelledBy: "me" })).toMatchObject({ ok: false, code: "cancelled-by" });
  });

  it("prints each breakdown only past the floor, and leaves out answers nobody gave", () => {
    const twoEb2 = [rec({ line: "eb2" }), rec({ line: "eb2" })];
    // Two employment reports: the cell is shut, so no category breakdown either.
    expect(summarizeReports(twoEb2, TODAY).categories.find((c) => c.id === "employment")!.byLine).toEqual([]);
    const cell = summarizeReports([...twoEb2, rec({ line: "eb3" }), rec()], TODAY).categories.find((c) => c.id === "employment")!;
    expect(cell.byLine).toEqual([
      { id: "eb2", label: "EB-2", count: 2 },
      { id: "eb3", label: "EB-3", count: 1 },
    ]);

    const g = (holdReason?: string) => rec({ outcome: "221g", holdReason } as Partial<ReportRecord>);
    expect(summarizeReports([g("public-charge"), g("documents"), rec(), rec()], TODAY).results.holdReasons).toEqual([]);
    expect(summarizeReports([g("public-charge"), g("public-charge"), g()], TODAY).results.holdReasons).toEqual([
      { id: "public-charge", label: "Public charge or I-864", count: 2 },
    ]);

    const moved = (cancelledBy?: string) =>
      rec({ outcome: "cancelled", interviewOn: undefined, scheduledOn: "2026-11-01", cancelledBy } as Partial<ReportRecord>);
    expect(summarizeReports([moved("consulate"), moved("me")], TODAY).moved).toEqual({ days: 90, n: null, byWho: [] });
    expect(summarizeReports([moved("consulate"), moved("consulate"), moved()], TODAY).moved).toEqual({
      days: 90,
      n: 3,
      byWho: [{ id: "consulate", label: "The consulate", count: 2 }],
    });
  });
});

describe("the dates a report is read by", () => {
  it("dates a report by its newest step, or the day it was saved", () => {
    expect(activityDay(rec({ scheduledOn: "2026-09-01", interviewOn: "2026-10-01", resolvedOn: "2026-10-15" }))).toBe("2026-10-15");
    expect(activityDay(rec({ interviewOn: undefined, nvcCompleteMonth: "2026-01" }))).toBe(TODAY);
  });

  it("counts the wait from the middle of the NVC month", () => {
    expect(waitDays(rec({ nvcCompleteMonth: "2026-10", interviewOn: "2026-11-04" }))).toBe(20);
    expect(waitDays(rec({ nvcCompleteMonth: "2026-10", interviewOn: "2026-11-04", outcome: "cancelled" }))).toBeNull();
    expect(waitDays(rec({ nvcCompleteMonth: undefined }))).toBeNull();
  });

  it("weeks start on Monday, the newest one holding today", () => {
    const weeks = weekStarts(TODAY, 3);
    expect(weeks).toEqual(["2026-10-19", "2026-10-26", "2026-11-02"]);
  });
});

describe("summarizeReports: the floor", () => {
  it("prints nothing about two reports but their number", () => {
    const v = summarizeReports([rec(), rec({ outcome: "221g" })], TODAY);
    expect(v.total).toBe(2);
    const w30 = v.windows.find((w) => w.days === 30)!;
    expect(w30).toMatchObject({ total: 2, open: false, byOutcome: [] });
    expect(v.categories.find((c) => c.id === "employment")).toMatchObject({ count: null, open: false, byOutcome: [] });
    expect(v.results).toEqual({ days: 90, n: null, g221: null, share: null, holdReasons: [] });
    expect(v.moved).toEqual({ days: 90, n: null, byWho: [] });
    expect(v.wait).toMatchObject({ n: null, median: null });
    expect(v.weeks.every((w) => w.count === null)).toBe(true);
  });

  it("opens each figure at three, and holds a category of two shut beside a category of three", () => {
    const rows = [
      rec({ nvcCompleteMonth: "2026-08" }),
      rec({ outcome: "221g", nvcCompleteMonth: "2026-08" }),
      rec({ outcome: "refused", refusalGround: "public-charge", nvcCompleteMonth: "2026-08" }),
      rec({ category: "h4", outcome: "issued" }),
      rec({ category: "h4", outcome: "waiting", interviewOn: undefined, scheduledOn: "2026-10-20" }),
    ];
    const v = summarizeReports(rows, TODAY);
    const w30 = v.windows.find((w) => w.days === 30)!;
    expect(w30.open).toBe(true);
    expect(Object.fromEntries(w30.byOutcome.map((o) => [o.id, o.count]))).toEqual({ issued: 2, "221g": 1, refused: 1, waiting: 1 });
    expect(v.categories.find((c) => c.id === "employment")).toMatchObject({ count: 3, open: true });
    expect(v.categories.find((c) => c.id === "h4")).toMatchObject({ count: null, open: false, byOutcome: [] });
    // Four interviews with a result: two issued, one 221(g), one refused.
    expect(v.results).toEqual({ days: 90, n: 4, g221: 1, share: 0.25, holdReasons: [] });
    // The week of Nov 2 holds four interviews held; the weeks before hold none.
    expect(v.weeks[v.weeks.length - 1]).toMatchObject({ start: "2026-11-02", count: 4, partial: true });
    expect(v.weeks[v.weeks.length - 2]?.count).toBeNull();
    // Three waits from mid-August to Nov 2: 79 days each.
    expect(v.wait).toMatchObject({ n: 3, median: 79 });
  });

  it("after the interview, never prints a median of the finished without the count still waiting", () => {
    const h1b = (over: Partial<ReportRecord>) => rec({ category: "h1b", interviewOn: "2026-10-20", ...over });
    // Two finished and one waiting: the pair shows, the median doesn't (two finished is under the floor).
    let v = summarizeReports(
      [
        h1b({ outcome: "approved", approvedOn: "2026-10-20" }),
        h1b({ outcome: "issued", approvedOn: "2026-10-20", resolvedOn: "2026-10-27" }),
        h1b({ outcome: "221g", slipColor: "white" }),
      ],
      TODAY,
    );
    expect(v.categories.find((c) => c.id === "h1b")?.after).toEqual({ finished: 2, waiting: 1, median: null });
    // A third finished, a cleared 221(g), and a drop box still waiting.
    v = summarizeReports(
      [
        h1b({ outcome: "approved", approvedOn: "2026-10-20" }),
        h1b({ outcome: "issued", approvedOn: "2026-10-20", resolvedOn: "2026-10-27" }),
        h1b({ outcome: "221g", slipColor: "white", resolvedOn: "2026-11-03" }),
        h1b({ outcome: "waiting", mode: "dropbox" }),
        h1b({ outcome: "refused", refusalGround: "214b" }),
      ],
      TODAY,
    );
    // Finished in 0, 0 and 14 days; the refusal is neither finished nor waiting.
    expect(v.categories.find((c) => c.id === "h1b")?.after).toEqual({ finished: 3, waiting: 1, median: 0 });
    // A drop box isn't an interview held, so the week counts four of the five.
    expect(v.weeks.find((w) => w.start === "2026-10-19")?.count).toBe(4);
    // Under three appointments, nothing at all.
    expect(summarizeReports([h1b({ outcome: "waiting" })], TODAY).categories.find((c) => c.id === "h1b")?.after).toEqual({
      finished: null,
      waiting: null,
      median: null,
    });
  });

  it("dates an approval as a step: a report approved this week is this week's", () => {
    expect(activityDay(rec({ interviewOn: "2026-08-01", approvedOn: "2026-11-01" }))).toBe("2026-11-01");
  });

  it("never counts a hidden report", () => {
    const rows = [rec(), rec(), rec({ hidden: true })];
    const v = summarizeReports(rows, TODAY);
    expect(v.total).toBe(2);
    expect(v.windows.every((w) => !w.open)).toBe(true);
    expect(v.weeks[v.weeks.length - 1]?.count).toBeNull();
  });

  it("leaves a report older than 90 days out of both windows, and a cancelled interview out of the week", () => {
    const rows = [
      rec(),
      rec(),
      rec({ outcome: "cancelled" }),
      rec({ interviewOn: "2026-06-01", createdAt: NOW, updatedAt: NOW }),
    ];
    const v = summarizeReports(rows, TODAY);
    expect(v.total).toBe(4);
    expect(v.windows.find((w) => w.days === 90)?.total).toBe(3);
    // Two held interviews that week: under the floor.
    expect(v.weeks[v.weeks.length - 1]?.count).toBeNull();
  });
});

describe("ownerDigest: the owner's daily email", () => {
  const since = 1_000_000;
  const row = (over: Partial<ReportChange> = {}): ReportChange => ({
    post: "manila",
    category: "k1",
    outcome: "221g",
    refusalGround: null,
    interviewOn: "2026-11-03",
    line: null,
    holdReason: null,
    cancelledBy: null,
    createdAt: since + 10,
    updatedAt: since + 10,
    hidden: false,
    ...over,
  });

  it("sends nothing on a day with no reports", () => {
    expect(ownerDigest([], since, "https://x")).toBeNull();
  });

  it("names each report's consulate, visa, result and appointment, new or edited, with its page", () => {
    const d = ownerDigest(
      [row(), row({ post: "ciudad-juarez", category: "immediate", outcome: "refused", refusalGround: "public-charge", createdAt: since - 5, hidden: true })],
      since,
      "https://x",
    )!;
    expect(d.subject).toBe("Consulate reports today: 2 reports");
    expect(d.text).toContain("1 new, 1 edited");
    expect(d.text).toContain("- Manila, K-1 fiancé(e): 221(g), more processing. appointment Nov 3. new. https://x/consular-posts/manila#reports");
    expect(d.text).toContain("Ciudad Juarez");
    expect(d.text).toContain("Refused (Public charge)");
    expect(d.text).toContain("edited. hidden.");
    const g = ownerDigest([row({ category: "family", line: "f2a", holdReason: "public-charge" })], since, "https://x")!;
    expect(g.text).toContain("- Manila, Family preference, F2A: 221(g), more processing (Public charge or I-864).");
    expect(d.text).toContain("https://x/admin#reviews");
  });

  it("lists at most OWNER_LIST_MAX and counts the rest; says 'at least' when the read stopped short", () => {
    const many = Array.from({ length: OWNER_LIST_MAX + 3 }, () => row());
    const d = ownerDigest(many, since, "https://x", true)!;
    expect(d.text.split("\n").filter((l) => l.startsWith("- "))).toHaveLength(OWNER_LIST_MAX);
    expect(d.text).toContain("3 more on the admin page.");
    expect(d.subject).toBe(`Consulate reports today: at least ${OWNER_LIST_MAX + 3} reports`);
  });

  it("reads a slug as words", () => {
    expect(postWords("ciudad-juarez")).toBe("Ciudad Juarez");
    expect(postWords("manila")).toBe("Manila");
  });
});
