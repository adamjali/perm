import { existsSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { CORRECTIONS, correctionsSorted } from "../corrections";

const PUBLIC = join(process.cwd(), "src/app/(site)/(public)");

describe("corrections log", () => {
  it("dates every entry and fills every field", () => {
    for (const c of CORRECTIONS) {
      expect(c.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      for (const k of ["where", "said", "truth", "fix"] as const) expect(c[k].length, `${c.date} ${k}`).toBeGreaterThanOrEqual(12);
    }
  });

  it("links only to pages that exist", () => {
    for (const c of CORRECTIONS) {
      if (!c.href) continue;
      const path = c.href === "/" ? "" : c.href.slice(1);
      expect(existsSync(join(PUBLIC, path, "page.tsx")), `${c.date} -> ${c.href}`).toBe(true);
    }
  });

  it("sorts newest first", () => {
    const dates = correctionsSorted().map((c) => c.date);
    expect(dates).toEqual([...dates].sort().reverse());
  });
});
