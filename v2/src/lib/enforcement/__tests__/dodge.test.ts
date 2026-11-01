import { describe, expect, it } from "vitest";

import { dodge, reach } from "../dodge";

describe("dodge", () => {
  it("leaves squares with room between them on the line", () => {
    const o = dodge([{ id: "a", x: 10, size: 20 }, { id: "b", x: 40, size: 20 }]);
    expect([o.get("a"), o.get("b")]).toEqual([0, 0]);
  });

  it("pulls two squares six days apart above and below the line (Cloudera and Instacart)", () => {
    const o = dodge([{ id: "instacart", x: 93.2, size: 44 }, { id: "cloudera", x: 92.1, size: 30 }]);
    expect(o.get("cloudera")).toBeLessThan(0);
    expect(o.get("instacart")).toBeGreaterThan(0);
    // Apart: the upper square's bottom is above the lower square's top.
    expect(o.get("cloudera")! + 15).toBeLessThan(o.get("instacart")! - 22);
  });

  it("separates two squares on the same day, so neither hides the other", () => {
    const o = dodge([{ id: "nitya", x: 40, size: 18 }, { id: "intellicept", x: 40, size: 14 }]);
    expect(o.get("nitya")).not.toBe(o.get("intellicept"));
  });

  it("steps three close squares down from the top", () => {
    const o = dodge([{ id: "a", x: 50, size: 20 }, { id: "b", x: 50.5, size: 20 }, { id: "c", x: 51, size: 20 }]);
    expect([o.get("a"), o.get("b"), o.get("c")]).toEqual([-24, 0, 24]);
    expect(reach([{ id: "a", x: 50, size: 20 }, { id: "c", x: 51, size: 20 }], o)).toBe(34);
  });
});
