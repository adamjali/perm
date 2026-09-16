import { describe, expect, it } from "vitest";

import { newsletterHealth } from "../newsletterSummary";

const DAY = 24 * 60 * 60 * 1000;
const now = Date.parse("2026-09-16T17:00:00Z");

describe("newsletterHealth", () => {
  it("says plainly that the flag is off, with the preview count, and does not warn", () => {
    expect(newsletterHealth({ enabled: false, latestBuiltAt: now - 20 * DAY, previewCount: 1, now })).toEqual({
      level: "off",
      message: "flag off, 1 preview issue",
    });
    expect(newsletterHealth({ enabled: false, latestBuiltAt: null, previewCount: 3, now }).message).toBe(
      "flag off, 3 preview issues",
    );
  });

  it("is ok while the newest issue is within 8 days and the flag is on", () => {
    const r = newsletterHealth({ enabled: true, latestBuiltAt: now - 7 * DAY, previewCount: 0, now });
    expect(r.level).toBe("ok");
    expect(r.message).toContain("7 days ago");
  });

  it("warns when the flag is on and the newest issue is older than 8 days", () => {
    const r = newsletterHealth({ enabled: true, latestBuiltAt: now - 9 * DAY, previewCount: 0, now });
    expect(r.level).toBe("warn");
    expect(r.message).toContain("9 days");
  });

  it("warns when the flag is on and nothing has ever been built", () => {
    const r = newsletterHealth({ enabled: true, latestBuiltAt: null, previewCount: 0, now });
    expect(r.level).toBe("warn");
    expect(r.message).toContain("no issue");
  });

  it("holds the boundary at exactly 8 days", () => {
    expect(newsletterHealth({ enabled: true, latestBuiltAt: now - 8 * DAY, previewCount: 0, now }).level).toBe("ok");
    expect(newsletterHealth({ enabled: true, latestBuiltAt: now - 8 * DAY - 1, previewCount: 0, now }).level).toBe("warn");
  });
});
