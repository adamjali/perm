import { describe, expect, it } from "vitest";

import { STAGE_NAMES, detailName, isArticlePath } from "@/lib/breadcrumbNames";
import { breadcrumbTrail, trailEndsAtPage, trailNamesPage } from "@/lib/breadcrumbs";
import { LINE_CATEGORY_SHORT, LINE_COUNTRY_SHORT, LINE_PAGE_COUNTRIES, lineSlugs, parseLineSlug } from "@/lib/bulletinLines";
import { stateSlug } from "@/lib/h1bRanks";
import { US_STATE_NAMES } from "@/lib/usStateNames";
import { reviewStages, stageMeta } from "@/components/rfi/stageMeta";

describe("the names a detail page's trail ends on", () => {
  it("names every state page the H-1B ranking builds", () => {
    for (const [code, name] of Object.entries(US_STATE_NAMES)) {
      expect(detailName(`/h1b-employers/${stateSlug(code)}`)).toBe(name);
    }
  });

  it("names every bulletin line page, as the line page's own short names", () => {
    const all = lineSlugs(Object.keys(LINE_CATEGORY_SHORT));
    expect(all.length).toBeGreaterThan(30);
    for (const slug of all) {
      const line = parseLineSlug(slug)!;
      expect(detailName(`/visa-bulletin/categories/${slug}`)).toBe(
        `${LINE_CATEGORY_SHORT[line.category]}, ${LINE_COUNTRY_SHORT[line.country]}`,
      );
    }
    expect(LINE_PAGE_COUNTRIES.length).toBe(5);
  });

  it("names every review stage page with the stage page's own label", () => {
    const stages = reviewStages();
    expect(stages.length).toBeGreaterThan(5);
    for (const { status, slug } of stages) {
      expect(STAGE_NAMES[slug]).toBe(stageMeta(status).label);
    }
    expect(Object.keys(STAGE_NAMES).sort()).toEqual(stages.map((s) => s.slug).sort());
  });

  it("returns nothing for a slug it can't name, so the trail stops at the list", () => {
    expect(detailName("/h1b-employers/atlantis")).toBeNull();
    expect(detailName("/perm-employers/adobe-inc")).toBeNull();
    expect(breadcrumbTrail("/perm-employers/adobe-inc").at(-1)?.href).toBe("/perm-employers");
  });

  it("ends the visible trail on a named detail page, while the page keeps emitting its own list", () => {
    expect(breadcrumbTrail("/h1b-employers/texas").map((c) => c.name)).toEqual(["Home", "Data", "Top H-1B employers", "Texas"]);
    expect(trailEndsAtPage("/h1b-employers/texas")).toBe(true);
    expect(trailNamesPage("/h1b-employers/texas")).toBe(false);
    expect(trailNamesPage("/perm-queue")).toBe(true);
  });

  it("gives the two processing-times pages different names", () => {
    const perm = breadcrumbTrail("/perm-processing-times").at(-1)?.name;
    const uscis = breadcrumbTrail("/uscis-processing-times").at(-1)?.name;
    expect(perm).not.toBe(uscis);
  });

  it("recognises article paths, and only those", () => {
    expect(isArticlePath("/guides/check-perm-case-status")).toBe(true);
    expect(isArticlePath("/blog/x")).toBe(true);
    expect(isArticlePath("/changelog/corrections")).toBe(true);
    expect(isArticlePath("/guides")).toBe(false);
    expect(isArticlePath("/perm-employers/adobe-inc")).toBe(false);
  });
});
