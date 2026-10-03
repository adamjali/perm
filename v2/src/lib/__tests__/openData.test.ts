import { describe, expect, it } from "vitest";
import {
  OPEN_DATA_LICENSE,
  bulletinCsv,
  bulletinJson,
  bulletinRows,
  dolCsv,
  dolJson,
  dolRows,
  downloadHeaders,
  type BulletinRecord,
  type DolReading,
} from "../openData";

const bulletin = (month: string, over: Partial<BulletinRecord> = {}): BulletinRecord => ({
  bulletinMonth: month,
  sourceUrl: `https://example.test/${month}`,
  finalAction: { EB2: { worldwide: "01APR24", india: "15JAN13" } },
  datesForFiling: { EB2: { worldwide: "C" } },
  familyFinalAction: { F2A: { mexico: "U" } },
  familyDatesForFiling: null,
  ...over,
});

const reading = (asOf: string, over: Partial<DolReading> = {}): DolReading => ({
  permAsOf: asOf,
  permQueues: [
    { queue: "Analyst Review", priorityDate: "2025-11", raw: "November 2025" },
    { queue: "Audit Review", priorityDate: null, raw: "--" },
  ],
  permAverageDays: [{ determination: "Analyst Review", month: "2026-08", calendarDays: 336, raw: "336" }],
  pwdAsOf: "2026-09-30",
  pwdQueues: [{ program: "PERM", oewsReceiptDate: "2025-10", nonOewsReceiptDate: null }],
  pwdPermBacklog: [{ receiptMonth: "2025-11", remainingRequests: 4210 }],
  sourceUrl: "https://flag.dol.gov/processingtimes",
  fetchedAt: Date.UTC(2026, 9, 1, 12),
  ...over,
});

describe("open data: visa bulletins", () => {
  it("writes one row per printed cell, oldest bulletin first, reading C and U as states", () => {
    const rows = bulletinRows([bulletin("2026-10"), bulletin("2026-09")]);
    expect(rows.map((r) => r.bulletin_month)).toEqual([
      ...Array(4).fill("2026-09"),
      ...Array(4).fill("2026-10"),
    ]);
    const sept = rows.filter((r) => r.bulletin_month === "2026-09");
    expect(sept).toEqual([
      { bulletin_month: "2026-09", preference: "employment", chart: "final_action", category: "EB2", country: "worldwide", as_printed: "01APR24", cutoff_date: "2024-04-01", status: "date" },
      { bulletin_month: "2026-09", preference: "employment", chart: "final_action", category: "EB2", country: "india", as_printed: "15JAN13", cutoff_date: "2013-01-15", status: "date" },
      { bulletin_month: "2026-09", preference: "employment", chart: "dates_for_filing", category: "EB2", country: "worldwide", as_printed: "C", cutoff_date: "", status: "current" },
      { bulletin_month: "2026-09", preference: "family", chart: "final_action", category: "F2A", country: "mexico", as_printed: "U", cutoff_date: "", status: "unavailable" },
    ]);
  });

  it("keeps a cell it cannot read, as printed, instead of dropping it", () => {
    const rows = bulletinRows([bulletin("2026-09", { finalAction: { EB3: { china: "see note" } }, datesForFiling: null, familyFinalAction: null })]);
    expect(rows).toEqual([
      expect.objectContaining({ as_printed: "see note", cutoff_date: "", status: "unread" }),
    ]);
  });

  it("writes CSV with a header, CRLF lines and quoted commas", () => {
    const csv = bulletinCsv([bulletin("2026-09", { finalAction: { "EB3 Other, Workers": { china: "01JAN20" } } })]);
    const lines = csv.split("\r\n");
    expect(lines[0]).toBe("bulletin_month,preference,chart,category,country,as_printed,cutoff_date,status");
    expect(lines[1]).toBe('2026-09,employment,final_action,"EB3 Other, Workers",china,01JAN20,2020-01-01,date');
    expect(csv.endsWith("\r\n")).toBe(true);
  });

  it("puts the licence and every bulletin's source in the JSON", () => {
    const j = JSON.parse(bulletinJson([bulletin("2026-10"), bulletin("2026-09")]));
    expect(j.license).toBe(OPEN_DATA_LICENSE.url);
    expect(j.bulletins.map((b: { bulletinMonth: string }) => b.bulletinMonth)).toEqual(["2026-09", "2026-10"]);
    expect(j.bulletins[0].sourceUrl).toBe("https://example.test/2026-09");
    expect(j.bulletins[0].family.finalAction).toEqual({ F2A: { mexico: "U" } });
  });
});

describe("open data: DOL processing times", () => {
  it("writes one row per published value, blank where DOL printed --", () => {
    const rows = dolRows([reading("2026-09-30")]);
    expect(rows).toEqual([
      { as_of: "2026-09-30", table: "perm_queue", row: "Analyst Review", month: "2025-11", calendar_days: "", remaining_requests: "" },
      { as_of: "2026-09-30", table: "perm_queue", row: "Audit Review", month: "", calendar_days: "", remaining_requests: "" },
      { as_of: "2026-09-30", table: "perm_average_days", row: "Analyst Review", month: "2026-08", calendar_days: 336, remaining_requests: "" },
      { as_of: "2026-09-30", table: "pwd_queue_oews", row: "PERM", month: "2025-10", calendar_days: "", remaining_requests: "" },
      { as_of: "2026-09-30", table: "pwd_queue_non_oews", row: "PERM", month: "", calendar_days: "", remaining_requests: "" },
      { as_of: "2026-09-30", table: "pwd_perm_backlog", row: "PERM", month: "2025-11", calendar_days: "", remaining_requests: 4210 },
    ]);
  });

  it("orders readings oldest first and skips the wage section a reading lacks", () => {
    const rows = dolRows([reading("2026-09-30"), reading("2026-08-28", { pwdAsOf: null })]);
    expect(rows[0]?.as_of).toBe("2026-08-28");
    expect(rows.filter((r) => r.as_of === "2026-08-28").map((r) => r.table)).toEqual([
      "perm_queue",
      "perm_queue",
      "perm_average_days",
    ]);
  });

  it("keeps both wage readings DOL published under one PERM date, and writes the PERM half once", () => {
    // Sep 30 2026: DOL moved only its wage figures; the PERM date stayed Sep 22.
    const before = reading("2026-09-22", { pwdAsOf: "2026-08-31", fetchedAt: Date.UTC(2026, 8, 22) });
    const after = reading("2026-09-22", {
      pwdAsOf: "2026-09-30",
      pwdPermBacklog: [{ receiptMonth: "2025-12", remainingRequests: 3900 }],
      fetchedAt: Date.UTC(2026, 8, 30),
    });
    const rows = dolRows([after, before]);
    expect(rows.filter((r) => r.table === "perm_queue" && r.row === "Analyst Review")).toHaveLength(1);
    expect(rows.filter((r) => r.table === "pwd_perm_backlog").map((r) => [r.as_of, r.month])).toEqual([
      ["2026-08-31", "2025-11"],
      ["2026-09-30", "2025-12"],
    ]);
  });

  it("writes a wage reading once when only the PERM figures moved", () => {
    const rows = dolRows([
      reading("2026-08-31", { pwdAsOf: "2026-08-31", fetchedAt: Date.UTC(2026, 8, 5) }),
      reading("2026-09-22", { pwdAsOf: "2026-08-31", fetchedAt: Date.UTC(2026, 8, 22) }),
    ]);
    expect(rows.filter((r) => r.table === "pwd_perm_backlog")).toHaveLength(1);
    expect(rows.filter((r) => r.table === "perm_average_days").map((r) => r.as_of)).toEqual(["2026-08-31", "2026-09-22"]);
  });

  it("never writes DOL's '--' as a cell a spreadsheet would treat as a formula", () => {
    expect(dolCsv([reading("2026-09-30")])).not.toMatch(/'?--/);
  });

  it("stamps each reading with when it was recorded, and survives a bad stamp", () => {
    const j = JSON.parse(dolJson([reading("2026-09-30"), reading("2026-08-28", { fetchedAt: Number.NaN })]));
    expect(j.license).toBe(OPEN_DATA_LICENSE.url);
    expect(j.readings[0].recordedAt).toBeNull();
    expect(j.readings[1].recordedAt).toBe("2026-10-01T12:00:00.000Z");
    expect(j.readings[1]).not.toHaveProperty("fetchedAt");
  });
});

describe("open data: download headers", () => {
  it("names the file, opens it to any site and links the licence", () => {
    const csv = new Headers(downloadHeaders("csv", "visa-bulletins.csv"));
    expect(csv.get("content-type")).toBe("text/csv; charset=utf-8");
    expect(csv.get("content-disposition")).toBe('attachment; filename="visa-bulletins.csv"');
    expect(csv.get("access-control-allow-origin")).toBe("*");
    expect(csv.get("link")).toBe(`<${OPEN_DATA_LICENSE.url}>; rel="license"`);
    expect(new Headers(downloadHeaders("json", "x.json")).get("content-type")).toBe("application/json; charset=utf-8");
  });
});
