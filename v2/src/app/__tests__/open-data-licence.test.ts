import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { OPEN_DATA_LICENSE, OPEN_DATA_NC_FROM } from "@/lib/openData";
import { longDate } from "@convex/lib/months";

/**
 * The open data files changed from CC BY 4.0 to CC BY-NC 4.0 (owner's call, Nov 5 2026): news,
 * research and teaching may use them in any publication, other commercial use needs our
 * permission, and copies taken before the change keep the old licence. The Terms bind and the
 * page shows, so both must name the same licence and the same day.
 */
const read = (p: string) => readFileSync(p, "utf8").replace(/\s+/g, " ");
const terms = read("src/app/(site)/(public)/terms/page.tsx");

describe("the open data licence", () => {
  it("is non-commercial, and the Terms say so", () => {
    expect(OPEN_DATA_LICENSE.url).toBe("https://creativecommons.org/licenses/by-nc/4.0/");
    expect(terms).toContain("(CC BY-NC 4.0)");
    expect(terms).toContain("news reporting, research and teaching may use them");
    expect(terms).toContain("requires our written permission");
  });

  it("names the same changeover day in the Terms as the page uses", () => {
    expect(terms).toContain(`Copies obtained before ${longDate(OPEN_DATA_NC_FROM)}`);
  });

  it("never offers the files as free for commercial use any more", () => {
    for (const f of [
      "src/app/(site)/(public)/terms/page.tsx",
      "src/app/(site)/(public)/open-data/page.tsx",
      "src/app/llms.txt/route.ts",
      "src/lib/pageCards.ts",
    ]) {
      expect(read(f), f).not.toMatch(/commercially too/);
    }
  });

  it("forbids building a stand-in for the site from its data", () => {
    expect(terms).toContain("to build a product or service that competes with PERM Tracker or stands in for it");
  });
});
