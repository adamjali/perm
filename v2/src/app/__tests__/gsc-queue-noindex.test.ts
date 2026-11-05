import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// @ts-expect-error a plain .mjs script module with no type declarations
import { alwaysNoindex, inFamily } from "../../../scripts/lib_page_inputs.mjs";

/**
 * scripts/gsc_queue.mjs leaves a noindex page out of the Search Console queue and the
 * IndexNow list. Until Nov 5 2026 it called any page whose source named
 * `robots: { index: false }` noindex, conditions included, so /perm-queue and every
 * month page (indexable while MIRROR_COMPLETE is on) were dropped from IndexNow and
 * listed as "not requested". These hold the rule to pages that are noindex on every render.
 */
const read = (p: string) => readFileSync(p, "utf8");

describe("which pages are noindex for the queue", () => {
  it("counts a plain robots noindex", () => {
    expect(alwaysNoindex(`export const metadata = {\n  robots: { index: false, follow: true },\n};`)).toBe(true);
  });

  it("doesn't count one inside a condition", () => {
    expect(alwaysNoindex(`    ...(MIRROR_COMPLETE ? {} : { robots: { index: false, follow: true } }),`)).toBe(false);
    expect(alwaysNoindex(`    ...(hasReceipt ? { robots: { index: false, follow: true } } : {}),`)).toBe(false);
    expect(alwaysNoindex(`  robots: { index: true },`)).toBe(false);
  });

  it("reads the real pages the way they render", () => {
    expect(alwaysNoindex(read("src/app/(site)/(public)/perm-queue/page.tsx"))).toBe(false);
    expect(alwaysNoindex(read("src/app/(site)/(public)/perm-queue/[month]/page.tsx"))).toBe(false);
    expect(alwaysNoindex(read("src/app/(site)/(public)/uscis-case-status/page.tsx"))).toBe(false);
    expect(alwaysNoindex(read("src/app/(site)/(public)/perm-employers/compare/page.tsx"))).toBe(true);
    expect(alwaysNoindex(read("src/app/(site)/(public)/perm-queue/[month]/[day]/page.tsx"))).toBe(true);
  });
});

describe("a page's family", () => {
  it("matches the family's segments, a [param] for one segment", () => {
    expect(inFamily("/perm-queue/2026-01", "/perm-queue/[month]")).toBe(true);
    expect(inFamily("/perm-queue/2026-01", "/perm-queue/[month]/[day]")).toBe(false);
    expect(inFamily("/perm-queue/2026-01/04", "/perm-queue/[month]/[day]")).toBe(true);
    expect(inFamily("/perm-queue", "/perm-queue/[month]")).toBe(false);
    expect(inFamily("/perm-employers/google-llc", "/perm-employers/compare")).toBe(false);
  });
});
