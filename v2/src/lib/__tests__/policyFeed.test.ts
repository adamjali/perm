import { describe, expect, it } from "vitest";

import {
  assignBarLanes,
  assignLanes,
  buildFeed,
  buildStrip,
  commentWindow,
  daysBetween,
  effectiveState,
  feedLedger,
  foldCorrections,
  STRIP_PAD,
  STRIP_W,
} from "@/lib/policyFeed";
import type { PolicyNotice } from "@/lib/turso/policyNotices";

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
  it("lists OFLC announcements on this site's programs and COUNTS the rest", () => {
    const feed = buildFeed([
      n({ documentNumber: "oflc-1", publicationDate: "2026-08-14", type: "OFLC announcement", topics: ["perm", "disclosure-data"] }),
      n({ documentNumber: "oflc-2", publicationDate: "2026-08-10", type: "OFLC announcement", topics: ["h-2b"] }),
      n({ documentNumber: "oflc-3", publicationDate: "2026-08-09", type: "OFLC announcement", topics: [] }),
      n({ documentNumber: "2026-1", publicationDate: "2026-08-01" }),
    ]);
    expect(feed.oflc.map((d) => d.documentNumber)).toEqual(["oflc-1"]);
    expect(feed.oflcOther).toBe(2);
    expect(feed.register.map((d) => d.documentNumber)).toEqual(["2026-1"]);
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
      rules: 1, proposed: 2, proposedOpen: 1, notices: 1, oflc: 2,
      oflcSince: "2019-01-04", earliest: "2026-03-27", newest: "2026-09-11",
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
    for (const m of [...strip.register, ...strip.oflc]) {
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
    expect(strip.earlierOflc).toBe(1);
    expect(strip.oflc.map((m) => m.documentNumber)).toEqual(["o1"]);
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
