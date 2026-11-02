import { describe, expect, it } from "vitest";

import { nextSteps } from "@convex/lib/mailPages";

/** The rating page's "What comes next" follows the case's own program, not only its status (Nov 2 2026). */
describe("the rating page's next steps", () => {
  it("sends a certified PERM case on to the green card steps", () => {
    const labels = nextSteps("CERTIFIED", "G-100-26015-561865").map((l) => l.label).join(" | ");
    expect(labels).toMatch(/steps after PERM/);
  });

  it("sends a certified LCA on to the H-1B petition, never to PERM's steps", () => {
    const links = nextSteps("CERTIFIED", "I-200-26294-315050");
    const labels = links.map((l) => l.label).join(" | ");
    expect(labels).toMatch(/USCIS receipt number/);
    expect(labels).not.toMatch(/PERM|green card line/i);
  });

  it("gives a withdrawn case nothing to add, whatever its program", () => {
    expect(nextSteps("WITHDRAWN", "I-200-26294-315050")).toEqual([]);
    expect(nextSteps("WITHDRAWN", "G-100-26015-561865")).toEqual([]);
  });
});
