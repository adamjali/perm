import { describe, expect, it } from "vitest";

import { RIVALS } from "../rivals";
import { CHECKED_ON, PERM_TRACKER, ROWS } from "../trackers";

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

  it("dates every site to the day the page names", () => {
    for (const t of [PERM_TRACKER, ...RIVALS]) expect(t.checkedOn).toBe(CHECKED_ON);
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
      expect(t.newestData.day <= CHECKED_ON, t.slug).toBe(true);
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
