import { describe, expect, it } from "vitest";

import { yearOnYear } from "@/lib/yearOnYear";

describe("yearOnYear", () => {
  it("names the earlier year, calls volume information, and says nothing on a tiny base", () => {
    expect(yearOnYear(108, 100, 2024)).toEqual({ text: "Up 8% on FY2024", dir: "up", tone: "info" });
    expect(yearOnYear(80, 100, 2024)).toEqual({ text: "Down 20% on FY2024", dir: "down", tone: "info" });
    expect(yearOnYear(103, 100, 2024)?.dir).toBe("level");
    expect(yearOnYear(50, 10, 2024)).toBeUndefined();
    expect(yearOnYear(50, undefined, 2024)).toBeUndefined();
  });
});
