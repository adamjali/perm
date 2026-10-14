import { describe, expect, it } from "vitest";

import { cn } from "@/lib/utils";

/**
 * The class merger knows the site's own names. Taught nothing, it read
 * `shadow-press` as a shadow colour, so a caller's `shadow-none` left the
 * press edge in place.
 */
describe("cn", () => {
  it("lets a later text colour replace an earlier one, the three text levels included", () => {
    expect(cn("text-muted-foreground", "text-soft")).toBe("text-soft");
    expect(cn("text-sm text-soft", "text-lg")).toBe("text-soft text-lg");
  });

  it("lets shadow-none take off the press edge and the overlay shadow", () => {
    expect(cn("shadow-press", "shadow-none")).toBe("shadow-none");
    expect(cn("shadow-overlay", "shadow-none")).toBe("shadow-none");
  });

  it("lets the tint replace a surface", () => {
    expect(cn("bg-card", "bg-tint")).toBe("bg-tint");
  });
});
