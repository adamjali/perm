import { describe, expect, it } from "vitest";

import { certifiedShare } from "../share";

describe("certifiedShare", () => {
  it("rounds to three decimals", () => {
    expect(certifiedShare(8800, 100)).toBe(0.989);
  });

  it("reaches 1 only when nothing was denied, and 0 only when nothing was certified", () => {
    expect(certifiedShare(2999, 1)).toBe(0.999);
    expect(certifiedShare(3000, 0)).toBe(1);
    expect(certifiedShare(1, 2999)).toBe(0.001);
    expect(certifiedShare(0, 40)).toBe(0);
  });

  it("has no share below the floor", () => {
    expect(certifiedShare(10, 1, 30)).toBeNull();
    expect(certifiedShare(0, 0)).toBeNull();
  });
});
