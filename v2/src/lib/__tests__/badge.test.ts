import { describe, expect, it } from "vitest";

import {
  BADGE_KINDS,
  BADGE_MEANING,
  badgeSpec,
  renderBadgeSvg,
  renderUnavailableSvg,
  shortMonth,
  type BadgeInputs,
} from "../badge";

/** DOL's figures on 2026-08-31, the shape the ingest actually produces. */
const inputs: BadgeInputs = {
  permQueueMonths: { analyst: "2025-11", audit: "2025-12", recon: "2026-04" },
  analystReviewDays: 336.4,
  pwdMonths: { "perm-oews": "2026-05", "perm-survey": "2026-05", h1b: "2026-05", h2b: "2026-07", cw1: "2026-05" },
  asOf: "2026-09-05",
};

describe("badges", () => {
  it("formats a queue month short and refuses anything else", () => {
    expect(shortMonth("2025-11")).toBe("Nov 2025");
    expect(shortMonth("2025-13")).toBeNull();
    expect(shortMonth(null)).toBeNull();
    expect(shortMonth("November 2025")).toBeNull();
  });

  it("builds a spec for every kind from DOL's figures", () => {
    for (const kind of BADGE_KINDS) {
      expect(badgeSpec(kind, inputs), `no spec for ${kind}`).not.toBeNull();
    }
    expect(badgeSpec("perm-queue", inputs)?.value).toBe("at Nov 2025");
    expect(badgeSpec("perm-audits", inputs)?.value).toBe("at Dec 2025");
    expect(badgeSpec("perm-recon", inputs)?.value).toBe("at Apr 2026");
    expect(badgeSpec("perm-days", inputs)?.value).toBe("336 days avg");
    expect(badgeSpec("pwd-h2b", inputs)?.value).toBe("at Jul 2026");
    expect(badgeSpec("pwd-queue", inputs)?.alt).toContain("DOL 2026-09-05");
  });

  it("returns nothing rather than a stale number when DOL printed no figure", () => {
    // DOL prints "--" for a queue with no determinations that month. An embed
    // that quietly kept showing the last real value would be wrong on exactly
    // the days it mattered, so every kind must degrade to null on its own.
    const empty: BadgeInputs = { permQueueMonths: {}, analystReviewDays: null, pwdMonths: {}, asOf: null };
    for (const kind of BADGE_KINDS) {
      expect(badgeSpec(kind, empty), `${kind} invented a figure from nothing`).toBeNull();
    }
    expect(badgeSpec("perm-days", { ...inputs, analystReviewDays: null })).toBeNull();
    expect(badgeSpec("perm-audits", { ...inputs, permQueueMonths: { ...inputs.permQueueMonths, audit: null } })).toBeNull();
  });

  it("never renames a badge somebody has already embedded", () => {
    // These ids are pasted into READMEs and forum signatures as
    // permtracker.app/badge/<id>.svg. Renaming one breaks an image on a page
    // this project does not control and cannot fix. New kinds get new ids.
    for (const frozen of ["perm-queue", "perm-days", "pwd-queue"]) {
      expect(BADGE_KINDS as readonly string[], `${frozen} is embedded elsewhere and cannot be renamed`).toContain(frozen);
    }
  });

  it("explains every badge on the catalogue page", () => {
    for (const kind of BADGE_KINDS) {
      expect(BADGE_MEANING[kind]?.length ?? 0, `${kind} has no description`).toBeGreaterThan(30);
    }
  });

  it("renders well-formed SVG with the text escaped", () => {
    const svg = renderBadgeSvg({ kind: "perm-queue", label: "A & B", value: "<x>", href: "/", alt: "q \"a\"" });
    expect(svg.startsWith("<svg xmlns=")).toBe(true);
    expect(svg).toContain("A &amp; B");
    expect(svg).toContain("&lt;x&gt;");
    expect(svg).toContain("aria-label=\"q &quot;a&quot;\"");
    expect(svg).not.toContain("<x>");
    const w = Number(/width="(\d+)"/.exec(svg)?.[1]);
    expect(w).toBeGreaterThan(40);
  });

  it("has an unavailable badge that names no figure", () => {
    const svg = renderUnavailableSvg("perm-days");
    expect(svg).toContain("no figure today");
    expect(svg).not.toMatch(/\d{4}-\d{2}/);
  });
});
