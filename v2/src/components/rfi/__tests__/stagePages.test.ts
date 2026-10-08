import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { hasStagePage, reviewStages, stageSlug } from "../stageMeta";

/**
 * A stage link goes only to a stage page that exists. A status stageMeta
 * doesn't know falls back to the "review" group, and the employer census
 * linked two such statuses to pages never built: every prefetch answered 404
 * and logged NoFallbackError, about 990 a day (Oct 8 2026).
 */
describe("stage page links", () => {
  it("knows which statuses have a page", () => {
    expect(hasStagePage("RFI ISSUED")).toBe(true);
    expect(hasStagePage("BALCA APPEALS")).toBe(true);
    expect(hasStagePage("RECONSIDERATION APPEALS - RFI ISSUED")).toBe(false);
    expect(hasStagePage("DENIED - BALCA AFFIRMED")).toBe(false);
    expect(hasStagePage("ANALYST REVIEW")).toBe(false);
    for (const s of reviewStages()) expect(hasStagePage(s.status), s.status).toBe(true);
  });

  it("no page builds a stage link without checking the page exists", () => {
    // Every file that writes `/perm-rfi-audit/${...}` must guard it with
    // hasStagePage or stageFromSlug in the same file (the stage page itself
    // links only its own route list).
    const root = path.resolve(__dirname, "../../..");
    const files = [
      "app/(site)/(public)/perm-employers/under-review/page.tsx",
      "app/(site)/(public)/perm-case-statuses/page.tsx",
      "components/rfi/StageCensus.tsx",
      "components/rfi/StageGlossary.tsx",
    ];
    for (const f of files) {
      const src = readFileSync(path.join(root, f), "utf8");
      expect(src, f).toContain("/perm-rfi-audit/${");
      expect(/hasStagePage\(|stageFromSlug\(/.test(src), `${f} links a stage without checking its page`).toBe(true);
    }
    expect(stageSlug("DENIED - BALCA AFFIRMED")).toBe("denied-balca-affirmed");
  });
});
