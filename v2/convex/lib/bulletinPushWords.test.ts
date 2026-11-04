import { describe, expect, it } from "vitest";

import { bulletinPushMessage, cutoffIso, cutoffWords } from "./bulletinPushWords";

const msg = (from: string, to: string, category = "EB2", country = "india" as const) =>
  bulletinPushMessage({ month: "2026-12", category, country, from, to });

describe("bulletin notifications", () => {
  it("reads State's cutoffs", () => {
    expect(cutoffIso("01APR25")).toBe("2025-04-01");
    expect(cutoffIso("22JAN14")).toBe("2014-01-22");
    expect(cutoffIso("08MAY97")).toBe("1997-05-08");
    expect(cutoffIso("C")).toBeNull();
    expect(cutoffWords("01NOV13")).toBe("November 1, 2013");
    expect(cutoffWords("C")).toBe("Current");
    expect(cutoffWords("U")).toBe("Unavailable");
  });

  it("names the bulletin and what it did to the reader's line", () => {
    expect(msg("01JAN25", "01APR25", "EB2", "worldwide" as never)).toEqual({
      title: "The December 2026 visa bulletin is out",
      body: "EB-2 Rest of World's final action date moved forward to April 1, 2025, from January 1, 2025. Tap to see the line.",
    });
    expect(msg("01NOV13", "01NOV13").body).toBe("EB-2 India's final action date held at November 1, 2013. Tap to see the line.");
    expect(msg("01JUN22", "01JAN22", "EW3", "worldwide" as never).body).toBe(
      "EB-3 Other Workers, Rest of World's final action date moved back to January 1, 2022, from June 1, 2022. Tap to see the line.",
    );
  });

  it("says Current and Unavailable as what they are, never as dates", () => {
    expect(msg("01JAN25", "C").body).toBe("EB-2 India is now Current: open to every priority date. Tap to see the line.");
    expect(msg("C", "01JAN25").body).toBe("EB-2 India's cutoff returned: January 1, 2025, after Current. Tap to see the line.");
    expect(msg("01JAN25", "U").body).toBe("EB-2 India is unavailable this month: no visa numbers. Tap to see the line.");
    expect(msg("U", "01JAN25").body).toBe("EB-2 India reopened at January 1, 2025. Tap to see the line.");
  });
});
