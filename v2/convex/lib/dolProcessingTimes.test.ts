/**
 * Tests for the DOL FLAG processing-times parser.
 *
 * These run against a real capture of https://flag.dol.gov/processingtimes
 * (fetched 2026-08-22, page stamped "as of 8/20/2026"), not a hand-written
 * fixture. A synthetic fixture would only prove the parser can read markup we
 * invented; the point is that it reads the markup DOL actually serves,
 * including captions split across tags and "--" placeholders.
 *
 * The fixture arrives through Vite's `?raw` loader rather than `node:fs`.
 * Anything under convex/ is bundled for a V8 isolate with no Node builtins,
 * so importing `fs` here would be wrong even in a file that never deploys.
 */

import { describe, it, expect } from "vitest";

import FIXTURE from "./__fixtures__/flag-processingtimes-2026-08-20.html?raw";

import {
  parseProcessingTimes,
  parseUsDate,
  parseMonthYear,
  parseCount,
  textOf,
  extractTables,
  analystReviewQueue,
  analystReviewAverageDays,
  DolParseError,
  DOL_PROCESSING_TIMES_URL,
} from "./dolProcessingTimes";

describe("field helpers", () => {
  describe("parseUsDate", () => {
    it.each([
      ["(as of 8/20/2026)", "2026-08-20"],
      ["(as of 08/20/2026)", "2026-08-20"],
      ["updated as of close of business 08/15/2026", "2026-08-15"],
      ["as of 6/30/2026", "2026-06-30"],
    ])("reads %s", (input, expected) => {
      expect(parseUsDate(input)).toBe(expected);
    });

    it("returns null when there is no date", () => {
      expect(parseUsDate("PERM Processing Times")).toBeNull();
    });
  });

  describe("parseMonthYear", () => {
    it.each([
      ["September 2025", "2025-09"],
      ["December 2025", "2025-12"],
      ["April 2026", "2026-04"],
      ["  July 2026  ", "2026-07"],
    ])("reads %s", (input, expected) => {
      expect(parseMonthYear(input)).toBe(expected);
    });

    it.each(["--", "N/A", "", "Not available"])(
      "returns null for the DOL placeholder %s",
      (input) => {
        expect(parseMonthYear(input)).toBeNull();
      },
    );
  });

  describe("parseCount", () => {
    it("strips thousands separators", () => {
      expect(parseCount("14,386")).toBe(14386);
      expect(parseCount("372")).toBe(372);
      expect(parseCount("0")).toBe(0);
    });

    it("returns null for the DOL placeholder", () => {
      expect(parseCount("--")).toBeNull();
      expect(parseCount("")).toBeNull();
    });
  });

  describe("textOf", () => {
    it("decodes the entities DOL emits and collapses whitespace", () => {
      expect(
        textOf("<strong>PERM Processing Times</strong>&nbsp;<em>(as of 8/20/2026)</em>"),
      ).toBe("PERM Processing Times (as of 8/20/2026)");
    });

    it("flattens a caption split across tags and newlines", () => {
      expect(textOf("<caption>\n  <strong>A</strong>\n  <em>B</em>\n</caption>")).toBe("A B");
    });

    // The four cases below are the CodeQL findings on this file
    // (js/double-escaping, js/incomplete-multi-character-sanitization,
    // js/bad-tag-filter). Each one produced a wrong value, not just a warning.

    it("decodes each entity once, so &amp;lt; stays literal", () => {
      // Chained replaces decoded &amp; to & first, then read the resulting
      // &lt; as a second entity and produced "<", a value DOL never published.
      expect(textOf("A &amp;lt; B")).toBe("A &lt; B");
      expect(textOf("Tom &amp; Jerry")).toBe("Tom & Jerry");
      expect(textOf("5 &lt; 10")).toBe("5 < 10");
    });

    it("strips a closing tag that carries whitespace before the bracket", () => {
      // `</script >` is valid HTML and the old pattern did not match it, so the
      // script body survived into the parsed text.
      expect(textOf("<script>alert(1)</script >tail")).toBe("tail");
      expect(textOf("<style>body{}</style\n>tail")).toBe("tail");
    });

    it("does not treat a longer element name as script or style", () => {
      expect(textOf("<scripting>kept</scripting>")).toBe("kept");
    });

    it("keeps removing script blocks until the result stops changing", () => {
      // A single lazy pass matches the first opener to the first closer and
      // leaves the outer </script> behind. Looping clears it.
      expect(textOf("<script>outer<script>inner</script></script>done")).toBe("done");
    });

    it("never leaves an executable tag behind on malformed markup", () => {
      // `<sc<script>ript>` is not valid HTML. The extractor consumes
      // `<sc<script>` as one tag and the leftover is inert text, which is the
      // correct outcome for a text extractor: no tag and no script survive.
      const out = textOf("<sc<script>ript>visible");
      expect(out).toBe("ript>visible");
      expect(out).not.toMatch(/<\s*script/i);
      expect(out).not.toContain("<");
    });
  });
});

describe("extractTables", () => {
  it("finds every table on the real page", () => {
    expect(extractTables(FIXTURE).length).toBeGreaterThanOrEqual(14);
  });

  it("recovers captions that are split across tags", () => {
    const captions = extractTables(FIXTURE).map((t) => t.caption);
    expect(captions).toContain("PERM Processing Times (as of 8/20/2026)");
    expect(captions).toContain("Average Number of Days to Process PERM Applications");
  });
});

describe("parseProcessingTimes against the real DOL page", () => {
  const snapshot = parseProcessingTimes(FIXTURE);

  it("reads DOL's own as-of date for the PERM section", () => {
    expect(snapshot.permAsOf).toBe("2026-08-20");
  });

  it("reads the prevailing-wage section's separate as-of date", () => {
    // The two sections update on different cadences and carry different dates.
    // Collapsing them into one "last updated" would misreport both.
    expect(snapshot.pwdAsOf).toBe("2026-06-30");
    expect(snapshot.pwdAsOf).not.toBe(snapshot.permAsOf);
  });

  it("records the canonical source on the snapshot", () => {
    expect(snapshot.sourceUrl).toBe(DOL_PROCESSING_TIMES_URL);
    expect(snapshot.sourceUrl).toBe("https://flag.dol.gov/processingtimes");
  });

  it("extracts the PERM priority-date queue", () => {
    const byQueue = Object.fromEntries(
      snapshot.permQueues.map((q) => [q.queue, q.priorityDate]),
    );
    expect(byQueue["Analyst Review"]).toBe("2025-09");
    expect(byQueue["Audit Review"]).toBe("2025-12");
    expect(byQueue["Reconsideration Request to the CO"]).toBe("2026-04");
  });

  it("keeps DOL's raw wording alongside the parsed value", () => {
    const analyst = analystReviewQueue(snapshot);
    expect(analyst?.raw).toBe("September 2025");
    expect(analyst?.priorityDate).toBe("2025-09");
  });

  it("extracts the average calendar days to a determination", () => {
    expect(analystReviewAverageDays(snapshot)).toBe(372);
  });

  it("represents a DOL '--' as null rather than zero", () => {
    // Audit Review had no reported average in this capture. Zero would read as
    // "instant", the opposite of what the placeholder means.
    const audit = snapshot.permAverageDays.find((d) => /audit review/i.test(d.determination));
    expect(audit).toBeDefined();
    expect(audit!.calendarDays).toBeNull();
    expect(audit!.raw).toBe("--");
  });

  it("extracts the prevailing-wage queue including the PERM row", () => {
    const perm = snapshot.pwdQueues.find((q) => q.program === "PERM");
    expect(perm).toBeDefined();
    expect(perm!.oewsReceiptDate).toBe("2026-04");
    expect(perm!.nonOewsReceiptDate).toBe("2026-03");
  });

  it("nulls the non-OEWS column where DOL prints '--'", () => {
    const cw1 = snapshot.pwdQueues.find((q) => q.program === "CW-1");
    expect(cw1?.oewsReceiptDate).toBe("2026-05");
    expect(cw1?.nonOewsReceiptDate).toBeNull();
  });

  it("extracts the PERM prevailing-wage backlog by receipt month", () => {
    const byMonth = Object.fromEntries(
      snapshot.pwdPermBacklog.map((r) => [r.receiptMonth, r.remainingRequests]),
    );
    expect(byMonth["2026-04"]).toBe(14386);
    expect(byMonth["2026-05"]).toBe(18310);
    expect(byMonth["2026-06"]).toBe(16797);
    expect(byMonth["2025-12"]).toBe(11);
  });

  it("picks the PERM backlog table, not a sibling program's", () => {
    // Four tables share the "Receipt Month / Remaining Requests" shape, one per
    // program. Matching on shape alone would silently return H-1B's numbers.
    const byMonth = Object.fromEntries(
      snapshot.pwdPermBacklog.map((r) => [r.receiptMonth, r.remainingRequests]),
    );
    // H-1B's April figure is 273 and H-2B's is 2; PERM's is 14,386.
    expect(byMonth["2026-04"]).not.toBe(273);
    expect(byMonth["2026-04"]).not.toBe(2);
  });

  it("returns backlog months already in sorted order", () => {
    const months = snapshot.pwdPermBacklog.map((r) => r.receiptMonth);
    expect([...months].sort()).toEqual(months);
  });
});

describe("failure policy", () => {
  // A parser that returns an empty snapshot is worse than one that throws: an
  // empty month is indistinguishable from a month where the queue did not move,
  // which would corrupt the stored series silently.

  it("throws on an empty document", () => {
    expect(() => parseProcessingTimes("")).toThrow(DolParseError);
  });

  it("throws on a document too short to be the real page", () => {
    expect(() => parseProcessingTimes("<html><body>down for maintenance</body></html>")).toThrow(
      /too short/,
    );
  });

  it("throws when there are no tables at all", () => {
    const padded = `<html><body>${"x".repeat(2000)}</body></html>`;
    expect(() => parseProcessingTimes(padded)).toThrow(/no <table>/);
  });

  it("throws when the PERM section disappears", () => {
    const withoutPerm = FIXTURE.replace(/PERM Processing Times/g, "Something Else Entirely");
    expect(() => parseProcessingTimes(withoutPerm)).toThrow(/PERM Processing Times/);
  });

  it("throws when the PERM caption loses its as-of date", () => {
    const undated = FIXTURE.replace("(as of 8/20/2026)", "");
    expect(() => parseProcessingTimes(undated)).toThrow(/no as-of date/);
  });

  it("throws when the average-days section disappears", () => {
    const withoutAvg = FIXTURE.replace(
      /Average Number of Days to Process PERM/g,
      "Removed Section",
    );
    expect(() => parseProcessingTimes(withoutAvg)).toThrow(/Average Number of Days/);
  });

  it("throws when the prevailing-wage queue headers change", () => {
    const withoutPwd = FIXTURE.replace(/OEWS Receipt Date/g, "Renamed Column");
    expect(() => parseProcessingTimes(withoutPwd)).toThrow(/prevailing-wage queue table/);
  });
});
