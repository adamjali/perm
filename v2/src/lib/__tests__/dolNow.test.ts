import { describe, expect, it } from "vitest";

import { averagePhrase, dolNow, dolPwdNow, howLongSentence, pwdLine, pwdSentence, pwdWaitPhrase, queueLine, queueSentence } from "@/lib/dolNow";
import type { ProcessingTimesSnapshot } from "@/lib/db/processingTimes";

// DOL's snapshot as stored on Oct 9 2026 (perm_as_of 2026-10-05), the fields this reads.
const OCT_5 = {
  permAsOf: "2026-10-05",
  permQueues: [
    { queue: "Analyst Review", priorityDate: "2025-12", raw: "December 2025" },
    { queue: "Audit Review", priorityDate: "2025-12", raw: "December 2025" },
  ],
  permAverageDays: [
    { determination: "Analyst Review", month: "2026-08", calendarDays: 336, raw: "336" },
    { determination: "Audit Review", month: "2026-08", calendarDays: null, raw: "N/A" },
  ],
} as unknown as ProcessingTimesSnapshot;

describe("DOL's figures in prose", () => {
  it("reads the audit line's month apart from analyst review's", () => {
    const later = { ...OCT_5, permQueues: [OCT_5.permQueues[0], { queue: "Audit Review", priorityDate: "2025-09", raw: "September 2025" }] } as unknown as ProcessingTimesSnapshot;
    expect(dolNow(later)).toMatchObject({ frontier: "December 2025", auditFrontier: "September 2025" });
    expect(dolNow(null).auditFrontier).toBeNull();
  });

  it("dates the average", () => {
    expect(averagePhrase(dolNow(OCT_5))).toBe("336 days as of October 5, 2026");
  });

  it("names the queue month and the average in one dated sentence", () => {
    expect(queueSentence(dolNow(OCT_5))).toBe(
      "As of October 5, 2026, DOL's analyst review is working cases filed in December 2025, and its published " +
        "average from filing to a decision is 336 days, measured on the cases it decided in August 2026.",
    );
  });

  it("never prints a number DOL didn't publish", () => {
    const empty = dolNow(null);
    expect(averagePhrase(empty)).toBe("about a year");
    expect(queueSentence(empty)).toMatch(/processing times page/);
    expect(queueSentence(empty)).not.toMatch(/\d/);
  });

  it("drops a missing average instead of inventing one", () => {
    const noAvg = { ...OCT_5, permAverageDays: [] } as unknown as ProcessingTimesSnapshot;
    expect(queueSentence(dolNow(noAvg))).toBe(
      "As of October 5, 2026, DOL's analyst review is working cases filed in December 2025.",
    );
  });
});

// DOL's wage-request table as stored on Oct 11 2026 (pwd_as_of 2026-09-30).
const SEP_30_PWD = {
  ...OCT_5,
  pwdAsOf: "2026-09-30",
  pwdQueues: [
    { program: "H-1B", oewsReceiptDate: "2026-06", nonOewsReceiptDate: "2026-06" },
    { program: "PERM", oewsReceiptDate: "2026-06", nonOewsReceiptDate: "2026-06" },
    { program: "H-2B", oewsReceiptDate: "2026-08", nonOewsReceiptDate: null },
  ],
} as unknown as ProcessingTimesSnapshot;

describe("DOL's figures in one short line", () => {
  it("leads with the average wait, then DOL's month, dated", () => {
    expect(queueLine(dolNow(OCT_5))).toBe(
      "About 336 days from filing to a decision, by DOL's figure of October 5, 2026. DOL is now deciding cases filed in December 2025.",
    );
  });

  it("says where DOL's figures are when it can't read them", () => {
    expect(queueLine(dolNow(null))).toBe(queueSentence(dolNow(null)));
  });
});

describe("DOL's wage-request queue in prose", () => {
  it("names the PERM month, the wait and the date", () => {
    const n = dolPwdNow(SEP_30_PWD);
    expect(n.frontierShort).toBe("Jun 2026");
    expect(pwdWaitPhrase(n)).toBe("3 to 4 months as of September 30, 2026");
    expect(pwdSentence(n)).toBe(
      "As of September 30, 2026, DOL is issuing PERM wage determinations on requests filed in June 2026, 3 to 4 months after they were filed.",
    );
  });

  it("says the wait in one short line, dated", () => {
    expect(pwdLine(dolPwdNow(SEP_30_PWD))).toBe("PERM wage requests take 3 to 4 months at DOL now, by its figure of September 30, 2026.");
    expect(pwdLine(dolPwdNow(null))).toBe(pwdSentence(dolPwdNow(null)));
  });

  it("reads the PERM row, never another program's", () => {
    const h2bOnly = { ...SEP_30_PWD, pwdQueues: [{ program: "H-2B", oewsReceiptDate: "2026-08", nonOewsReceiptDate: null }] } as unknown as ProcessingTimesSnapshot;
    expect(dolPwdNow(h2bOnly).frontier).toBeNull();
  });

  it("reads the other wage-source month from the PERM row", () => {
    const other = { ...SEP_30_PWD, pwdQueues: [{ program: "PERM", oewsReceiptDate: "2026-06", nonOewsReceiptDate: "2026-05" }] } as unknown as ProcessingTimesSnapshot;
    expect(dolPwdNow(other).otherFrontier).toBe("May 2026");
    expect(dolPwdNow(null).otherFrontier).toBeNull();
  });

  it("never prints a number DOL didn't publish", () => {
    const empty = dolPwdNow(null);
    expect(pwdWaitPhrase(empty)).toBe("a few months");
    expect(pwdSentence(empty)).toMatch(/processing times page/);
    expect(pwdSentence(empty)).not.toMatch(/\d/);
  });
});

describe("how long PERM takes right now (Oct 29 2026)", () => {
  // /today's reading for Oct 27 2026: the middle case DOL decided that day was filed Jan 13 2026.
  const OCT_27 = { day: "2026-10-27", span: { n: 812, middle: "2026-01-13", from: "2025-12-02", to: "2026-02-20" } };

  it("leads with what the cases DOL decided last had waited, then DOL's own month and average", () => {
    const s = howLongSentence(OCT_27, OCT_5);
    expect(s).toMatch(/^The PERM cases DOL decided on October 27, 2026 had waited about 9½ months from filing\. /);
    expect(s).toContain("As of October 5, 2026, DOL's analyst review is working cases filed in December 2025");
  });

  it("leaves out a reading it doesn't have, never typing one", () => {
    expect(howLongSentence(null, OCT_5)).toMatch(/^As of October 5, 2026/);
    expect(howLongSentence({ ...OCT_27, span: null }, OCT_5)).toMatch(/^As of October 5, 2026/);
    expect(howLongSentence(OCT_27, null)).toBe("The PERM cases DOL decided on October 27, 2026 had waited about 9½ months from filing.");
    // A day whose middle case was filed that same day says nothing about a wait.
    const sameDay = { day: "2026-10-27", span: { n: 60, middle: "2026-10-27", from: "2026-10-20", to: "2026-10-27" } };
    expect(howLongSentence(sameDay, OCT_5)).toMatch(/^As of October 5, 2026/);
  });

  it("says where DOL's figures are when it has neither reading", () => {
    expect(howLongSentence(null, null)).toBe("DOL's figures couldn't be read just now; DOL's own page, flag.dol.gov/processingtimes, has them.");
  });
});
