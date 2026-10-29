import { describe, expect, it } from "vitest";

import { RIVALS } from "../rivals";
import { checkedPhrase, GROUPS, PERM_TRACKER, ROWS } from "../trackers";

/**
 * The comparison names other sites, so every mark on one of them has to be
 * something a reader can check: where it was read, in its own words or with
 * what was looked at, on the day the page says.
 */

const words = (s: string) => s.trim().split(/\s+/).length;

describe("the PERM tracker comparison", () => {
  it("fills every question for every site", () => {
    for (const t of [PERM_TRACKER, ...RIVALS]) {
      for (const r of ROWS) expect(t.cells[r.key], `${t.slug} ${r.key}`).toBeDefined();
    }
  });

  it("dates every site to a real day, which the page names", () => {
    const phrase = checkedPhrase(RIVALS.map((t) => t.checkedOn));
    for (const t of [PERM_TRACKER, ...RIVALS]) {
      expect(t.checkedOn, t.slug).toMatch(/^2\d{3}-\d{2}-\d{2}$/);
      expect(Number.isNaN(Date.parse(`${t.checkedOn}T12:00:00Z`)), t.slug).toBe(false);
    }
    for (const day of new Set(RIVALS.map((t) => t.checkedOn))) {
      expect(phrase, day).toContain(String(Number(day.slice(8, 10))));
    }
  });

  it("words the reading days plainly", () => {
    expect(checkedPhrase(["2026-10-27"])).toBe("October 27, 2026");
    expect(checkedPhrase(["2026-10-28", "2026-10-27", "2026-10-27"])).toBe("October 27 and 28, 2026");
    expect(checkedPhrase(["2026-10-27", "2026-10-28", "2026-10-30"])).toBe("October 27, 28 and 30, 2026");
    expect(checkedPhrase(["2026-10-31", "2026-11-02"])).toBe("October 31, 2026 and November 2, 2026");
  });

  it("puts every site in one of the page's lists, this one among the PERM trackers", () => {
    const keys = GROUPS.map((g) => g.key) as string[];
    for (const t of [PERM_TRACKER, ...RIVALS]) expect(keys, t.slug).toContain(t.group);
    expect(PERM_TRACKER.group).toBe("perm");
    // A list's columns sit together, so the grid's header over each list is one span.
    const order = RIVALS.map((t) => t.group);
    expect(order.filter((g, i) => i > 0 && g !== order[i - 1]).length, order.join(",")).toBeLessThan(GROUPS.length);
  });

  it("names each site once", () => {
    const slugs = [PERM_TRACKER, ...RIVALS].map((t) => t.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("rests every mark on a rival on a page, with its words or what was checked", () => {
    for (const t of RIVALS) {
      for (const r of ROWS) {
        const c = t.cells[r.key];
        if (c.mark === "unknown") continue;
        expect(c.evidence?.url, `${t.slug} ${r.key}`).toMatch(/^https:\/\//);
        expect(Boolean(c.evidence?.quote || c.note), `${t.slug} ${r.key}: a quote or a note`).toBe(true);
        if (c.mark === "no" && !c.evidence?.quote) expect(c.note, `${t.slug} ${r.key}: what was checked`).toBeTruthy();
      }
    }
  });

  it("keeps every quote short, and never a link to our own site", () => {
    for (const t of RIVALS) {
      for (const r of ROWS) {
        const q = t.cells[r.key].evidence?.quote;
        if (q) expect(words(q), `${t.slug} ${r.key}`).toBeLessThanOrEqual(25);
        expect(t.cells[r.key].evidence?.url ?? "").not.toMatch(/permtracker\.app/);
      }
    }
  });

  it("dates each rival's newest data from its own stamp", () => {
    for (const t of RIVALS) {
      if (!t.newestData.day) continue;
      expect(t.newestData.day <= t.checkedOn, t.slug).toBe(true);
      expect(t.newestData.evidence?.quote, t.slug).toBeTruthy();
    }
  });

  it("claims nothing for this site it can't link", () => {
    for (const r of ROWS) {
      const c = PERM_TRACKER.cells[r.key];
      expect(c.mark, r.key).not.toBe("unknown");
    }
  });
});
