import { describe, expect, it } from "vitest";

import { deadlinesIcs, deadlinesText, icsStamp, type DeadlineRow } from "../deadlineExport";

/**
 * The calculator's dates leaving the page: text to paste into another system
 * (plain Salesforce, a spreadsheet) and a calendar file. A wrong date here is a
 * missed PERM deadline in someone else's system, so the exact output is pinned.
 */
const rows: DeadlineRow[] = [
  { label: "Prevailing wage determination expires", date: "2026-06-30", detail: "20 CFR 656.40(c). Recruitment has to begin by this date, or the application be filed by it." },
  { label: "ETA-9089 filing window closes", date: "2026-07-31", detail: "One hundred and eighty days after the first recruitment step." },
];
const inputs = { pwdDate: "2026-01-15", firstRecruitment: "2026-02-01" };

describe("deadlinesText", () => {
  it("lists the dates entered, then every deadline, then where they came from", () => {
    expect(deadlinesText(rows, inputs, [], "2026-10-19")).toBe(
      [
        "Dates entered",
        "Prevailing wage determination: January 15, 2026",
        "First recruitment step: February 1, 2026",
        "",
        "PERM deadlines",
        "Prevailing wage determination expires: June 30, 2026",
        "ETA-9089 filing window closes: July 31, 2026",
        "",
        "Worked out October 19, 2026 under 20 CFR 656 at https://permtracker.app/tools/perm-deadline-calculator. Not legal advice.",
      ].join("\n"),
    );
  });

  it("puts any warning first, so a pasted copy carries the doubt", () => {
    const t = deadlinesText(rows, inputs, ["The first recruitment step is after the determination expires."], "2026-10-19");
    expect(t.split("\n")[0]).toBe("Check first: The first recruitment step is after the determination expires.");
  });
});

describe("deadlinesIcs", () => {
  const ics = deadlinesIcs(rows, inputs, "20261019T235900Z");
  const lines = ics.split("\r\n");

  it("is a calendar with CRLF lines and one all-day event per deadline", () => {
    expect(lines[0]).toBe("BEGIN:VCALENDAR");
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(ics.replace(/\r\n/g, "")).not.toMatch(/\n/);
    expect(lines.filter((l) => l === "BEGIN:VEVENT")).toHaveLength(2);
    expect(lines).toContain("DTSTART;VALUE=DATE:20260630");
    expect(lines).toContain("DTEND;VALUE=DATE:20260701");
    expect(lines).toContain("DTSTART;VALUE=DATE:20260731");
    expect(lines).toContain("DTEND;VALUE=DATE:20260801");
  });

  it("ends a month-end deadline on the first of the next month, and a year-end one in the next year", () => {
    const y = deadlinesIcs([{ label: "x", date: "2026-12-31", detail: "" }], inputs, "20261019T235900Z");
    expect(y).toContain("DTEND;VALUE=DATE:20270101");
  });

  it("reminds a week before each date", () => {
    expect(lines.filter((l) => l === "TRIGGER:-P7D")).toHaveLength(2);
  });

  it("escapes commas, semicolons and newlines, and folds long lines at 75 octets", () => {
    const summary = lines.find((l) => l.startsWith("SUMMARY:PERM: ETA-9089"));
    expect(summary).toBe("SUMMARY:PERM: ETA-9089 filing window closes");
    const unfolded = ics.replace(/\r\n /g, "");
    expect(unfolded).toContain("DESCRIPTION:20 CFR 656.40(c). Recruitment has to begin by this date\\, or the application be filed by it.\\n\\nWorked out at");
    expect(lines.every((l) => new TextEncoder().encode(l).length <= 75)).toBe(true);
  });

  it("gives the same dates the same event ids, so a second import updates", () => {
    const uids = (s: string) => s.replace(/\r\n /g, "").split("\r\n").filter((l) => l.startsWith("UID:"));
    expect(uids(deadlinesIcs(rows, inputs, "20261020T000000Z"))).toEqual(uids(ics));
    expect(uids(ics)[0]).toBe("UID:2026011520260201-prevailing-wage-determination-expires@permtracker.app");
    expect(new Set(uids(ics)).size).toBe(2);
  });
});

describe("icsStamp", () => {
  it("writes UTC with no separators or milliseconds", () => {
    expect(icsStamp(new Date("2026-10-19T23:59:07.123Z"))).toBe("20261019T235907Z");
  });
});
