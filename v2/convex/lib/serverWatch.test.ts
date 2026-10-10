import { describe, expect, it } from "vitest";

import { DISK_PCT, REMIND_MS, STALE_MS, judge, step } from "./serverWatch";

const NOW = 1_791_640_000_000;
const fresh = (diskPct = 34) => ({ computed_at: NOW - 5 * 60 * 1000, json: JSON.stringify({ now: { diskPct } }) });

describe("judge", () => {
  it("a fresh report with room on the disk needs nothing", () => {
    expect(judge(fresh(), NOW)).toBeNull();
  });

  it("a report older than 35 minutes is the server going quiet (Oct 10 2026: it stopped at 5:20 AM)", () => {
    const why = judge({ computed_at: NOW - STALE_MS - 60_000, json: "{}" }, NOW);
    expect(why).toMatch(/36 minutes old/);
  });

  it("libSQL's string integers are read as numbers", () => {
    expect(judge({ computed_at: String(NOW - 60_000), json: "{}" }, NOW)).toBeNull();
  });

  it("a nearly full disk is named even while the report is fresh", () => {
    expect(judge(fresh(DISK_PCT), NOW)).toMatch(/90% full/);
    expect(judge(fresh(DISK_PCT - 1), NOW)).toBeNull();
  });

  it("a database that does not answer is an alarm, never a quiet pass", () => {
    expect(judge(null, NOW, "fetch failed")).toMatch(/did not answer/);
    expect(judge(null, NOW)).toMatch(/never written/);
  });
});

describe("step", () => {
  it("emails when trouble starts, not every 15 minutes, again after 6 hours, and once on recovery", () => {
    let s = step(null, "quiet", NOW);
    expect(s.mail?.kind).toBe("start");
    s = step(s.next, "quiet", NOW + 15 * 60 * 1000);
    expect(s.mail).toBeNull();
    s = step(s.next, "quiet", NOW + REMIND_MS);
    expect(s.mail?.kind).toBe("still");
    s = step(s.next, null, NOW + REMIND_MS + 15 * 60 * 1000);
    expect(s.mail).toEqual({ kind: "clear", reason: "quiet" });
    expect(step(s.next, null, NOW + REMIND_MS + 30 * 60 * 1000).mail).toBeNull();
  });
});
