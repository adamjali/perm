import { describe, expect, it } from "vitest";

import { FLAG_NOTICE_MAX_AGE_MS, liveFlagNotice } from "../flagNotice";

const NOW = Date.parse("2026-10-27T21:10:00Z");
const doc = { active: true, heading: "Scheduled Maintenance", body: "Starting on Tuesday, October 27, 2026 at 7:00 PM Eastern Time, ...", firstSeenAt: NOW - 600_000, checkedAt: NOW - 300_000 };

describe("DOL's FLAG notice", () => {
  it("shows a current notice as DOL wrote it", () => {
    expect(liveFlagNotice(doc, NOW)).toMatchObject({ heading: "Scheduled Maintenance", checkedAt: doc.checkedAt });
  });
  it("shows nothing when no notice is up", () => {
    expect(liveFlagNotice({ ...doc, active: false }, NOW)).toBeNull();
  });
  it("drops a reading too old to trust, so a stopped job can't keep a banner up", () => {
    expect(liveFlagNotice({ ...doc, checkedAt: NOW - FLAG_NOTICE_MAX_AGE_MS - 1 }, NOW)).toBeNull();
  });
  it("shows nothing for an unreadable or empty document", () => {
    expect(liveFlagNotice(null, NOW)).toBeNull();
    expect(liveFlagNotice("x", NOW)).toBeNull();
    expect(liveFlagNotice({ ...doc, heading: "", body: "" }, NOW)).toBeNull();
  });
});
