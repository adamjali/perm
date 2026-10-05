import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

// A source line can be a bare web address with no spaces. Unwrapped, State's
// 56-character first segment pushed two pages 75px sideways at 320 wide.
describe("DataProvenance", () => {
  it("lets a source line break anywhere", () => {
    const src = readFileSync(join(process.cwd(), "src/components/data/DataProvenance.tsx"), "utf8");
    expect(src).toContain("[overflow-wrap:anywhere]");
  });
});
