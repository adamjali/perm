import { describe, expect, it } from "vitest";

import { BADGE_KINDS, badgeSpec, renderBadgeSvg, renderUnavailableSvg, shortMonth } from "../badge";

const inputs = { analystReviewMonth: "2025-11", analystReviewDays: 336.4, pwdOewsMonth: "2026-03", asOf: "2026-09-05" };

describe("badges", () => {
  it("formats a queue month short and refuses anything else", () => {
    expect(shortMonth("2025-11")).toBe("Nov 2025");
    expect(shortMonth("2025-13")).toBeNull();
    expect(shortMonth(null)).toBeNull();
    expect(shortMonth("November 2025")).toBeNull();
  });

  it("builds a spec for every kind from DOL's figures, and none when DOL printed nothing", () => {
    for (const kind of BADGE_KINDS) expect(badgeSpec(kind, inputs)).not.toBeNull();
    expect(badgeSpec("perm-queue", inputs)?.value).toBe("at Nov 2025");
    expect(badgeSpec("perm-days", inputs)?.value).toBe("336 days avg");
    expect(badgeSpec("pwd-queue", inputs)?.alt).toContain("DOL 2026-09-05");
    expect(badgeSpec("perm-queue", { ...inputs, analystReviewMonth: null })).toBeNull();
    expect(badgeSpec("perm-days", { ...inputs, analystReviewDays: null })).toBeNull();
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
