import { describe, expect, it } from "vitest";

import { NEWS_LINES_MAX, newsBody, newsSubject, readNews } from "./newsworthyEmail";

describe("the evening newsworthy email", () => {
  const line =
    'OIRA finished its review of "A PERM rule" on Oct 23, 2026. Its decision: "Consistent with Change". Source: OIRA\'s review lists on reginfo.gov.';

  it("reads the hand-over, dropping anything that isn't a line", () => {
    expect(readNews({ day: "2026-10-27", items: [line, 4, "", null] })).toEqual({ day: "2026-10-27", lines: [line] });
    expect(readNews({ day: "Oct 27", items: [line] })).toBeNull();
    expect(readNews("nope")).toBeNull();
    expect(readNews({ day: "2026-10-27", items: Array.from({ length: 40 }, () => line) })?.lines).toHaveLength(NEWS_LINES_MAX);
  });

  it("says how many things moved, on which day", () => {
    expect(newsSubject({ day: "2026-10-27", lines: [line] })).toBe("Newsworthy, Tue Oct 27: 1 thing moved");
    expect(newsSubject({ day: "2026-10-27", lines: [line, line] })).toBe("Newsworthy, Tue Oct 27: 2 things moved");
  });

  it("lists every line with its source, and nothing else invented", () => {
    const body = newsBody({ day: "2026-10-27", lines: [line] });
    expect(body).toContain(`- ${line}`);
    expect(body).toContain("https://permtracker.app/policy-changes#pipeline");
  });
});
