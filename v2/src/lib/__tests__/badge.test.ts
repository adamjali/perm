import { describe, expect, it } from "vitest";

import {
  BADGE_DEFS,
  BADGE_KINDS,
  BADGE_STYLES,
  BADGE_THEMES,
  badgeDef,
  badgeSpec,
  groupDigits,
  shortMonth,
  type BadgeData,
} from "../badge";
import { renderBadge, renderUnavailable } from "../badgeRender";

/** The real shape the assembler produces, with 2026-08-31's figures. */
const data: BadgeData = {
  permQueueMonths: { analyst: "2025-11", audit: "2025-12", recon: "2026-04" },
  analystReviewDays: 336.4,
  pwdMonths: { "perm-oews": "2026-05", "perm-survey": "2026-05", h1b: "2026-05", h2b: "2026-07", cw1: "2026-05" },
  dolAsOf: "2026-08-31",
  counts: {
    "perm-decisions": { value: 373939, asOf: "2026-06-30" },
    "perm-pending": { value: 95432, asOf: "2026-09-08" },
    "pwd-determinations": { value: 634638, asOf: "2026-06-30" },
    "lca-decisions": { value: 437496, asOf: "2026-06-30" },
    "bulletins-held": { value: 96, asOf: "2026-09" },
  },
  stages: {
    "ANALYST REVIEW": { cases: 90150, seenTo: "2026-09-08" },
    "RFI ISSUED": { cases: 999, seenTo: "2026-09-08" },
    "APPLICATION ON HOLD": { cases: 1854, seenTo: "2026-09-08" },
    "RECONSIDERATION APPEALS": { cases: 2362, seenTo: "2026-09-08" },
    "BALCA APPEALS": { cases: 369, seenTo: "2026-09-08" },
    "NORD ISSUED": { cases: 127, seenTo: "2026-09-08" },
  },
  stagesTotal: 95861,
  bulletin: {
    "EB2:india": { cutoff: "Jan 1, 2013", month: "2026-09", series: [0, 0.3, 0.7, 1] },
    "EB1:worldwide": { cutoff: "Current", month: "2026-09", series: [] },
    "EB3:china": { cutoff: "Unavailable", month: "2026-09", series: [] },
  },
};

/** Nothing published for anything. */
const empty: BadgeData = {
  permQueueMonths: {}, analystReviewDays: null, pwdMonths: {}, dolAsOf: null,
  counts: {}, stages: {}, stagesTotal: null, bulletin: {},
};

describe("badges", () => {
  it("formats a queue month short and refuses anything else", () => {
    expect(shortMonth("2025-11")).toBe("Nov 2025");
    expect(shortMonth("2025-13")).toBeNull();
    expect(shortMonth(null)).toBeNull();
    expect(shortMonth("November 2025")).toBeNull();
    expect(groupDigits(373939)).toBe("373,939");
  });

  it("offers a lot of badges across every group", () => {
    expect(BADGE_KINDS.length).toBeGreaterThanOrEqual(30);
    const groups = new Set(BADGE_DEFS.map((d) => d.group));
    expect([...groups].sort()).toEqual(["DOL queues", "The record", "Visa bulletin", "Where cases sit"]);
    // Ids are addressable URLs, so they must be unique and URL-clean.
    expect(new Set(BADGE_KINDS).size).toBe(BADGE_KINDS.length);
    for (const id of BADGE_KINDS) expect(id, `${id} is not URL-safe`).toMatch(/^[a-z0-9-]+$/);
  });

  it("never renames a badge somebody has already embedded", () => {
    // These are pasted into READMEs as permtracker.app/badge/<id>.svg.
    // Renaming one breaks an image on a page this project cannot fix.
    for (const frozen of ["perm-queue", "perm-days", "pwd-queue"]) {
      expect(BADGE_KINDS, `${frozen} is embedded elsewhere and cannot be renamed`).toContain(frozen);
    }
  });

  it("builds a spec from real figures", () => {
    expect(badgeSpec("perm-queue", data)?.value).toBe("at Nov 2025");
    expect(badgeSpec("perm-audits", data)?.value).toBe("at Dec 2025");
    expect(badgeSpec("perm-days", data)?.value).toBe("336 days avg");
    expect(badgeSpec("pwd-h2b", data)?.value).toBe("at Jul 2026");
    expect(badgeSpec("perm-decisions", data)?.value).toBe("373,939");
    expect(badgeSpec("stage-rfi", data)?.value).toBe("999");
    expect(badgeSpec("bulletin-eb2-india", data)?.value).toBe("Jan 1, 2013");
    // The date and the publisher are part of the claim, not decoration.
    expect(badgeSpec("perm-queue", data)?.alt).toContain("2026-08-31");
    expect(badgeSpec("bulletin-eb2-india", data)?.source).toContain("State");
  });

  it("gives a stage its share of everything pending", () => {
    const spec = badgeSpec("stage-analyst", data);
    expect(spec?.fraction).toBeCloseTo(90150 / 95861, 5);
  });

  it("returns nothing rather than a stale number when nothing was published", () => {
    for (const kind of BADGE_KINDS) {
      expect(badgeSpec(kind, empty), `${kind} invented a figure from nothing`).toBeNull();
    }
  });

  it("refuses a kind it does not have", () => {
    expect(badgeDef("not-a-badge")).toBeNull();
    expect(badgeSpec("not-a-badge", data)).toBeNull();
  });

  it("renders every kind in every shape it offers, in both themes", () => {
    for (const def of BADGE_DEFS) {
      const spec = badgeSpec(def.id, data);
      if (!spec) continue;
      for (const style of def.styles) {
        for (const theme of BADGE_THEMES) {
          const svg = renderBadge(spec, style, theme);
          expect(svg.startsWith("<svg xmlns="), `${def.id} ${style} ${theme}`).toBe(true);
          expect(svg.endsWith("</svg>"), `${def.id} ${style} ${theme}`).toBe(true);
          // Served cross-origin and rendered inside other people's sanitisers,
          // so no script, no style, no external reference may ever appear.
          expect(svg, `${def.id} ${style} ${theme}`).not.toMatch(/<script|<style|foreignObject|xlink:href|<image/i);
          expect(svg).toContain("role=\"img\"");
          expect(svg).toContain("<title>");
        }
      }
    }
  });

  it("escapes anything it draws", () => {
    const spec = { kind: "x", label: "A & B", value: "<x>", href: "/", alt: 'q "a"', asOf: null, source: "S" };
    for (const style of BADGE_STYLES) {
      const svg = renderBadge(spec, style, "dark");
      expect(svg).toContain("A &amp; B");
      expect(svg).not.toContain("<x>");
      expect(svg).toContain("aria-label=\"q &quot;a&quot;\"");
    }
  });

  it("has an unavailable badge that names no figure", () => {
    for (const style of BADGE_STYLES) {
      const svg = renderUnavailable("perm-days", style, "light");
      expect(svg).toContain("no figure today");
      expect(svg).not.toMatch(/\d{4}-\d{2}-\d{2}/);
    }
  });
});
