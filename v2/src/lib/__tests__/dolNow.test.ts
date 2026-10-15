import { describe, expect, it } from "vitest";

import { averagePhrase, dolNow, dolPwdNow, pwdSentence, pwdWaitPhrase, queueSentence } from "@/lib/dolNow";
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

describe("DOL's wage-request queue in prose", () => {
  it("names the PERM month, the wait and the date", () => {
    const n = dolPwdNow(SEP_30_PWD);
    expect(n.frontierShort).toBe("Jun 2026");
    expect(pwdWaitPhrase(n)).toBe("3 to 4 months as of September 30, 2026");
    expect(pwdSentence(n)).toBe(
      "As of September 30, 2026, DOL is issuing PERM wage determinations on requests filed in June 2026, 3 to 4 months after they were filed.",
    );
  });

  it("reads the PERM row, never another program's", () => {
    const h2bOnly = { ...SEP_30_PWD, pwdQueues: [{ program: "H-2B", oewsReceiptDate: "2026-08", nonOewsReceiptDate: null }] } as unknown as ProcessingTimesSnapshot;
    expect(dolPwdNow(h2bOnly).frontier).toBeNull();
  });

  it("never prints a number DOL didn't publish", () => {
    const empty = dolPwdNow(null);
    expect(pwdWaitPhrase(empty)).toBe("a few months");
    expect(pwdSentence(empty)).toMatch(/processing times page/);
    expect(pwdSentence(empty)).not.toMatch(/\d/);
  });
});
