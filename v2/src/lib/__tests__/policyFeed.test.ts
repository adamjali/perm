import { describe, expect, it } from "vitest";

import {
  assignBarLanes,
  assignLanes,
  awaitsRegister,
  BALCA_TYPE,
  BILL_TYPE,
  buildFeed,
  COURT_TYPE,
  buildStrip,
  commentWindow,
  daysBetween,
  effectiveState,
  feedLedger,
  foldCorrections,
  STRIP_PAD,
  STRIP_W,
} from "@/lib/policyFeed";
import type { PolicyNotice } from "@/lib/db/policyNotices";

function n(over: Partial<PolicyNotice> & { documentNumber: string; publicationDate: string }): PolicyNotice {
  return {
    type: "Rule",
    title: `Doc ${over.documentNumber}`,
    abstract: "First sentence. Second sentence.",
    url: `https://www.federalregister.gov/d/${over.documentNumber}`,
    agencies: ["Homeland Security Department"],
    topics: ["H-1B"],
    effectiveOn: null,
    commentsCloseOn: null,
    commentUrl: null,
    citation: null,
    action: null,
    dates: null,
    correctionOf: null,
    pdfUrl: null,
    source: null,
    status: null,
    piFiled: null,
    signingDate: null,
    supersededBy: null,
    ...over,
  };
}

const TODAY = "2026-09-16";

describe("foldCorrections", () => {
  it("attaches a correction to the document it corrects and drops it from the list", () => {
    const parent = n({ documentNumber: "2026-17324", publicationDate: "2026-08-25", type: "Proposed Rule" });
    const fix = n({ documentNumber: "C1-2026-17324", publicationDate: "2026-09-10", type: "Proposed Rule", correctionOf: "2026-17324" });
    const out = foldCorrections([fix, parent]);
    expect(out.map((d) => d.documentNumber)).toEqual(["2026-17324"]);
    expect(out[0]!.corrections.map((c) => c.documentNumber)).toEqual(["C1-2026-17324"]);
  });

  it("recognises a correction by its number when correction_of was not stored", () => {
    const parent = n({ documentNumber: "2026-1", publicationDate: "2026-08-01" });
    const fix = n({ documentNumber: "C1-2026-1", publicationDate: "2026-08-05" });
    const out = foldCorrections([parent, fix]);
    expect(out).toHaveLength(1);
    expect(out[0]!.corrections).toHaveLength(1);
  });

  it("keeps an orphan correction as its own entry rather than losing the record", () => {
    const fix = n({ documentNumber: "C1-2026-9", publicationDate: "2026-08-05", correctionOf: "2026-9" });
    const out = foldCorrections([fix]);
    expect(out.map((d) => d.documentNumber)).toEqual(["C1-2026-9"]);
  });

  it("sorts newest first", () => {
    const out = foldCorrections([
      n({ documentNumber: "a", publicationDate: "2026-01-01" }),
      n({ documentNumber: "b", publicationDate: "2026-03-01" }),
    ]);
    expect(out.map((d) => d.documentNumber)).toEqual(["b", "a"]);
  });
});

describe("buildFeed", () => {
  const feed = buildFeed([
    n({ documentNumber: "oflc-1", publicationDate: "2026-08-14", type: "OFLC announcement", topics: ["perm"] }),
    n({ documentNumber: "oflc-2", publicationDate: "2026-08-10", type: "OFLC announcement", topics: ["h-2b"] }),
    n({ documentNumber: "uscis-1", publicationDate: "2026-08-12", type: "USCIS announcement", source: "uscis-news" }),
    n({ documentNumber: "2026-1", publicationDate: "2026-08-01", status: "published" }),
    n({ documentNumber: "2026-2", publicationDate: "2026-08-20", status: "public-inspection", piFiled: "2026-08-19" }),
    n({ documentNumber: "2026-3", publicationDate: "2026-08-02", status: "withdrawn" }),
    n({ documentNumber: "wh-a", publicationDate: "2026-08-18", type: "Presidential action", source: "white-house" }),
    n({ documentNumber: "wh-b", publicationDate: "2026-07-01", type: "Presidential action", supersededBy: "2026-9" }),
    n({ documentNumber: "2026-9", publicationDate: "2026-07-03", type: "Presidential Document", status: "published" }),
  ]);

  it("lists every agency announcement, H-2B included, newest first", () => {
    expect(feed.announcements.map((d) => d.documentNumber)).toEqual(["oflc-1", "uscis-1", "oflc-2"]);
  });

  it("puts a filed document under coming next, never in the Register list", () => {
    expect(feed.filed.map((d) => d.documentNumber)).toEqual(["2026-2"]);
    expect(feed.register.map((d) => d.documentNumber)).not.toContain("2026-2");
  });

  it("lists a White House action until the Register publishes it, then only the Register's", () => {
    expect(feed.signed.map((d) => d.documentNumber)).toEqual(["wh-a"]);
    expect(feed.register.map((d) => d.documentNumber)).toEqual(["2026-3", "2026-1", "2026-9"]);
  });

  it("moves an unmatched White House action to the announcements once its wait is over", () => {
    const rows = [
      n({ documentNumber: "wh-new", publicationDate: "2026-09-10", type: "Presidential action", source: "white-house" }),
      n({ documentNumber: "wh-old", publicationDate: "2026-08-01", type: "Presidential action", source: "white-house" }),
    ];
    // Sep 24 is exactly SIGNED_WAIT_DAYS after Sep 10: still waiting on that day, not after it.
    const onTheDay = buildFeed(rows, "2026-09-24");
    expect(onTheDay.signed.map((d) => d.documentNumber)).toEqual(["wh-new"]);
    expect(onTheDay.announcements.map((d) => d.documentNumber)).toEqual(["wh-old"]);
    const after = buildFeed(rows, "2026-09-25");
    expect(after.signed).toEqual([]);
    expect(after.announcements.map((d) => d.documentNumber)).toEqual(["wh-new", "wh-old"]);
    expect(awaitsRegister(rows[0]!, "2026-09-24")).toBe(true);
    expect(awaitsRegister(rows[0]!, "2026-09-25")).toBe(false);
  });

  it("keeps a withdrawn filing in the record but off the ledger's counts", () => {
    expect(feedLedger(feed, TODAY)).toMatchObject({ rules: 1, presidential: 1, coming: 2, announcements: 3 });
  });
});

describe("dates", () => {
  it("daysBetween counts whole days without a zone", () => {
    expect(daysBetween("2026-09-16", "2026-11-10")).toBe(55);
    expect(daysBetween("2026-09-16", "2026-09-16")).toBe(0);
    expect(daysBetween("2026-09-16", "2026-09-15")).toBe(-1);
  });

  it("a comment window is OPEN through its close date and closed the day after", () => {
    const d = n({ documentNumber: "p", publicationDate: "2026-08-25", type: "Proposed Rule", commentsCloseOn: "2026-09-16" });
    expect(commentWindow(d, "2026-09-16")).toEqual({ closesOn: "2026-09-16", state: "open", daysLeft: 0 });
    expect(commentWindow(d, "2026-09-17")?.state).toBe("closed");
    expect(commentWindow(n({ documentNumber: "r", publicationDate: "2026-08-25" }), TODAY)).toBeNull();
  });

  it("an effective date in the future is UPCOMING, not merely absent", () => {
    expect(effectiveState(n({ documentNumber: "r", publicationDate: "2026-08-10", effectiveOn: "2026-10-01" }), TODAY)).toEqual({ on: "2026-10-01", state: "upcoming" });
    expect(effectiveState(n({ documentNumber: "r", publicationDate: "2026-08-10", effectiveOn: "2026-09-09" }), TODAY)?.state).toBe("in-effect");
    expect(effectiveState(n({ documentNumber: "r", publicationDate: "2026-08-10", effectiveOn: TODAY }), TODAY)?.state).toBe("in-effect");
  });
});

describe("feedLedger", () => {
  it("counts by type, open comment windows, and the span", () => {
    const feed = buildFeed([
      n({ documentNumber: "r1", publicationDate: "2026-05-11" }),
      n({ documentNumber: "p1", publicationDate: "2026-09-11", type: "Proposed Rule", commentsCloseOn: "2026-11-10" }),
      n({ documentNumber: "p2", publicationDate: "2026-03-27", type: "Proposed Rule", commentsCloseOn: "2026-05-26" }),
      n({ documentNumber: "n1", publicationDate: "2026-04-07", type: "Notice" }),
      n({ documentNumber: "o1", publicationDate: "2026-08-14", type: "OFLC announcement", topics: ["perm"] }),
      n({ documentNumber: "o0", publicationDate: "2019-01-04", type: "OFLC announcement", topics: ["perm"] }),
    ]);
    expect(feedLedger(feed, TODAY)).toEqual({
      rules: 1, proposed: 2, proposedOpen: 1, notices: 1, presidential: 0, coming: 0, announcements: 2,
      announcementsSince: "2019-01-04", bills: 0, decisions: 0, earliest: "2026-03-27", newest: "2026-09-11",
    });
  });
});

describe("buildStrip", () => {
  const feed = buildFeed([
    n({ documentNumber: "p1", publicationDate: "2026-09-11", type: "Proposed Rule", commentsCloseOn: "2026-11-10" }),
    n({ documentNumber: "p2", publicationDate: "2026-08-25", type: "Proposed Rule", commentsCloseOn: "2026-09-24" }),
    n({ documentNumber: "r1", publicationDate: "2026-05-11" }),
    n({ documentNumber: "old", publicationDate: "2025-09-30" }),
    n({ documentNumber: "o1", publicationDate: "2026-08-14", type: "OFLC announcement", topics: ["perm"] }),
    n({ documentNumber: "o-old", publicationDate: "2024-08-14", type: "OFLC announcement", topics: ["perm"] }),
  ]);
  const strip = buildStrip(feed, TODAY);

  it("spans twelve months ending with today's month, and today sits inside it", () => {
    expect(strip.start).toBe("2025-10-01");
    expect(strip.end).toBe("2026-09-30");
    expect(strip.months).toHaveLength(12);
    expect(strip.months[0]!.label).toBe("Oct 2025");
    expect(strip.months[3]!.label).toBe("Jan 2026");
    expect(strip.months[11]!.label).toBe("Sep");
    expect(strip.todayX).toBeGreaterThan(STRIP_PAD);
    expect(strip.todayX).toBeLessThan(STRIP_W - STRIP_PAD);
  });

  it("places every mark and every bar inside the padded box", () => {
    for (const m of [...strip.register, ...strip.announcements]) {
      expect(m.x).toBeGreaterThanOrEqual(STRIP_PAD);
      expect(m.x).toBeLessThanOrEqual(STRIP_W - STRIP_PAD);
      if (m.bar) {
        expect(m.bar.x0).toBeLessThanOrEqual(m.bar.x1);
        expect(m.bar.x1).toBeLessThanOrEqual(STRIP_W - STRIP_PAD);
      }
    }
  });

  it("clips a comment window that runs past the strip and marks its state", () => {
    const p1 = strip.register.find((m) => m.documentNumber === "p1")!;
    expect(p1.bar?.open).toBe(true);
    expect(p1.bar?.x1).toBe(STRIP_W - STRIP_PAD);
    const p2 = strip.register.find((m) => m.documentNumber === "p2")!;
    expect(p2.bar?.open).toBe(true);
    expect(p2.bar!.x1).toBeLessThan(STRIP_W - STRIP_PAD);
  });

  it("leaves documents older than the strip out of the drawing and counts them", () => {
    expect(strip.register.map((m) => m.documentNumber)).not.toContain("old");
    expect(strip.earlierRegister).toBe(1);
    expect(strip.earlierAnnouncements).toBe(1);
    expect(strip.announcements.map((m) => m.documentNumber)).toEqual(["o1"]);
  });
});

describe("assignLanes", () => {
  it("stacks marks that share a day and leaves spread-out marks on lane 0", () => {
    const lanes = assignLanes([{ x: 100 }, { x: 100 }, { x: 108 }, { x: 300 }, { x: 100 }]).map((m) => m.lane);
    expect(lanes).toEqual([0, 1, 2, 0, 3]);
  });
  it("keeps input order", () => {
    const out = assignLanes([{ x: 5, id: "a" }, { x: 5, id: "b" }]);
    expect(out.map((m) => m.id)).toEqual(["a", "b"]);
  });
});

describe("assignBarLanes", () => {
  it("gives overlapping windows separate lanes and lets a later one reuse a freed lane", () => {
    const bars = [
      { bar: { x0: 100, x1: 300 } },   // lane 0
      { bar: { x0: 200, x1: 400 } },   // overlaps -> lane 1
      { bar: { x0: 350, x1: 500 } },   // lane 0 ended at 300 -> lane 0
      { bar: null },
      { bar: { x0: 380, x1: 450 } },   // overlaps both -> lane 2
    ];
    expect(assignBarLanes(bars).map((b) => b.barLane)).toEqual([0, 1, 0, 0, 2]);
  });
});

describe("bills in Congress", () => {
  it("get their own list, newest latest action first, and stay out of the Register's", () => {
    const old = n({ documentNumber: "bill-119-hr-2315", publicationDate: "2025-03-25", type: BILL_TYPE, dates: "2026-10-22", source: "congress" });
    const fresh = n({ documentNumber: "bill-119-s-2886", publicationDate: "2026-09-01", type: BILL_TYPE, dates: "2026-09-02", source: "congress" });
    const rule = n({ documentNumber: "2026-1", publicationDate: "2026-09-10" });
    const feed = buildFeed([fresh, rule, old], TODAY);
    // Introduced in 2025, moved this month: it leads.
    expect(feed.bills.map((d) => d.documentNumber)).toEqual(["bill-119-hr-2315", "bill-119-s-2886"]);
    expect(feed.register.map((d) => d.documentNumber)).toEqual(["2026-1"]);
    expect(feed.announcements).toEqual([]);
    expect(feedLedger(feed, TODAY).bills).toBe(2);
    // A bill is never a mark on the Register's strip.
    expect(buildStrip(feed, TODAY).register.map((m) => m.documentNumber)).toEqual(["2026-1"]);
  });
});

describe("court and BALCA decisions", () => {
  it("get their own list, newest first, and never reach the Register's list or the strip", () => {
    const court = n({ documentNumber: "cl-1", publicationDate: "2026-09-10", type: COURT_TYPE, source: "courtlistener" });
    const enBanc = n({ documentNumber: "balca-1", publicationDate: "2010-03-02", type: BALCA_TYPE, source: "balca" });
    const rule = n({ documentNumber: "2026-1", publicationDate: "2026-09-10" });
    const feed = buildFeed([enBanc, rule, court], TODAY);
    expect(feed.decisions.map((d) => d.documentNumber)).toEqual(["cl-1", "balca-1"]);
    expect(feed.register.map((d) => d.documentNumber)).toEqual(["2026-1"]);
    expect(feed.announcements).toEqual([]);
    expect(feedLedger(feed, TODAY).decisions).toBe(2);
    expect(buildStrip(feed, TODAY).register.map((m) => m.documentNumber)).toEqual(["2026-1"]);
  });
});
