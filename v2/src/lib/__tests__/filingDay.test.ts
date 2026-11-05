import { describe, expect, it } from "vitest";

import { DAY_PAGE_SIZE, dayView, filingDayOf, letterOf, type DayCase } from "../filingDay";

const c = (n: number, employer: string, status: string, final = false): DayCase => ({
  caseNumber: `G-100-26015-${String(n).padStart(6, "0")}`,
  status,
  employer,
  jobTitle: "Software Engineer",
  final,
});

const CASES: DayCase[] = [
  c(1, "Amazon.com Services LLC", "ANALYST REVIEW"),
  c(2, "Apple Inc.", "CERTIFIED", true),
  c(3, "Bloomberg L.P.", "ANALYST REVIEW"),
  c(4, "3M Company", "RFI ISSUED"),
  c(5, "amazon web services", "ANALYST REVIEW"),
];

describe("letterOf", () => {
  it("files a name under its first letter, a digit or symbol under #", () => {
    expect(letterOf("Amazon.com Services LLC")).toBe("A");
    expect(letterOf("amazon web services")).toBe("A");
    expect(letterOf("3M Company")).toBe("#");
    expect(letterOf("")).toBe("#");
  });
});

describe("dayView", () => {
  it("counts every status and letter over the whole day, whatever is picked", () => {
    // Act
    const v = dayView(CASES, { status: "CERTIFIED", letter: null, page: 1 });
    // Assert
    expect(v.statuses).toEqual([
      { status: "ANALYST REVIEW", n: 3 },
      { status: "CERTIFIED", n: 1 },
      { status: "RFI ISSUED", n: 1 },
    ]);
    expect(v.letters).toEqual([
      { letter: "#", n: 1 },
      { letter: "A", n: 3 },
      { letter: "B", n: 1 },
    ]);
  });

  it("filters by status and letter together", () => {
    const v = dayView(CASES, { status: "ANALYST REVIEW", letter: "A", page: 1 });
    expect(v.total).toBe(2);
    expect(v.rows.map((r) => r.employer).sort()).toEqual(["Amazon.com Services LLC", "amazon web services"]);
  });

  it("pages the list and keeps a page past the end on the last page", () => {
    // Arrange
    const many = Array.from({ length: DAY_PAGE_SIZE * 2 + 3 }, (_, i) => c(i, `Employer ${i}`, "ANALYST REVIEW"));
    // Act
    const last = dayView(many, { status: null, letter: null, page: 99 });
    // Assert
    expect(last.pageCount).toBe(3);
    expect(last.page).toBe(3);
    expect(last.rows).toHaveLength(3);
  });
});

describe("filingDayOf", () => {
  it("reads a real day from the month and day in the address", () => {
    expect(filingDayOf("2026-01", "15", "2026-10-28")).toBe("2026-01-15");
  });

  it("refuses a day that doesn't exist, a malformed one, or one after today", () => {
    expect(filingDayOf("2026-02", "30", "2026-10-28")).toBeNull();
    expect(filingDayOf("2026-01", "5", "2026-10-28")).toBeNull();
    expect(filingDayOf("2026-13", "01", "2026-10-28")).toBeNull();
    expect(filingDayOf("2026-11", "02", "2026-10-28")).toBeNull();
  });
});

describe("dayView, searched and sorted", () => {
  const rows: DayCase[] = [
    { ...c(7, "Bloomberg L.P.", "CERTIFIED", true), decided: "2026-05-01" },
    { ...c(8, "Amazon.com Services LLC", "ANALYST REVIEW"), jobTitle: "Data Scientist" },
    { ...c(9, "Apple Inc.", "CERTIFIED", true), decided: "2026-06-02" },
  ];

  it("finds every word in the case number, employer or job, whatever the punctuation", () => {
    expect(dayView(rows, { status: null, letter: null, page: 1, q: "amazon data" }).rows.map((r) => r.employer)).toEqual(["Amazon.com Services LLC"]);
    expect(dayView(rows, { status: null, letter: null, page: 1, q: "26015 000009" }).total).toBe(1);
    expect(dayView(rows, { status: null, letter: null, page: 1, q: "nobody" }).total).toBe(0);
  });

  it("orders by employer unless asked, and by the newest decision with undecided cases last", () => {
    expect(dayView(rows, { status: null, letter: null, page: 1 }).rows.map((r) => r.employer)).toEqual(["Amazon.com Services LLC", "Apple Inc.", "Bloomberg L.P."]);
    expect(dayView(rows, { status: null, letter: null, page: 1, sort: "decided" }).rows.map((r) => r.employer)).toEqual(["Apple Inc.", "Bloomberg L.P.", "Amazon.com Services LLC"]);
  });

  it("keeps the day's status and letter counts whatever is searched", () => {
    expect(dayView(rows, { status: null, letter: null, page: 1, q: "apple" }).statuses).toEqual([
      { status: "CERTIFIED", n: 2 },
      { status: "ANALYST REVIEW", n: 1 },
    ]);
  });
});
