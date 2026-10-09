import { describe, expect, it } from "vitest";

import { averagePhrase, dolNow, queueSentence } from "@/lib/dolNow";
import type { ProcessingTimesSnapshot } from "@/lib/turso/processingTimes";

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
